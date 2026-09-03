#!/usr/bin/env node
/* ============================================================
   Do the several-views rules still bite?
   ============================================================
   `views` multiplies the discipline: each view is an ordinary screen and
   owes what a screen owes, and on top of that the choreography between
   them — what one screen's action does to the others — becomes something
   the specification has to state and the harness has to check.

   Those rules live in the engine, not in the linter, so the component
   test next door cannot see them. This one boots the harness for real,
   feeds it prototypes that are wrong on purpose, and fails the build if
   the gate lets any of them through. Loosen a rule and this goes red,
   rather than CI staying green on a rule that no longer bites.
   ============================================================ */
const fs = require("fs");
const path = require("path");

let JSDOM;
try { ({ JSDOM } = require("jsdom")); }
catch { console.error("jsdom is not installed. Run: pnpm install"); process.exit(3); }

const harness = fs.readFileSync(path.join(__dirname, "..", "harness.js"), "utf8");

let failed = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? "✓" : "✕"} ${label}${cond ? "" : " — " + detail}`);
  if (!cond) failed++;
};

/* One bench per case: a fresh window, so the config, the handlers and the
   fixtures of one case never reach the next. */
async function bench(config){
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`,
    { runScripts:"outside-only", pretendToBeVisual:true, url:"https://proto.test/" });
  const w = dom.window;
  w.eval(harness);
  w.Proto.init({ title:"teste", verifyOnOpen:false, resumeVerification:false, ...config });
  /* the control has to really do something, or every case below would pass
     for the wrong reason: nothing moved because nothing happened */
  w.Proto.on("click", '[data-act="bump"]', async () => {
    const back = await w.Proto.api.post("/api/n", {});
    w.Proto.set({ n: back.n });
  });
  const r = await w.Proto.verifyAll();
  const reasons = (r.failures || []).map(f => f.reason).join(" § ");
  return { r, reasons, warnings: (r.warnings || []).join(" § ") };
}

/* Two screens on the same state. `a` has the control; what `b` draws is what
   each case is about. */
const VIEWS = [
  { id:"a", label:"A", viewport:"xs" },
  { id:"b", label:"B", viewport:"md" }
];

const telaA = s => `<div data-estado="${s.app.n ? "conteudo" : "vazio"}">`
                 + `<button data-act="bump">somar</button><i>${s.app.n}</i></div>`;

const base = espelha => ({
  views: VIEWS,
  data_: { n:0 },
  routes: [{ httpMethod:"POST", pathStr:"/api/n",
             responds: ({ data_ }) => ({ n: ++data_.n }) }],
  render: s => s.view === "a" ? telaA(s)
             : `<div data-estado="conteudo">${espelha ? s.app.n : "parado"}</div>`
});

const journey = extra => ({
  id:"j", name:"jornada", page:"p", tags:["@feliz"],
  given:{ text:"que as duas telas estão abertas", state:() => ({ page:"p", n:0 }) },
  steps:[
    { then:"a tela A começa vazia", on:"a",
      check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
    { when:"A soma", on:"a", click:'[data-act="bump"]', ...extra },
    { then:"a tela A conta um", on:"a", check:a => a.n === 1 }
  ]
});

(async () => {
  /* ---- the choreography: declared and not delivered ---- */
  const naoPropaga = await bench({ ...base(false), scenarios:[journey({ propagates:["b"] })] });
  check("rejects a propagation that never reaches the other screen",
        /a vista "b" não mudou depois deste passo/.test(naoPropaga.reasons),
        "not reported: " + naoPropaga.reasons);

  const propaga = await bench({ ...base(true), scenarios:[journey({ propagates:["b"] })] });
  check("accepts a propagation that does reach it",
        !/a vista "b" não mudou/.test(propaga.reasons), "reported anyway");

  /* ---- and its inverse, which is the harder half: a screen that must NOT
          move. Nothing about one screen can express it. ---- */
  const mexeu = await bench({ ...base(true), scenarios:[journey({ unchanged:["b"] })] });
  check("rejects a screen declared unchanged that moved",
        /a vista "b" mudou depois deste passo/.test(mexeu.reasons),
        "not reported: " + mexeu.reasons);

  const parado = await bench({ ...base(false), scenarios:[journey({ unchanged:["b"] })] });
  check("accepts a screen declared unchanged that held still",
        !/a vista "b" mudou/.test(parado.reasons), "reported anyway");

  /* ---- a view that is not declared is a typo, not a screen ---- */
  const fantasma = await bench({ ...base(true), scenarios:[journey({ propagates:["c"] })] });
  check("rejects a step naming a view that is not declared",
        /não está declarada em views/.test(fantasma.reasons),
        "not reported: " + fantasma.reasons);

  /* ---- with two screens on the bench, a step that does not say where it
          acts is not a specification ---- */
  const semOnde = await bench({ ...base(true), scenarios:[{
    id:"j", name:"jornada", page:"p", tags:["@feliz"],
    given:{ text:"que as duas telas estão abertas", state:() => ({ page:"p", n:0 }) },
    steps:[
      { when:"alguém soma", click:'[data-act="bump"]' },
      { then:"contou um", on:"a", check:a => a.n === 1 }
    ]
  }] });
  check("rejects an action that does not say which screen it acts on",
        /não diz em qual vista age/.test(semOnde.reasons + semOnde.warnings),
        "not reported: " + semOnde.reasons + semOnde.warnings);

  /* ---- a screen nobody touches, and a screen that never reaches a state ---- */
  const ocioso = await bench({ ...base(true), scenarios:[journey({})] });
  check("warns about a view no step ever operates",
        /a vista "B" não é operada por nenhum passo/.test(ocioso.warnings),
        "not warned: " + ocioso.warnings);
  check("warns per view about a state that view never reaches",
        /a vista "B" nunca marcou \[data-estado="erro"\]/.test(ocioso.warnings),
        "not warned: " + ocioso.warnings);

  /* ---- and none of it fires on a prototype with one screen ---- */
  const umaTela = await bench({
    data_:{ n:0 },
    routes: [{ httpMethod:"POST", pathStr:"/api/n", responds: ({ data_ }) => ({ n: ++data_.n }) }],
    render: telaA,
    scenarios:[{
      id:"j", name:"jornada", page:"p", tags:["@feliz"],
      given:{ text:"que a tela está aberta", state:() => ({ page:"p", n:0 }) },
      steps:[
        { then:"começa vazia", check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"soma", click:'[data-act="bump"]' },
        { then:"conta um", check:a => a.n === 1 }
      ]
    }]
  });
  check("says nothing about views when none are declared",
        !/vista/.test(umaTela.warnings + umaTela.reasons),
        "leaked a multi-view rule: " + umaTela.warnings + umaTela.reasons);

  /* ---- the live bench: the stage is laid out from the views, and a click
          belongs to the screen it happened on ---- */
  {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`,
      { runScripts:"outside-only", pretendToBeVisual:true, url:"https://proto.test/" });
    const w = dom.window;
    w.eval(harness);
    const seen = [];
    w.Proto.init({ title:"palco", verifyOnOpen:false, resumeVerification:false,
                   ...base(true), scenarios:[journey({})] });
    /* records which screen the click belonged to AND does the real work, so
       the verification at the end of this block still has a journey to run */
    w.Proto.on("click", '[data-act="bump"]', async (e, el, st) => {
      seen.push(st.view);
      const back = await w.Proto.api.post("/api/n", {});
      w.Proto.set({ n: back.n });
    });
    w.Proto.render();

    const cells = w.document.querySelectorAll("#app [data-h-view]");
    check("draws one frame per declared view",
          cells.length === 2, "drew " + cells.length);

    const frames = [...w.document.querySelectorAll("#app .h-view-frame")].map(f => f.style.width);
    check("gives each frame its own device width",
          frames[0] === "380px" && frames[1] === "768px", "got " + frames.join(", "));

    w.Proto.fit();
    /* the stage is the sum of the views plus the gap between them */
    check("sizes the stage from the views, not from a viewport",
          w.document.getElementById("h-host").shadowRoot
            .getElementById("h-frame").style.width === (380 + 20 + 768) + "px",
          "got " + w.document.getElementById("h-host").shadowRoot
            .getElementById("h-frame").style.width);

    const botao = w.document.querySelector('#app [data-h-view="a"] [data-act="bump"]');
    if (botao) botao.dispatchEvent(new w.MouseEvent("click", { bubbles:true }));
    check("a click belongs to the screen it happened on",
          seen.length === 1 && seen[0] === "a", "handler saw " + JSON.stringify(seen));

    /* ---- swapping the device a view is shown on ---- */
    const picker = w.document.querySelector('#app [data-h-view="a"] .h-view-vp');
    check("offers a device picker above each view",
          !!picker && picker.querySelectorAll("option").length > 1,
          "no picker on the view");

    const antes = seen.length;
    picker.value = "ipad";
    picker.dispatchEvent(new w.Event("change", { bubbles:true }));
    const larguraA = w.document.querySelector('#app [data-h-view="a"] .h-view-frame').style.width;
    check("swapping a view's device changes that view's width",
          larguraA === "1024px", "got " + larguraA);
    check("and leaves the other view where it was",
          w.document.querySelector('#app [data-h-view="b"] .h-view-frame').style.width === "768px",
          "the other view moved too");
    w.Proto.fit();
    check("the stage follows the swap",
          w.document.getElementById("h-host").shadowRoot
            .getElementById("h-frame").style.width === (1024 + 20 + 768) + "px",
          "stage did not follow");
    /* the picker is the bench's, not the screen's: a prototype handler must
       not receive its change event */
    check("the picker's own event never reaches the prototype",
          seen.length === antes, "a prototype handler answered the picker");

    /* ---- and none of that changes what is verified ---- */
    const depois = await w.Proto.verifyAll();
    check("swapping a device does not change what the gate measures",
          depois.bad === 0, depois.bad + " failing after the swap");
  }

  console.log(failed
    ? `\n✕ ${failed} of the several-views rules no longer bites.`
    : `\n✓ the several-views rules still bite`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("✕ the test blew up: " + e.stack); process.exit(3); });
