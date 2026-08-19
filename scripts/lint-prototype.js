#!/usr/bin/env node
/* ============================================================
   The component rule, enforced.
   ============================================================
   A prototype may not write raw HTML. Every element has to come from
   @12-apps/ui, and every name has to be one the catalog actually offers.

   And using the component is not the end of it. A component classified
   `exige` in catalog/ui-interactions.js exists to be operated — a
   CollapsibleTrigger renders a button, a SubmitButton submits. Rendering one
   and giving it nothing to do is a hole in the specification that reads as a
   finished screen. So the chain is checked end to end, in the source:

       <Foo data-act="x">  →  Proto.on(_, '[data-act="x"]')

   both directions. An `exige` component with no hook is an affordance with
   no behaviour; a hook with no handler is a control that does nothing; a
   handler for a hook that appears nowhere is dead code.

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

/* The wiring level per component: `exige` = always operable, `pode` =
   operable if given a handler, `nunca` = inert. Only `exige` is enforced
   here — `pode` depends on what the screen offers, which is the runtime
   audit's job, and `nunca` has nothing to demand. */
function loadWiring(repo){
  const src = fs.readFileSync(path.join(repo, "catalog", "ui-interactions.js"), "utf8");
  const m = src.match(/window\.PROTO_UI_WIRING = ([\s\S]*?);\n/);
  if (!m) throw new Error("catalog/ui-interactions.js has no PROTO_UI_WIRING map");
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

function lint(file, catalog, wiring){
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

  if (wiring) problems.push(...unwired(ast, imported, wiring, walk));

  return problems.sort((a, b) => a.line - b.line);
}

/* ============================================================
   The wiring chain
   ============================================================
   `data-act` / `data-campo` is how a prototype names something operable:
   the harness's steps address it by that name, and Proto.on answers on the
   same selector. So the three links can be checked before anything runs.

   Only string literals count. A hook built at runtime (`data-act={id}`) is
   real but not readable here, and accusing it would be worse than missing
   it — so a file that has one turns off the direction of the check that
   would guess wrong, and says nothing about the rest.
   ============================================================ */
const HOOK_ATTR = /^data-(act|campo)$/;
const HANDLER_PROP = /^on[A-Z]/;

/* every hook on ONE element, including the ones buried in a props object:
   MUI puts the real input behind a slot, so a prototype writes
   slotProps={{ htmlInput: { "data-campo": "preco" } }} and the attribute
   never appears at the top level. */
function hooksOf(el, walk){
  const literal = [];
  let dynamic = false, handler = false, spread = false;
  for (const a of el.attributes || []){
    if (a.type === "JSXSpreadAttribute"){ spread = true; continue; }
    const nameStr = a.name && a.name.name;
    if (typeof nameStr === "string"){
      if (HANDLER_PROP.test(nameStr) || nameStr === "href") handler = true;
      if (HOOK_ATTR.test(nameStr)){
        if (a.value && a.value.type === "StringLiteral") literal.push(a.value.value);
        else dynamic = true;
        continue;
      }
    }
    walk(a, n => {
      if (n.type !== "ObjectProperty") return;
      const k = n.key && (n.key.name || n.key.value);
      if (typeof k !== "string" || !HOOK_ATTR.test(k)) return;
      if (n.value && n.value.type === "StringLiteral") literal.push(n.value.value);
      else dynamic = true;
    });
  }
  return { literal, dynamic, handler, spread };
}

function unwired(ast, imported, wiring, walk){
  const problems = [];
  const elements = [];
  const hooks = new Map();          /* hook name -> first line it appears on */
  let anyDynamic = false;

  walk(ast.program, n => {
    if (n.type !== "JSXOpeningElement" || n.name.type !== "JSXIdentifier") return;
    const h = hooksOf(n, walk);
    h.literal.forEach(v => { if (!hooks.has(v)) hooks.set(v, n.loc.start.line); });
    if (h.dynamic) anyDynamic = true;
    elements.push({ nameStr: n.name.name, line: n.loc.start.line, ...h });
  });

  /* Proto.on("click", "<selector>", …) — the second argument, when literal */
  const handlers = [];
  walk(ast.program, n => {
    if (n.type !== "CallExpression") return;
    const c = n.callee;
    if (!(c.type === "MemberExpression" && c.object.name === "Proto" && c.property.name === "on")) return;
    const sel = n.arguments[1];
    if (sel && sel.type === "StringLiteral") handlers.push({ sel: sel.value, line: n.loc.start.line });
  });
  const answered = v => handlers.some(h => h.sel.includes(`="${v}"`));

  /* 1. an `exige` component with nothing to operate */
  elements.forEach(e => {
    const imp = imported.get(e.nameStr);
    if (!imp || !imp.source.startsWith(PKG)) return;
    const comp = imp.imported || e.nameStr;
    if (wiring[comp] !== "exige") return;
    /* a spread could carry the hook; it cannot be read, so it is not accused */
    if (e.literal.length || e.dynamic || e.handler || e.spread) return;
    problems.push({ line: e.line, kind:"unwired-component",
      msg: `<${e.nameStr}> is "exige" in catalog/ui-interactions.md — it always renders `
         + `something to operate, so a screen that shows one owes a step. Give it `
         + `data-act="…" (or data-campo="…" for a field) and a matching Proto.on, `
         + `or use a component that is not operable.` });
  });

  /* 2. a hook nothing answers: a control that looks live and is not */
  hooks.forEach((line, v) => {
    if (answered(v)) return;
    problems.push({ line, kind:"hook-without-handler",
      msg: `nothing answers "${v}" — add Proto.on(…, '[data-act="${v}"]', …), `
         + `or drop the attribute if there is nothing to do.` });
  });

  /* 3. a handler for a hook that is nowhere on screen. Skipped entirely when
     the file builds any hook at runtime, because then "nowhere" is a guess. */
  if (!anyDynamic){
    handlers.forEach(h => {
      const m = /\[data-(?:act|campo)="([^"]+)"\]/.exec(h.sel);
      if (!m || hooks.has(m[1])) return;
      problems.push({ line: h.line, kind:"handler-without-hook",
        msg: `Proto.on answers "${h.sel}" but no element carries it — dead code, `
           + `or the attribute was renamed on one side only.` });
    });
  }

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

module.exports = { lint, loadCatalog, loadWiring, designSystemImports };

if (require.main === module){
  const file = process.argv[2];
  if (!file){ console.error("usage: node scripts/lint-prototype.js <app.jsx>"); process.exit(3); }
  const repo = path.join(__dirname, "..");
  const problems = lint(file, loadCatalog(repo), loadWiring(repo));
  if (!problems.length){ console.log("✓ " + file + " — every element is a component, and every one that owes a step has one"); process.exit(0); }
  problems.forEach(p => console.error(`  ${file}:${p.line}  ${p.msg}`));
  console.error(`\n✕ ${problems.length} violation(s) of the component rule.`);
  process.exit(1);
}
