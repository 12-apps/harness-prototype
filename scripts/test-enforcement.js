#!/usr/bin/env node
/* ============================================================
   Does the component rule still bite?
   ============================================================
   The rule is the reason a prototype cannot ship raw HTML, so it needs a
   test of its own. Without one, someone loosens the linter and CI stays
   green — which is the failure this repository keeps finding in itself.
   ============================================================ */
const path = require("path");
const { lint, loadCatalog } = require("./lint-prototype.js");

const repo = path.join(__dirname, "..");
const catalog = loadCatalog(repo);
const fixture = f => path.join(__dirname, "fixtures", f);

let failed = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? "✓" : "✕"} ${label}${cond ? "" : " — " + detail}`);
  if (!cond) failed++;
};

const bad = lint(fixture("violates.jsx"), catalog);
const kinds = bad.map(p => p.kind);
const has = k => kinds.includes(k);

check("rejects a raw <button>",            has("raw-html") && bad.some(p => /<button>/.test(p.msg)), "not reported");
check("rejects raw layout tags",           bad.some(p => /<div>/.test(p.msg)) && bad.some(p => /<p>/.test(p.msg)), "not reported");
check("names the component to use instead", bad.some(p => /Use <Button> from @12-apps\/ui\/form\/Button/.test(p.msg)), "no suggestion");
check("rejects a foreign import",          has("foreign-import"), "not reported");
check("rejects a name not in the catalog", has("not-in-catalog"), "not reported");
check("rejects the right name, wrong path", has("wrong-path"), "not reported");
check("rejects a component never imported", has("unknown-component"), "not reported");

const good = lint(fixture("complies.jsx"), catalog);
check("passes a compliant prototype", good.length === 0,
      good.map(p => p.kind + ": " + p.msg).join(" | "));

console.log(failed ? `\n✕ the component rule is not enforcing what it claims (${failed})`
                   : `\n✓ the component rule still bites (${bad.length} violations caught in the fixture)`);
process.exit(failed ? 1 : 0);
