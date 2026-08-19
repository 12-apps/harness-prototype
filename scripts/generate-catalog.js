#!/usr/bin/env node
/* ============================================================
   Regenerates catalog/ from the installed @12-apps/ui.
   ============================================================
   The catalog is what tells a prototype which components exist and where
   they come from, so it has to be read out of the package rather than
   guessed. The previous generator took the last segment of each export
   path as the component name. That is right for ./form/Button and wrong
   for ./charts, ./tokens or ./feedback/Sonner — it invented 24 components
   that do not exist and mis-named 3 that do.

   This one reads the names the built files actually export.

     node scripts/generate-catalog.js                 install, then generate
     node scripts/generate-catalog.js --no-install    use what is installed
     node scripts/generate-catalog.js --version 5.3.0 pin a version

   Install goes through pnpm: the package's own preinstall runs
   `only-allow pnpm`, so npm refuses it unless scripts are skipped.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const valueOf = n => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; };

const repo = path.join(__dirname, "..");
const outDir = path.join(repo, "catalog");
const PKG = "@12-apps/ui";
const wanted = valueOf("--version") || null;

/* ---------- 1. make sure the package is here, and current ---------- */
if (!flag("--no-install")){
  const spec = wanted ? `${PKG}@${wanted}` : PKG;
  console.log(`installing ${spec} with pnpm…`);
  try {
    execFileSync("pnpm", ["add", "-D", spec, "--reporter", "silent"], { cwd: repo, stdio: "inherit" });
  } catch {
    console.error(`✕ pnpm could not install ${spec}.`);
    console.error("  The package's preinstall runs `only-allow pnpm`, so npm is refused.");
    console.error("  Install pnpm, or run with --no-install to use what is already there.");
    process.exit(1);
  }
}

const pkgDir = path.join(repo, "node_modules", PKG);
if (!fs.existsSync(pkgDir)){
  console.error(`✕ ${PKG} is not installed. Run without --no-install, or: pnpm add -D ${PKG}`);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));

/* ---------- 2. what each entry really exports ----------
   The build emits `export { A, B as C };`. Reading that is what keeps the
   catalog honest: a name in here is a name you can actually import. */
function exportedNames(file){
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { return []; }
  const names = new Set();
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)){
    m[1].split(",").forEach(part => {
      const bit = part.trim();
      if (!bit) return;
      const as = bit.split(/\s+as\s+/);
      const nameStr = (as.length > 1 ? as[1] : as[0]).trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(nameStr) && nameStr !== "default") names.add(nameStr);
    });
  }
  if (/export\s+default\s/.test(src)) names.add("default");
  return [...names];
}

/* A component is a capitalised name that is neither a hook nor a constant.
   The distinction matters: a prototype claims components, and offering it
   `useSonner` or `DEFAULT_RAILS` as if they were components is how a wrong
   name gets into the specification. */
const kindOf = n =>
  /^use[A-Z]/.test(n)          ? "hook"
  : /^[A-Z0-9_]+$/.test(n)     ? "constant"
  : /^[A-Z]/.test(n)           ? "component"
  :                              "helper";

const NAMESPACES = /^\.\/(data-display|feedback|form|layout|navigation|typography|utility)\//;
const components = {};      /* name -> { imp, rank } while building */
const hooks = {}, helpers = {}, constants = {};
const empty = [];           /* entries that export nothing importable */

Object.entries(pkg.exports || {}).forEach(([key, val]) => {
  if (key === ".") return;                       /* the barrel is intentionally empty */
  const target = typeof val === "string" ? val : (val && val.default);
  if (!target) return;
  const file = path.join(pkgDir, target.replace(/^\.\//, ""));
  const imp = PKG + key.slice(1);
  const names = exportedNames(file);
  if (!names.length){ empty.push({ key, imp }); return; }
  names.forEach(n => {
    const bucket = { component: components, hook: hooks, helper: helpers, constant: constants }[kindOf(n)];
    /* A name can be offered by more than one entry, and "first one wins" picks
       the wrong one: ./button (turborepo scaffolding, alerts "Hello from your
       app!") sorts before ./form/Button and would shadow the real component.
       The entry whose last segment IS the name is the canonical one. */
    const seg = key.split("/").pop();
    const rank = seg === n ? 3 : NAMESPACES.test(key) ? 2 : 1;
    const held = bucket[n];
    if (!held || rank > held.rank) bucket[n] = { imp, rank };
  });
});

[components, hooks, helpers, constants].forEach(bucket => {
  Object.keys(bucket).forEach(n => { bucket[n] = bucket[n].imp; });
});
const nComp = Object.keys(components).length;

/* ---------- 3. write ---------- */
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "ui-catalog.js"),
  `/* Catalog of ${PKG}@${pkg.version} — generated by scripts/generate-catalog.js.\n`
+ `   ${nComp} components, read from what the built package exports.\n`
+ `   The harness validates the names used in \`primitives\` against this.\n`
+ `   Do not edit by hand. */\n`
+ `window.PROTO_UI = ${JSON.stringify(components, null, 2)};\n\n`
+ `/* Hooks and helpers are importable too, but they are not components and a\n`
+ `   prototype cannot claim markup with them. */\n`
+ `window.PROTO_UI_EXTRA = ${JSON.stringify({ version: pkg.version, hooks, helpers, constants }, null, 2)};\n`);

const byGroup = {};
Object.entries(components).forEach(([n, imp]) => {
  const g = imp.split("/")[2] || "root";
  (byGroup[g] = byGroup[g] || []).push([n, imp]);
});

let md = `# ${PKG}@${pkg.version} — catalog\n\n`
  + `${nComp} components, generated from what the built package exports — not from its\n`
  + `file names. Import by the exact path shown; the root \`${PKG}\` barrel is\n`
  + `intentionally empty, so there is no shorter form.\n`;
Object.keys(byGroup).sort().forEach(g => {
  md += `\n## ${g}\n\n`;
  byGroup[g].sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([n, imp]) => { md += `- \`${n}\` — \`${imp}\`\n`; });
});
if (Object.keys(hooks).length){
  md += `\n## hooks\n\nNot components — a prototype cannot claim markup with these.\n\n`;
  Object.entries(hooks).sort().forEach(([n, imp]) => { md += `- \`${n}\` — \`${imp}\`\n`; });
}
if (empty.length){
  md += `\n## entries that export nothing importable\n\n`;
  empty.forEach(e => { md += `- \`${e.imp}\`\n`; });
}
fs.writeFileSync(path.join(outDir, "ui-catalog.md"), md);

console.log(`catalog generated from ${PKG}@${pkg.version}`);
console.log(`  components ${nComp} · hooks ${Object.keys(hooks).length}`
          + ` · helpers ${Object.keys(helpers).length} · constants ${Object.keys(constants).length}`);
if (empty.length) console.log(`  ${empty.length} export entr${empty.length === 1 ? "y" : "ies"} export nothing importable`);
console.log("note: ui-interactions.* is a curated classification — review it by hand when the lib changes.");
