#!/usr/bin/env node
/* ============================================================
   PROTO · verification gate
   ============================================================
   Runs the prototype's suite OUTSIDE the browser and returns an exit
   code. It exists so that whoever edits the file — human or agent —
   does not ship a screen that is already broken.

     node verify.js product-editor.html
     node verify.js file.html --strict

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

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const strict = args.includes("--strict");

if (!file){
  console.error("usage: node verify.js <file.html> [--strict]");
  process.exit(3);
}
if (!fs.existsSync(file)){
  console.error("file not found: " + file);
  process.exit(3);
}

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

async function runInBrowser(file, chrome, pptr){
  const b = await pptr.launch({
    headless: "new", executablePath: chrome,
    args:["--no-sandbox","--disable-dev-shm-usage","--font-render-hinting=none"]
  });
  try {
    const pg = await b.newPage();
    await pg.setViewport({ width:1400, height:1000 });
    const errors = [];
    pg.on("pageerror", e => errors.push(String(e.message).split("\n")[0]));
    await pg.goto("file://" + path.resolve(file), { waitUntil:"load" });
    await pg.waitForFunction("window.Proto && typeof window.Proto.verifyAll === 'function'", { timeout:20000 });
    const r = await pg.evaluate(async () => {
      const s = await window.Proto.verifyAll();
      return { ok:s.ok, bad:s.bad, warnings:s.warnings || [], infos:s.infos || [],
               coverage:s.coverage || null, report: s.bad ? window.Proto.report() : "" };
    });
    r.errors = errors;
    return r;
  } finally { await b.close(); }
}

let JSDOM;

/* browser first: it is the only way for the layout rules to apply */
const chrome = findChromium();
const pptr = chrome ? findPuppeteer() : null;

if (chrome && pptr){
  runInBrowser(file, chrome, pptr).then(r => {
    const warnings = r.warnings || [];
    const cov = r.coverage;
    const line = `${r.ok} ok · ${r.bad} failing · ${warnings.length} warning(s)`
      + (cov ? ` · handlers ${cov.exercised}/${cov.total}` : "") + "  [browser]";

    if (r.bad){
      console.error(r.report);
      console.error(`\n✕ DO NOT SHIP. ${line}`);
      process.exit(1);
    }
    console.log(`✓ ${path.basename(file)} — ${line}`);
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
const html = fs.readFileSync(file, "utf8");
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://proto.local/" + path.basename(file)
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
    const P = w.Proto;
    if (!P || typeof P.verifyAll !== "function"){
      console.error("✕ " + file + " does not expose the Proto harness — is it a harness prototype?");
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

    console.log(`✓ ${path.basename(file)} — ${line}`);

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
