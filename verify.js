#!/usr/bin/env node
/* ============================================================
   PROTO · verification gate
   ============================================================
   Runs the prototype's suite OUTSIDE the browser and returns an exit
   code. It exists so that whoever edits the file — human or agent —
   does not ship a screen that is already broken.

     node verify.js product-editor.html
     node verify.js file.html --strict
     node verify.js file.html --export handoff/    write the handoff files

   Exit codes:
     0  passed
     1  there are failures — DO NOT ship, fix them first
     2  passed with warnings, and --strict was on
     3  the file could not be loaded

   The jsdom engine needs jsdom:  npm install jsdom
   ============================================================ */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { pathToFileURL } = require("url");

const args = process.argv.slice(2);
const strict = args.includes("--strict");

/* --export <dir> writes the three handoff files. It runs only when the gate
   passes: handing an implementer a specification that failed its own checks
   is worse than handing them nothing. */
let exportDir = null, exportValueAt = -1;
const eqArg = args.find(a => a.startsWith("--export="));
if (eqArg) exportDir = eqArg.slice("--export=".length) || ".";
else {
  const i = args.indexOf("--export");
  if (i > -1){
    const next = args[i + 1];
    if (next && !next.startsWith("--")){ exportDir = next; exportValueAt = i + 1; }
    else exportDir = ".";
  }
}
const file = args.find((a, i) => !a.startsWith("--") && i !== exportValueAt);

if (!file){
  console.error("usage: node verify.js <apps/<name> | file.html> [--strict] [--export <dir>]");
  process.exit(3);
}
if (!fs.existsSync(file)){
  console.error("not found: " + file);
  process.exit(3);
}

/* A prototype is a folder of sidecars the bench loads by name, so the thing
   under test is proto.html?app=<name> rather than a file of its own. A plain
   .html still works: a self-contained prototype is a legitimate thing to
   check, and that is what the bundle export produces. */
const isApp = fs.statSync(file).isDirectory();
const appName = isApp ? path.basename(path.resolve(file)) : null;
const pageFile = isApp ? path.join(__dirname, "proto.html") : file;
const label = isApp ? appName : path.basename(file);

/* A prototype is React (app.jsx) or vanilla (app.js). React is the one that
   can be held to the component rule, because the rule lives in the source:
   once <Button> renders, MUI emits a real <button> and nothing downstream can
   tell it from one an agent typed. */
const jsxEntry = isApp && fs.existsSync(path.join(file, "app.jsx"));
/* the components the prototype imports; the build fills this and the page
   gets it, so the .feature can list what an implementer actually needs */
let usedComponents = [];

if (isApp){
  const need = ["styles.css", "data.js", jsxEntry ? "app.jsx" : "app.js"];
  for (const f of need){
    if (!fs.existsSync(path.join(file, f))){
      console.error("✕ " + file + " is missing " + f + " — a prototype is all three files.");
      process.exit(3);
    }
  }

  if (jsxEntry){
    /* 1. the component rule, before a browser is even started */
    const { lint, loadCatalog, designSystemImports } = require("./scripts/lint-prototype.js");
    const entry = path.join(file, "app.jsx");
    let problems;
    try { problems = lint(entry, loadCatalog(__dirname)); }
    catch (e){ console.error("✕ could not check the component rule: " + e.message); process.exit(3); }
    if (problems.length){
      problems.forEach(p => console.error(`  ${entry}:${p.line}  ${p.msg}`));
      console.error(`\n✕ DO NOT SHIP. ${problems.length} violation(s) of the component rule — `
                  + `a prototype uses ${"@12-apps/ui"}, never raw HTML.`);
      process.exit(1);
    }

    /* 2. build it, so the bench can load one plain script */
    const outFile = path.join(file, ".build", "app.js");
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    let esbuild;
    try { esbuild = require("esbuild"); }
    catch { console.error("✕ esbuild is not installed. Run: pnpm install"); process.exit(3); }
    const t0 = Date.now();
    const built = esbuild.buildSync({
      entryPoints: [entry], outfile: outFile, bundle: true, format: "iife",
      jsx: "automatic", logLevel: "silent", write: true,
      define: { "process.env.NODE_ENV": '"development"' },
      absWorkingDir: __dirname
    });
    if (built.errors && built.errors.length){
      built.errors.forEach(e => console.error("  " + (e.text || e)));
      console.error("\n✕ the prototype did not build.");
      process.exit(1);
    }
    console.log(`built ${path.relative(__dirname, entry)} in ${Date.now() - t0}ms`);
    usedComponents = designSystemImports(entry);
  }
  if (!fs.existsSync(pageFile)){
    console.error("✕ proto.html not found next to verify.js");
    process.exit(3);
  }
}
const pageUrl = pathToFileURL(path.resolve(pageFile)).href + (isApp ? "?app=" + appName : "");

/* ------------------------------------------------------------------
   The gate's layout engine

   The per-step layout rules and the physical measurements (overflow,
   touch target, text size, line length) need someone to measure boxes.
   jsdom does not measure: it resolves the DOM, not the layout, and a
   container query never matches. So the gate looks for a Chromium;
   finding one, it runs the suite inside it and EVERYTHING applies. Not
   finding one, it falls back to jsdom and the rules that depend on
   measurement declare themselves unverifiable instead of approving in
   the dark.
   ------------------------------------------------------------------ */
function findChromium(){
  const candidates = [
    process.env.PROTO_CHROME,
    "/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    const found = execSync("ls -d /root/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | head -1",
      { encoding:"utf8" }).trim();
    if (found && fs.existsSync(found)) return found;
  } catch {}
  return null;
}

function findPuppeteer(){
  const paths = [
    "puppeteer",
    "/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer"
  ];
  for (const c of paths){ try { return require(c); } catch {} }
  return null;
}

async function runInBrowser(pageUrl, chrome, pptr){
  const b = await pptr.launch({
    headless: "new", executablePath: chrome,
    args:["--no-sandbox","--disable-dev-shm-usage","--font-render-hinting=none"]
  });
  try {
    const pg = await b.newPage();
    await pg.setViewport({ width:1400, height:1000 });
    const errors = [];
    pg.on("pageerror", e => errors.push(String(e.message).split("\n")[0]));
    await pg.evaluateOnNewDocument(list => { window.PROTO_IMPORTS = list; }, usedComponents);
    await pg.goto(pageUrl, { waitUntil:"load" });
    await pg.waitForFunction("window.Proto && typeof window.Proto.verifyAll === 'function'", { timeout:20000 });
    const loadError = await pg.evaluate(() => window.PROTO_LOAD_ERROR || null);
    if (loadError){
      console.error("✕ the app did not load: " + loadError);
      await b.close();
      process.exit(3);
    }
    const r = await pg.evaluate(async (wantArtifacts) => {
      const s = await window.Proto.verifyAll();
      const out = { ok:s.ok, bad:s.bad, warnings:s.warnings || [], infos:s.infos || [],
                    coverage:s.coverage || null, report: s.bad ? window.Proto.report() : "" };
      if (wantArtifacts && !s.bad){
        out.artifacts = { feature: window.Proto.gherkin(),
                          api: window.Proto.apiContract(),
                          html: window.Proto.source() };
      }
      return out;
    }, !!exportDir);
    r.errors = errors;
    return r;
  } finally { await b.close(); }
}

/* One file that opens anywhere: the bench, the catalog and the app's three
   sidecars inlined into a single document. The folder is the working format;
   this is the deliverable, because a folder emailed to someone arrives with
   a file missing sooner or later. */
function bundle(appDir, appName){
  /* A React prototype ships the built bundle, not app.jsx: a browser cannot
     run JSX, and the build already carries React and the components with it. */
  /* inlined script must not carry a sequence that closes its own block —
     the engine builds one deliberately, to inject a marker into the
     verification iframe */
  const read = f => fs.readFileSync(f, "utf8").replace(/<\/(script)/gi, "<\\/$1");
  const here = f => path.join(__dirname, f);
  const app  = f => path.join(appDir, f);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${appName}</title>
<!-- Self-contained prototype: bench, catalog and app in one file.
     Open it in a browser — nothing to install, nothing else to keep
     alongside it. The editable form is the apps/${appName}/ folder. -->
<style data-harness-css>
${read(here("harness.css"))}
</style>
<style>
${read(app("styles.css"))}
</style>
</head>
<body>
<script>window.PROTO_BUNDLED = true;</script>
<script>
${read(here("harness.js"))}
</script>
<script>
${read(here("catalog/ui-catalog.js"))}
</script>
<script>
${read(app("data.js"))}
</script>
<script>
${read(jsxEntry ? path.join(appDir, ".build", "app.js") : app("app.js"))}
</script>
</body>
</html>
`;
}

/* The three things whoever implements this needs: the scenarios as Gherkin,
   the routes with a request and response actually observed, and the
   prototype itself. Same artefacts the browser's "Baixar tudo" produces. */
function writeArtifacts(dir, arts){
  const base = label.replace(/\.html?$/i, "");
  fs.mkdirSync(dir, { recursive: true });
  const wrote = [];
  const put = (nameStr, text) => {
    if (typeof text !== "string" || !text) return;
    const full = path.join(dir, nameStr);
    fs.writeFileSync(full, text);
    wrote.push(nameStr + " (" + Buffer.byteLength(text) + " bytes)");
  };
  put(base + ".feature", arts.feature);
  put("api.md", arts.api);
  put(base + ".html", isApp ? bundle(file, appName) : arts.html);

  /* The bundle is for looking at; the source is what gets implemented. A
     2MB build with React inlined is no use to somebody reading the screen. */
  if (isApp){
    const srcDir = path.join(dir, "source");
    fs.mkdirSync(srcDir, { recursive: true });
    ["styles.css", "data.js", jsxEntry ? "app.jsx" : "app.js"].forEach(f => {
      const from = path.join(file, f);
      if (!fs.existsSync(from)) return;
      fs.copyFileSync(from, path.join(srcDir, f));
      wrote.push("source/" + f);
    });
  }
  console.log("→ " + dir + ": " + (wrote.length ? wrote.join(", ") : "nothing to write"));
}

let JSDOM;

/* browser first: it is the only way for the layout rules to apply */
const chrome = findChromium();
const pptr = chrome ? findPuppeteer() : null;

if (chrome && pptr){
  runInBrowser(pageUrl, chrome, pptr).then(r => {
    const warnings = r.warnings || [];
    const cov = r.coverage;
    const line = `${r.ok} ok · ${r.bad} failing · ${warnings.length} warning(s)`
      + (cov ? ` · handlers ${cov.exercised}/${cov.total}` : "") + "  [browser]";

    if (r.bad){
      console.error(r.report);
      console.error(`\n✕ DO NOT SHIP. ${line}`);
      process.exit(1);
    }
    console.log(`✓ ${label} — ${line}`);
    if (exportDir && r.artifacts) writeArtifacts(exportDir, r.artifacts);
    warnings.forEach(a => console.log("  ! " + a));
    (r.infos || []).forEach(i => console.log("  · " + i));
    (r.errors || []).forEach(e => console.log("  ! page error: " + e));
    if (warnings.length && strict){
      console.error("\n✕ --strict: warnings count as failure.");
      process.exit(2);
    }
    process.exit(0);
  }).catch(e => {
    console.error("✕ the browser failed: " + e.message);
    process.exit(3);
  });
} else {
  viaJsdom();
}

function viaJsdom(){
/* only the jsdom engine needs it: whoever has a browser should not trip
   over this dependency to run the gate */
try {
  ({ JSDOM } = require("jsdom"));
} catch {
  console.error("jsdom is not installed. Run:  npm install jsdom");
  process.exit(3);
}
const html = fs.readFileSync(pageFile, "utf8");
/* A prototype includes the harness rather than containing it, so jsdom has
   to fetch harness.js and the catalog: `resources: "usable"` turns that on,
   and a real file:// url is what makes the relative paths resolve. The
   origin is opaque there, so localStorage throws — the harness already
   treats storage as optional. */
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  beforeParse(w){ w.PROTO_IMPORTS = usedComponents; },
  pretendToBeVisual: true,
  url: pageUrl
});
const w = dom.window;

/* jsdom does no layout: without this the stage measures 0 and the scale
   becomes NaN */
Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
  get(){ return this.id === "h-stage" ? 1280 : 0; }, configurable: true
});
Object.defineProperty(w.HTMLElement.prototype, "clientHeight", {
  get(){ return this.id === "h-stage" ? 900 : 0; }, configurable: true
});

const errors = [];
w.addEventListener("error", e => errors.push(e.message));

w.addEventListener("load", () => {
  /* the Proto.on handlers are registered after init, so the suite is
     only valid once the app script has finished — same reason as the
     setTimeout there */
  setTimeout(async () => {
    if (w.PROTO_LOAD_ERROR){
      console.error("✕ the app did not load: " + w.PROTO_LOAD_ERROR);
      process.exit(3);
    }
    const P = w.Proto;
    if (!P || typeof P.verifyAll !== "function"){
      console.error("✕ " + label + " does not expose the Proto harness — did its app.js run?");
      process.exit(3);
    }

    let r;
    /* verifyAll is async: without the await, r is the pending Promise,
       r.bad is undefined and the gate approves every prototype */
    try { r = await P.verifyAll(); }
    catch (e){
      console.error("✕ verification blew up: " + e.message);
      process.exit(3);
    }

    const warnings = r.warnings || [];
    const cov = r.coverage;
    const line = `${r.ok} ok · ${r.bad} failing · ${warnings.length} warning(s)`
      + (cov ? ` · handlers ${cov.exercised}/${cov.total}` : "");

    if (r.bad){
      console.error(P.report());
      console.error(`\n✕ DO NOT SHIP. ${line}`);
      process.exit(1);
    }

    console.log(`✓ ${label} — ${line}`);

    if (exportDir){
      writeArtifacts(exportDir, { feature: P.gherkin(), api: P.apiContract(), html: P.source() });
    }

    if (warnings.length){
      warnings.forEach(a => console.log("  ! " + a));
      if (cov && cov.exercised < cov.total){
        console.log(`  ! ${cov.total - cov.exercised} handler(s) with no step that fires them`);
      }
      if (strict){
        console.error("\n✕ --strict: warnings count as failure.");
        process.exit(2);
      }
    }

    if (errors.length){
      console.log("  ! page errors: " + errors.join("; "));
    }
    process.exit(0);
  }, 0);
});
}
