#!/usr/bin/env node
/* ============================================================
   The component rule, enforced.
   ============================================================
   A prototype may not write raw HTML. Every element has to come from
   @12-apps/ui, and every name has to be one the catalog actually offers.

   This runs against the SOURCE, and it has to: once <Button> renders, MUI
   emits a real <button> into the DOM, so nothing downstream can tell the
   design system's button from one an agent typed. The source can.

   Standalone:  node scripts/lint-prototype.js apps/<name>/app.jsx
   ============================================================ */

const fs = require("fs");
const path = require("path");

const PKG = "@12-apps/ui";

function loadCatalog(repo){
  const src = fs.readFileSync(path.join(repo, "catalog", "ui-catalog.js"), "utf8");
  const m = src.match(/window\.PROTO_UI = ([\s\S]*?);\n/);
  if (!m) throw new Error("catalog/ui-catalog.js has no PROTO_UI map — regenerate it");
  return JSON.parse(m[1]);
}

/* what to reach for instead of a raw tag; anything not here just points at
   the catalog rather than guessing a component that may not exist */
const INSTEAD = {
  button:"Button", input:"Input", select:"Select", textarea:"Textarea", form:"Form",
  a:"Link", img:"Avatar", table:"Table", ul:"List", ol:"List", li:"ListItem",
  h1:"Heading", h2:"Heading", h3:"Heading", h4:"Heading", h5:"Heading", h6:"Heading",
  p:"Paragraph", span:"Text", strong:"Text", em:"Text", small:"Text", label:"Label",
  div:"Box", section:"Box", article:"Box", header:"Box", footer:"Box", main:"Box",
  nav:"Box", aside:"Box", pre:"Code", code:"Code", hr:"Divider", dialog:"Dialog"
};

function lint(file, catalog){
  const babel = require("@babel/parser");
  const src = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = babel.parse(src, { sourceType:"module", plugins:["jsx"], errorRecovery:false });
  } catch (e){
    return [{ line: e.loc ? e.loc.line : 0, kind:"syntax", msg: "could not parse: " + e.message }];
  }

  const problems = [];
  const imported = new Map();      /* local name -> source */

  const walk = (node, fn) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(n => walk(n, fn));
    fn(node);
    for (const k of Object.keys(node)){
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      walk(node[k], fn);
    }
  };

  walk(ast.program, n => {
    if (n.type === "ImportDeclaration"){
      n.specifiers.forEach(sp => {
        if (sp.local) imported.set(sp.local.name, { source: n.source.value, line: n.loc.start.line,
                                                   imported: sp.imported ? sp.imported.name : null });
      });
    }
    if (n.type === "JSXOpeningElement"){
      const nameNode = n.name;
      const line = n.loc.start.line;
      if (nameNode.type === "JSXIdentifier"){
        const nameStr = nameNode.name;
        if (/^[a-z]/.test(nameStr)){
          const hint = INSTEAD[nameStr];
          problems.push({ line, kind:"raw-html",
            msg: `<${nameStr}> is raw HTML. `
               + (hint && catalog[hint] ? `Use <${hint}> from ${catalog[hint]}`
                                        : `Use a component from ${PKG} — see catalog/ui-catalog.md`) });
        }
      }
    }
  });

  /* Components the file defines itself are fine — composing design-system
     parts into a screen is the job. The rule is about raw HTML, not about
     composition. */
  const local = new Set();
  walk(ast.program, n => {
    if (n.type === "FunctionDeclaration" && n.id) local.add(n.id.name);
    if (n.type === "ClassDeclaration" && n.id) local.add(n.id.name);
    if (n.type === "VariableDeclarator" && n.id && n.id.type === "Identifier") local.add(n.id.name);
  });

  /* every component actually used has to come from the design system */
  const used = new Set();
  walk(ast.program, n => {
    if (n.type === "JSXOpeningElement" && n.name.type === "JSXIdentifier" && /^[A-Z]/.test(n.name.name))
      used.add(n.name.name);
  });
  used.forEach(nameStr => {
    if (local.has(nameStr)) return;
    const imp = imported.get(nameStr);
    if (!imp){
      problems.push({ line:0, kind:"unknown-component",
        msg: `<${nameStr}> is used but never imported.` });
      return;
    }
    if (!imp.source.startsWith(PKG)){
      problems.push({ line: imp.line, kind:"foreign-import",
        msg: `<${nameStr}> comes from "${imp.source}". Components must come from ${PKG}.` });
      return;
    }
    const expected = catalog[imp.imported || nameStr];
    if (!expected){
      problems.push({ line: imp.line, kind:"not-in-catalog",
        msg: `${imp.imported || nameStr} is not a component in the catalog — see catalog/ui-catalog.md` });
    } else if (expected !== imp.source){
      problems.push({ line: imp.line, kind:"wrong-path",
        msg: `${imp.imported || nameStr} is imported from "${imp.source}" but lives at "${expected}"` });
    }
  });

  return problems;
}

/* The components a prototype actually imports. The handoff used to carry a
   hand-written selector→component map; with real imports that map is the
   import list, and this is where it comes from. */
function designSystemImports(file){
  const babel = require("@babel/parser");
  const src = fs.readFileSync(file, "utf8");
  let ast;
  try { ast = babel.parse(src, { sourceType:"module", plugins:["jsx"] }); }
  catch { return []; }
  const out = [];
  (ast.program.body || []).forEach(n => {
    if (n.type !== "ImportDeclaration") return;
    if (!String(n.source.value).startsWith(PKG)) return;
    n.specifiers.forEach(sp => {
      if (sp.imported) out.push({ name: sp.imported.name, from: n.source.value });
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { lint, loadCatalog, designSystemImports };

if (require.main === module){
  const file = process.argv[2];
  if (!file){ console.error("usage: node scripts/lint-prototype.js <app.jsx>"); process.exit(3); }
  const repo = path.join(__dirname, "..");
  const problems = lint(file, loadCatalog(repo));
  if (!problems.length){ console.log("✓ " + file + " — every element is a component"); process.exit(0); }
  problems.forEach(p => console.error(`  ${file}:${p.line}  ${p.msg}`));
  console.error(`\n✕ ${problems.length} violation(s) of the component rule.`);
  process.exit(1);
}
