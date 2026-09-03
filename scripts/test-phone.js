#!/usr/bin/env node
/* ============================================================
   Does the phone bench still bite?
   ============================================================
   The bench changes shape below a threshold: the list becomes a drawer,
   the controls fold, the journey gets a row, and several views become one
   at a time. None of that is a rule the linter can read and none of it is
   a number the suite reports — it is the shape of the chrome, and the only
   way to know it still holds is to open the bench at that size and look.

   This exists because the first version of that chrome shipped with nine
   defects that a careful reading of the diff had already missed: an
   Examples row stranded the device view for the rest of the session, the
   starter template drew a step row with nothing to step through, the
   screen that names a missing file arrived 591px wider than the phone it
   was being read on. Every one of them was found by driving a browser at
   390px, and none of them by reading. So the driving is the test.

   Each case is checked BOTH ways: what is true on a phone has to be false
   on a computer. A chrome that went compact everywhere would pass half of
   this file and fail the other half, which is the point — a rule that
   cannot fail has stopped being one.

   Needs a real browser, and says so rather than passing without one:
   everything here is about what got drawn, so there is no degraded mode
   that means anything.

       node scripts/test-phone.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repo = path.join(__dirname, "..");

/* the same two things the gate looks for, in the same places */
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

const chrome = findChromium();
let pptr = null;
try { pptr = require("puppeteer"); } catch {}

if (!chrome || !pptr){
  console.error("✕ the phone bench cannot be checked without a browser.");
  console.error("  " + (chrome ? "puppeteer is missing: pnpm add -D puppeteer"
                                : "no Chromium found: set PROTO_CHROME=/path/to/chrome"));
  console.error("  Everything here is about what got drawn, so there is no engine to fall back to.");
  process.exit(3);
}

let failed = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? "✓" : "✕"} ${label}${cond ? "" : " — " + detail}`);
  if (!cond) failed++;
};

const harnessJs  = fs.readFileSync(path.join(repo, "harness.js"), "utf8");
const harnessCss = fs.readFileSync(path.join(repo, "harness.css"), "utf8");

/* A bench with the prototype inlined — the same shape as the single-file
   bundle, which is the thing that actually gets opened on a phone. The app
   arrives as source rather than as data because a prototype is functions. */
const benchHtml = appSource => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>teste</title>
<style data-harness-css>${harnessCss}</style>
</head><body>
<script>window.PROTO_BUNDLED = true;</script>
<script>${harnessJs.replace(/<\/(script)/gi, "<\\/$1")}</script>
<script>${appSource.replace(/<\/(script)/gi, "<\\/$1")}</script>
</body></html>`;

/* ---------- the shapes ---------- */
const PHONE     = { nameStr:"390×844 coarse",  width:390,  height:844,  coarse:true  };
/* a phone on its side: current models are 874–956 CSS px wide there, which
   is past any threshold a laptop window is also past — short and coarse is
   what separates them */
const LANDSCAPE = { nameStr:"932×430 coarse",  width:932,  height:430,  coarse:true  };
/* a narrow window on a computer: the compact chrome, without the device */
const NARROW    = { nameStr:"800×700 fine",    width:800,  height:700,  coarse:false };
/* the same shape as the phone on its side, with an ordinary pointer: the
   control that keeps the landscape clause off computers */
const SHORT     = { nameStr:"932×430 fine",    width:932,  height:430,  coarse:false };
const COMPUTER  = { nameStr:"1400×1000 fine",  width:1400, height:1000, coarse:false };

let browser = null;

async function open(shape, appSource, url){
  const pg = await browser.newPage();
  await pg.setViewport({ width:shape.width, height:shape.height,
                         deviceScaleFactor:1, isMobile:!!shape.coarse, hasTouch:!!shape.coarse });
  /* the switch is the pointer and the viewport, never the user agent, so
     that is what gets emulated */
  const cdp = await pg.createCDPSession();
  await cdp.send("Emulation.setEmulatedMedia", { features:[
    { name:"pointer",     value: shape.coarse ? "coarse" : "fine" },
    { name:"any-pointer", value: shape.coarse ? "coarse" : "fine" }
  ] });
  await pg.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch {} });
  const errors = [];
  pg.on("pageerror", e => errors.push(String(e.message).split("\n")[0]));
  if (url) await pg.goto(url, { waitUntil:"load" });
  else await pg.setContent(benchHtml(appSource), { waitUntil:"load" });
  await pg.waitForFunction("window.Proto && window.Proto.state", { timeout:20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 250));
  pg.protoErrors = errors;
  return pg;
}

/* What the bench is showing, read out of the shadow root the chrome lives
   in. One probe, so every case below asks the same questions. */
const look = () => {
  const host = document.getElementById("h-host");
  const H = host && host.shadowRoot;
  if (!H) return { noChrome:true };
  const q = id => H.getElementById(id);
  const seen = el => !!(el && el.getClientRects().length);
  const frame = q("h-frame");
  const P = window.Proto;
  const cells = [...document.querySelectorAll("#app > .h-view")];
  return {
    compacto: q("h-shell").hasAttribute("data-compacto"),
    aparelho: q("h-stage").hasAttribute("data-aparelho"),
    viewport: P && P.state.viewport,
    scenario: P && P.state.scenario, step: P && P.state.step,
    side: seen(q("h-side")), veil: seen(q("h-veu")),
    menu: seen(q("h-menu")), more: seen(q("h-more")),
    passos: seen(q("h-passos")), vistas: seen(q("h-vistas")),
    spec: q("h-spec") && !q("h-spec").hidden,
    passoText: (q("h-passo-nm") && q("h-passo-nm").textContent || "").replace(/\s+/g, " ").trim(),
    passoLabel: q("h-passo-nm") && q("h-passo-nm").getAttribute("aria-label"),
    nextOff: q("h-passo-prox") && q("h-passo-prox").disabled,
    frameCss: frame && frame.style.width,
    frameW: frame ? Math.round(frame.getBoundingClientRect().width) : 0,
    stageW: Math.round(q("h-stage").getBoundingClientRect().width),
    stageH: Math.round(q("h-stage").getBoundingClientRect().height),
    sideW: Math.round(q("h-side").getBoundingClientRect().width),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    views: cells.map(c => ({ id:c.getAttribute("data-h-view"), shown: !!c.getClientRects().length })),
    /* every control a finger has to hit, and every field a phone could
       zoom into and never zoom back out of */
    small: [...H.querySelectorAll(".h-top button, .h-top select, .h-top input,"
                                + ".h-passos button, .h-vistas button,"
                                + ".h-side button, .h-side input, .h-side select")]
      .filter(el => el.getClientRects().length)
      .map(el => ({ what:el.id || el.className, h:Math.round(el.getBoundingClientRect().height) }))
      .filter(t => t.h < 44),
    tiny: [...H.querySelectorAll("input, select, textarea")]
      .filter(el => el.getClientRects().length)
      .map(el => ({ what:el.id || el.className, px:parseFloat(getComputedStyle(el).fontSize) }))
      .filter(f => f.px < 16)
  };
};

const tap = id => document.getElementById("h-host").shadowRoot.getElementById(id).click();

/* ---------- the prototypes these cases are about ----------
   Written as source, not imported: each is the smallest screen that can
   carry the one rule its case is about. */
const TELA = 's => \'<div data-estado="conteudo"><button data-act="bump">somar</button>\''
           + ' + \'<i>\' + (s.app.n || 0) + \'</i></div>\'';

const HANDLER = `
Proto.on("click", '[data-act="bump"]', async () => {
  const back = await Proto.api.post("/api/n", {});
  Proto.set({ n: back.n });
});`;

/* two scenarios, the second an Esquema do Cenário that declares a width:
   the pair that stranded the device view */
const APP_WALK = `
Proto.init({
  title:"andar", verifyOnOpen:false, resumeVerification:false,
  data_:{ n:0 },
  routes:[{ httpMethod:"POST", pathStr:"/api/n", responds: ({ data_ }) => ({ n: ++data_.n }) }],
  render: ${TELA},
  scenarios:[
    { id:"simples", name:"uma jornada comum", page:"p", tags:["@feliz"],
      given:{ text:"a tela abre", state:() => ({ page:"p", n:0 }) },
      steps:[
        { when:"soma uma vez", click:'[data-act="bump"]' },
        { then:"contou", check:a => a.n === 1 },
        { when:"soma de novo", click:'[data-act="bump"]' },
        { then:"contou duas", check:a => a.n === 2 }
      ] },
    { id:"larguras", name:"a tela em cada largura", page:"p", tags:["@feliz"],
      given:{ text:"a tela abre", state:() => ({ page:"p", n:0 }) },
      steps:[
        { when:"soma", click:'[data-act="bump"]' },
        { then:"contou", check:a => a.n === 1 }
      ],
      examples:{ columns:["largura"], tableRows:[["xxs"], ["md"]] } }
  ]
});${HANDLER}`;

/* the starter's shape: a bench with no journey to walk */
const APP_EMPTY = `
Proto.init({
  title:"vazio", verifyOnOpen:false, resumeVerification:false,
  render: () => '<div data-estado="vazio">nada ainda</div>',
  scenarios:[]
});`;

/* two people, two devices: the row a phone cannot hold */
const APP_VIEWS = `
Proto.init({
  title:"duas telas", verifyOnOpen:false, resumeVerification:false,
  views:[
    { id:"a", label:"Tela A", viewport:"se" },
    { id:"b", label:"Tela B", viewport:"ipad" }
  ],
  data_:{ n:0 },
  routes:[{ httpMethod:"POST", pathStr:"/api/n", responds: ({ data_ }) => ({ n: ++data_.n }) }],
  render: s => s.view === "a"
    ? '<div data-estado="conteudo"><button data-act="bump">somar</button></div>'
    : '<div data-estado="conteudo">B</div>',
  scenarios:[
    { id:"j", name:"as duas telas", page:"p", tags:["@feliz"],
      given:{ text:"as duas abrem", state:() => ({ page:"p", n:0 }) },
      steps:[
        { then:"B começa parada", on:"b", check:(a, el) => !!el.querySelector('[data-estado]') },
        { when:"A soma", on:"a", click:'[data-act="bump"]' },
        { then:"A contou", on:"a", check:a => a.n === 1 }
      ] }
  ]
});${HANDLER}`;

(async () => {
  browser = await pptr.launch({ headless:"new", executablePath:chrome,
    args:["--no-sandbox","--disable-dev-shm-usage","--font-render-hinting=none"] });
  try {
    /* ---------- the shape follows the viewport, and only the viewport ---------- */
    for (const shape of [PHONE, LANDSCAPE]){
      const pg = await open(shape, APP_WALK);
      const r = await pg.evaluate(look);
      check(`compact on ${shape.nameStr}`, r.compacto, "the computer's chrome on a phone");
      check(`opens on the device (${shape.nameStr})`, r.viewport === "aparelho" && r.aparelho,
            `viewport ${r.viewport}, data-aparelho ${r.aparelho}`);
      check(`nothing overflows sideways (${shape.nameStr})`, r.overflow === 0, r.overflow + "px past the screen");
      await pg.close();
    }
    /* a narrow window is how you look at the phone bench without a phone —
       and it is still a window, so it keeps the rung the file declares */
    {
      const pg = await open(NARROW, APP_WALK);
      const r = await pg.evaluate(look);
      check("a narrow window gets the compact chrome", r.compacto, "not compact");
      check("…but keeps the declared rung, because a window is not a device",
            r.viewport !== "aparelho", "a window was handed the device view");
      await pg.close();
    }
    /* the same pixels as the phone on its side, with an ordinary pointer.
       If this ever goes compact, the landscape clause has stopped being
       about phones and started being about short windows. */
    {
      const pg = await open(SHORT, APP_WALK);
      const r = await pg.evaluate(look);
      check("a short wide window on a computer is not a phone on its side", !r.compacto,
            "the landscape clause leaked onto computers");
      await pg.close();
    }
    /* and the computer is untouched by any of it */
    {
      const pg = await open(COMPUTER, APP_WALK);
      const r = await pg.evaluate(look);
      check("a computer is not compact", !r.compacto, "the phone chrome on a computer");
      check("the sidebar is a column, not a drawer", r.side && r.sideW >= 288, `${r.sideW}px`);
      check("no ☰, no ⋯, no step row", !r.menu && !r.more && !r.passos,
            `menu ${r.menu}, more ${r.more}, passos ${r.passos}`);
      await pg.close();
    }

    /* ---------- an Examples row borrows the width; it does not keep it ---------- */
    {
      const pg = await open(PHONE, APP_WALK);
      const before = await pg.evaluate(look);
      await pg.evaluate(() => window.Proto.goto("larguras", -1, 0));
      await new Promise(r => setTimeout(r, 400));
      const onRow = await pg.evaluate(look);
      await pg.evaluate(() => window.Proto.goto("simples", -1, 0));
      await new Promise(r => setTimeout(r, 400));
      const after = await pg.evaluate(look);
      check("the row takes the frame to its width", onRow.viewport === "xxs", onRow.viewport);
      check("leaving the row gives the device back",
            before.viewport === "aparelho" && after.viewport === "aparelho",
            `left at ${after.viewport} — one tap on an outline strands the bench`);

      /* …while a width somebody picked is nobody else's to take back */
      await pg.evaluate(() => {
        const sel = document.getElementById("h-host").shadowRoot.getElementById("h-vp");
        sel.value = "sm"; sel.dispatchEvent(new Event("change", { bubbles:true }));
      });
      await new Promise(r => setTimeout(r, 200));
      await pg.evaluate(() => window.Proto.goto("simples", 1, 0));
      await new Promise(r => setTimeout(r, 400));
      const hand = await pg.evaluate(look);
      check("a rung picked by hand survives the walk", hand.viewport === "sm", hand.viewport);
      await pg.close();
    }

    /* ---------- the journey's row ---------- */
    {
      const pg = await open(PHONE, APP_WALK);
      let r = await pg.evaluate(look);
      check("the step row says where in the journey you are", /passo|dado/.test(r.passoText), `"${r.passoText}"`);
      /* an aria-label here would replace the only readout of that */
      check("and nothing hides that from a screen reader", !r.passoLabel, `aria-label "${r.passoLabel}"`);

      /* walking to the end and one further: the arrows cross into the next
         scenario, and a phone has no arrows */
      const walked = await pg.evaluate(async () => {
        const H = document.getElementById("h-host").shadowRoot;
        const seen = [];
        for (let i = 0; i < 10; i++){
          const nxt = H.getElementById("h-passo-prox");
          if (nxt.disabled) break;
          nxt.click();
          await new Promise(r => setTimeout(r, 220));
          seen.push(window.Proto.state.scenario + "/" + window.Proto.state.step);
        }
        return seen;
      });
      const crossed = new Set(walked.map(s => s.split("/")[0])).size > 1;
      check("the row walks past the end of a scenario", crossed, "it stops where the arrows keep going");
      await pg.close();
    }
    /* a bench with no journey draws no row to walk it with */
    {
      const pg = await open(PHONE, APP_EMPTY);
      const r = await pg.evaluate(look);
      check("no step row when there is nothing to step through", !r.passos,
            "the starter ships two chevrons and no journey");
      await pg.close();
    }

    /* ---------- the drawer ---------- */
    {
      const pg = await open(PHONE, APP_WALK);
      await pg.evaluate(tap, "h-menu");
      await new Promise(r => setTimeout(r, 250));
      const open_ = await pg.evaluate(look);
      check("☰ opens the list over the stage", open_.side && open_.veil,
            `side ${open_.side}, veil ${open_.veil}`);

      /* a panel opened from behind the veil is a panel nobody can see */
      await pg.evaluate(tap, "h-spec-btn");
      await new Promise(r => setTimeout(r, 250));
      const spec = await pg.evaluate(look);
      check("opening Gherkin closes the drawer first", spec.spec && !spec.veil,
            `spec ${spec.spec}, veil ${spec.veil}`);
      await pg.evaluate(tap, "h-spec-btn");

      await pg.evaluate(tap, "h-menu");
      await new Promise(r => setTimeout(r, 200));
      await pg.keyboard.press("Escape");
      await new Promise(r => setTimeout(r, 250));
      const esc = await pg.evaluate(look);
      check("Escape closes the drawer", !esc.side, "still open");

      /* picking from it is asking to see the screen it covers */
      await pg.evaluate(tap, "h-menu");
      await new Promise(r => setTimeout(r, 200));
      await pg.evaluate(() => {
        const H = document.getElementById("h-host").shadowRoot;
        H.querySelector('.h-scn-hd[data-scn="larguras"]').click();
      });
      await new Promise(r => setTimeout(r, 500));
      const picked = await pg.evaluate(look);
      check("picking a scenario closes the drawer", !picked.side && picked.scenario === "larguras",
            `side ${picked.side}, at ${picked.scenario}`);
      await pg.close();
    }

    /* ---------- what a finger and a phone browser demand ---------- */
    {
      const pg = await open(PHONE, APP_WALK);
      await pg.evaluate(tap, "h-more");
      await pg.evaluate(tap, "h-menu");
      await new Promise(r => setTimeout(r, 350));
      const r = await pg.evaluate(look);
      /* the same 44 the bench demands of every prototype below sm */
      check("every chrome control a finger can reach is 44px", r.small.length === 0,
            JSON.stringify(r.small.slice(0, 6)));
      /* under 16px a phone zooms the page in and never zooms back out */
      check("no field a phone would zoom into", r.tiny.length === 0,
            JSON.stringify(r.tiny.slice(0, 6)));
      await pg.close();
    }

    /* ---------- several views: a row on a computer, one at a time on a phone ---------- */
    {
      const pg = await open(PHONE, APP_VIEWS);
      const r = await pg.evaluate(look);
      const showing = r.views.filter(v => v.shown);
      check("the switcher is there", r.vistas, "no way to reach the other screens");
      check("exactly one view on show", showing.length === 1, JSON.stringify(r.views));
      check("the frame is one device, not the row of them",
            parseInt(r.frameCss, 10) < 500, `frame ${r.frameCss}`);
      check("nothing overflows sideways with views", r.overflow === 0, r.overflow + "px");

      /* the step says which screen it acts on, so the stage goes there */
      const led = await pg.evaluate(async () => {
        const H = document.getElementById("h-host").shadowRoot;
        const seen = [];
        for (let i = 0; i < 3; i++){
          const nxt = H.getElementById("h-passo-prox");
          if (nxt.disabled) break;
          nxt.click();
          await new Promise(r => setTimeout(r, 300));
          seen.push([...document.querySelectorAll("#app > .h-view")]
            .filter(c => c.getClientRects().length).map(c => c.getAttribute("data-h-view"))[0]);
        }
        return seen;
      });
      check("the stage follows the step's addressee", new Set(led).size > 1,
            "stayed on " + JSON.stringify(led));
      await pg.close();
    }
    {
      const pg = await open(COMPUTER, APP_VIEWS);
      const r = await pg.evaluate(look);
      check("a computer still shows every view at once",
            r.views.length > 1 && r.views.every(v => v.shown), JSON.stringify(r.views));
      check("and has no switcher to need", !r.vistas, "a switcher where there is room for the row");
      await pg.close();
    }

    /* ---------- the screen that names a missing file ----------
       The one screen whose whole job is to be read on the device the folder
       was sent to, and the one the shape has to be right for before init()
       has run at all. */
    {
      const url = "file://" + path.join(repo, "proto.html") + "?app=nao-existe-mesmo";
      const pg = await open(PHONE, null, url);
      const r = await pg.evaluate(look);
      const msg = await pg.evaluate(() => {
        const el = document.querySelector("#app h1");
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { text:el.textContent, within: b.right <= innerWidth + 1 && b.left >= -1 };
      });
      check("a prototype that fails to load still gets the phone chrome", r.compacto,
            "the 288px sidebar on a 390px screen");
      check("its message is on the screen", msg && msg.within, JSON.stringify(msg));
      check("and nothing overflows sideways", r.overflow === 0, r.overflow + "px past the screen");
      await pg.close();
    }

    /* ---------- the gate cannot be reached by any of this ----------
       What keeps the gate device-independent is that verify.js drives the
       page at a fixed size with an ordinary pointer. That is a claim the
       docs make, so it is one this file checks: change the viewport there
       and the sentence stops being true. */
    {
      const src = fs.readFileSync(path.join(repo, "verify.js"), "utf8");
      const m = src.match(/setViewport\(\s*\{\s*width\s*:\s*(\d+)/);
      check("the gate still pins a viewport wider than the threshold",
            !!m && Number(m[1]) > 860, m ? m[1] + "px" : "no setViewport in verify.js");
      const pg = await open(COMPUTER, APP_WALK);
      const r = await pg.evaluate(look);
      check("so the bench the gate measures is never in phone form", !r.compacto, "compact at the gate's size");
      await pg.close();
    }
  } finally { if (browser) await browser.close(); }

  console.log(failed
    ? `\n✕ the phone bench lost ${failed} of its rules.`
    : "\n✓ the phone bench still bites");
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error("✕ the check itself blew up: " + (e && e.stack || e));
  process.exit(3);
});
