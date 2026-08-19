#!/usr/bin/env node
/* ============================================================
   Does the component rule still bite?
   ============================================================
   The rule is the reason a prototype cannot ship raw HTML, so it needs a
   test of its own. Without one, someone loosens the linter and CI stays
   green — which is the failure this repository keeps finding in itself.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { lint, loadCatalog, loadWiring } = require("./lint-prototype.js");

const repo = path.join(__dirname, "..");
const catalog = loadCatalog(repo);
const wiring  = loadWiring(repo);
const fixture = f => path.join(__dirname, "fixtures", f);

let failed = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? "✓" : "✕"} ${label}${cond ? "" : " — " + detail}`);
  if (!cond) failed++;
};

const bad = lint(fixture("violates.jsx"), catalog, wiring);
const kinds = bad.map(p => p.kind);
const has = k => kinds.includes(k);

check("rejects a raw <button>",            has("raw-html") && bad.some(p => /<button>/.test(p.msg)), "not reported");
check("rejects raw layout tags",           bad.some(p => /<div>/.test(p.msg)) && bad.some(p => /<p>/.test(p.msg)), "not reported");
check("names the component to use instead", bad.some(p => /Use <Button> from @12-apps\/ui\/form\/Button/.test(p.msg)), "no suggestion");
check("rejects a foreign import",          has("foreign-import"), "not reported");
check("rejects a name not in the catalog", has("not-in-catalog"), "not reported");
check("rejects the right name, wrong path", has("wrong-path"), "not reported");
check("rejects a component never imported", has("unknown-component"), "not reported");

/* Using the component is not the end of it: one that exists to be operated
   has to be wired to a step, and the wiring has to join up at both ends. */
check("rejects an `exige` component with no step hook",
      has("unwired-component") && bad.some(p => /<CollapsibleTrigger>/.test(p.msg)), "not reported");
check("rejects a hook no handler answers",
      has("hook-without-handler") && bad.some(p => /"pay"/.test(p.msg)), "not reported");
check("rejects a handler for a hook nothing carries",
      has("handler-without-hook") && bad.some(p => /nobody/.test(p.msg)), "not reported");

const good = lint(fixture("complies.jsx"), catalog, wiring);
check("passes a compliant prototype", good.length === 0,
      good.map(p => p.kind + ": " + p.msg).join(" | "));

/* ------------------------------------------------------------
   The classification has to cover the catalog it describes.
   ------------------------------------------------------------
   ui-interactions.* is curated by hand while ui-catalog.js is generated,
   so the two drift in silence: the catalog grew to 210 components while
   the classification still described 116, and nothing said so. This
   checks both directions — a component with no level, and a level for a
   component that no longer exists. Regenerate the catalog, add the
   missing judgments, or this goes red.
   ------------------------------------------------------------ */
const maps = {};
new Function("window", fs.readFileSync(path.join(repo, "catalog", "ui-interactions.js"), "utf8"))(maps);
const names = Object.keys(catalog);
const missing = level => names.filter(n => !(n in level));
const orphan  = level => Object.keys(level).filter(n => !(n in catalog));
const list = a => a.length + ": " + a.slice(0, 8).join(", ") + (a.length > 8 ? " …" : "");

for (const [label, level] of [["wiring", maps.PROTO_UI_WIRING], ["action", maps.PROTO_UI_ACTION]]){
  check(`every catalog component has a ${label} level`, missing(level).length === 0, list(missing(level)));
  check(`no ${label} level for a component that is gone`, orphan(level).length === 0, list(orphan(level)));
}

/* `nunca` means there is nothing to operate, so it cannot carry a step
   that operates something. `efemero` is allowed: a skeleton or a loading
   state appears and goes away without ever being touched. */
const inert = names.filter(n => maps.PROTO_UI_WIRING[n] === "nunca"
                             && !["passivo", "efemero"].includes(maps.PROTO_UI_ACTION[n]));
check("no component is inert and operable at once", inert.length === 0, list(inert));

console.log(failed ? `\n✕ the component rule is not enforcing what it claims (${failed})`
                   : `\n✓ the component rule still bites (${bad.length} violations caught in the fixture)`);
process.exit(failed ? 1 : 0);
