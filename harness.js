/* ============================================================
   PROTO — harness engine.  Do not edit from a prototype.
   ============================================================
   A prototype includes this file; it never contains it. Everything a
   prototype writes lives in its own three ▼ zones, so editing a
   prototype cannot reach the harness by accident.

     <link rel="stylesheet" href="harness.css">
     <script src="harness.js"></script>

   The API it exposes is documented in docs/project-instructions.md.
   ============================================================ */

/* The chrome lives in a shadow root, so a prototype's CSS cannot reach it
   and its own cannot reach the prototype. The mount is deliberately NOT in
   there: #app stays in the light DOM and is projected through a slot, so
   the prototype's styles and its delegated handlers work exactly as before.

   Injected once and repairable: isolated verification clones this document,
   and a shadow root does not survive serialization — the clone arrives with
   a host element and no chrome inside it. */
let H_ROOT = null;

(function shell(){
  const DOC_CSS = `
    *,*::before,*::after{box-sizing:border-box}
    html,body{height:100%;margin:0}
    body{background:#0b0d10;overflow:hidden}
    #app{
      width:100%;height:100%;overflow:auto;-webkit-overflow-scrolling:touch;
      container-type:inline-size;container-name:frame;
    }
    /* the off-screen probe verification measures: light DOM, like the mount,
       so the prototype's own CSS reaches it — and carrying the same named
       container, or every @container rule would sit out the measurement */
    .h-probe{
      position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;
      container-type:inline-size;container-name:frame;
    }
    /* Several devices watching the same data at once. The mount is still one
       screen: the harness calls it once per declared view and lays the
       results out side by side. The named container moves from the mount to
       each view's frame, so every @container rule resolves against the width
       of the device that view stands for — which is what lets every rule
       written for one screen keep applying to each of them. */
    #app.h-multi, .h-probe.h-multi{
      display:flex;gap:20px;align-items:flex-start;
      width:auto;height:auto;overflow:visible;container-type:normal;
    }
    .h-view{flex:0 0 auto;display:flex;flex-direction:column;gap:6px}
    .h-view-label{
      display:flex;align-items:center;gap:8px;min-height:22px;
      font:600 10px/1.6 ui-sans-serif,system-ui,sans-serif;letter-spacing:.09em;
      text-transform:uppercase;color:#8b93a5;
    }
    .h-view-name{white-space:nowrap}
    /* the device this view is being shown on: the declared one until somebody
       asks to see the same screen somewhere else */
    .h-view-vp{
      font:500 10px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em;
      text-transform:none;color:#c3cad8;background:#1b1f27;
      border:1px solid #2f3643;border-radius:6px;padding:2px 4px;max-width:170px;
    }
    .h-view-vp:hover{border-color:#414a5b;color:#e8eaef}
    .h-view-vp:focus-visible{outline:2px solid #5b7cfa;outline-offset:1px}
    .h-view-frame{
      background:#fff;border-radius:14px;overflow:auto;
      box-shadow:0 0 0 1px #313846,0 18px 44px rgba(0,0,0,.5);
      container-type:inline-size;container-name:frame;
    }
    .h-probe .h-view-frame{box-shadow:none;border-radius:0}
  `;
  if (!document.getElementById("h-doc-css")){
    const st = document.createElement("style");
    st.id = "h-doc-css"; st.textContent = DOC_CSS;
    document.head.appendChild(st);
  }

  let host = document.getElementById("h-host");
  if (host && host.shadowRoot){ H_ROOT = host.shadowRoot; return; }
  if (!host){
    host = document.createElement("div");
    host.id = "h-host";
    document.body.insertBefore(host, document.body.firstChild);
  }

  H_ROOT = host.attachShadow({ mode: "open" });

  /* a shadow root is a DocumentFragment: no insertAdjacentHTML on it */
  H_ROOT.innerHTML = `
<div class="h-shell">
  <header class="h-top">
    <span class="h-brand"><span class="h-dot"></span>Proto <em id="h-title">protótipo</em></span>

    <select class="h-sel" id="h-vp" aria-label="Viewport"></select>
    <select class="h-sel" id="h-zoomsel" aria-label="Escala">
      <option value="fit" id="h-zoomfit">Ajustar</option>
      <option value="100">100% · rolar</option>
      <option value="75">75%</option>
      <option value="50">50%</option>
    </select>

    <input class="h-linkin" id="h-linkin" spellcheck="false" autocomplete="off"
           aria-label="Link do estado — cole um para ir até ele" placeholder="#cenario/passo">

    <div class="h-pills">
      <span class="h-pill" id="h-dims">—</span>
      <span class="h-pill" id="h-checks">—</span>
    </div>

    <div class="h-right">
      <button class="h-btn" id="h-verify">Verificar</button>
      <button class="h-btn" id="h-dados-btn">Dados</button>
      <button class="h-btn" id="h-spec-btn">Gherkin</button>
      <button class="h-btn" id="h-rotate">Girar</button>
      <button class="h-btn" id="h-flags" aria-pressed="true">Cenários</button>
      <button class="h-btn" id="h-reset">Resetar</button>
    </div>
  </header>

  <section class="h-falha" id="h-falha" hidden>
    <div class="h-falha-cx">
      <h3>A verificação falhou</h3>
      <p>O protótipo não foi desenhado. Copie o relatório abaixo e devolva a quem editou.</p>
      <textarea id="h-falha-txt" spellcheck="false" readonly></textarea>
      <div class="h-falha-acoes">
        <button class="h-btn" id="h-falha-copy">Copiar relatório</button>
        <button class="h-btn" id="h-falha-ver">Ver assim mesmo</button>
      </div>
    </div>
  </section>

  <div class="h-body">
    <aside class="h-side" id="h-side"></aside>
    <div class="h-resize" id="h-resize" role="separator" aria-orientation="vertical"
         tabindex="0" title="Arraste para largura · duplo clique volta ao padrão"></div>

    <main class="h-stage" id="h-stage">
      <div class="h-frame-box" id="h-frame-box">
        <div class="h-frame" id="h-frame"><slot name="app"></slot></div>
      </div>

      <aside class="h-mon" id="h-mon" hidden>
        <button class="h-mon-trig" id="h-mon-trig" aria-expanded="false">
          <span class="pt"></span><span id="h-mon-resumo">rede</span>
        </button>
        <div class="h-mon-corpo" id="h-mon-corpo" hidden>
          <div class="h-mon-list" id="h-mon-list"></div>
          <pre class="h-mon-det" id="h-mon-det" hidden></pre>
        </div>
      </aside>

      <section class="h-spec" id="h-dados" hidden>
        <div class="h-spec-hd">
          <div>
            <h3>Dados e rede</h3>
            <p>As fixtures que respondem aos pedidos, e tudo que a tela pediu até agora.</p>
          </div>
          <div class="h-right"><button class="h-btn" id="h-dados-limpar">Limpar registro</button></div>
        </div>
        <div class="h-dados-cols">
          <div class="h-dados-col">
            <p class="h-side-title">Rotas e registro</p>
            <div id="h-dados-log" class="h-log"></div>
          </div>
          <div class="h-dados-col">
            <p class="h-side-title">Fixtures</p>
            <textarea id="h-dados-fix" spellcheck="false" readonly></textarea>
          </div>
        </div>
      </section>

      <section class="h-spec" id="h-spec" hidden>
        <div class="h-spec-hd">
          <div>
            <h3>Especificação executável</h3>
            <p>Entregue a quem for implementar. É o contrato do comportamento.</p>
          </div>
          <div class="h-right">
            <button class="h-btn" id="h-spec-copy">Copiar</button>
            <button class="h-btn" id="h-dl-all" title="Baixa os três arquivos de uma vez">Baixar tudo</button>
          </div>
        </div>
        <textarea id="h-spec-text" spellcheck="false" readonly></textarea>
        <div class="h-spec-dl">
          <span>Para quem for implementar:</span>
          <button class="h-btn" id="h-dl-feature" title="Os cenários em Gherkin">.feature</button>
          <button class="h-btn" id="h-dl-api" title="As rotas, com pedido e resposta observados">api.md</button>
          <button class="h-btn" id="h-dl-html" title="O protótipo em um arquivo só">.html</button>
          <code id="h-dl-hint"></code>
        </div>
      </section>
    </main>
  </div>
</div>
`;

  /* the chrome stylesheet goes in with it, ahead of the markup; the
     document keeps none of it, which is what makes the isolation mutual */
  const sheet = document.querySelector('link[rel="stylesheet"][href*="harness.css"]')
             || document.querySelector("style[data-harness-css]");
  if (sheet){
    H_ROOT.insertBefore(sheet.cloneNode(true), H_ROOT.firstChild);
    sheet.remove();
  }

  /* light-DOM mount, projected into the frame above */
  let app = host.querySelector("#app") || document.getElementById("app");
  if (!app){
    app = document.createElement("div");
    app.id = "app";
  }
  app.setAttribute("slot", "app");
  host.appendChild(app);
})();

/* ============================================================
   HARNESS — do not edit
   ============================================================ */
const Proto = (() => {
  /* build stamp: lets you tell from the screen whether the open file is
     the newest one — hover over the Proto name */
  const VERSION = "v3.7 · 2026-08-17 · primeira pintura imediata";
  /* ---------- breakpoint ladder ----------
     Naming the widths changes what you ask of the prototype: "works on
     mobile" is vague; "on xxs the primary action moves to the fixed
     footer" is verifiable. The ladder is the ruler — the devices are just
     shortcuts to market widths. Change it in `widths` in the config. */
  const DEFAULT_LADDER = [
    { id:"xxs", label:"xxs · 320",  w:320,  h:640,  level:true },
    { id:"xs",  label:"xs · 380",   w:380,  h:780,  level:true },
    { id:"sm",  label:"sm · 480",   w:480,  h:860,  level:true },
    { id:"md",  label:"md · 768",   w:768,  h:1024, level:true },
    { id:"lg",  label:"lg · 1024",  w:1024, h:900,  level:true },
    { id:"xlg", label:"xlg · 1440", w:1440, h:900,  level:true }
  ];

  const DEVICES = [
    { id:"se",    label:"iPhone SE",          w:375,  h:667  },
    { id:"pro",   label:"iPhone 16 Pro Max",  w:440,  h:956  },
    { id:"mini",  label:"iPad Mini",          w:744,  h:1133 },
    { id:"ipad",  label:"iPad Pro",           w:1024, h:1366 },
    { id:"livre", label:"Largura livre",      w:0, h:0, freeForm:true }
  ];

  let LADDER = DEFAULT_LADDER.slice();
  let VIEWPORTS = LADDER.concat(DEVICES);

  /* ---------- views: more than one device on the same data ----------
     A flow that needs two people needs two screens at once — someone orders,
     someone else prepares, and each has to see what the other did. `views`
     declares them; how many and who they are is the product's business, and
     the harness holds no opinion beyond needing a width for each.

         views:[
           { id:"cliente", label:"Cliente", actor:"cliente", viewport:"se"   },
           { id:"cozinha", label:"Cozinha", actor:"cozinha", viewport:"ipad" }
         ]

     The prototype does NOT draw the stage. It keeps rendering ONE screen and
     the harness calls `mount` once per view, each in a frame the width of the
     device it stands for. That is the whole design: a view is an ordinary
     screen, so every rule the harness already has for one screen — the width
     ladder, the three states, touch targets, wiring, the journey — applies to
     each of them unchanged, instead of a stage nobody can measure.

     Declaring no views leaves every path below exactly as it was. */
  let VIEWS = [];
  function multi(){ return VIEWS.length > 0; }

  /* the view being drawn or measured right now: what `state.rung`,
     `state.widthPx` and the measurements answer for */
  let renderingView = null;

  function normalizeViews(list){
    if (!Array.isArray(list) || !list.length) return [];
    return list.map((v, i) => {
      const id = String(v.id || v.identifier || ("vista" + (i + 1)));
      return { id, label: v.label || id, actor: v.actor || v.papel || null,
               viewport: v.viewport || v.aparelho || null,
               w: Number(v.w) || 0, h: Number(v.h) || 0,
               /* what this screen subscribes to — dropping it here was how a
                  view ended up watching nothing while saying it did */
               watches: v.watches || v.assina || null };
    });
  }

  function viewById(id){ return VIEWS.find(v => v.id === id) || null; }

  /* A view's width. What `views` declares is the device the specification is
     about; `state.viewSizes` is the person at the bench asking to see that
     same screen on another one — the audit still walks every view across the
     whole ladder either way, so swapping here changes what you look at, never
     what is verified. */
  function declaredWidth(v){
    if (!v) return null;
    if (v.w) return { id: rungOf(v.w).id, w: v.w, h: v.h || 800 };
    const d = VIEWPORTS.find(x => x.id === v.viewport);
    return d ? { id: d.id, w: d.w, h: d.h } : null;
  }

  function viewWidth(v){
    if (!v) return null;
    /* The swap is the bench's, never the suite's. Verification and the audit
       always measure the device the view DECLARES — otherwise looking at a
       screen on another size would quietly change what the gate approved,
       and the specification would be whatever was last picked from a
       dropdown. */
    const swap = !verifying && state.viewSizes && state.viewSizes[v.id];
    if (swap){
      const d = VIEWPORTS.find(x => x.id === swap);
      if (d && !d.freeForm) return { id: d.id, w: d.w, h: d.h };
    }
    return declaredWidth(v);
  }

  /* which rung a width falls on: the largest rung it reaches */
  function rungOf(w){
    let current = LADDER[0];
    for (const d of LADDER) if (w >= d.w) current = d;
    return current;
  }

  /* the chrome is in the shadow root, #app is in the light DOM */
  const $ = id => (H_ROOT && H_ROOT.getElementById(id)) || document.getElementById(id);
  const clone = o => (o == null ? {} : JSON.parse(JSON.stringify(o)));

  let cfg = { title:"protótipo", feature:null, context:[], scenarios:[], render:null, mount:null };
  let initial = null;
  let results = {};      /* live: scenarioId -> { step: bool } */
  let suite   = null;    /* the last complete verification */
  let muteHash = false;
  let search = "", searchFocused = false, onlyFailures = false;
  const closedGroups = new Set();
  let seededStates = false;
  /* Verification holds the queue for ~30s. Without this, clicking a
     scenario mid-run does nothing — navigation waits for the suite to
     finish and the bar looks dead. Navigating cancels the run: whoever is
     looking at the screen wins over whoever is checking it. */
  let cancelVerification = false;
  /* the context the PERSON chose. Verification swaps context for every
     scenario; when it finishes (or is interrupted) it has to return to
     what is ticked now, not to the snapshot from the start — otherwise
     cancelling undoes the very choice that caused the cancellation. */
  let userCtx = null;
  let interrupted = false;

  /* Interrupting the suite to navigate is right, but leaving it interrupted
     forever is expensive: its cache is what makes the next navigation
     instant. So it resumes on its own once the person stops interacting —
     without stealing the turn while they are still using it. */
  /* Saved progress from an interrupted run. Starting over was pure waste:
     since every scenario is verified in the context it demands for itself,
     what the person does on screen (navigating, switching plan) invalidates
     nothing already verified. Only reloading the file invalidates it — and
     then the whole page restarts anyway. */
  let partial = null;
  let resumeTimer = null;
  function scheduleResume(){
    if (cfg.resumeVerification === false) return;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (verifying || !interrupted) return;
      verify().then(r => { if (r && r.bad && !r.canceled) showFailureSafely(); });
    }, cfg.resumeWait || 1200);
  }

  /* showFailure lives inside init; this is the hook that reaches it */
  let showFailureSafely = () => {};
  let byKeyboard = false;
  let manualChoice = false;   /* the person just touched the width selector */
  let awaiting = null;
  /* did the person touch the screen after the last replayed step? */
  let appDirty = false;
  let didRender = false;
  let showHidden = false;   /* sidebar showing only what is out of scope */
  let openDim = null;    /* the open multiselect panel — lives outside the
                            sidebar rebuild, or it would close on every render */

  const state = {
    scenario:null, step:-1, example:0,
    ctx:{},        /* dimensionId -> active id (string), or a list (flags) */
    app:{}, ex:null,
    viewport:"xs", landscape:false, zoom:"fit", sidebar:288,
    /* viewId -> a viewport id, when the bench is showing that view on a
       device other than the one it declares */
    viewSizes:{},

    /* is a request in flight right now? AsyncStateContainer uses this to show
       the loading state without the prototype hand-managing a flag */
    waitingFor(){ return network.inFlightScreen > 0; },
    /* What the server says, for the view being drawn — only the names that
       view declares it watches, so a screen that forgot to subscribe stays
       stale and the gate notices instead of the person. Live: a write
       anywhere re-reads these and redraws every view holding them. */
    get data(){ return dataFor(renderingView).data; },
    get dataError(){ return dataFor(renderingView).dataError; },
    /* which view is being drawn. With no views declared this is null and the
       prototype never has to ask. */
    get view(){ return renderingView ? renderingView.id : null; },
    get viewLabel(){ return renderingView ? renderingView.label : null; },
    get actor(){ return renderingView ? renderingView.actor : null; },
    /* the rung the screen is being drawn at: lets the prototype change
       structure, not just CSS, when the arrangement calls for it */
    get rung(){ return rungOf(currentWidth().w).id; },
    get widthPx(){ return currentWidth().w; },
    option(dimId){ return this.ctx[dimId]; },
    flag(id){
      for (const d of cfg.context){
        if (d.kind !== "flags") continue;
        if ((this.ctx[d.id] || []).indexOf(id) > -1) return true;
      }
      return false;
    },
    can(perm){ return can(perm); }
  };

  /* ---------- contexto: plano / papel / funcionalidades ---------- */
  function dim(id){ return cfg.context.find(d => d.id === id); }

  /* the options active right now. On a scale, the active level includes the
     ones below it: whoever is on Ultra also has what Pro has. */
  function activeOptions(actor){
    const out = [];
    cfg.context.forEach(d => {
      let v = state.ctx[d.id];
      /* A view declares its actor, and several are on screen at once — so
         "the role" stops being one answer for the whole bench. For the view
         being drawn, the exclusive dimension that owns that actor answers as
         the actor, whatever the bar has ticked. The other dimensions (the
         plan, the flags) still answer for the bench: they describe the
         installation, not who is looking. */
      if (actor && d.kind !== "flags" && d.options.some(o => o.id === actor)) v = actor;
      if (d.kind === "flags"){
        (v || []).forEach(id => {
          const o = d.options.find(x => x.id === id);
          if (o) out.push({ d, o });
        });
      } else if (d.kind === "escala"){
        const i = d.options.findIndex(x => x.id === v);
        d.options.slice(0, i + 1).forEach(o => out.push({ d, o }));
      } else {
        const o = d.options.find(x => x.id === v);
        if (o) out.push({ d, o });
      }
    });
    return out;
  }

  /* A permission needs the blessing of EVERY dimension that mentions it.
     The plan enables, the role authorises — a union would let the Pro plan
     hand margin to the waiter. A dimension that never mentions the
     permission has no opinion. A permission nobody mentions does not
     exist: better that a scenario visibly disappears than that a
     mistyped @pode: slips through unnoticed. */
  function can(perm, actor){
    let cited = false;
    for (const d of cfg.context){
      const mentions = d.options.some(o => (o.allows || []).indexOf(perm) > -1);
      if (!mentions) continue;
      cited = true;
      const ok = activeOptions(actor)
        .filter(x => x.d.id === d.id)
        .some(({ o }) => (o.allows || []).some(p => p === perm || p === "*"));
      if (!ok) return false;
    }
    if (!cited){
      /* only the wildcard can cover a permission no option lists */
      return activeOptions(actor).some(({ o }) => (o.allows || []).indexOf("*") > -1);
    }
    return true;
  }

  /* a tag only filters if it matches something in the context.
     @catálogo, @validação and the like remain labels only. */
  function tagSatisfied(tag){
    if (tag.indexOf("@pode:") === 0) return state.can(tag.slice(6));

    const id = tag.replace(/^@/, "");
    for (const d of cfg.context){
      const idx = d.options.findIndex(o => o.id === id);
      if (idx < 0) continue;
      const v = state.ctx[d.id];
      if (d.kind === "flags")  return (v || []).indexOf(id) > -1;
      if (d.kind === "escala") return d.options.findIndex(o => o.id === v) >= idx;
      return v === id;
    }
    return true;   /* a tag with no match: a label, not a filter */
  }

  function isVisible(s){ return (s.tags || []).every(tagSatisfied); }
  function visible(){ return cfg.scenarios.filter(isVisible); }
  /* ---------- implementation hint ---------- */
  /* Where this scenario becomes code. What the scenario declares wins; the
     rest is inherited from the feature, so the same route is not repeated
     across five scenarios. Accepts keys in Portuguese or English. */
  function implOf(s){
    const base = (cfg.feature && cfg.feature.impl) || {};
    const own  = (s && s.impl) || {};
    const pick = k => own[k[0]] != null ? own[k[0]]
                    : own[k[1]] != null ? own[k[1]]
                    : base[k[0]] != null ? base[k[0]] : base[k[1]];
    const out = {
      component: pick(["componente","component"]),
      route:       pick(["rota","route"]),
      moduleName:     pick(["modulo","module"]),
      notes:      pick(["notas","notes"])
    };
    return (out.component || out.route || out.moduleName || out.notes) ? out : null;
  }

  function implLine(im){
    const bits = [];
    if (im.component) bits.push("componente " + im.component);
    if (im.route)       bits.push("rota " + im.route);
    if (im.moduleName)     bits.push("módulo " + im.moduleName);
    return bits.join(" · ");
  }

  /* ---------- primitives that already exist in the library ---------- */
  /* Prototyping by hand is fast, and that is what vanilla mode is for.
     The risk is the home-made version being rebuilt in production when the
     library already has the piece. So the harness scans what was drawn,
     crosses it with the primitives map and carries the mapping into the
     .feature: whoever implements it gets "this one is a Button", not a
     screen to reinvent. */
  function scanPrim(root){
    const map = cfg.primitives || {};
    const cat = cfg.catalog || (typeof window !== "undefined" && window.PROTO_UI) || null;
    const out = [];
    Object.keys(map).forEach(sel => {
      let n = 0;
      try { n = root.querySelectorAll(sel).length; } catch { n = 0; }
      if (!n) return;
      const v = map[sel];
      const nameStr = typeof v === "string" ? v : v.nameStr;
      /* the path comes from the catalog — hand-writing imports for 128
         components is how a wrong name gets into the specification */
      const de = (typeof v === "object" && v.de) || (cat && cat[nameStr]) || null;
      out.push({ sel, nameStr, de, n, unknown: !!cat && !cat[nameStr] });
    });
    return out;
  }

  /* two selectors can map to the same component (.card and .var are both
     Card), so it groups by name and sums — the list is of components, not
     of classes */
  function groupPrim(list){
    const by = {};
    list.forEach(p => {
      const g = by[p.nameStr] || (by[p.nameStr] = { nameStr:p.nameStr, de:p.de, n:0, sels:[], unknown:p.unknown });
      g.n += p.n;
      g.sels.push(p.sel);
    });
    return Object.values(by);
  }

  function primLine(list){
    return groupPrim(list)
      .map(p => `${p.nameStr}${p.n > 1 ? " ×" + p.n : ""}`
              + (p.unknown ? " (?)" : "")
              + ` ← ${p.sels.join(", ")}`)
      .join(" · ");
  }

  /* imports ready to paste, only for what the screen uses */
  function primImports(list){
    return groupPrim(list).filter(p => p.de)
      .map(p => `import { ${p.nameStr} } from "${p.de}";`);
  }

  /* scans a scenario at its last step, off screen */
  async function primOf(s){
    if (!cfg.primitives) return [];
    const probe = document.createElement("div");
    probe.className = "h-probe";
    sizeProbe(probe, currentWidth().w);
    document.body.appendChild(probe);
    const steps = (s.steps || []).length;
    const built = await buildState(s, steps - 1, 0);
    let list = [];
    try {
      paint(probe, { app:built.app, ex:built.ex, scenario:s.id, step:steps - 1, example:0 });
      list = scanPrim(probe);
    } catch { list = []; }
    probe.remove();
    return list;
  }

  /* ---------- the painter ----------
     One place draws the screen, so the live stage, the replay's probe, the
     assertions and the per-rung measurements all get the same treatment.

     With no views declared it calls `mount` once, on the element it was
     given — the path the harness has always taken. With views declared it
     calls `mount` once per view, each inside a frame the width of that
     view's own device, and hands back a root per view: that is what lets a
     step address one screen and an assertion read another.

     `only` paints a single view alone. The audit uses it to walk the ladder
     for one view at a time, so a phone is measured at a phone's widths and
     nothing measures the stage. */
  function widthFor(v){
    const before = renderingView;
    renderingView = v;
    try { return currentWidth(); } finally { renderingView = before; }
  }

  /* The size picker that rides above each view on the bench. It is built for
     the live stage only: a probe is what the rules measure, and chrome inside
     one would be measured with the screen. */
  function viewPicker(v){
    const sel = document.createElement("select");
    sel.className = "h-view-vp";
    sel.setAttribute("aria-label", "Aparelho da vista " + v.label);
    const declared = (declaredWidth(v) || {}).id;
    const group = (label, list) => {
      const g = document.createElement("optgroup");
      g.label = label;
      list.filter(d => !d.freeForm).forEach(d => {
        const o = document.createElement("option");
        o.value = d.id;
        o.textContent = d.label + (d.id === declared ? " · declarado" : "");
        g.appendChild(o);
      });
      sel.appendChild(g);
    };
    group("Pontos de quebra", LADDER);
    group("Aparelhos", DEVICES);
    sel.value = (state.viewSizes && state.viewSizes[v.id]) || declared || "";
    sel.addEventListener("change", ev => {
      /* the declared device is not an override — picking it back clears one,
         so the bench stops claiming a swap that is no longer there */
      if (ev.target.value === declared) delete state.viewSizes[v.id];
      else state.viewSizes[v.id] = ev.target.value;
      savePrefs();
      render();
      fit();
    });
    return sel;
  }

  function paint(host, extras, only){
    const draw = (el, v) => {
      const before = renderingView;
      renderingView = v;
      try {
        /* extras == null is the live stage: it hands `mount` the state object
           itself, getters and all, exactly as before */
        let shown;
        if (v == null && extras == null) shown = state;
        else {
          shown = (extras == null) ? { ...state } : { ...state, ...extras };
          /* `mount` renders ONE screen and has no business reading the others,
             and the roots on the live state point at the live document — a
             mount drawing into a probe would be handed the wrong nodes. So no
             copy carries them; the assertions get them set deliberately,
             after the paint that produced them. */
          delete shown.views;
          if (v){
            /* Callers build their `shown` before they know which view it is
               for, so it carries the STAGE's answers: view null, and the rung
               and width of the bench. Re-stamp them here, or every view draws
               as the first one and measures at somebody else's width. */
            const w = currentWidth();
            const d = dataFor(v);
            shown.view      = v.id;
            shown.viewLabel = v.label;
            shown.actor     = v.actor;
            shown.rung      = rungOf(w.w).id;
            shown.widthPx   = w.w;
            shown.data      = d.data;
            shown.dataError = d.dataError;
            shown.can       = perm => can(perm, v.actor);
            shown.waitingFor = () => waitingForView(v.id);
          }
        }
        if (cfg.mount)       cfg.mount(el, shown);
        else if (cfg.render) el.innerHTML = cfg.render(shown);
      } finally { renderingView = before; }
    };

    if (!multi()){ draw(host, null); return { "": host }; }

    host.classList.add("h-multi");
    const roots = {};
    VIEWS.forEach(v => {
      if (only && only !== v.id) return;
      let cell = [...host.children].find(c => c.getAttribute
                 && c.getAttribute("data-h-view") === v.id);
      if (!cell){
        cell = document.createElement("div");
        cell.className = "h-view";
        cell.setAttribute("data-h-view", v.id);
        /* The label and its picker are chrome, and chrome inside a probe gets
           read as the prototype's own: a 10px label is measured as text below
           the minimum, and in strict mode its <span> is reported as raw
           markup the prototype cannot remove, because it never wrote it. So
           the bench gets them and a probe never does. */
        if (host.id === "app"){
          const tag = document.createElement("div");
          tag.className = "h-view-label";
          const nome = document.createElement("span");
          nome.className = "h-view-name";
          nome.textContent = v.label;
          tag.appendChild(nome);
          tag.appendChild(viewPicker(v));
          cell.appendChild(tag);
        }
        const frame = document.createElement("div");
        frame.className = "h-view-frame";
        cell.appendChild(frame);
        host.appendChild(cell);
      }
      const frame = cell.querySelector(".h-view-frame");
      /* the picker mirrors the state, never a second source of truth: Resetar
         and a restored preference both come through here */
      const picker = cell.querySelector(".h-view-vp");
      if (picker){
        const want = (state.viewSizes && state.viewSizes[v.id]) || (declaredWidth(v) || {}).id || "";
        if (picker.value !== want) picker.value = want;
      }
      const w = widthFor(v);
      frame.style.width  = w.w + "px";
      frame.style.height = w.h + "px";
      roots[v.id] = frame;
      draw(frame, v);
    });
    return roots;
  }

  /* What each view is showing right now, as text to compare. Coarse on
     purpose: "did this screen change at all" is the question, and anything
     finer would start guessing which changes count. */
  /* Which of the three states each view was seen in, across the whole suite.
     The single-screen rule is that a page owes loading, empty and error; with
     several views it is owed by each of them, and this is the evidence rather
     than a promise in a tag. */
  let statesSeen = {};
  function noteStates(roots){
    if (!multi()) return;
    Object.keys(roots).forEach(id => {
      const el = roots[id];
      if (!el) return;
      STATES.forEach(e => {
        if (el.querySelector(`[data-estado="${e}"]`)){
          (statesSeen[id] = statesSeen[id] || new Set()).add(e);
        }
      });
    });
  }

  function snapshotViews(roots){
    const out = {};
    Object.keys(roots).forEach(id => { out[id] = roots[id] ? roots[id].innerHTML : null; });
    return out;
  }

  /* The element a step or an assertion means. Naming no view means the whole
     stage — which is what a cross-view assertion wants to read. */
  function rootOf(roots, host, viewId){
    if (!multi()) return host;
    return viewId ? (roots[viewId] || null) : host;
  }

  /* ---------- steps that really click ---------- */
  /* `applyState` describes the transition; the button on screen runs its
     own. The two can drift apart with nobody noticing. A step with `click`
     closes that gap: it renders the state, looks for the element and calls
     the SAME handlers registered with Proto.on. If the element does not
     exist the step fails — the specification now demands the button
     exists. */
  let sandbox = null;
  /* one replay at a time. Without this, the replay triggered by navigation
     and the automatic verification run together and each wipes the other's
     sandbox. */
  let queue = Promise.resolve();
  function enqueue(fn){
    const p = queue.then(fn, fn);
    queue = p.catch(() => {});
    return p;
  }
  const problems = [];
  const silentChanges = [];
  const suspectLocal = [];
  const arrivals = new Set();
  /* steps that actually changed the state: `${scenario}|${index}` */
  const stateChanged = new Set();
  const lyingLabels = [];
  const exercised = new Set();   /* the "type selector" of a handler that has really fired */

  /* Not every interaction is a click. A field gets filled, a select gets
     chosen, a switch gets toggled — and each fires different events. A step
     declares what the person does and the harness runs it against the real
     DOM, calling the handlers registered with Proto.on. */
  /* How do we know THIS button should have called the server? Three
     independent signals, none of which relies on anyone declaring intent:

       label        "Salvar" promises to store. A control with a
                    persistence verb that makes no request is lying, and
                    marking local: true does not contradict its own text.
       provenance   did it touch data that came from an API response? then
                    somebody has to send it back there.
       durability   did the write change the fixtures? otherwise a reload
                    undoes it.

     None is infallible alone; together they cover the false "Salvar". */
  const PERSISTENT_VERBS = /\b(salvar|guardar|gravar|confirmar|enviar|publicar|excluir|remover|apagar|criar|cadastrar|adicionar|atualizar|editar|pagar|finalizar|aplicar|convidar|aprovar|recusar|cancelar pedido)\b/i;

  const ACTIONS = {
    click:   { evs:["click"],           caption:"clica em"    },
    fill: { evs:["input","change"],  caption:"preenche"    },
    choose:  { evs:["change"],          caption:"escolhe em"  },
    toggleCtl:  { evs:["change","click"],  caption:"alterna"     }
  };

  /* releases the stalled requests: the server answered */
  async function releaseStalled(filterText){
    const aim = network.stalled.filter(p => !filterText || p.routeId.indexOf(filterText) > -1);
    network.stalled = network.stalled.filter(p => aim.indexOf(p) < 0);
    const payloads = [];
    for (const p of aim){
      const r = p.releases();
      try { payloads.push(await r.json()); } catch { payloads.push(null); }
    }
    await awaitNetwork();
    return { n: aim.length, payload: payloads[0], payloads };
  }

  function specOf(st){
    for (const kindName of Object.keys(ACTIONS)){
      if (!st[kindName]) continue;
      const v = st[kindName];
      return typeof v === "string"
        ? { kindName, sel:v, val:undefined, on:st.on || null }
        : { kindName, sel:v.sel || v.selectorStr, val:v.val, on:st.on || v.on || null };
    }
    return null;
  }

  async function runAction(spec, app, exRow){
    const { kindName, sel, val } = spec;
    const probe = document.createElement("div");
    probe.className = "h-probe";
    sizeProbe(probe, currentWidth().w);
    document.body.appendChild(probe);

    /* With views declared, a step that does not say WHERE it acts is not a
       specification: two screens are on the bench and the same control can
       be on both. */
    if (multi() && !spec.on){
      probe.remove();
      return { app, error_:'o passo não diz em qual vista age — falta on:"' 
               + VIEWS.map(v => v.id).join('" / "') + '"' };
    }
    if (spec.on && !viewById(spec.on)){
      probe.remove();
      return { app, error_:'o passo age na vista "' + spec.on + '", que não está declarada em views' };
    }

    let roots;
    try {
      roots = paint(probe, { app, ex:exRow });
    } catch (e){
      probe.remove();
      return { app, error_:"a tela quebrou antes de " + ACTIONS[kindName].caption + " " + sel + ": " + e.message };
    }

    const where = spec.on ? ' na vista "' + spec.on + '"' : " nesta tela";
    const root = rootOf(roots, probe, spec.on);
    const el = root && root.querySelector(sel);
    if (!el){ probe.remove(); return { app, error_:"não há " + sel + where }; }
    if (el.disabled){ probe.remove(); return { app, error_:sel + " está desabilitado" + where }; }

    /* filling a button or clicking a field is a script error, not a code one */
    const tag = el.tagName.toLowerCase();
    const isField = tag === "input" || tag === "textarea" || tag === "select";
    if (kindName !== "click" && !isField){
      probe.remove();
      return { app, error_:sel + " não é campo — não dá para " + ACTIONS[kindName].caption };
    }

    if (kindName === "toggleCtl") el.checked = !el.checked;
    else if (kindName !== "click"){
      if (val === undefined){
        probe.remove();
        return { app, error_:"o passo não diz com que valor " + ACTIONS[kindName].caption + " " + sel };
      }
      el.value = String(val);
    }

    const previousSandbox = sandbox;
    sandbox = { app: clone(app) };
    const s = { ...state, app: sandbox.app, ex: exRow, view: spec.on || null };
    if (spec.on){
      const v = viewById(spec.on);
      s.can = perm => can(perm, v && v.actor);
    }
    const previousActing = actingView;
    actingView = spec.on || null;
    let touched = 0;
    ACTIONS[kindName].evs.forEach(ev => {
      handlers.forEach(h => {
        if (h.type !== ev) return;
        let sameAs = false;
        try { sameAs = el.matches(h.selector); } catch { sameAs = false; }
        if (!sameAs) return;
        touched++;
        exercised.add(h.type + " " + h.selector);
        try { h.fn({ target:el, currentTarget:el, preventDefault(){}, stopPropagation(){} }, el, s); }
        catch (e){ problems.push("handler de " + h.selector + " quebrou: " + e.message); }
      });
    });

    /* the handler may have fired a request: the sandbox only closes once the
       network settles, otherwise the response's set() would land on screen */
    await awaitNetwork();
    actingView = previousActing;
    const out = sandbox.app;
    sandbox = previousSandbox;
    const caption = ((el.textContent || "") + " " + (el.getAttribute("data-act") || "")
                    + " " + (el.getAttribute("aria-label") || "")).trim();
    probe.remove();
    if (!touched) return { app: out, caption, error_:"nenhum handler responde a " + sel + where + " para " + kindName };
    return { app: out, caption };
  }

  /* Why this scenario is out. "Everything on" does not exist when a
     dimension is exclusive: being on Dono already removes the @garcom
     scenarios. So every unsatisfied tag explains what it demands and what
     is currently in force. */
  function reasons(s){
    return (s.tags || []).filter(t => !tagSatisfied(t)).map(tag => {
      if (tag.indexOf("@pode:") === 0){
        const perm = tag.slice(6);
        const aim = [];
        cfg.context.forEach(d => {
          const opt = d.options.find(o => (o.allows || []).some(p => p === perm || p === "*"));
          const alreadyOk = activeOptions().filter(x => x.d.id === d.id)
            .some(({ o }) => (o.allows || []).some(p => p === perm || p === "*"));
          if (opt && !alreadyOk) aim.push({ dim:d.id, opt:opt.id, label:`${d.label} = ${opt.label || opt.id}` });
        });
        return { tag, textStr:`exige a permissão ${perm}`, missing:aim.map(a => a.label).join(" e "), fix:aim };
      }

      const id = tag.replace(/^@/, "");
      for (const d of cfg.context){
        const o = d.options.find(x => x.id === id);
        if (!o) continue;
        const current = state.ctx[d.id];
        const nowMs = d.kind === "flags"
          ? `${(current || []).length ? (current || []).join(", ") : "nenhuma"}`
          : (d.options.find(x => x.id === current) || {}).label || current;
        const verb = d.kind === "escala" ? `${o.label || id} ou acima`
                    : d.kind === "flags"  ? `${o.label || id} ligada`
                    : `${d.label} = ${o.label || id}`;
        return { tag, textStr:`exige ${verb}`, missing:`agora: ${nowMs}`, fix:[{ dim:d.id, opt:o.id }] };
      }
      return { tag, textStr:`exige ${tag}`, missing:"", fix:[] };
    });
  }

  /* The context THIS scenario demands. Verification cannot depend on the
     chips ticked in the bar: a waiter scenario has to run as the waiter, a
     @pro one as Pro. Otherwise the suite cries "dead route" only because
     whoever is looking at the screen is in another role. */
  function contextOf(s){
    const ctx = clone(initial ? initial.ctx : state.ctx);
    const stored = state.ctx;
    state.ctx = ctx;
    try {
      reasons(s).forEach(m => m.fix.forEach(f => {
        const d = dim(f.dim);
        if (!d) return;
        if (d.kind === "flags"){
          const cur = ctx[d.id] || [];
          if (cur.indexOf(f.opt) < 0) ctx[d.id] = cur.concat(f.opt);
        } else ctx[d.id] = f.opt;
      }));
    } finally { state.ctx = stored; }
    return ctx;
  }

  function applyFix(s){
    reasons(s).forEach(m => m.fix.forEach(f => {
      const d = dim(f.dim);
      if (!d) return;
      if (d.kind === "flags"){
        const cur = state.ctx[d.id] || [];
        if (cur.indexOf(f.opt) < 0) state.ctx[d.id] = cur.concat(f.opt);
      } else {
        state.ctx[d.id] = f.opt;
      }
    }));
    suite = null;
  }



  /* ---------- data layer ----------
     The screen never invents data: it asks. The harness intercepts fetch
     and answers from the fixtures. A Service Worker would be ideal, but it
     needs a secure context — it does not run on file:// nor in the preview
     inside an iframe, which is where these files open. Intercepting fetch
     gives the same discipline: swapping in a real backend means deleting
     the interceptor, not rewriting the screen. */
  /* the view whose handler is running right now: what a request fired from
     it belongs to. Without this, `waitingFor()` is one number for the whole
     bench and a request from the kitchen puts the customer's screen into a
     skeleton it has no reason to show. */
  let actingView = null;

  const network = { inFlight:0, log:[], tela:[], failures:{}, counter:0, seq:0, origin:null, stalled:[], seenRoutes:{}, inFlightScreen:0,
    /* viewId -> requests in flight; `loose` is what no view owns (the Dado,
       a screen load) and which therefore every view is waiting on */
    byView:{}, loose:0,
    /* one success and one failure per route, kept for the API contract
       export: the log is a rolling window and loses them */
    samples:{} };

  function paraRegex(pathStr){
    return new RegExp("^" + pathStr
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:([A-Za-z_]+)/g, "(?<$1>[^/]+)") + "/?$");
  }

  function findRoute(httpMethod, pathStr){
    for (const r of (cfg.routes || [])){
      if ((r.httpMethod || "GET").toUpperCase() !== httpMethod) continue;
      const m = paraRegex(r.pathStr).exec(pathStr);
      if (m) return { route:r, params:m.groups || {} };
    }
    return null;
  }

  function installNetwork(){
    if (window.__protoNetwork) return;
    window.__protoNetwork = true;
    const originalFetch = window.fetch ? window.fetch.bind(window) : null;

    window.fetch = function(url, opts){
      opts = opts || {};
      const httpMethod = String(opts.method || "GET").toUpperCase();
      const pathStr = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      const found = findRoute(httpMethod, pathStr);
      const t0 = Date.now();

      /* a route the scenario forced to fail: this is how ErrorState is tested */
      const forced = network.failures[httpMethod + " " + pathStr] || (found && network.failures[httpMethod + " " + found.route.pathStr]);

      const register = (status, obs, submission, back) => {
        /* a separate counter: the log is a 60-entry window that drops the old
           ones, so measuring "how many requests this scenario made" by its
           size gives zero as soon as the window fills */
        network.counter++;
        const reg = { id:++network.seq, httpMethod, pathStr, status, ms: Date.now() - t0,
                      obs: obs || "", verifyState: verifying,
                      routeId: found ? (httpMethod + " " + found.route.pathStr) : null,
                      origin: network.origin ? { ...network.origin } : null,
                      submission: submission === undefined ? null : submission,
                      back: back === undefined ? null : back };
        network.log.push(reg);
        if (network.log.length > 60) network.log.shift();

        if (reg.routeId){
          const sm = network.samples[reg.routeId] = network.samples[reg.routeId] || {};
          const slot = (status && status < 300) ? "ok" : "error_";
          if (!sm[slot]) sm[slot] = { status, request:reg.submission, response:reg.back,
                                      from: reg.origin ? reg.origin.nameStr : null };
        }
        /* what THIS screen asked for: verification runs off screen and does not
         count */
        /* route coverage lives outside the log: the log is a 60-entry window
           and, with the step-by-step scan, real calls fall out of it */
        if (reg.routeId && reg.origin){
          const v = network.seenRoutes[reg.routeId] = network.seenRoutes[reg.routeId]
            || { ok:new Set(), error_:new Set(), origins:new Set() };
          if (status) (status < 300 ? v.ok : v.error_).add(reg.origin.nameStr);
          v.origins.add(reg.origin.stp >= 0 ? "passo" : "dado");
        }
        if (!verifying){
          network.tela.push(reg);
          if (network.tela.length > 25) network.tela.shift();
        }
        return reg;
      };

      if (!found){
        register(404, "rota não declarada", null, { error_:"rota não declarada" });
        return Promise.resolve(resposta(404, { error_:"rota não declarada: " + httpMethod + " " + pathStr }));
      }

      const payload = opts.body ? tryJson(opts.body) : null;

      network.inFlight++;
      /* decide HERE whether this request counts as a visible wait: the
         response arrives later, when `replaying` may already have changed,
         and using the flag on the way back made the counter go down without
         ever having gone up */
      const countsOnScreen = !verifying && !replaying;
      const owner = actingView;
      if (countsOnScreen){ network.inFlightScreen++; markIn(owner); warnNetwork(); }
      const ctx = { params: found.params, payload, data_: cfg.data_, query:{} };

      const run = () => {
        if (forced && forced !== "pendente"){
          /* the scenario rules: a number becomes a bare status, an object
             carries a body — this is how "the provider returned card
             declined" gets reproduced */
          const st = typeof forced === "object" ? (forced.status || 500) : forced;
          const errorBody = typeof forced === "object"
            ? (forced.payload || { error_: forced.error_ || "falha simulada" })
            : { error_:"falha simulada" };
          register(st, "resposta ditada pelo cenário", payload, errorBody);
          return resposta(st, errorBody);
        }
        try {
          /* a write route that answers 200 without changing the fixtures is a
             facade: the screen says "salvo", nothing was saved, and a
             reload contradicts it. Comparing before and after is
             objective. */
          const writes = httpMethod === "POST" || httpMethod === "PUT" || httpMethod === "PATCH" || httpMethod === "DELETE";
          const before = writes ? JSON.stringify(cfg.data_) : null;
          const r = found.route.responds(ctx);
          const reg = register(200, "", payload, r === undefined ? null : r);
          if (writes && before === JSON.stringify(cfg.data_)) reg.didNotPersist = true;
          /* a write moved the server, so every watch that covers it is now a
             stale copy — this is the whole of the synchronisation, and no
             prototype has to remember it */
          if (writes){ markStale(found.route); scheduleSettle(); }
          return resposta(200, r === undefined ? null : r);
        } catch (e){
          register(500, e.message, payload, { error_:e.message });
          return resposta(500, { error_:e.message });
        }
      };

      /* network:{ "GET /api/x": "pendente" } holds the response. It does not
         count as in flight — otherwise the suite would wait forever — and
         only moves when a `waitFor` step releases it. This is how loading
         becomes a step of the journey instead of a still photo. */
      if (forced === "pendente"){
        /* Out of the "in flight" count: the request is stalled on purpose,
           waiting for a step to release it. Leaving it in inFlight froze
           EVERY subsequent wait — awaitNetwork never saw the network idle
           and burned the retry limit on each action, until the suite looked
           dead. */
        network.inFlight--;
        register(0, "parado até o passo aguarda", payload, null);
        return new Promise(res => {
          network.stalled.push({ routeId: httpMethod + " " + found.route.pathStr, releases: () => {
            network.inFlight++;
            const r = run();
            network.inFlight--;
            if (countsOnScreen){ network.inFlightScreen = Math.max(0, network.inFlightScreen - 1); markOut(owner); warnNetwork(); }
            res(r);
            return r;   /* the `waitFor` step needs the payload that arrived */
          } });
        });
      }

      /* latency on screen only: delaying during verification adds nothing and
         would make the suite slow and flaky */
      /* the delay exists so the person feels the wait on screen. Redoing the
         earlier steps of a journey is nobody's wait: paying 140ms per step
         makes navigation feel stuck. */
      /* a server does not always answer in the same time. A random range so
         the screen is drawn with a real wait — and so the loading state is
         not a theoretical detail. */
      const range = cfg.latency || [250, 750];
      const randomPick = () => Array.isArray(range)
        ? Math.round(range[0] + Math.random() * (range[1] - range[0]))
        : range;
      const expects = (verifying || replaying)
        ? 0
        : (found.route.delay != null ? found.route.delay : randomPick());
      return new Promise(res => {
        const end = () => {
          network.inFlight--;
          if (countsOnScreen){ network.inFlightScreen = Math.max(0, network.inFlightScreen - 1); markOut(owner); warnNetwork(); }
          res(run());
        };
        expects ? setTimeout(end, expects) : end();
      });
    };
    window.fetch.__original = originalFetch;
  }

  function markIn(owner){
    if (owner) network.byView[owner] = (network.byView[owner] || 0) + 1;
    else network.loose++;
  }
  function markOut(owner){
    if (owner) network.byView[owner] = Math.max(0, (network.byView[owner] || 0) - 1);
    else network.loose = Math.max(0, network.loose - 1);
  }

  /* What THIS view is waiting on: its own requests, plus the ones nobody
     owns — a screen load belongs to all of them. */
  function waitingForView(id){
    if (!multi() || !id) return network.inFlightScreen > 0;
    return (network.byView[id] || 0) > 0 || network.loose > 0;
  }

  /* On the bench the re-read happens on its own, a tick after the write, and
     every view holding that query redraws with it. During a replay the calls
     below are awaited in order instead, so the suite stays deterministic. */
  let settleTimer = null;
  function scheduleSettle(){
    if (verifying || replaying) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(async () => {
      if (verifying || replaying) return;
      const moved = await settleQueries();
      if (moved && didRender) render();
    }, 0);
  }

  /* redraws when a request starts or ends: this is what makes the skeleton
     appear while the response has not arrived */
  let networkTimer = null;
  function warnNetwork(){
    clearTimeout(networkTimer);
    networkTimer = setTimeout(() => { if (didRender) render(); }, 0);
  }

  function resposta(status, payload){
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(clone(payload)),
      text: () => Promise.resolve(JSON.stringify(payload))
    };
  }

  function tryJson(v){ try { return JSON.parse(v); } catch { return v; } }

  /* waits for the network to settle: without this an assertion would run
     before the response arrived and fail on a race, not on a bug */
  async function awaitNetwork(){
    /* nothing was requested: drain the microtasks and leave. Charging a
       setTimeout here multiplied per step across every navigation. */
    if (!network.inFlight){
      for (let k = 0; k < 8; k++) await Promise.resolve();
      if (!network.inFlight) return;
    }
    for (let i = 0; i < 200; i++){
      if (network.inFlight){ await new Promise(r => setTimeout(r, 0)); continue; }
      /* an idle network does not mean a ready screen: the response still has
         to cross json() and the handler's await before reaching set() */
      for (let k = 0; k < 8; k++) await Promise.resolve();
      await new Promise(r => setTimeout(r, 0));
      if (!network.inFlight) return;
    }
  }

  const api = {
    /* the LIVE fixtures of this replay — every scenario gets a fresh copy,
       so touching them here does not leak into the next scenario */
    get data_(){ return cfg.data_; },
    async get(pathStr){ return request("GET", pathStr); },
    async post(pathStr, payload){ return request("POST", pathStr, payload); },
    async put(pathStr, payload){ return request("PUT", pathStr, payload); },
    async del(pathStr){ return request("DELETE", pathStr); }
  };

  async function request(httpMethod, pathStr, payload){
    const r = await window.fetch(pathStr, {
      method: httpMethod,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      headers: { "Content-Type":"application/json" }
    });
    const data_ = await r.json();
    if (!r.ok){
      const e = new Error((data_ && data_.error_) || ("HTTP " + r.status));
      e.status = r.status;
      throw e;
    }
    return data_;
  }

  /* ---------- the query layer ----------
     `data_` is the server and has always been one source of truth. What was
     not one was the CLIENT: every screen kept its own copy inside `app`, and
     somebody had to remember to re-read it. That is why a kitchen's handler
     ended up fetching the customer's comanda — one device doing another
     device's reading, which is not something any real product can do.

     So a view declares what it WATCHES, and the harness owns the copy:

         views:[
           { id:"cliente", watches:{ comanda:"GET /api/comandas/7" } },
           { id:"cozinha", watches:{ fila:"GET /api/cozinha/fila"   } }
         ]

     Every write invalidates, every watch re-reads, every view that holds one
     redraws — without a line of it in the prototype. `app` goes back to
     meaning what it should have meant all along: this screen's local state,
     the half-typed form and the open tab, not a stale photograph of the
     server.

     A route may narrow what it disturbs with `invalidates:["fila"]`; saying
     nothing invalidates everything, which is the safe direction to be wrong
     in. */
  let queries = {};        /* name -> the value the server last gave */
  let queryErrors = {};    /* name -> why it could not be read */
  let staleAll = false;
  const staleNames = new Set();

  function watchList(){
    const out = [], seen = new Set();
    const add = (nameStr, spec) => {
      if (seen.has(nameStr)) return;
      seen.add(nameStr);
      const m = /^\s*(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s*$/i.exec(String(spec));
      out.push(m ? { nameStr, httpMethod:m[1].toUpperCase(), pathStr:m[2] }
                 : { nameStr, httpMethod:"GET", pathStr:String(spec) });
    };
    VIEWS.forEach(v => Object.keys(v.watches || {}).forEach(n => add(n, v.watches[n])));
    Object.keys(cfg.watches || {}).forEach(n => add(n, cfg.watches[n]));
    return out;
  }

  function watching(){ return watchList().length > 0; }

  /* Reads go through the same interceptor as everything else, so a watch
     shows up in the monitor and in api.md as the request it really is —
     the specification says the screen re-read, and says which route. */
  async function runWatches(only){
    for (const q of watchList()){
      if (only && !only.has(q.nameStr)) continue;
      /* A route the scenario is holding open never answers until a `waitFor`
         releases it, so awaiting it here would hang the whole replay. Fire it
         and leave: the value lands when the step lets the server speak, which
         is exactly what a subscription looks like. Until then the name reads
         undefined — the screen's loading state. */
      if (heldOpen(q.httpMethod, q.pathStr)){
        request(q.httpMethod, q.pathStr)
          .then(v => { queries[q.nameStr] = v; delete queryErrors[q.nameStr]; })
          .catch(e => { queryErrors[q.nameStr] = e.message; });
        continue;
      }
      try {
        queries[q.nameStr] = await request(q.httpMethod, q.pathStr);
        delete queryErrors[q.nameStr];
      } catch (e){
        queryErrors[q.nameStr] = e.message;
      }
    }
  }

  function heldOpen(httpMethod, pathStr){
    const direct = network.failures[httpMethod + " " + pathStr];
    if (direct === "pendente") return true;
    const found = findRoute(httpMethod, pathStr);
    return !!found && network.failures[httpMethod + " " + found.route.pathStr] === "pendente";
  }

  /* Pull to refresh: a real control on a real screen, and the only way a
     prototype asks for a re-read by hand. Everything else re-reads because
     something was written. */
  async function refresh(...names){
    const flat = names.flat().filter(Boolean);
    await runWatches(flat.length ? new Set(flat) : null);
    if (!verifying && !replaying && didRender) render();
  }

  function markStale(route){
    const inv = route && (route.invalidates || route.invalida);
    if (Array.isArray(inv) && inv.length) inv.forEach(n => staleNames.add(n));
    else staleAll = true;
  }

  async function settleQueries(){
    if (!staleAll && !staleNames.size) return false;
    const only = staleAll ? null : new Set(staleNames);
    staleAll = false; staleNames.clear();
    await runWatches(only);
    return true;
  }

  function resetQueries(){
    queries = {}; queryErrors = {};
    staleAll = false; staleNames.clear();
  }

  /* what a given view is allowed to see: only what it says it watches, so a
     screen that forgot to subscribe goes stale and the gate notices */
  function dataFor(v){
    const out = { data:{}, dataError:{} };
    const w = v ? (v.watches || {}) : (cfg.watches || {});
    Object.keys(w).forEach(n => {
      out.data[n] = queries[n];
      if (queryErrors[n] != null) out.dataError[n] = queryErrors[n];
    });
    return out;
  }

  /* Context and layout preferences survive a reload. On about:srcdoc
     localStorage throws (null origin), so everything here is try/catch:
     with no storage the harness simply stops remembering. */
  function prefsKey(){ return "proto:" + (cfg.title || "proto"); }

  function readPrefs(){
    try { return JSON.parse(localStorage.getItem(prefsKey()) || "null"); }
    catch { return null; }
  }

  function savePrefs(){
    if (!initial) return;
    try {
      localStorage.setItem(prefsKey(), JSON.stringify({
        ctx: state.ctx, viewport: state.viewport, zoom: state.zoom, sidebar: state.sidebar,
        viewSizes: state.viewSizes
      }));
    } catch {}
  }

  const MIN_SIDEBAR = 288;
  function applySidebar(px){
    const ceiling = Math.max(MIN_SIDEBAR, Math.min(680, (window.innerWidth || 1280) - 340));
    state.sidebar = Math.round(Math.max(MIN_SIDEBAR, Math.min(ceiling, px)));
    document.documentElement.style.setProperty("--h-side-w", state.sidebar + "px");
    fit();
  }

  function forgetPrefs(){
    try { localStorage.removeItem(prefsKey()); } catch {}
  }

  let started = false;   /* while false, nobody writes to the hash */
  let pendingFlag = null;
  let verifying = false;
  let replaying = false;   /* redoing past steps: no simulated delay */
  let baseData = null;
  const primCache = {};

  /* ---------- the page's mandatory states ----------
     Every page passes through loading, empty and error before showing
     content. The scenario's tag says which state it covers, and the
     harness asserts on its own that the screen marked that state — without
     relying on somebody remembering to write the Então. */
  const STATES = ["carregando", "vazio", "erro"];

  function stateOf(s){
    const t = (s.tags || []).map(x => x.replace(/^@/, "")).find(x => STATES.indexOf(x) > -1);
    return t || null;
  }

  /* Which page the state is on. The prototype says so with `page`; the
     harness has no other way to know, and guessing from the shape of the
     state would only work for whichever prototype the guess was written
     against. Journeys that cross screens need this set. */
  function pageOf(app){
    if (!app) return null;
    return app.page || null;
  }

  /* Journey first, state checks after. Loading, empty and error are
     mandatory, but they are the container's checks — whoever opens the bar
     wants to see what the person does, not the loading skeleton. The
     declaration order is preserved inside each block. */
  function readingOrder(listEl){
    const weight = s => {
      const e = stateOf(s);
      if (!e) return 0;
      return 1 + ["carregando", "vazio", "erro"].indexOf(e);
    };
    return listEl.map((s, i) => ({ s, i }))
                .sort((a, b) => (weight(a.s) - weight(b.s)) || (a.i - b.i))
                .map(x => x.s);
  }

  /* ---------- width as an example column ----------
     An Examples row can say at which width that case applies. The harness
     sets the frame to that width before drawing and before running the
     Então — this is what turns "it is responsive" into something
     checkable: each row declares the arrangement and is measured at that
     width. */
  const COLUMN_WIDTH = "largura";

  function sampleWidth(s, exIndex){
    if (!isOutline(s)) return null;
    const cols = s.examples.columns;
    const i = cols.indexOf(cfg.columnWidth || COLUMN_WIDTH);
    if (i < 0) return null;
    const rawText = String(s.examples.tableRows[Math.max(0, Math.min(s.examples.tableRows.length - 1, exIndex || 0))][i]).trim();
    const rung = LADDER.find(d => d.id === rawText);
    if (rung) return { id:rung.id, w:rung.w, h:rung.h };
    const n = parseInt(rawText, 10);
    if (!isNaN(n)) return { id:rungOf(n).id, w:n, h:900 };
    return null;
  }

  /* the width in force NOW: the example's, if it declares one; otherwise
     the screen's */
  let forcedWidth = null;
  /* Order matters. A ladder walk (`forcedWidth`) is the audit measuring this
     view AT that rung and has to win; otherwise the view answers for the
     device it stands for; only with no views declared does the stage's own
     viewport decide, exactly as before. */
  function currentWidth(){
    return forcedWidth || (renderingView && viewWidth(renderingView)) || vp();
  }

  function scnById(id){ return cfg.scenarios.find(s => s.id === id); }
  function scn(id){ return scnById(id) || visible()[0]; }

  function ensureVisibleScenario(){
    const list = visible();
    if (!list.length) return;
    if (!list.some(s => s.id === state.scenario)){
      state.scenario = list[0].id;
      state.expanded = list[0].id;
      state.step = -1;
      state.example = 0;
      pendingFlag = replay();
    }
  }

  /* ---------- scenario outline ---------- */
  function isOutline(s){ return !!(s.examples && s.examples.tableRows && s.examples.tableRows.length); }

  function exampleRow(s, i){
    if (!isOutline(s)) return null;
    const cols = s.examples.columns;
    const row  = s.examples.tableRows[Math.max(0, Math.min(s.examples.tableRows.length - 1, i || 0))];
    const obj  = {};
    cols.forEach((c, k) => { obj[c] = row[k]; });
    return obj;
  }

  function subst(text, ex){
    if (!ex) return String(text);
    return String(text).replace(/<([^<>]+)>/g, (m, k) => (ex[k] != null ? ex[k] : m));
  }

  function substHtml(text, ex){
    if (!ex) return esc(text);
    return esc(String(text)).replace(/&lt;([^&]+?)&gt;/g, (m, k) =>
      ex[k] != null ? `<span class="ph">${esc(ex[k])}</span>` : m);
  }

  /* ---------- gherkin ---------- */
  /* In Gherkin the "E" inherits the keyword of the previous step: an "E"
     after a "Então" continues an assertion. Writing an action there says
     the screen MUST do that on its own, which is a different claim. So the
     keyword does not come from what the author typed, but from what the
     step does:
       acts (click/fill/choose/toggleCtl/waitFor) → Quando
       checks (check)                             → Então
     and "E" only when it repeats the nature of the previous step. */
  function nature(st){
    if (specOf(st) || st.waitFor) return "acao";
    if (typeof st.check === "function") return "verificacao";
    return "outro";
  }

  function stepWord(st, natPrevious){
    const nat = nature(st);
    if (nat === "outro") return kindOf(st);
    if (nat === natPrevious) return { kw:"E", key:"e", text:kindOf(st).text };
    return nat === "acao"
      ? { kw:"Quando", key:"quando", text:kindOf(st).text }
      : { kw:"Então",  key:"então",  text:kindOf(st).text };
  }

  function kindOf(st){
    if (st.when != null) return { kw:"Quando", key:"quando", text:st.when };
    if (st.then != null) return { kw:"Então",  key:"então",  text:st.then };
    if (st.and  != null) return { kw:"E",      key:"e",      text:st.and  };
    if (st.but  != null) return { kw:"Mas",    key:"mas",    text:st.but  };
    return { kw:"E", key:"e", text:st.text || "" };
  }

  function table(cols, rows){
    const w = cols.map((c, i) =>
      Math.max(String(c).length, ...rows.map(r => String(r[i] == null ? "" : r[i]).length)));
    const line = cells => "      | " + cells.map((c, i) => String(c == null ? "" : c).padEnd(w[i])).join(" | ") + " |\n";
    return line(cols) + rows.map(line).join("");
  }

  function gherkin(){
    const f = cfg.feature || {};
    const list = readingOrder(visible());
    let out = "# language: pt\n";

    const dropped = cfg.scenarios.filter(s => !isVisible(s));
    if (dropped.length){
      const culprits = [...new Set(dropped.flatMap(s =>
        (s.tags || []).filter(t => !tagSatisfied(t))))];
      out += `# escopo: ${dropped.length} cenário${dropped.length === 1 ? "" : "s"} `
           + `fora porque ${culprits.join(", ")} não se aplica a este contexto\n`;
    }
    if (multi()){
      out += `# vistas: ${VIEWS.map(v => {
        const d = viewWidth(v) || {};
        return `${v.id} = ${v.label}${v.actor ? ` (${v.actor})` : ""} @ ${d.w}px`;
      }).join(" · ")}\n`;
      out += `# vistas: as telas estão abertas ao mesmo tempo e leem os mesmos dados; `
           + `um passo marcado [vista] acontece naquela tela\n`;
    }
    out += `# contexto: ${cfg.context.map(d => {
      const v = state.ctx[d.id];
      return `${d.label.toLowerCase()}=${Array.isArray(v) ? (v.join(",") || "nenhuma") : v}`;
    }).join(" · ")}\n`;
    if (cfg.primitives && cfg.library){
      out += `# ui: as linhas "# ui:" abaixo mapeiam a marcação do protótipo `
           + `para componentes de ${cfg.library} — use o componente, não recrie o CSS\n`;
    }
    /* A React prototype has no map to read: it imports the components, and the
       gate hands that list in. These are the real imports, checked against the
       catalog, not a description of them. */
    const used = (typeof window !== "undefined" && window.PROTO_IMPORTS) || null;
    if (used && used.length){
      out += `# ui: este protótipo usa os componentes abaixo — são os imports dele, `
           + `não uma descrição da marcação\n`;
      used.forEach(u => { out += `# ui: import { ${u.name} } from "${u.from}";\n`; });
    }
    if (suite && suite.coverage){
      const c = suite.coverage;
      out += `# cobertura: ${c.exercised} de ${c.total} handlers disparados por algum passo\n`;
    }
    if (suite && suite.warnings && suite.warnings.length){
      suite.warnings.forEach(a => { out += `# aviso: ${a}\n`; });
    }
    out += "\n";

    out += `Funcionalidade: ${f.name || cfg.title}\n`;
    if (f.as)   out += `  Como ${f.as}\n`;
    if (f.want) out += `  Eu quero ${f.want}\n`;
    if (f.so)   out += `  Para que ${f.so}\n`;

    list.forEach(s => {
      out += "\n";
      const im = implOf(s);
      if (im){
        const line = implLine(im);
        if (line)      out += `  # impl: ${line}\n`;
        if (im.notes)  out += `  # impl: ${im.notes}\n`;
      }
      /* the primitives map comes from the cache verification fills —
         gherkin() is synchronous because it is called from a button click */
      const prim = primCache[s.id] || [];
      if (prim.length){
        out += `  # ui: ${primLine(prim)}\n`;
        primImports(prim).forEach(l => { out += `  # ui: ${l}\n`; });
      }
      if (s.tags && s.tags.length) out += `  ${s.tags.join(" ")}\n`;
      out += `  ${isOutline(s) ? "Esquema do Cenário" : "Cenário"}: ${s.name}\n`;
      out += `    Dado ${s.given.text}\n`;
      let natPrev = "dado";
      (s.steps || []).forEach(st => {
        const k = stepWord(st, natPrev);
        natPrev = nature(st);
        out += `    ${k.kw} ${st.on ? `[${st.on}] ` : ""}${k.text}\n`;
        const wants = [].concat(st.propagates || []);
        const holds = [].concat(st.unchanged || []);
        if (wants.length) out += `      # e a tela de ${wants.join(", ")} muda por causa disso\n`;
        if (holds.length) out += `      # e a tela de ${holds.join(", ")} continua como estava\n`;
      });
      if (isOutline(s)){
        out += `\n    Exemplos:\n`;
        out += table(s.examples.columns, s.examples.tableRows);
      }
    });
    return out;
  }

  /* ---------- handoff: what the implementer needs ----------
     A prototype is the specification, so handing it over should not mean
     handing over a folder to reverse-engineer. Three artefacts come out of
     the same run the gate already does:

       .feature   the scenarios, as Gherkin
       api.md     every declared route, with a real request and response
                  captured from the scenarios that exercised it
       .html      the prototype itself, without the harness chrome

     Each is also on the API (Proto.gherkin / Proto.apiContract /
     Proto.source), so an agent can write them out headlessly —
     `node verify.js <file> --export <dir>` does exactly that.
     ------------------------------------------------------------------- */

  function jsonBlock(v){
    if (v === undefined || v === null) return "_none_";
    let t; try { t = JSON.stringify(v, null, 2); } catch { t = String(v); }
    if (t === undefined) t = String(v);
    return "```json\n" + t + "\n```";
  }

  function apiContract(){
    const routes = cfg.routes || [];
    const out = [];
    out.push("# API contract — " + (cfg.title || "prototype"));
    out.push("");
    out.push("Generated by the Proto harness. Every route the prototype declares, with");
    out.push("a request and response actually observed while the scenarios ran — not an");
    out.push("example someone wrote by hand and never checked.");
    out.push("");
    if (!routes.length) out.push("_The prototype declares no routes._");

    routes.forEach(r => {
      const method = (r.httpMethod || "GET").toUpperCase();
      const id = method + " " + r.pathStr;
      const seen = network.seenRoutes[id];
      const sm = network.samples[id] || {};
      out.push("## `" + id + "`");
      out.push("");
      if (r.onLoad) out.push("- Called when the screen loads, not from a step.");
      if (seen){
        const ok = [...(seen.ok || [])], bad = [...(seen.error_ || [])];
        if (ok.length)  out.push("- Succeeds in: " + ok.join(", "));
        if (bad.length) out.push("- Fails in: " + bad.join(", "));
      } else {
        out.push("- **Not exercised by any scenario.** The gate reports this as a dead route.");
      }
      out.push("");
      ["ok", "error_"].forEach(slot => {
        const x = sm[slot]; if (!x) return;
        out.push("### " + (slot === "ok" ? "Success" : "Failure") + " — status " + (x.status || "?"));
        if (x.from) out.push("");
        if (x.from) out.push("Observed in: " + x.from);
        out.push("");
        if (x.request !== null && x.request !== undefined){
          out.push("Request body:"); out.push(""); out.push(jsonBlock(x.request)); out.push("");
        }
        out.push("Response body:"); out.push(""); out.push(jsonBlock(x.response)); out.push("");
      });
      if (!sm.ok && !sm.error_){ out.push("_No traffic captured — run the suite first._"); out.push(""); }
    });
    return out.join("\n");
  }

  /* The prototype as it is on disk: the document minus the chrome the
     harness injected into it. Reading the file back is not an option —
     fetch cannot read a file:// sibling. */
  function source(){
    const clone = document.documentElement.cloneNode(true);
    /* everything the harness put into the document goes: the chrome, and
       the verification iframe whose srcdoc holds a whole copy of this
       very document — serializing that doubled the export. */
    clone.querySelectorAll("#h-host, .h-shell, .h-verify-frame, #h-doc-css").forEach(n => n.remove());
    /* An included file stays a reference in the export. Some DOM
       implementations (jsdom with usable resources) park the fetched source
       inside the element, and serializing that would smuggle the whole
       engine back into a file whose point is not to carry it. */
    clone.querySelectorAll("script[src]").forEach(n => { n.textContent = ""; });
    return "<!DOCTYPE html>\n" + clone.outerHTML + "\n";
  }

  function slug(){
    return String(cfg.title || "prototype").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prototype";
  }

  function download(nameStr, text, mime){
    try {
      const blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nameStr;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch { return false; }
  }

  /* ---------- replay ---------- */
  /* Memo of replay prefixes.
     buildState(s, k) redid steps 0..k from scratch, so verifying a 6-step
     scenario cost 1+2+3+4+5+6 runs — and the audit, the state checks and
     the journey checks walk the same steps again. By storing the state at
     the end of each step, step k continues where k-1 stopped: quadratic
     becomes linear.

     The state is not just `app`: write routes change the fixtures, so
     resuming without restoring the data would put the fake server out of
     step with what the screen thinks happened. That is why every snapshot
     carries both. */
  let memo = new Map();

  async function buildState(s, upTo, exIndex, liveNow){
    const replayingBefore = replaying;
    replaying = true;
    try {
      return await buildStateInternal(s, upTo, exIndex, liveNow);
    } finally { replaying = replayingBefore; }
  }

  async function buildStateInternal(s, upTo, exIndex, liveNow){
    const ex = exampleRow(s, exIndex);
    const axis = exIndex || 0;
    const previousWidth = forcedWidth;
    forcedWidth = sampleWidth(s, axis);
    /* the key carries the context: the same step yields different screens for
       the owner and for the waiter */
    const ctxSig = JSON.stringify(state.ctx);
    const wid = (forcedWidth ? forcedWidth.id : "tela")
      + (multi() ? "|" + VIEWS.map(v => (viewWidth(v) || {}).w).join(",") : "");
    const keyName = k => s.id + "|" + axis + "|" + k + "|" + ctxSig + "|" + wid;

    /* A scenario with `waitFor` does not enter the cache: the stalled request
       is a live promise, and the snapshot only stores state and fixtures.
       Resuming from a saved prefix would leave the step with nothing to
       release. */
    const usesStalled = (s.steps || []).some(st => st.waitFor);
    const cache = usesStalled ? null : memo;

    const stps = (s.steps || []).slice(0, upTo + 1);
    /* Live, what really has to happen is the LAST ACTION up to here — not
       the last step. Stopping on a Então after a "reload the list" step has to
       fire the reload; otherwise the screen shows up ready with no request
       at all, which is what made it look broken. */
    let idxAcao = -1;
    if (liveNow){
      for (let i = stps.length - 1; i >= 0; i--){
        if (specOf(stps[i]) || stps[i].waitFor){ idxAcao = i; break; }
      }
    }

    const restore = c => {
      cfg.data_ = JSON.parse(c.data_);
      queries = JSON.parse(c.queries);
      queryErrors = JSON.parse(c.queryErrors);
      staleAll = false; staleNames.clear();
      return { app: clone(c.app), errors_: c.errors_.slice(), orders: c.orders };
    };

    /* When navigating, the step being looked at really runs: it is the one
       that fires the request, lights up the loading state and shows in the
       monitor. Serving that step from the cache gave a ready screen with no
       request ever made — it looked as if the click did nothing. The
       history before it still comes from the cache. */
    if (cache && (!liveNow || idxAcao < 0) && cache.has(keyName(upTo))){
      const c = cache.get(keyName(upTo));
      const r = restore(c);
      /* returning early must not skip the restore: without this the width
         forced by the rung disappears and whoever draws next uses the
         screen's */
      forcedWidth = previousWidth;
      return { app:r.app, ex, errors_:r.errors_, orders:r.orders, alreadySeen:true };
    }

    let app, errors_, baseOrders, start;

    /* the longest prefix already known */
    let deK = -2;
    if (cache){
      const ceiling = (liveNow && idxAcao >= 0) ? idxAcao - 1 : upTo - 1;
      for (let k = ceiling; k >= -1; k--){ if (cache.has(keyName(k))){ deK = k; break; } }
    }

    if (deK >= -1){
      const r = restore(cache.get(keyName(deK)));
      app = r.app; errors_ = r.errors_; baseOrders = r.orders;
      start = deK + 1;
      network.origin = { scn:s.id, nameStr:s.name, stp:start, kw:"Quando" };
    } else {
      /* every replay starts with the fixtures as they were in the file and
         with no requests left stalled from earlier replays — otherwise a
         `waitFor` finds another run's stalled request, or fails to find
         its own */
      if (baseData) cfg.data_ = JSON.parse(baseData);
      network.stalled.length = 0;
      network.failures = typeof s.network === "function" ? (s.network(ex) || {}) : (s.network || {});
      network.origin = { scn:s.id, nameStr:s.name, stp:-1, kw:"Dado" };
      const beforeGiven = network.counter;
      resetQueries();
      /* the Dado runs first: it may seed the fixtures, and the watches have
         to read the server as the scenario leaves it, not as the file did */
      app = typeof s.given.state === "function" ? await s.given.state(ex, api) : clone(s.given.state);
      await runWatches();
      errors_ = [];
      baseOrders = network.counter - beforeGiven;
      start = 0;
      if (cache) cache.set(keyName(-1), instant(app, errors_, baseOrders));
    }

    network.failures = typeof s.network === "function" ? (s.network(ex) || {}) : (s.network || {});
    const inicial0 = clone(app);
    const entryCounter = network.counter;

    for (let i = start; i < stps.length; i++){
      const st = stps[i];
      network.origin = { scn:s.id, nameStr:s.name, stp:i, kw:kindOf(st).kw };

      if (st.waitFor){
        const beforeWait = JSON.stringify(app);
        sandbox = { app: clone(app) };
        const r = await releaseStalled(st.waitFor === true ? null : st.waitFor);
        app = sandbox.app; sandbox = null;
        await settleQueries();
        if (!r.n){
          errors_.push({ stp:i, error_:"não havia pedido parado para soltar em " + st.waitFor });
        } else if (typeof st.applyState === "function"){
          const next = st.applyState(app, r.payload, ex);
          if (next && typeof next === "object") app = next;
        }
        if (JSON.stringify(app) !== beforeWait) stateChanged.add(s.id + "|" + i);
        if (cache) cache.set(keyName(i), instant(app, errors_, baseOrders + (network.counter - entryCounter)));
        continue;
      }

      const lastLive = liveNow && i === idxAcao;
      const spec = specOf(st);
      if (spec){
        const before = JSON.stringify(app);
        /* the watches are part of what a step changes: a step whose whole
           effect is that the screen re-read would otherwise look inert. The
           rules about silent changes and `local:` still compare `app` alone —
           they are about what the SCREEN did, not about what it re-read. */
        const beforeAll = before + "\u0000" + JSON.stringify(queries);
        const repBefore = replaying;
        if (lastLive) replaying = false;   /* latency + loading */
        const cAntes = network.counter;
        const r = await runAction(spec, app, ex);
        app = r.app;
        if (r.error_) errors_.push({ stp:i, error_:r.error_ });

        await settleQueries();
        if (lastLive) replaying = repBefore;
        if (JSON.stringify(app) + "\u0000" + JSON.stringify(queries) !== beforeAll) stateChanged.add(s.id + "|" + i);
        if (!st.local && !r.error_ && network.counter === cAntes && JSON.stringify(app) !== before){
          silentChanges.push({ scn:s.id, nameStr:s.name, stp:i, sel:spec.sel, kindName:spec.kindName });
        }
        if (!r.error_ && network.counter === cAntes && PERSISTENT_VERBS.test(r.caption || "")){
          const verb = (r.caption.match(PERSISTENT_VERBS) || [""])[0];
          lyingLabels.push({ scn:s.id, nameStr:s.name, stp:i, sel:spec.sel,
            caption:(r.caption || "").slice(0, 40), verb });
        }
        if (st.local && JSON.stringify(app) !== before){
          const base = JSON.parse(before);
          const touchedServer = Object.keys(app).some(k =>
            k in base && base[k] && typeof base[k] === "object"
            && JSON.stringify(base[k]) !== JSON.stringify(app[k]));
          if (touchedServer){
            const persistsAfter = (s.steps || []).slice(i + 1).some(x => {
              const sp = specOf(x);
              return sp && !x.local;
            });
            if (!persistsAfter) suspectLocal.push({ scn:s.id, nameStr:s.name, stp:i, sel:spec.sel });
          }
        }
      } else if (typeof st.apply === "function"){
        const beforeApply = JSON.stringify(app);
        const next = await st.apply(app, ex, api);
        if (next && typeof next === "object") app = next;
        if (JSON.stringify(app) !== beforeApply) stateChanged.add(s.id + "|" + i);
      }

      if (cache && !(liveNow && idxAcao >= 0 && i >= idxAcao)){
        cache.set(keyName(i), instant(app, errors_, baseOrders + (network.counter - entryCounter)));
      }
    }

    forcedWidth = previousWidth;
    network.origin = null;
    const pgStart = pageOf(inicial0);
    const pgEnd = pageOf(app);
    if (pgStart && pgEnd && pgStart !== pgEnd) arrivals.add(pgEnd);

    return { app, ex, errors_, orders: baseOrders + (network.counter - entryCounter) };
  }

  function instant(app, errors_, orders){
    return { app: clone(app), data_: JSON.stringify(cfg.data_),
             queries: JSON.stringify(queries), queryErrors: JSON.stringify(queryErrors),
             errors_: errors_.slice(), orders };
  }

  async function replay(){
    /* nothing to cancel: the suite runs in its own world, inside the iframe */
    if (verifying) cancelVerification = true;   /* fallback mode only */
    return enqueue(async () => {
    const s = scn(state.scenario);
    if (!s) return;
    network.tela.length = 0;    /* the monitor shows what THIS screen asked for */
    network.inFlightScreen = 0;      /* a request left stalled by the previous screen does not count here */
    const r = await buildState(s, state.step, state.example, !verifying);
    state.app = r.app;
    state.ex  = r.ex;
    });
  }

  async function goto(scenarioId, step, example){
    /* clicking the step you are already on needs no redo — unless the person
       touched the screen afterwards, in which case the click is precisely
       to get back to the script's state */
    const samePoint = state.scenario === scenarioId
      && state.step === (step == null ? -1 : step)
      && (example == null || state.example === example);
    /* didRender is mandatory: at init the state ALREADY points at the first
       scenario, so without this guard the first goto would match as "same
       point" and the screen would never be drawn. */
    if (samePoint && didRender && !appDirty && !awaiting) return;

    state.scenario = scenarioId;
    state.expanded = scenarioId;
    state.step = (step == null ? -1 : step);
    if (example != null) state.example = example;

    /* An example row that declares a width takes the stage with it — that is
       what guarantees you see what was verified. But if the person just
       picked a rung by hand, their choice wins: the row switch already
       happened in the selector. */
    const targetWidth = sampleWidth(scnById(scenarioId) || {}, state.example);
    if (targetWidth && !manualChoice && state.viewport !== targetWidth.id
        && LADDER.some(d => d.id === targetWidth.id)){
      state.viewport = targetWidth.id;
    }
    manualChoice = false;

    /* going to a scenario opens the block it lives in: otherwise navigation
       (by link, by arrow or by Go to the failure) lands on a collapsed card
       and the bar looks as if it did not react */
    const aim = scnById(scenarioId);
    if (aim){
      const pg = aim.page || cfg.defaultPage || "única";
      closedGroups.delete(pg);
      if (stateOf(aim)) closedGroups.delete(pg + "::estados");
    }

    /* The first visit to a scenario redoes the whole journey and can take
       nearly a second. With no signal at all the click feels lost — so the
       step is marked as waiting up front, before the await. */
    awaiting = { id:scenarioId, stp:state.step };
    buildSidebar();

    await replay();
    awaiting = null;
    appDirty = false;
    render();
    /* navigation may have switched the rung (an Examples row with a width):
       the frame has to follow, otherwise the pill lies */
    fit();
  }

  /* ---------- permalink ---------- */
  function encodeHash(){
    let h = "#" + (state.scenario || "");
    h += "/" + (state.step < 0 ? "dado" : (state.step + 1));

    const parts = [];
    const s = scnById(state.scenario);
    if (s && isOutline(s) && state.example) parts.push("ex=" + (state.example + 1));

    cfg.context.forEach(d => {
      const v = state.ctx[d.id], iv = initial.ctx[d.id];
      const now = Array.isArray(v) ? v.join(",") : v;
      const def = Array.isArray(iv) ? iv.join(",") : iv;
      if (now !== def) parts.push(d.id + "=" + now);
    });

    if (state.viewport !== initial.viewport) parts.push("viewport=" + state.viewport);
    if (state.zoom     !== initial.zoom)     parts.push("zoom=" + state.zoom);
    if (state.landscape)                     parts.push("rotated=1");
    if (state.sidebar !== 288)                 parts.push("sidebar=" + state.sidebar);

    return h + (parts.length ? "?" + parts.join("&") : "");
  }

  function applyHash(source){
    /* accepts "#a/2", "a/2" or a whole pasted URL */
    let raw = source == null ? location.hash : String(source);
    const cut = raw.indexOf("#");
    if (cut > -1) raw = raw.slice(cut + 1);
    try { raw = decodeURIComponent(raw.trim()); } catch { raw = raw.trim(); }
    if (!raw) return false;

    const [path, query] = raw.split("?");
    const [sid, nextStep] = path.split("/");
    const target = scnById(sid);
    if (!target) return false;

    const q = {};
    (query || "").split("&").filter(Boolean).forEach(p => {
      const i = p.indexOf("=");
      q[i < 0 ? p : p.slice(0, i)] = i < 0 ? "" : p.slice(i + 1);
    });

    cfg.context.forEach(d => {
      if (q[d.id] == null) return;
      /* the hash is attacker-supplied: only ids this dimension declares get
         into the context. The single-choice branch already checked; the
         flags branch used to take whatever the URL said. */
      if (d.kind === "flags"){
        state.ctx[d.id] = q[d.id].split(",")
          .filter(Boolean)
          .filter(id => d.options.some(o => o.id === id));
      }
      else if (d.options.some(o => o.id === q[d.id])) state.ctx[d.id] = q[d.id];
      userCtx = clone(state.ctx);
      suite = null;
    });

    if (q.viewport && VIEWPORTS.some(v => v.id === q.viewport)) state.viewport = q.viewport;
    /* the hash is attacker-supplied: only a known number becomes the zoom */
    if (q.zoom != null){
      const z = parseFloat(q.zoom);
      if (!isNaN(z) && z > 0 && z <= 4) state.zoom = z;
    }
    if (q.sidebar){
      const b = parseInt(q.sidebar, 10);
      if (!isNaN(b)){
        state.sidebar = Math.max(288, b);
        document.documentElement.style.setProperty("--h-side-w", state.sidebar + "px");
      }
    }
    state.landscape = q.rotated === "1";

    const n = (target.steps || []).length;
    let step = -1;
    if (nextStep && nextStep !== "dado"){
      const p = parseInt(nextStep, 10);
      if (!isNaN(p)) step = Math.max(-1, Math.min(n - 1, p - 1));
    }
    let exi = 0;
    if (q.ex != null && isOutline(target)){
      const p = parseInt(q.ex, 10);
      if (!isNaN(p)) exi = Math.max(0, Math.min(target.examples.tableRows.length - 1, p - 1));
    }

    state.scenario = sid; state.expanded = sid; state.step = step; state.example = exi;
    ensureVisibleScenario();
    pendingFlag = replay();
    return true;
  }

  function syncHash(){
    /* during init fit() already runs and would write the restored state over
       the incoming link — the link has to be read before any write, or it
       never wins */
    if (!started) return;
    savePrefs();
    const h = encodeHash();
    if (location.hash === h) return;
    /* history.replaceState with a URL throws on file:// (null origin), so we
       touch the hash directly and ignore the event it fires */
    muteHash = true;
    location.hash = h;
    setTimeout(() => { muteHash = false; }, 0);
    const inp = $("h-linkin");
    if (inp && document.activeElement !== inp) inp.value = linkValue();
  }

  function linkValue(){
    /* on about:srcdoc the href opens nowhere: only the fragment is useful */
    return /^(https?|file):$/.test(location.protocol) ? location.href : encodeHash();
  }

  /* ---------- auditoria ---------- */
  /* What can be demanded mechanically, and why:
     1. Every rendered interactive element must be clicked by some step —
        otherwise there is a path on screen the specification ignores.
     2. Every `Quando` needs a `Então` after it — an action with no
        assertion is verified by nobody.
     3. A registered handler that never matches anything is dead code.
     4. A step that changes neither state nor screen describes nothing. */
  /* A component is not passive by nature — it is passive by use. An Avatar
     opens a menu, a whole Card becomes a click target, a Badge gets
     dismissed. So the audit does not ask "which component is this", but
     "is this screen offering something for the person to operate". */
  const INTERACTIVE_ROLES = ["button","link","checkbox","switch","tab","menuitem",
    "menuitemcheckbox","option","combobox","slider","radio","textbox","searchbox","spinbutton"];

  /* Roles that exist to be announced, not operated. */
  const ANNOUNCING_ROLES = ["alert","status","log","progressbar","timer","marquee"];

  function hasAffordance(el){
    const tag = el.tagName.toLowerCase();
    if (["button","select","textarea","input"].indexOf(tag) > -1) return true;
    if (tag === "a" && el.getAttribute("href")) return true;
    if (INTERACTIVE_ROLES.indexOf(el.getAttribute("role")) > -1) return true;
    if (el.hasAttribute("data-act") || el.hasAttribute("data-campo")) return true;
    if (el.hasAttribute("onclick")) return true;
    /* A live region is focusable so a screen reader can be sent to it, not
       because there is anything to operate: an Alert ships role="alert" with
       tabindex="0", and reading that as an affordance demands a handler the
       prototype has no business writing — and cannot remove, since the role
       and the tabindex belong to the component. */
    if (ANNOUNCING_ROLES.indexOf(el.getAttribute("role")) > -1) return false;
    const ti = el.getAttribute("tabindex");
    if (ti != null && Number(ti) >= 0) return true;
    if (el.isContentEditable) return true;
    try {
      const cs = el.ownerDocument.defaultView.getComputedStyle(el);
      if (cs && cs.cursor === "pointer") return true;   /* the div pretending to be a button */
    } catch {}
    return false;
  }

  function requirementOf(el){
    const tag = el.tagName.toLowerCase();
    const kindName = (el.getAttribute("type") || "").toLowerCase();
    const role = el.getAttribute("role");
    if (tag === "select" || role === "combobox") return "choose";
    if (tag === "textarea" || el.isContentEditable) return "fill";
    if (tag === "input"){
      if (kindName === "checkbox" || kindName === "radio") return "toggleCtl";
      if (kindName === "button" || kindName === "submit")  return "click";
      return "fill";
    }
    if (role === "switch" || role === "checkbox") return "toggleCtl";
    if (role === "textbox" || role === "searchbox") return "fill";
    if (role === "slider" || role === "option") return "choose";
    return "click";
  }

  /* Strict mode: in vanilla you cannot forbid raw HTML — the render is a
     string. You can demand that every piece of markup that SHOWS text or
     TAKES interaction is claimed by some component in the map. Purely
     structural divs and spans (with no text of their own) pass; the rest
     becomes explicit debt, with a suggestion of which component to use. */
  const SUGGESTION = {
    h1:"Heading", h2:"Heading", h3:"Heading", h4:"Heading", h5:"Heading", h6:"Heading",
    p:"Paragraph", span:"Text", small:"Text", strong:"Text", em:"Text", b:"Text", i:"Text",
    label:"Label", button:"Button", a:"Link", img:"LazyImage", table:"Table",
    ul:"List", ol:"List", li:"ListItem", input:"Input", textarea:"Textarea",
    select:"Select", code:"Code", pre:"Code", blockquote:"Blockquote", hr:"Separator",
    dialog:"Dialog", form:"Form", progress:"Progress"
  };

  function ownText(el){
    return [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim())
      .join(" ").trim();
  }

  function rawMarkup(root){
    const map = cfg.primitives || {};
    const sels = Object.keys(map);
    const claimed = new Set();
    sels.forEach(sel => {
      try { root.querySelectorAll(sel).forEach(el => claimed.add(el)); } catch {}
    });

    const released = [];
    root.querySelectorAll("*").forEach(el => {
      if (claimed.has(el)) return;
      const tag = el.tagName.toLowerCase();
      const shows = !!ownText(el);
      const opera  = hasAffordance(el);
      if (!shows && !opera) return;          /* structural container: passes */
      const cls = el.className ? "." + String(el.className).split(" ")[0] : "";
      released.push({
        onde: tag + cls,
        textStr: (ownText(el) || "").slice(0, 34),
        opera,
        suggestion: SUGGESTION[tag] || (opera ? "Button" : "Text")
      });
    });
    return released;
  }

  /* ---------- layout signature per rung ----------
     Part 2 demands what the prototype DECLARES. This one demands what it
     delivers: it draws the same screen at every rung and compares the
     computed arrangement. The same signature across the whole ladder means
     the screen fit, not that it responded.

     It needs a layout engine — a container query resolves to nothing
     without someone measuring the box. In the gate (jsdom) the rule
     declares itself unverifiable instead of accusing falsely. */
  const LAYOUT_PROPS = ["display","flexDirection","flexWrap","gridTemplateColumns",
                        "position","order","justifyContent","alignItems","fontSize","textAlign"];

  let hasEngine = null;
  function layoutEngine(){
    if (hasEngine != null) return hasEngine;
    try {
      const boxOf = document.createElement("div");
      boxOf.style.cssText = "position:absolute;left:-99999px;container-type:inline-size;width:200px";
      const child = document.createElement("div");
      child.className = "h-teste-cq";
      boxOf.appendChild(child);
      const rule = document.createElement("style");
      rule.textContent = "@container (min-width: 100px){ .h-teste-cq{ display:grid } }";
      document.head.appendChild(rule);
      document.body.appendChild(boxOf);
      const worth = getComputedStyle(child).display === "grid";
      boxOf.remove(); rule.remove();
      hasEngine = worth;
    } catch { hasEngine = false; }
    return hasEngine;
  }

  /* the probe has to follow the current width, otherwise the container
     query never changes and the Então always measures the same arrangement */
  function adjustProbe(probe){ sizeProbe(probe, currentWidth().w); }

  /* A probe holding several views is a row of frames, each already the width
     of its own device — forcing a width on the row would squeeze them all. */
  function sizeProbe(probe, w){
    if (!probe) return;
    if (multi()){ probe.style.width = ""; return; }
    probe.style.width = w + "px";
  }

  function layoutSignature(root){
    const pieces = [];
    root.querySelectorAll("[data-estado],[data-colunas],[data-acao],.grade,.app-bd,.actions,.linha,.var,.card,.btn")
      .forEach((el, i) => {
        if (i > 40) return;
        let cs = null;
        try { cs = getComputedStyle(el); } catch { return; }
        if (!cs) return;
        const keyName = (el.tagName + "." + String(el.className || "").split(" ")[0]).toLowerCase();
        pieces.push(keyName + ":" + LAYOUT_PROPS.map(k => cs[k]).join("|"));
      });
    return pieces.join("\u00a7");
  }

  /* ---------- physical rules per rung ----------
     "It fit" is not the same as "it works". These measure what the eye
     would object to: sideways overflow, a target too small for a finger,
     tiny text, a line too long to read, and content that vanishes when
     narrow without anyone having decided that. */
  const MIN_TOUCH_TARGET = 44;     /* px — an average finger */
  const MIN_TEXT_SIZE = 12;    /* px */
  const MAX_LINE_LENGTH = 75;    /* caracteres */

  function measuresPhysical(root, rung, width_){
    /* returns [key, detail] pairs: the audit groups by key and lists the
       rungs, otherwise the same defect becomes six identical warnings */
    const foundItems = [];
    const narrow = rung.w <= 480;

    /* sideways overflow: horizontal scrolling is almost always an accident */
    const scrollTarget = root.scrollWidth || 0;
    if (scrollTarget > width_ + 2){
      foundItems.push([`transborda na horizontal`, `${scrollTarget - width_}px`]);
    }

    root.querySelectorAll("button,a[href],input,select,textarea,[role=button]").forEach(el => {
      if (el.disabled) return;
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (!r || (!r.width && !r.height)) return;
      if (narrow && (r.height < MIN_TOUCH_TARGET || r.width < MIN_TOUCH_TARGET)){
        foundItems.push([`alvo ${targetOf(el)} menor que ${MIN_TOUCH_TARGET}px para toque`,
          `${Math.round(r.width)}×${Math.round(r.height)}px`]);
      }
    });

    root.querySelectorAll("p,span,li,td,b,label,h1,h2,h3").forEach(el => {
      let cs = null;
      try { cs = getComputedStyle(el); } catch { return; }
      if (!cs) return;
      const px = parseFloat(cs.fontSize) || 0;
      if (px && px < MIN_TEXT_SIZE){
        foundItems.push([`texto abaixo de ${MIN_TEXT_SIZE}px`, `${Math.round(px)}px`]);
      }
      /* an over-long line only bothers on wide screens, where space is plentiful */
      if (rung.w >= 1024 && el.tagName === "P"){
        const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        const ch = r && px ? r.width / (px * 0.5) : 0;
        if (ch > MAX_LINE_LENGTH){
          foundItems.push([`linha acima de ${MAX_LINE_LENGTH} caracteres`, `~${Math.round(ch)}ch`]);
        }
      }
    });

    return foundItems;
  }

  function targetOf(el){
    const a = el.getAttribute("data-act") || el.getAttribute("data-campo");
    if (a) return `[data-act="${a}"]`;
    return el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "");
  }

  /* what the screen offers: used to find content that vanishes when narrow */
  function offerOf(root){
    const set = new Set();
    root.querySelectorAll("[data-act],[data-campo],[data-card]").forEach(el => {
      set.add("ação:" + (el.getAttribute("data-act") || el.getAttribute("data-campo")
                      || el.getAttribute("data-card")));
    });
    /* content counts too: a whole block vanishing when narrow is the classic
       "it did not fit, so I removed it" — and nobody decided that */
    root.querySelectorAll("h1,h2,h3").forEach(el => {
      const t = (el.textContent || "").trim();
      if (t) set.add("bloco:" + t.slice(0, 40));
    });
    return set;
  }

  /* One view, at one rung. `forcedWidth` wins over the view's own device, so
     each view is walked across the whole ladder as the ordinary screen it is
     — and everything below reads THAT VIEW'S frame, never the row of frames
     around it. Measuring the row is what made the rules stop meaning
     anything: the finger rule fired on a desktop view and stayed silent on a
     phone, because it was reading the stage's rung instead of the view's. */
  async function rungSignature(s, rung, probe, view){
    const before = forcedWidth;
    forcedWidth = { id:rung.id, w:rung.w, h:rung.h };
    sizeProbe(probe, rung.w);
    let sig = "", physical = [], offer = new Set();
    try {
      const built = await buildState(s, (s.steps || []).length - 1, 0);
      const roots = paint(probe, { app:built.app, ex:built.ex, scenario:s.id },
                          view ? view.id : null);
      const root = view ? roots[view.id] : probe;
      if (!root) throw new Error("vista sem raiz");
      sig = layoutSignature(root);
      physical = layoutEngine() ? measuresPhysical(root, rung, rung.w) : [];
      offer = offerOf(root);
    } catch { sig = "ERRO"; }
    forcedWidth = before;
    return { sig, physical, offer };
  }

  async function audit(){
    const warnings = [];
    const infos = [];
    const physicals = new Map();
    const doneCount = new Set();          /* a "type selector" already exercised */
    const aims  = new Map();          /* "type selector" -> scenarios */
    const usedHandlers = new Set();
    const noHandler = new Set();
    const rawList = new Map();
    /* do NOT clear here: with the memo, handlers fire during the verification
       phase and the audit merely reuses the state. Resetting at this point
       would erase the evidence and every handler would look uncovered. */

    const probe = document.createElement("div");
    probe.className = "h-probe";
    sizeProbe(probe, currentWidth().w);
    document.body.appendChild(probe);

    const auditCtx = clone(state.ctx);
    for (const s of cfg.scenarios){
      state.ctx = contextOf(s);
      (s.steps || []).forEach(st => {
        const spec = specOf(st);
        if (spec){
          /* [data-act=x][data-id=2] covers the [data-act=x] target: clicking
             one row of the list proves the pattern, not just that row */
          const m = /\[data-(act|campo)="([^"]+)"\]/.exec(spec.sel);
          doneCount.add(spec.kindName + " " + (m ? `[data-${m[1]}="${m[2]}"]` : spec.sel));
        }
      });

      /* a Quando with no Então: an action nobody verifies */
      const steps = s.steps || [];
      steps.forEach((st, i) => {
        if (nature(st) !== "acao") return;
        const k = kindOf(st);
        const hasThen = steps.slice(i + 1).some(x => nature(x) === "verificacao");
        if (!hasThen) warnings.push(`${s.name}: "${k.text}" não tem Então depois — a ação não é verificada`);
      });

      const rows = isOutline(s) ? s.examples.tableRows.map((_, i) => i) : [0];

      /* A literal Dado carrying domain structure is data invented on the
         screen. The rule: the scenario fetches what it shows.
         `noNetwork: true` exempts screens that genuinely do not depend on
         a server. */
      if (!s.noNetwork && stateOf(s) !== "carregando"
          && s.given && s.given.state && typeof s.given.state !== "function"){
        const v = s.given.state;
        const hasStructure = Object.keys(v || {}).some(k =>
          Array.isArray(v[k]) || (v[k] && typeof v[k] === "object"));
        if (hasStructure){
          warnings.push(`${s.name}: o Dado traz dado pronto no código — busque pela API `
            + `(state: async (ex, api) => …) ou marque semRede: true`);
        }
      }

      for (const ri of rows){
        forcedWidth = sampleWidth(s, ri);
        adjustProbe(probe);
        const built = await buildState(s, steps.length - 1, ri);
        built.errors_.forEach(e => warnings.push(`${s.name}: passo ${e.stp + 1} — ${e.error_}`));
        if (!s.noNetwork && stateOf(s) !== "carregando" && !built.orders){
          warnings.push(`${s.name}: nenhum pedido à rede — de onde veio o dado da tela?`);
        }

        /* scans the WHOLE journey, not just the destination: in a journey the
           retry button appears midway and disappears afterwards — looking
           only at the last step would write it off as dead code */
        const screens = [];
        for (let k = -1; k < steps.length; k++){
          try {
            const b = k === steps.length - 1 ? built : await buildState(s, k, ri);
            paint(probe, { app:b.app, ex:b.ex, scenario:s.id });
            screens.push(probe.innerHTML);
          } catch { /* a step that breaks is already called out elsewhere */ }
        }

        for (const html of screens){
          probe.innerHTML = html;

        probe.querySelectorAll("*").forEach(el => {
          if (!hasAffordance(el) || el.disabled) return;
          /* the target is the button, not the spans inside it: clicking a row
             clicks the whole row */
          const owner = el.closest("button,a[href],[role=button],input,select,textarea");
          if (owner && owner !== el) return;
          const act  = el.getAttribute("data-act") || el.getAttribute("data-campo");
          const attr = el.hasAttribute("data-act") ? "data-act" : "data-campo";
          const sel = act
            ? `[${attr}="${act}"]`
            : el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "");
          /* a step that clicks [data-act=x][data-id=2] covers the
             [data-act=x] target: what counts is the element matching the
             selector */
          let anyOf = false;
          handlers.forEach(h => {
            try { if (el.matches(h.selector)){ usedHandlers.add(h.selector); anyOf = true; } } catch {}
          });
          if (!anyOf && !el.getAttribute("href")) noHandler.add(sel);

          const keyName = requirementOf(el) + " " + sel;
          if (doneCount.has(keyName)) return;
          if (!aims.has(keyName)) aims.set(keyName, new Set());
          aims.get(keyName).add(s.name);
        });

        if (cfg.strictMode){
          rawMarkup(probe).forEach(m => {
            rawList.set(m.onde, m);
          });
        }
        }
        forcedWidth = null;
      }
    }
    state.ctx = auditCtx;
    probe.remove();

    const verb = { click:"clica", fill:"preenche", choose:"escolhe em", toggleCtl:"alterna" };
    aims.forEach((scens, keyName) => {
      if (doneCount.has(keyName)) return;
      const [kindName, ...rest] = keyName.split(" ");
      warnings.push(`${rest.join(" ")} aparece em ${[...scens].join(", ")} mas nenhum passo ${verb[kindName]} nele`);
    });

    /* ---------- does the screen change per rung? ---------- */
    if (cfg.responsive !== false){
      /* its own probe: the scenario scan's was removed before this point,
         and measuring an element outside the document returns empty style
         — which looked just like "does not change on any rung" */
      const probeL = document.createElement("div");
      probeL.className = "h-probe";
      document.body.appendChild(probeL);

      const noEngine = !layoutEngine();
      if (noEngine){
        warnings.push("arranjo e medidas por degrau não verificáveis aqui (sem motor de layout) — "
          + "abra no navegador; o sumiço de conteúdo abaixo ainda vale");
      }
      {
        const perPage = {};
        cfg.scenarios.forEach(x => {
          if (stateOf(x)) return;                   /* a state does not represent an arrangement */
          const pg = x.page || cfg.defaultPage || "única";
          (perPage[pg] = perPage[pg] || []).push(x);
        });

        /* Each declared view is an ordinary screen, so the whole block below
           runs once per view. A page with three views owes three arrangements
           across the ladder, not one — the discipline is multiplied by the
           views, never escaped by them. */
        const units = multi() ? VIEWS : [null];

        for (const pg of Object.keys(perPage)){
          /* Looks at a few of the page's journeys, not just the first: one
             that ends in the empty state has no arrangement to compare, and
             judging the page by it would accuse falsely. One journey
             showing different arrangements is enough for the page to have
             responded. */
          const candidates = perPage[pg].slice(0, cfg.layoutJourneys || 3);

          for (const view of units){
          /* a probe per view: frames left over from the previous view would
             sit in this one's layout and in its measurements */
          const probeV = view ? document.createElement("div") : probeL;
          if (view){ probeV.className = "h-probe"; document.body.appendChild(probeV); }
          const unit = pg + (view ? ` · ${view.label}` : "");
          let best = { distinct:1, inheritedList:[], nameStr:candidates[0] && candidates[0].name };

          for (const s of candidates){
            state.ctx = contextOf(s);
            const sigs = [];
            for (const d of LADDER) sigs.push({ d, ...(await rungSignature(s, d, probeV, view)) });

            sigs.forEach(x => (x.physical || []).forEach(([keyName, detail]) => {
              const k = `${unit}: ${keyName}`;
              const reg = physicals.get(k) || { rungs:[], details:new Set() };
              if (reg.rungs.indexOf(x.d.id) < 0) reg.rungs.push(x.d.id);
              reg.details.add(detail);
              physicals.set(k, reg);
            }));

            /* content that exists when wide and vanishes when narrow with
               nobody having decided it: it goes the wrong way, for lack of
               room */
            const wide = sigs[sigs.length - 1].offer || new Set();
            const narrow = sigs[0].offer || new Set();
            wide.forEach(item => {
              if (String(item).indexOf("estado:") === 0) return;
              if (!narrow.has(item)){
                physicals.set(`${unit}: ${item} some no estreito`,
                  `existe em ${sigs[sigs.length - 1].d.id}, some em ${sigs[0].d.id} — decisão ou falta de espaço?`);
              }
            });

            const distinct = new Set(sigs.map(x => x.sig)).size;
            if (distinct > best.distinct){
              best = {
                distinct,
                inheritedList: sigs.filter((x, i) => i > 0 && x.sig === sigs[i - 1].sig).map(x => x.d.id),
                nameStr: s.name
              };
            }
          }

          const what = view ? `a vista "${view.label}" da página "${pg}"` : `a página "${pg}"`;
          if (noEngine){ /* with no engine there is no arrangement to judge */ }
          else if (best.distinct === 1){
            warnings.push(`${what} desenha o MESMO arranjo em toda a escada `
              + `(${LADDER.map(d => d.id).join(", ")}) — coube, mas não respondeu`);
          } else {
            if (best.distinct < (cfg.minimalArrangements || 2)){
              warnings.push(`${what} tem só ${best.distinct} arranjo(s) em ${LADDER.length} degraus`);
            }
            if (best.inheritedList.length){
              infos.push(`"${unit}": ${best.distinct} arranjos (via ${best.nameStr}); `
                + `${best.inheritedList.join(", ")} herdam o degrau anterior`);
            }
          }
          if (view) probeV.remove();
          }
        }
        state.ctx = clone(auditCtx);
      }
      probeL.remove();
      physicals.forEach((reg, k) => {
        /* the key is what names the page, the view and the thing that
           vanished; pushing only the value left "existe em xlg, some em xxs"
           with nothing to say WHAT did, which with several views on the
           bench does not even say which screen */
        if (typeof reg === "string"){ warnings.push(`${k} — ${reg}`); return; }
        warnings.push(`${k} — ${[...reg.details].slice(0, 3).join(", ")} `
          + `(em ${reg.rungs.join(", ")})`);
      });
    }

    /* ---------- variety of journeys ----------
       Depth is not enough: a suite with five happy paths and no conflict is
       as incomplete as a one-step scenario. The vocabulary below forces you
       to think in TYPES of journey, and every tag is checked against what
       the screen actually does — a @conflito that ends with no error on
       screen is a lying label.

         @feliz        the path that works, end to end
         @conflito     the server refuses: email exists, limit, 422
         @recuperacao  breaks midway and the person recovers on their own
         @retorno      someone who already used it returns: leaves the
                       screen and comes back in                          */
    if (cfg.journeys !== false){
      const TYPES = ["feliz", "conflito", "recuperacao", "retorno"];
      const kindFor = s => (s.tags || []).map(t => t.replace(/^@/, ""))
                                        .find(t => TYPES.indexOf(t) > -1) || null;

      const byPage = {};
      cfg.scenarios.forEach(s => {
        const pg = s.page || cfg.defaultPage || "única";
        (byPage[pg] = byPage[pg] || []).push(s);
      });

      for (const pg of Object.keys(byPage)){
        const ofGroup = byPage[pg];
        const kinds = new Set(ofGroup.map(kindFor).filter(Boolean));

        if (!kinds.has("feliz")){
          warnings.push(`a página "${pg}" não tem jornada @feliz — falta o caminho `
            + `que dá certo de ponta a ponta`);
        }
        if (!["conflito", "recuperacao", "retorno"].some(t => kinds.has(t))){
          warnings.push(`a página "${pg}" só tem caminho feliz — falta pelo menos uma `
            + `jornada @conflito, @recuperacao ou @retorno`);
        }

        /* the same signature = a scenario cloned under another name */
        const signatures = {};
        ofGroup.forEach(s => {
          const sig = (s.steps || []).map(st => { const sp = specOf(st); return sp ? sp.kindName + " " + sp.sel : null; })
                                     .filter(Boolean).join(" > ");
          if (!sig) return;
          if (signatures[sig]){
            warnings.push(`"${s.name}" e "${signatures[sig]}" percorrem exatamente os mesmos `
              + `controles — são o mesmo cenário com nomes diferentes`);
          } else signatures[sig] = s.name;
        });

        /* at least one end-to-end journey per page */
        const longest = Math.max(0, ...ofGroup.map(s =>
          (s.steps || []).filter(st => specOf(st) || st.waitFor).length));
        if (longest < (cfg.endToEndActions || 3)){
          warnings.push(`a página "${pg}" não tem nenhuma jornada de ponta a ponta `
            + `(a maior tem ${longest} ações) — falta o percurso completo`);
        }
      }

      /* the type tags are checked against the final screen */
      for (const s of cfg.scenarios){
        state.ctx = contextOf(s);
        const kindName = kindFor(s);
        if (!kindName) continue;
        const stps = (s.steps || []).length;

        const errorMarks = el => !!(el.querySelector('[data-erro]')
          || el.querySelector('[data-estado="erro"]') || el.querySelector('[data-pg="erro"]'));

        forcedWidth = sampleWidth(s, 0);
        adjustProbe(probe);
        let end = null, middle = false;
        for (let k = -1; k < stps; k++){
          try {
            const b = await buildState(s, k, 0);
            paint(probe, { app:b.app, ex:b.ex, scenario:s.id });
            if (errorMarks(probe)) middle = true;
            if (k === stps - 1) end = errorMarks(probe);
          } catch { /* already called out elsewhere */ }
        }

        forcedWidth = null;
        if (kindName === "feliz" && (end || middle)){
          warnings.push(`${s.name}: marcado @feliz mas a tela mostra erro no caminho — `
            + `caminho feliz não passa por falha`);
        }
        if (kindName === "conflito" && !end){
          warnings.push(`${s.name}: marcado @conflito mas termina sem erro na tela — `
            + `o conflito precisa aparecer para quem usa`);
        }
        if (kindName === "recuperacao" && !(middle && !end)){
          warnings.push(`${s.name}: marcado @recuperacao mas ${middle ? "termina no erro" : "nunca falha"} — `
            + `recuperação é quebrar no meio e sair inteiro do outro lado`);
        }
      }
    }

    /* the typed keyword versus what the step does */
    cfg.scenarios.forEach(s => {
      (s.steps || []).forEach((st, i) => {
        const nat = nature(st);
        if (nat === "acao" && st.then != null){
          warnings.push(`${s.name}: passo ${i + 1} está escrito como "Então" mas executa uma ação `
            + `— Então descreve o que se vê; a ação é Quando`);
        }
        if (nat === "verificacao" && st.when != null){
          warnings.push(`${s.name}: passo ${i + 1} está escrito como "Quando" mas só verifica `
            + `— Quando é a ação; o que se observa é Então`);
        }
      });
    });

    /* ---------- a journey, not a loose assertion ----------
       "Dado que o usuário não pagou / Então a tela fica vazia" is not a
       scenario: it is a screenshot with a caption. A scenario is the path —
       reach the screen, act, and see what changed. The rules below demand
       that. */
    if (cfg.journeys !== false){
      const MIN_ACTIONS = cfg.minAcoes || 2;

      /* E inherits the previous keyword: an E after a Então IS a Então. So
         an action written as an E-of-Então lies about what the step does.
         An action is a Quando (or an E inside the Quando block); a check is
         a Então (or an E inside the Então block). */
      cfg.scenarios.forEach(s => {
        let inherited = null;
        (s.steps || []).forEach((st, i) => {
          const k = kindOf(st);
          if (k.kw === "Quando" || k.kw === "Então" || k.kw === "Dado") inherited = k.kw;
          const efetivo = (k.kw === "E" || k.kw === "Mas") ? inherited : k.kw;
          const acted = !!(specOf(st) || st.waitFor);
          const verified = typeof st.check === "function";

          /* did it change the state? then it is a Quando, always. It does not
             matter whether it came from a click, from applyState or from
             the response that arrived: a step that changes the world is an
             action, and an action in Gherkin is written as a Quando. */
          if (stateChanged.has(s.id + "|" + i) && efetivo !== "Quando"){
            warnings.push(`${s.name}: passo ${i + 1} ("${k.text.slice(0, 40)}") muda o estado, `
              + `então é Quando — está escrito como ${k.kw}`
              + (k.kw === "E" ? ` depois de ${inherited}` : ""));
          }
          if (acted && efetivo === "Então"){
            warnings.push(`${s.name}: passo ${i + 1} ("${k.text.slice(0, 40)}") age, mas está escrito `
              + `como ${k.kw} depois de Então — E herda o Então, use Quando`);
          }
          if (verified && efetivo === "Quando"){
            warnings.push(`${s.name}: passo ${i + 1} ("${k.text.slice(0, 40)}") verifica, mas está `
              + `escrito como ${k.kw} depois de Quando — use Então`);
          }
        });
      });

      cfg.scenarios.forEach(s => {
        if (s.journey === false) return;
        const steps = s.steps || [];
        const actions = steps.map((st, i) => ({ st, i, spec:specOf(st) || (st.waitFor ? { sel:"(resposta)" } : null) }))
                           .filter(x => x.spec);
        const nameStr = s.name;

        if (actions.length < MIN_ACTIONS){
          warnings.push(`${nameStr}: ${actions.length} ação(ões) — não é jornada. `
            + `Mostre o caminho inteiro (chegar na tela, agir, ver o resultado), `
            + `não só o estado final`);
        }

        /* an assertion that only exists BEFORE any action describes the screen
           standing still; what matters is what changed after acting */
        const firstAction = actions.length ? actions[0].i : Infinity;
        const hasThenAfter = steps.some((st, i) => i > firstAction && typeof st.check === "function");
        if (actions.length && !hasThenAfter){
          warnings.push(`${nameStr}: nenhum Então depois da última ação — `
            + `o cenário age e não verifica o que aconteceu`);
        }

        /* clicking the same button three times is not a path */
        const aims = new Set(actions.map(a => a.spec.sel));
        if (actions.length >= MIN_ACTIONS && aims.size < 2){
          warnings.push(`${nameStr}: todas as ações são no mesmo alvo (${[...aims][0]}) — `
            + `uma jornada passa por controles diferentes`);
        }
      });

      /* every page needs at least one scenario that REACHES it from another:
         otherwise nobody specified how you get in there */
      const pages = {};
      visible().forEach(s => {
        const pg = s.page || cfg.defaultPage || "única";
        pages[pg] = pages[pg] || { arrived:false, total:0 };
        pages[pg].total++;
      });
      arrivals.forEach(pg => { if (pages[pg]) pages[pg].arrived = true; });
      Object.keys(pages).forEach(pg => {
        if (!pages[pg].arrived && Object.keys(pages).length > 1){
          warnings.push(`nenhum cenário chega na página "${pg}" vindo de outra tela — `
            + `falta a jornada de entrada (navegar até ali e só então agir)`);
        }
      });
    }

    /* Every declared route has to appear in the specification from both
       ends: succeeding and failing. A route exercised only on success is
       half the behaviour — the error handling is left for somebody to
       discover in production. */
    if (cfg.routes && cfg.routes.length && cfg.coveredRoutes !== false){
      const byRoute = {};
      cfg.routes.forEach(r => {
        byRoute[(r.httpMethod || "GET").toUpperCase() + " " + r.pathStr] =
          { ok:new Set(), error_:new Set(), origins:new Set(), onLoad: !!r.onLoad };
      });
      Object.keys(network.seenRoutes).forEach(id => {
        const v = network.seenRoutes[id], aim = byRoute[id];
        if (!aim) return;
        v.ok.forEach(n => aim.ok.add(n));
        v.error_.forEach(n => aim.error_.add(n));
        v.origins.forEach(o => aim.origins.add(o));
      });

      Object.keys(byRoute).forEach(id => {
        const r = byRoute[id];
        if (!r.ok.size && !r.error_.size){
          warnings.push(`${id} está declarada mas nenhum cenário a chama — rota morta?`);
          return;
        }
        if (!r.ok.size)   warnings.push(`${id} só aparece falhando — falta o cenário de sucesso`);
        if (!r.error_.size) warnings.push(`${id} só aparece dando certo — falta o cenário de erro `
          + `(rede:{ "${id}": 500 })`);
        /* attribution: every call is born from a step. Only in the Dado is it
           a screen load — legitimate, but it has to be declared with
           onLoad:true, otherwise nobody knows what fires it. */
        if (!r.origins.has("passo") && !r.onLoad){
          warnings.push(`${id} só é chamada pelo Dado — se ela carrega junto com a tela, `
            + `marque naCarga:true na rota; se não, falta o Quando que a dispara`);
        }
      });
    }

    /* the page needs all three states. Missing one is not a matter of style:
       it is a path nobody designed and the user will meet. */
    if (cfg.states !== false){
      /* each page has its own AsyncStateContainer, so the demand is per
         page: a list with no empty state is as holed as a detail view with
         no error state */
      const pages = {};
      cfg.scenarios.forEach(x => {
        const pg = x.page || cfg.defaultPage || "única";
        (pages[pg] = pages[pg] || {})[stateOf(x) || "_"] = x;
      });

      Object.keys(pages).forEach(pg => {
        const covered = pages[pg];
        STATES.forEach(e => {
          if (!covered[e]){
            warnings.push(`a página "${pg}" não tem cenário de ${e} — todo AsyncStateContainer `
              + `precisa de carregando, vazio e erro (marque um cenário com @${e} e pagina:"${pg}")`);
          }
        });
        const errStr = covered.error_;
        if (errStr && !errStr.network && !errStr.fixtureFailure){
          warnings.push(`${errStr.name}: marcado @erro mas não força falha em nenhuma rota `
            + `— declare rede:{ "GET /api/…": 500 }`);
        }
      });

      /* AsyncStateContainer has to be in the map, otherwise the mapping
         disappears precisely at the component that carries the three states */
      const hasASC = Object.values(cfg.primitives || {}).some(v =>
        (typeof v === "string" ? v : v && v.nameStr) === "AsyncStateContainer");
      if (cfg.primitives && !hasASC){
        warnings.push(`nenhum seletor mapeia AsyncStateContainer — a tela está `
          + `desenhando carregando/vazio/erro à mão?`);
      }
    }

    rawList.forEach(m => {
      warnings.push(`marcação crua: ${m.onde}${m.textStr ? ` ("${m.textStr}")` : ""} `
        + `não pertence a nenhum componente — use ${m.suggestion}`);
    });

    const facade = new Set();
    network.log.forEach(l => { if (l.didNotPersist && l.routeId) facade.add(l.routeId); });
    facade.forEach(id => {
      warnings.push(`${id} respondeu 200 mas não alterou as fixtures — a rota é fachada, `
        + `então "salvo" é mentira: recarregar desfaz`);
    });

    const seen = new Set();
    silentChanges.splice(0).forEach(m => {
      const k = m.scn + "#" + m.stp;
      if (seen.has(k)) return;
      seen.add(k);
      warnings.push(`${m.nameStr}: passo ${m.stp + 1} mudou a tela ao ${m.kindName} ${m.sel} `
        + `mas não fez nenhum pedido — a alteração se perde ao recarregar? `
        + `(se for só de interface, marque local: true no passo)`);
    });

    const seenRouteSet = new Set();
    lyingLabels.splice(0).forEach(m => {
      const k = m.scn + "#" + m.stp;
      if (seenRouteSet.has(k)) return;
      seenRouteSet.add(k);
      warnings.push(`${m.nameStr}: o controle "${m.caption}" diz "${m.verb}" mas o passo ${m.stp + 1} `
        + `não fez pedido nenhum — rótulo que promete gravar tem de gravar`);
    });

    const seenLocal = new Set();
    suspectLocal.splice(0).forEach(m => {
      const k = m.scn + "#" + m.stp;
      if (seenLocal.has(k)) return;
      seenLocal.add(k);
      warnings.push(`${m.nameStr}: passo ${m.stp + 1} está marcado local: true mas alterou dado `
        + `do servidor em ${m.sel}, e nenhum passo depois persiste — ou salve, ou não é local`);
    });

    noHandler.forEach(sel => {
      warnings.push(`${sel} parece operável na tela mas nenhum handler responde — afordância sem ação`);
    });

    /* Every Proto.on is an onClick/onChange. Three different states, three
       different problems:
         matches nothing        → dead code
         matches, never fired   → uncovered behaviour
         fired                  → covered */
    handlers.forEach(h => {
      const keyName = h.type + " " + h.selector;
      if (!usedHandlers.has(h.selector)){
        warnings.push(`handler ${h.type} ${h.selector} nunca casa com a tela — código morto?`);
      } else if (!exercised.has(keyName)){
        warnings.push(`handler ${h.type} ${h.selector} existe e casa com a tela, mas nenhum passo o dispara — comportamento sem cobertura`);
      }
    });

    /* A step that names a view in a prototype that declares none: today the
       harness quietly ignores it, so a leftover `on:` from a copied scenario
       reads as if it were scoping something. */
    if (!multi()){
      const strays = cfg.scenarios.filter(s => (s.steps || []).some(st => st.on));
      if (strays.length){
        warnings.push(`${strays.map(s => `"${s.name}"`).join(", ")}: passo com on:"…" `
          + `mas o protótipo não declara views — o on não aponta para nada`);
      }
    }

    /* ---------- the query layer ---------- */
    watchList().forEach(q => {
      if (!findRoute(q.httpMethod, q.pathStr)){
        warnings.push(`a assinatura "${q.nameStr}" observa ${q.httpMethod} ${q.pathStr}, `
          + `que não é uma rota declarada`);
      }
    });
    if (multi() && !watching()){
      const writes = (cfg.routes || []).some(r =>
        ["POST","PUT","PATCH","DELETE"].indexOf((r.httpMethod || "GET").toUpperCase()) > -1);
      if (writes){
        warnings.push(`várias vistas e nenhuma assina nada (watches) — cada tela está `
          + `mantendo a própria cópia do servidor à mão, e alguém tem que lembrar de `
          + `reler. Declare watches:{ nome:"GET /rota" } na vista e o harness relê sozinho`);
      }
    }

    /* ---------- what several views owe ----------
       A view is an ordinary screen, so it owes everything a screen owes — and
       the audit above has already demanded that of each of them. What is left
       is what only exists because they are on the bench together. */
    if (multi()){
      const acted = new Set(), choreo = new Set();
      cfg.scenarios.forEach(s => (s.steps || []).forEach(st => {
        if (specOf(st) && st.on) acted.add(st.on);
        [].concat(st.propagates || [], st.unchanged || []).forEach(v => choreo.add(v));
      }));

      VIEWS.forEach(v => {
        if (!acted.has(v.id)){
          warnings.push(`a vista "${v.label}" não é operada por nenhum passo — `
            + `uma tela que ninguém usa é uma captura de tela, não uma especificação`);
        }
        const seen = statesSeen[v.id] || new Set();
        STATES.forEach(e => {
          if (!seen.has(e)){
            warnings.push(`a vista "${v.label}" nunca marcou [data-estado="${e}"] em nenhum passo — `
              + `são três telas, e cada uma passa por carregando, vazio e erro`);
          }
        });
      });

      /* An Examples `largura` column forces ONE width on the whole draw, so
         with views on the bench it puts every screen at that width at once —
         which is almost never what the row meant. Each view already carries
         the width of its own device. */
      const comLargura = cfg.scenarios.filter(s => isOutline(s) && sampleWidth(s, 0));
      if (comLargura.length){
        warnings.push(`${comLargura.map(s => `"${s.name}"`).join(", ")}: a coluna largura `
          + `vale para TODAS as vistas ao mesmo tempo — com várias telas, cada uma já traz `
          + `a largura do seu aparelho`);
      }

      if (!choreo.size){
        warnings.push(`nenhum passo declara propagates/unchanged — com várias vistas, o que uma `
          + `ação faz nas OUTRAS telas é justamente o que precisa ser especificado `
          + `(propagates:["cliente"], unchanged:["cozinha"])`);
      }
    }

    return {
      warnings: warnings.concat(problems.splice(0)),
      infos,
      coverage: { total: handlers.length, exercised: exercised.size }
    };
  }

  /* ---------- isolated verification ----------
     The suite runs inside an iframe that loads a copy of this very
     document. That gives it a whole realm of its own: other fixtures,
     another context, another sandbox, another queue, another fetch
     interceptor. Nothing is shared, so navigating the screen does not
     corrupt the run and the run does not need to be cancelled.

     A Worker will not do: verification really DRAWS the render and asks
     the DOM whether the screen met the Então. A Worker has no DOM. The
     iframe has one — and it is still the same code, with no simulation. */
  let verifyIframe = null;

  function verifyIsolated(){
    return new Promise(resolve => {
      try {
        if (verifyIframe) verifyIframe.remove();
        const v = vp();
        const mark = "<scr" + "ipt>window.__PROTO_CHILD=1;</scr" + "ipt>";
        const copy = "<!DOCTYPE html>" +
          document.documentElement.outerHTML.replace("<head>", "<head>" + mark);

        const ifr = document.createElement("iframe");
        ifr.className = "h-verify-frame";
        ifr.setAttribute("aria-hidden", "true");
        ifr.style.cssText = "position:absolute;left:-99999px;top:0;border:0;"
                          + "width:" + Math.max(1000, v.w) + "px;height:" + Math.max(800, v.h) + "px";
        verifyIframe = ifr;

        /* If the iframe gives no sign of life, the suite runs in the same
           world, as before. An environment that blocks iframes (or srcdoc
           without script) degrades to the old path instead of never
           verifying at all. */
        let alive = false;
        const giveUp = setTimeout(() => {
          if (alive) return;
          window.removeEventListener("message", onReceive);
          ifr.remove(); verifyIframe = null;
          resolve(null);
        }, cfg.iframeWait || 6000);

        const onReceive = ev => {
          /* only this iframe may report a result. A magic field is not proof
             of origin: any window able to post here could otherwise hand the
             gate a fabricated all-green suite. The origin is opaque for a
             srcdoc frame, so the window reference is what identifies it. */
          if (ev.source !== ifr.contentWindow) return;
          const m = ev.data;
          if (!m || m.proto !== 1) return;
          alive = true;
          if (m.kindName === "progress"){ externalProgress(m.doneCount, m.total); return; }
          if (m.kindName === "result"){
            clearTimeout(giveUp);
            window.removeEventListener("message", onReceive);
            ifr.remove(); verifyIframe = null;
            resolve(m.suite);
          }
        };
        window.addEventListener("message", onReceive);

        ifr.srcdoc = copy;
        document.body.appendChild(ifr);
      } catch (e){
        /* no iframe (restricted environment), falls back to the old mode */
        resolve(null);
      }
    });
  }

  let externalProgress = () => {};
  let running = false, runningDone = 0;
  let verificationMode = "—";

  /* Runs the suite in isolation and adopts the result. Since nothing is
     shared there is nothing to cancel: the person keeps navigating while it
     runs. */
  async function verify(){
    const btn = $("h-verify");
    const total = cfg.scenarios.length;
    const pill = $("h-checks");
    running = true; runningDone = 0;
    externalProgress = (doneCount, t) => {
      runningDone = doneCount;
      if (!pill) return;
      pill.className = "h-pill verificando";
      pill.innerHTML = `<span class="h-spin"></span>verificando <b>${doneCount}</b>/${t || total}`;
      pill.title = "Roda isolada num iframe — pode navegar à vontade";
    };
    if (btn){ btn.setAttribute("aria-busy", "true"); btn.textContent = "Verificando…"; }
    externalProgress(0, total);

    const r = await verifyIsolated();
    running = false;
    externalProgress = () => {};
    if (btn){ btn.removeAttribute("aria-busy"); btn.textContent = "Verificar"; }

    if (!r){
      /* environment with no iframe: runs in the same world, as before */
      verificationMode = "mesmo mundo (sem iframe)";
      return verifyAll();
    }
    verificationMode = "isolado no iframe";
    suite = r;
    interrupted = false;
    partial = null;
    render();
    return r;
  }

  /* ---------- full verification ---------- */
  async function verifyAll(){
    return enqueue(async () => {
    const probe = document.createElement("div");
    probe.className = "h-probe";
    sizeProbe(probe, currentWidth().w);
    document.body.appendChild(probe);

    const by = partial ? partial.by : {};
    let ok = partial ? partial.ok : 0;
    let bad = partial ? partial.bad : 0;
    const failures = partial ? partial.failures : [];

    verifying = true;
    cancelVerification = false;
    interrupted = false;
    network.seenRoutes = {};
    statesSeen = {};

    /* 20 seconds with no sign of life feels frozen: the pill becomes a
       counter and the button stays busy while the suite runs */
    const btn = $("h-verify");
    userCtx = userCtx || clone(state.ctx);
    const all = cfg.scenarios;
    const total = all.length;
    /* resumes where it stopped */
    let startIdx = partial ? partial.idx : 0;
    let doneCount = startIdx;
    const progressFn = () => {
      const pill = $("h-checks");
      if (!pill) return;
      pill.className = "h-pill verificando";
      pill.innerHTML = `<span class="h-spin"></span>verificando <b>${doneCount}</b>/${total}`;
      pill.title = "Roda isolada num iframe — pode navegar à vontade";
    };
    if (btn){ btn.setAttribute("aria-busy", "true"); btn.textContent = "Verificando…"; }
    progressFn();
    await new Promise(r => setTimeout(r, 0));   /* lets the screen paint before blocking */
    exercised.clear();   /* evidence holds for a whole run */
    memo = new Map();      /* a new run starts with a clean cache */
    let idxAtual = startIdx;
    for (const s of all.slice(startIdx)){
      if (cancelVerification) break;
      state.ctx = contextOf(s);
      by[s.id] = {};
      doneCount++; idxAtual++; progressFn();
      if (window.__protoProgress) window.__protoProgress(doneCount, total);
      await new Promise(r => setTimeout(r, 0));
      const rows = isOutline(s) ? s.examples.tableRows.map((_, i) => i) : [0];

      for (const ri of rows){
        const stps = s.steps || [];
        for (let i = 0; i < stps.length; i++){
          const st = stps[i];
          if (typeof st.check !== "function") continue;
          /* the row's width applies when drawing and checking too, not only
             during the replay — otherwise the Então measures the wrong
             screen */
          forcedWidth = sampleWidth(s, ri);
          adjustProbe(probe);
          const built = await buildState(s, i, ri);
          const probeState = { ...state, app:built.app, ex:built.ex, scenario:s.id, step:i, example:ri };
          /* if an earlier step could not act, that is the real reason, not the
             assertion that came after it */
          const stepError = (built.errors_ || []).map(e => e.error_)[0];

          let passed, reason = null;
          try {
            const roots = paint(probe, probeState);
            noteStates(roots);
            /* every view's root, so an assertion can say "the customer saw it
               change" and "the kitchen's board did not move" in one breath */
            probeState.views = roots;
            const el = rootOf(roots, probe, st.on);
            if (!el){
              passed = false;
              reason = 'o Então lê a vista "' + st.on + '", que não está declarada em views';
            } else {
              passed = !!st.check(built.app, el, probeState);
              if (!passed) reason = stepError || "a verificação do Então devolveu falso";
            }
          } catch (e){
            passed = false;
            reason = stepError || ("quebrou ao desenhar: " + e.message);
          }

          passed ? ok++ : bad++;
          if (!passed){
            const k = kindOf(st);
            failures.push({
              scen:s.name, tags:(s.tags || []).join(" "),
              stp:i + 1, kw:k.kw, textStr:subst(k.text, built.ex),
              example: isOutline(s) ? s.examples.tableRows[ri].join(" | ") : null,
              reason,
              link:`#${s.id}/${i + 1}` + (isOutline(s) && ri ? `?ex=${ri + 1}` : "")
            });
          }
          by[s.id][i] = (by[s.id][i] == null ? passed : (by[s.id][i] && passed));
          by[s.id]["ex" + ri] = (by[s.id]["ex" + ri] == null ? passed : (by[s.id]["ex" + ri] && passed));
          forcedWidth = null;
        }
      }
    }

    /* Every state scenario gets an assertion the author does not write. In a
       journey a state is a STEP, not a destination: the screen passes
       through loading and leaves it. So it is enough for the state to show
       up somewhere along the path — demanding it on the last step would
       force the scenario to end sitting in the error, which is exactly what
       we do not want. */
    for (const s of all){
      if (cancelVerification) break;
      state.ctx = contextOf(s);
      const est = stateOf(s);
      if (!est) continue;
      const total = (s.steps || []).length;
      let matched = false, reason = null, onde = null;

      forcedWidth = sampleWidth(s, 0);
      adjustProbe(probe);
      /* A state scenario may name the view it is about: with three screens on
         the bench, "the empty state" is the empty state OF SOMEBODY. Naming
         none keeps the old reading — it showed up somewhere. */
      const alvoView = s.on || null;
      for (let i = -1; i < total && !matched; i++){
        try {
          const built = await buildState(s, i, 0);
          const roots = paint(probe, { app:built.app, ex:built.ex, scenario:s.id });
          noteStates(roots);
          const el = rootOf(roots, probe, alvoView);
          if (!el){
            reason = `o cenário é da vista "${alvoView}", que não está declarada em views`;
            break;
          }
          if (el.querySelector(`[data-estado="${est}"]`)){ matched = true; onde = i; }
        } catch (e){ reason = "quebrou ao desenhar: " + e.message; break; }
      }
      if (!matched && !reason){
        reason = `em nenhum passo ${alvoView ? `a vista "${alvoView}"` : "a tela"} marcou `
               + `[data-estado="${est}"] — o AsyncStateContainer cobriu este caso?`;
      }

      forcedWidth = null;
      matched ? ok++ : bad++;
      if (!matched){
        failures.push({ scen:s.name, tags:(s.tags || []).join(" "), stp:"—",
          kw:"Estado", textStr:est, example:null, reason, link:`#${s.id}/dado` });
      }
    }

    /* ---------- a step that does not say where it acts ----------
       With several screens open the same control can be on more than one of
       them, so an action naming no view has not said what happens. The replay
       reports it too, but only where a later Então drags it into the open — a
       scenario whose last step is that action would pass with a warning. This
       makes it a failure on its own, which is what the rule claims to be. */
    if (multi()) for (const s of all){
      if (cancelVerification) break;
      (s.steps || []).forEach((st, i) => {
        const spec = specOf(st);
        const k = kindOf(st);
        const fail = reason => {
          bad++;
          failures.push({ scen:s.name, tags:(s.tags || []).join(" "), stp:i + 1,
            kw:k.kw, textStr:k.text, example:null, reason, link:`#${s.id}/${i + 1}` });
        };
        if (st.on && !viewById(st.on)){
          fail(`o passo aponta para a vista "${st.on}", que não está declarada em views`);
        } else if (spec && !spec.on){
          fail(`o passo age mas não diz em qual vista — falta on:"`
             + VIEWS.map(v => v.id).join('" / "') + `"`);
        }
      });
    }

    /* ---------- propagation: what the OTHER screens did ----------
       The reason to have several views open at once is that an action on one
       is meant to show up on another — and, just as often, is meant NOT to.
       `propagates` names the views that must have changed because of a step;
       `unchanged` names the ones that must not have. Neither can be said with
       a single screen, and neither is a matter of opinion: the harness holds
       both renderings and compares them. */
    if (multi()) for (const s of all){
      if (cancelVerification) break;
      state.ctx = contextOf(s);
      const stps = s.steps || [];
      for (let i = 0; i < stps.length; i++){
        const st = stps[i];
        const wants = [].concat(st.propagates || []);
        const holds = [].concat(st.unchanged || []);
        if (!wants.length && !holds.length) continue;

        const k = kindOf(st);
        const fail = reason => {
          bad++;
          failures.push({ scen:s.name, tags:(s.tags || []).join(" "), stp:i + 1,
            kw:k.kw, textStr:k.text, example:null, reason, link:`#${s.id}/${i + 1}` });
        };

        /* every row of an Esquema do Cenário, not just the first: a
           propagation that only holds for one set of Exemplos is a
           propagation that does not hold */
        const rows = isOutline(s) ? s.examples.tableRows.map((_, ri) => ri) : [0];
        for (const ri of rows){
          const linha = isOutline(s) ? ` (${s.examples.tableRows[ri].join(" | ")})` : "";
          let before = null, after = null, broke = null;
          forcedWidth = sampleWidth(s, ri);
          adjustProbe(probe);
          try {
            const b = await buildState(s, i - 1, ri);
            before = snapshotViews(paint(probe, { app:b.app, ex:b.ex, scenario:s.id }));
            const a2 = await buildState(s, i, ri);
            after  = snapshotViews(paint(probe, { app:a2.app, ex:a2.ex, scenario:s.id }));
          } catch (e){ broke = "quebrou ao desenhar: " + e.message; }
          forcedWidth = null;

          if (broke){ wants.concat(holds).forEach(() => fail(broke + linha)); continue; }

          wants.forEach(id => {
            if (!viewById(id)) return fail(`o passo declara propagates:"${id}", que não está declarada em views`);
            if (before[id] !== after[id]) ok++;
            else fail(`a vista "${id}" não mudou depois deste passo${linha} — `
                    + `a propagação está declarada mas não acontece`);
          });
          holds.forEach(id => {
            if (!viewById(id)) return fail(`o passo declara unchanged:"${id}", que não está declarada em views`);
            if (before[id] === after[id]) ok++;
            else fail(`a vista "${id}" mudou depois deste passo${linha} — `
                    + `o passo declara que ela fica como está`);
          });
        }
      }
    }

    if (!cancelVerification){
      for (const s of all){ state.ctx = contextOf(s); primCache[s.id] = await primOf(s); }
    }
    state.ctx = clone(userCtx);

    probe.remove();

    if (cancelVerification){
      /* keeps what has already been established so it can continue later,
         instead of throwing it away and redoing everything */
      partial = { idx: idxAtual, by, ok, bad, failures };
      verifying = false;
      state.ctx = clone(userCtx);
      suite = null;
      interrupted = true;
      cancelVerification = false;
      if (btn){ btn.removeAttribute("aria-busy"); btn.textContent = "Verificar"; }
      const pill = $("h-checks");
      if (pill){
        pill.className = "h-pill";
        pill.innerHTML = `pausada em <b>${idxAtual}</b>/${total}`;
        pill.title = "Continua sozinha quando você parar de mexer";
      }
      return { ok:0, bad:0, warnings:[], canceled:true };
    }

    const aud = await audit();
    partial = null;
    verifying = false;
    /* do NOT clear: what the suite just computed is exactly what the person
       is about to navigate. Discarding it here would force every journey to
       be redone from scratch on the first click. */
    if (btn){ btn.removeAttribute("aria-busy"); btn.textContent = "Verificar"; }
    state.ctx = clone(userCtx);
    suite = { by, ok, bad, failures, skipped: cfg.scenarios.length - visible().length,
              warnings: aud.warnings, infos: aud.infos || [], coverage: aud.coverage };
    render();
    return suite;
    });
  }

  /* A one-screen report, to paste back to whoever edited the file. */
  function report(){
    if (!suite) return "";
    const ctx = cfg.context.map(d => {
      const v = state.ctx[d.id];
      return `${d.id}=${Array.isArray(v) ? (v.join(",") || "nenhuma") : v}`;
    }).join(" · ");

    let t = `PROTO · a verificação falhou\n`;
    t += `protótipo: ${cfg.title}\n`;
    t += `contexto: ${ctx}\n`;
    t += `placar: ${suite.bad} falha${suite.bad === 1 ? "" : "s"} · ${suite.ok} ok`;
    if (suite.coverage) t += ` · handlers ${suite.coverage.exercised}/${suite.coverage.total}`;
    t += `\n`;

    (suite.failures || []).forEach((f, i) => {
      t += `\nFALHA ${i + 1} — ${f.scen}${f.tags ? "  " + f.tags : ""}\n`;
      if (f.example) t += `  exemplo: ${f.example}\n`;
      t += `  passo ${f.stp} · ${f.kw} ${f.textStr}\n`;
      t += `  motivo: ${f.reason}\n`;
      t += `  abrir: ${f.link}\n`;
    });

    if ((suite.warnings || []).length){
      t += `\nAVISOS (${suite.warnings.length})\n`;
      suite.warnings.forEach(a => { t += `  - ${a}\n`; });
    }
    return t;
  }

  function checkAt(sid, i){
    const live = results[sid];
    if (live && live[i] != null) return live[i];
    if (suite && suite.by[sid] && suite.by[sid][i] != null) return suite.by[sid][i];
    return null;
  }

  function exStatus(sid, ri){
    if (!suite || !suite.by[sid]) return null;
    const v = suite.by[sid]["ex" + ri];
    return v == null ? null : v;
  }

  function failCount(s){
    const keys = new Set([
      ...Object.keys(results[s.id] || {}),
      ...(suite && suite.by[s.id] ? Object.keys(suite.by[s.id]).filter(k => k.indexOf("ex") !== 0) : [])
    ]);
    let bad = 0;
    keys.forEach(k => { if (checkAt(s.id, Number(k)) === false) bad++; });
    return bad;
  }

  function firstFailure(){
    for (const s of visible()){
      const steps = s.steps || [];
      for (let i = 0; i < steps.length; i++){
        if (checkAt(s.id, i) === false) return { id:s.id, step:i };
      }
    }
    return null;
  }

  function updatePill(){
    const pill = $("h-checks");
    if (!pill) return;
    /* a run in progress owns the pill: without this, navigating during
       verification wiped the counter and it looked as if it had died */
    if (running){ externalProgress(runningDone, cfg.scenarios.length); return; }
    if (suite){
      const warn = (suite.warnings || []).length;
      pill.className = "h-pill " + (suite.bad ? "bad" : (warn ? "warn" : "ok"));
      pill.innerHTML = (suite.bad ? `<b>${suite.ok}</b> ok · <b>${suite.bad}</b> falhando`
                                  : `<b>${suite.ok}</b> ok`)
                     + (warn ? ` · <b>${warn}</b> aviso${warn === 1 ? "" : "s"}` : "");
      const c = suite.coverage;
      pill.title = (c ? `handlers: ${c.exercised}/${c.total} disparados. ` : "")
                 + (warn ? "Os avisos vão no topo do Gherkin" : "Tudo verificado");
      return;
    }
    if (interrupted){
      pill.className = "h-pill";
      pill.innerHTML = partial
        ? `pausada em <b>${partial.idx}</b>/${cfg.scenarios.length}`
        : "verificação interrompida";
      pill.title = "Continua sozinha quando você parar de mexer";
      return;
    }
    const live = Object.values(results[state.scenario] || {});
    const bad  = live.filter(v => v === false).length;
    pill.className = "h-pill" + (live.length ? (bad ? " bad" : " ok") : "");
    pill.innerHTML = live.length
      ? (bad ? `<b>${bad}</b> falhando` : `<b>${live.length}</b> ok`)
      : "sem verificação";
    pill.title = "Verificar roda todos os cenários";
  }

  function runChecks(){
    const s = scn(state.scenario), el = $("app");
    if (!s || !el) return;
    results[s.id] = results[s.id] || {};
    (s.steps || []).forEach((st, i) => {
      if (typeof st.check !== "function") return;
      /* Only the CURRENT step can be judged by the current screen. Running
         the earlier assertions against what is drawn now fails them for the
         wrong reason: "the empty list invites you to create" is true at
         step 1 and false at step 3, when the screen is already another one.
         The earlier steps keep the suite's result, which judged each of
         them at its own moment. */
      if (i !== state.step){ delete results[s.id][i]; return; }
      const root = rootOf(liveRoots, el, st.on);
      try { results[s.id][i] = root ? !!st.check(state.app, root, state) : false; }
      catch { results[s.id][i] = false; }
    });
    updatePill();
  }

  /* ---------- medidas ---------- */
  const STAGE_PAD = 48;

  function vp(){
    const v = VIEWPORTS.find(x => x.id === state.viewport) || VIEWPORTS[1];
    if (v.freeForm){
      /* measures the stage right then: resizing the window changes the
         viewport, which is the point of this option. Rotating does not
         apply. */
      const stage = $("h-stage");
      return { ...v,
        w: Math.max(320, Math.round(((stage && stage.clientWidth)  || 1280) - STAGE_PAD)),
        h: Math.max(320, Math.round(((stage && stage.clientHeight) ||  900) - STAGE_PAD)) };
    }
    return state.landscape ? { ...v, w:v.h, h:v.w } : v;
  }
  function bpLabel(w){
    const d = rungOf(w);
    /* an exact rung width shows clean; between rungs it shows the one below
       with a ~, so as not to fake precision that does not exist */
    return (w === d.w ? "" : "~") + d.id;
  }

  /* With views declared the stage is not a device — it is the row of them.
     Each frame keeps its device's true width (which is what every rule
     measures) and the whole row is scaled to fit, exactly the way a single
     frame already is. */
  const VIEW_GAP = 20, VIEW_LABEL = 22;
  function stageSize(){
    if (!multi()) return vp();
    let w = 0, h = 0;
    VIEWS.forEach((v, i) => {
      const d = viewWidth(v) || { w:380, h:780 };
      w += d.w + (i ? VIEW_GAP : 0);
      h = Math.max(h, d.h);
    });
    return { id:"palco", label:"palco", w, h: h + VIEW_LABEL };
  }

  function fit(){
    const v = stageSize(), frame = $("h-frame"), box = $("h-frame-box"), stage = $("h-stage");
    if (!frame || !box || !stage) return;

    frame.style.width = v.w + "px";
    frame.style.height = v.h + "px";

    let scale;
    if (v.freeForm){
      scale = 1;                       /* the frame is already the size of the stage */
    } else if (state.zoom === "fit"){
      scale = Math.min(1, (stage.clientWidth - STAGE_PAD) / v.w, (stage.clientHeight - STAGE_PAD) / v.h);
    } else scale = Number(state.zoom) / 100;

    frame.style.transform = `scale(${scale})`;
    box.style.width  = Math.round(v.w * scale) + "px";
    box.style.height = Math.round(v.h * scale) + "px";

    frame.classList.toggle("h-multi", multi());
    $("h-dims").innerHTML = multi()
      ? VIEWS.map(x => { const d = viewWidth(x) || {}; return `${x.label} <b>${d.w}</b>`; }).join(" · ")
      : `<b>${v.w}</b> × <b>${v.h}</b> · ${bpLabel(v.w)}`;
    /* the selector mirrors the state, never a second source of truth: a link,
       a scenario and a click can all change the width, and all pass through
       here */
    const selVp = $("h-vp");
    if (selVp && selVp.value !== state.viewport) selVp.value = state.viewport;
    const fitOpt = $("h-zoomfit");
    if (fitOpt) fitOpt.textContent = state.zoom === "fit"
      ? `Ajustar · ${Math.round(scale * 100)}%` : "Ajustar";

    if (initial) syncHash();
  }

  /* ---------- barra lateral ---------- */
  function buildSidebar(){
    const side = $("h-side");
    if (!side) return;
    const f = cfg.feature || {};
    let html = "";

    html += `<div class="h-feature"><h2>${esc(f.name || cfg.title)}</h2>`;
    if (f.as || f.want){
      html += `<p>${esc([f.as && "Como " + f.as, f.want && "eu quero " + f.want].filter(Boolean).join(", "))}</p>`;
    }
    html += `</div>`;

    /* context before the list: it is what defines the list's scope */
    if (cfg.context.length){
      html += `<div class="h-ctx">`;
      cfg.context.forEach(d => {
        const v = state.ctx[d.id];
        /* a single choice becomes a dropdown and a multiselect becomes a
           dropdown with a panel: only the scale stays as chips, because
           there the included levels are the information. It can be forced
           with ui:"chips". */
        /* Three options or fewer fit on one segmented track, and there
           everything is visible at once — better than a dropdown hiding two
           options behind a click. Above that, a dropdown. A scale is always
           a track: the included stretch is the information. */
        const compact = d.options.length <= 3;
        const mode = d.ui || (d.kind === "escala" || compact ? "seg" : "select");
        const activeIdx = d.kind === "escala" ? d.options.findIndex(o => o.id === v) : -1;
        const activeFlag = (d.options.find(o => o.id === v) || {}).label;

        html += `<div class="h-dim"><p class="h-dim-hd">${esc(d.label)}`
             +  (mode === "seg" && d.kind !== "flags" ? ` <span>${esc(activeFlag || "")}</span>` : "")
             +  (d.kind === "flags" && mode !== "select"
                  ? ` <span>${(v || []).length} de ${d.options.length}</span>` : "")
             +  `</p>`;

        if (mode === "seg"){
          html += `<div class="h-seg${d.kind === "flags" ? " multi" : ""}" role="group"`
               +  ` aria-label="${esc(d.label)}">`;
          d.options.forEach((o, i) => {
            const on  = d.kind === "flags" ? (v || []).indexOf(o.id) > -1 : v === o.id;
            const inc = d.kind === "escala" && !on && i < activeIdx;
            html += `<button data-dim="${esc(d.id)}" data-opt="${esc(o.id)}"`
                 +  ` aria-pressed="${on}" class="${inc ? "incluido" : ""}"`
                 +  ` title="@${esc(o.id)}${inc ? " · incluído no nível atual" : ""}">`
                 +  (d.kind === "flags" ? `<span class="tick">${on ? "✓" : ""}</span>` : "")
                 +  `${esc(o.label || o.id)}</button>`;
          });
          html += `</div>`;

        } else if (mode === "select" && d.kind === "flags"){
          const sel = (v || []);
          const names = d.options.filter(o => sel.indexOf(o.id) > -1).map(o => o.label || o.id);
          const isOpen = openDim === d.id;

          html += `<button class="h-multi-trig" data-dimopen="${esc(d.id)}"`
               +  ` aria-expanded="${isOpen}">`
               +  `<span class="lbl${names.length ? "" : " vazio"}">`
               +    esc(names.length ? names.join(", ") : "Nenhuma")
               +  `</span>`
               +  `<span class="cnt">${sel.length}/${d.options.length}</span>`
               +  `<span class="car">▶</span></button>`;

          if (isOpen){
            html += `<div class="h-multi-panel">`;
            d.options.forEach(o => {
              const on = sel.indexOf(o.id) > -1;
              html += `<button class="h-multi-opt" data-dim="${esc(d.id)}" data-opt="${esc(o.id)}"`
                   +  ` aria-pressed="${on}"><span class="mark">✓</span>`
                   +  `${esc(o.label || o.id)}<span class="tg">@${esc(o.id)}</span></button>`;
            });
            html += `</div>`;
          }

        } else if (mode === "select"){
          html += `<select class="h-dimsel" data-dim="${esc(d.id)}" aria-label="${esc(d.label)}">`
               +  d.options.map(o =>
                    `<option value="${esc(o.id)}"${v === o.id ? " selected" : ""}>`
                    + `${esc(o.label || o.id)}</option>`).join("")
               +  `</select>`;

        } else {
          html += `<div class="h-chips" role="group" aria-label="${esc(d.label)}">`;
          d.options.forEach((o, i) => {
            const on = d.kind === "flags" ? (v || []).indexOf(o.id) > -1 : v === o.id;
            const inc = d.kind === "escala" && !on && i < activeIdx;
            html += `<button class="h-chip${d.kind === "flags" ? "" : " radio"}${inc ? " incluido" : ""}"`
                 +  ` data-dim="${esc(d.id)}" data-opt="${esc(o.id)}" aria-pressed="${on}"`
                 +  ` title="@${esc(o.id)}">`
                 +  `<span class="mark">✓</span>${esc(o.label || o.id)}</button>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    const visibleOnes = visible();
    const hiddenOnes  = cfg.scenarios.filter(s => !isVisible(s));
    let list = showHidden ? hiddenOnes : visibleOnes;

    const q = deaccent(search);
    if (q) list = list.filter(x =>
      deaccent(x.name).indexOf(q) > -1 || deaccent((x.tags || []).join(" ")).indexOf(q) > -1);
    if (onlyFailures) list = list.filter(x => failCount(x) > 0);

    const withFailure = visibleOnes.filter(x => failCount(x) > 0).length;

    html += `<div class="h-count">`
         +  `<p class="h-side-title">Cenários · ${list.length}`
         +  (list.length !== cfg.scenarios.length ? ` de ${cfg.scenarios.length}` : "") + `</p>`
         +  (hiddenOnes.length
              ? `<button class="h-mini" id="h-toggle-ocultos" aria-pressed="${showHidden}">`
                + (showHidden ? "voltar" : `${hiddenOnes.length} fora de escopo`)
                + `</button>`
              : "")
         +  `</div>`;

    html += `<div class="h-filtros">`
         +  `<input class="h-busca" id="h-busca" placeholder="filtrar por nome ou @tag" title="↑↓ troca de cenário · ←→ anda nos passos"`
         +  ` value="${esc(search)}" spellcheck="false">`
         +  (withFailure
              ? `<button class="h-mini falha" id="h-so-falhas" aria-pressed="${onlyFailures}">`
                + `${withFailure} falhando</button>`
              : "")
         +  `</div>`;

    if (!list.length){
      html += `<p class="h-vazio">${showHidden && !hiddenOnes.length
        ? "Nada oculto neste contexto."
        : "Nenhum cenário com esse filtro."}</p>`;
    }

    /* grouped by page: with sixteen scenarios a flat list becomes a wall,
       and what the person looks for is "the list ones" or "the editor ones"
       before looking for a specific scenario */
    if (!seededStates){
      seededStates = true;
      cfg.scenarios.forEach(x => {
        if (stateOf(x)) closedGroups.add((x.page || cfg.defaultPage || "única") + "::estados");
      });
    }

    const groupList = {};
    list.forEach(x => {
      const g = x.page || cfg.defaultPage || "única";
      (groupList[g] = groupList[g] || []).push(x);
    });

    Object.keys(groupList).forEach(groupLabel => {
      const items = readingOrder(groupList[groupLabel]);
      const closed = closedGroups.has(groupLabel);
      const badOnes = items.reduce((n, x) => n + (failCount(x) ? 1 : 0), 0);

      html += `<button class="h-grupo${closed ? " fechado" : ""}" data-group="${esc(groupLabel)}">`
           +  `<span class="chev">▶</span><span class="nm">${esc(groupLabel)}</span>`
           +  `<span class="ct">${items.length}</span>`
           +  (badOnes ? `<span class="fl">${badOnes}</span>` : "")
           +  `</button>`;
      if (closed) return;

      /* the state scenarios live in their own block, collapsed on open: they
         are mandatory and checked on their own, so they do not need to take
         up the bar all the time — whoever opens it wants to see the
         journeys */
      const journeys = items.filter(x => !stateOf(x));
      const states  = items.filter(x => stateOf(x));
      let inStates = false;

      items.forEach(s => {
        if (stateOf(s) && !inStates){
          inStates = true;
          const stateKey = groupLabel + "::estados";
          const fech = closedGroups.has(stateKey);
          const badStates = states.reduce((n, x) => n + (failCount(x) ? 1 : 0), 0);
          html += `<button class="h-grupo sub${fech ? " fechado" : ""}" data-group="${esc(stateKey)}">`
               +  `<span class="chev">▶</span><span class="nm">estados</span>`
               +  `<span class="ct">${states.length}</span>`
               +  (badStates ? `<span class="fl">${badStates}</span>` : "")
               +  `</button>`;
        }
        if (stateOf(s) && closedGroups.has(groupLabel + "::estados")) return;
      const isHidden = showHidden;
      const on   = !isHidden && s.id === state.scenario;
      const open = !isHidden && s.id === state.expanded;
      const n    = (s.steps || []).length;
      const bad  = failCount(s);
      const ex   = on ? state.ex : exampleRow(s, 0);

      html += `<div class="h-scn${on ? " on" : ""}${open ? " open" : ""}${isHidden ? " oculto" : ""}">`;
      html += `<button class="h-scn-hd" data-scn="${esc(s.id)}"${isHidden ? " disabled" : ""}>`
           +  (isHidden ? `<span class="chev">✕</span>` : `<span class="chev">▶</span>`)
           +  `<span class="title">${esc(s.name)}</span>`
           +  `<span class="sub">`
           +    (isOutline(s) ? `<span class="esq">esquema</span><span class="sep">·</span>` : "")
           +    (s.tags && s.tags.length ? `<span class="h-tags">${esc(s.tags.join(" "))}</span><span class="sep">·</span>` : "")
           +    (bad ? `<span class="fail">${bad} falhando</span>` : `<span>${n}${n === 1 ? " passo" : " passos"}</span>`)
           +  `</span></button>`;

      if (isHidden){
        html += `<div class="h-motivo">`;
        reasons(s).forEach(m => {
          html += `<p><b>${esc(m.tag)}</b> ${esc(m.textStr)}`
               +  (m.missing ? ` <span class="ag">— ${esc(m.missing)}</span>` : "") + `</p>`;
        });
        html += `<button class="h-mini fix" data-fix="${esc(s.id)}">Ajustar contexto e abrir</button>`;
        html += `</div>`;
      }

      if (open){
        const im = implOf(s);
        const prim = on ? scanPrim($("app") || document.createElement("div")) : [];
        if (im || prim.length){
          html += `<div class="h-impl">`;
          if (im && im.component) html += `<span class="k">componente</span><b>${esc(im.component)}</b>`;
          if (im && im.route)       html += `<span class="k">rota</span><b>${esc(im.route)}</b>`;
          if (im && im.moduleName)     html += `<span class="k">módulo</span><b>${esc(im.moduleName)}</b>`;
          if (prim.length){
            html += `<span class="ui"><span class="k">ui</span>`
                 +  groupPrim(prim).map(p =>
                      `<b class="${p.unknown ? "desconhecido" : ""}"`
                      + ` title="${esc(p.de || "fora do catálogo — confira o nome")}">`
                      + `${esc(p.nameStr)}${p.unknown ? " ?" : ""}</b>`
                      + (p.n > 1 ? `<i>×${p.n}</i>` : "")
                    ).join(" ")
                 +  `</span>`;
          }
          if (im && im.notes)      html += `<span class="nota">${esc(im.notes)}</span>`;
          html += `</div>`;
        }

        html += `<div class="h-steps">`;
        html += stepRow(s, -1, "Dado", "dado", s.given.text, ex, on && state.step === -1, on && state.step > -1,
          (awaiting && awaiting.id === s.id && awaiting.stp === -1) ? `<span class="h-spin sm"></span>` : "");
        let natPrev = "dado";
        (s.steps || []).forEach((st, i) => {
          const k = stepWord(st, natPrev);
          natPrev = nature(st);
          const r = checkAt(s.id, i);
          const waitingFor = awaiting && awaiting.id === s.id && awaiting.stp === i;
          const dot = waitingFor
            ? `<span class="h-spin sm"></span>`
            : (r != null ? `<span class="dot ${r ? "ok" : "bad"}">●</span>` : "");
          html += stepRow(s, i, k.kw, k.key, k.text, ex, on && state.step === i, on && state.step > i, dot,
                          st.on);
        });
        html += `</div>`;

        if (isOutline(s)){
          html += `<div class="h-ex"><p class="h-ex-hd">Exemplos</p>`;
          html += `<div class="h-ex-row head"><span class="st"></span>`
               +  s.examples.columns.map(c => `<span class="cel">${esc(c)}</span>`).join("")
               +  `</div>`;
          s.examples.tableRows.forEach((row, ri) => {
            const st = exStatus(s.id, ri);
            const lg = sampleWidth(s, ri);
            html += `<button class="h-ex-row${on && state.example === ri ? " on" : ""}${lg ? " larg" : ""}"`
                 +  ` data-scn="${esc(s.id)}" data-ex="${ri}">`
                 +  `<span class="st${st == null ? "" : (st ? " ok" : " bad")}">${st == null ? "" : "●"}</span>`
                 +  row.map(c => `<span class="cel">${esc(c)}</span>`).join("")
                 +  `</button>`;
          });
          html += `</div>`;
        }
      }
      html += `</div>`;
      });
    });

    side.innerHTML = html;
    if (byKeyboard){
      byKeyboard = false;
      const aim = side.querySelector(".h-step.on") || side.querySelector(".h-scn.on");
      if (aim && aim.scrollIntoView) aim.scrollIntoView({ block:"nearest" });
    }
    if (searchFocused){
      const i = $("h-busca");
      if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    }
  }

  function stepRow(s, i, kw, key, text, ex, isOn, isDone, dot, onView){
    const v = onView ? viewById(onView) : null;
    const tag = multi() && onView
      ? `<span class="h-step-vista">${esc(v ? v.label : onView)}</span>` : "";
    return `<button class="h-step k-${key}${isOn ? " on" : ""}${isDone ? " done" : ""}"`
      + ` data-scn="${esc(s.id)}" data-step="${i}">`
      + `<span class="kw">${esc(kw)}</span><span>${tag}${substHtml(text, ex)}</span>${dot || "<span></span>"}`
      + `</button>`;
  }

  /* ---------- render ---------- */
  function render(){
    const app = $("app");
    if (!app) return;
    try {
      liveRoots = paint(app, null);
      state.views = liveRoots;
    } catch (err){
      app.innerHTML = `<pre class="h-err"><b>O protótipo quebrou ao desenhar a tela.</b>`
        + esc(String(err && err.stack || err)) + `</pre>`;
    }
    didRender = true;
    runChecks();
    buildSidebar();
    paintMonitor();
    syncHash();
  }

  let liveRoots = {};
  let monitorOpen = false, monitorSel = null;

  function paintMonitor(){
    const cx = $("h-mon");
    if (!cx) return;
    if (!cfg.routes || !cfg.routes.length){ cx.hidden = true; return; }
    cx.hidden = false;

    const items = network.tela;
    const badOnes = items.filter(r => r.status >= 300).length;
    const trig = $("h-mon-trig");
    trig.classList.toggle("temErro", badOnes > 0);
    trig.setAttribute("aria-expanded", String(monitorOpen));
    $("h-mon-resumo").textContent = items.length
      ? `${items.length} pedido${items.length === 1 ? "" : "s"}` + (badOnes ? ` · ${badOnes} com erro` : "")
      : "nenhum pedido nesta tela";

    $("h-mon-corpo").hidden = !monitorOpen;
    if (!monitorOpen) return;

    $("h-mon-list").innerHTML = items.length
      ? items.slice().reverse().map(r =>
          `<button class="h-mon-item${monitorSel === r.id ? " on" : ""}" data-req="${r.id}">`
          + `<span class="m">${esc(r.httpMethod)}</span>`
          + `<span class="c">${esc(r.pathStr)}</span>`
          + `<span class="s ${r.status < 300 ? "ok" : "bad"}">${r.status}</span>`
          + `<span class="t">${r.ms}ms</span></button>`).join("")
      : `<div class="h-mon-vazio">Esta tela não pediu nada ainda.</div>`;

    const sel = items.find(r => r.id === monitorSel);
    const det = $("h-mon-det");
    det.hidden = !sel;
    if (sel){
      det.textContent =
        `${sel.httpMethod} ${sel.pathStr}\n`
        + `status ${sel.status}${sel.obs ? "  (" + sel.obs + ")" : ""} · ${sel.ms}ms\n`
        + (sel.origin
            ? `disparado por: ${sel.origin.kw} · ${sel.origin.nameStr}`
              + (sel.origin.stp >= 0 ? ` (passo ${sel.origin.stp + 1})` : " (carga da tela)") + `\n`
            : "")
        + `\n`
        + `enviado:\n${sel.submission == null ? "  (sem corpo)" : JSON.stringify(sel.submission, null, 2)}\n\n`
        + `recebido:\n${sel.back == null ? "  (sem corpo)" : JSON.stringify(sel.back, null, 2)}`;
    }
  }

  function deaccent(t){
    return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ---------- delegated events (they survive a re-render) ---------- */
  const handlers = [];
  function on(type, selector, fn){ handlers.push({ type, selector, fn }); }

  function bindDelegation(){
    const app = $("app");
    if (!app) return;
    ["click","input","change","keydown","submit"].forEach(type => {
      app.addEventListener(type, ev => {
        /* which view was touched: the handler then reads `state.view`, its
           permissions answer for that view's actor, and the requests it
           fires are that view's — not the whole bench's */
        /* the size picker sits inside #app but belongs to the bench, not to
           the screen: a prototype's change handler must not answer it */
        if (ev.target.closest && ev.target.closest(".h-view-label")) return;
        const cell = ev.target.closest ? ev.target.closest("[data-h-view]") : null;
        const v = cell ? viewById(cell.getAttribute("data-h-view")) : null;
        const prevActing = actingView, prevRendering = renderingView;
        actingView = v ? v.id : null;
        renderingView = v;
        try {
          handlers.forEach(h => {
            if (h.type !== type) return;
            const el = ev.target.closest ? ev.target.closest(h.selector) : null;
            if (el && app.contains(el)) h.fn(ev, el, state);
          });
        } finally { actingView = prevActing; renderingView = prevRendering; }
      });
    });
  }

  function set(patch){
    /* during a step with `click` the handler writes to the sandbox, not to
       the screen — that way the same code runs in the replay and in real
       use */
    if (sandbox){ Object.assign(sandbox.app, patch); return; }
    appDirty = true;
    Object.assign(state.app, patch);
    render();
  }

  function reset(){
    forgetPrefs();          /* Reset means "go back to what the file declares" */
    state.ctx = clone(initial.ctx);
    userCtx = clone(state.ctx);
    state.viewport = initial.viewport;
    state.viewSizes = {};        /* back to the devices the views declare */
    state.zoom = initial.zoom;
    state.landscape = false;
    state.example = 0;
    applySidebar(MIN_SIDEBAR);
    results = {}; suite = null; memo = new Map(); partial = null;
    $("h-vp").value = state.viewport;
    $("h-zoomsel").value = state.zoom;
    goto(initial.scenario, -1, 0);
    fit();
  }

  /* ---------- init ---------- */
  function init(options){
    cfg = { ...cfg, ...options };

    /* compat: old toggles become a features dimension */
    if (cfg.toggles && cfg.toggles.length && !cfg.context.length){
      cfg.context = [{
        id:"flags", label:"Funcionalidades", kind:"flags",
        options: cfg.toggles.map(t => ({ id:t.id, label:t.label })),
        value: cfg.toggles.filter(t => t.value).map(t => t.id)
      }];
    }

    $("h-title").textContent = cfg.title || "protótipo";
    const mark = document.querySelector(".h-brand");
    if (mark) mark.title = "harness " + VERSION;
    document.title = "Proto · " + (cfg.title || "protótipo");

    cfg.context.forEach(d => {
      state.ctx[d.id] = d.kind === "flags"
        ? (d.value || []).slice()
        : (d.value || (d.options[0] && d.options[0].id));
    });

    if (cfg.viewport) state.viewport = cfg.viewport;
    if (cfg.zoom)     state.zoom     = String(cfg.zoom);

    const first = cfg.scenarios[0];
    state.scenario = cfg.initial || (first && first.id) || null;
    state.expanded = state.scenario;

    initial = {
      scenario: state.scenario,
      ctx: clone(state.ctx),
      viewport: state.viewport,
      zoom: state.zoom
    };

    /* the shared link comes later and wins: whoever sends a link expects that
       to be seen, not the saved context of whoever opened it */
    const prefs = readPrefs();
    if (prefs){
      if (prefs.ctx) cfg.context.forEach(d => {
        const v = prefs.ctx[d.id];
        if (v == null) return;
        if (d.kind === "flags") state.ctx[d.id] = Array.isArray(v) ? v.filter(x => d.options.some(o => o.id === x)) : [];
        else if (d.options.some(o => o.id === v)) state.ctx[d.id] = v;
      });
      if (prefs.viewport && VIEWPORTS.some(v => v.id === prefs.viewport)) state.viewport = prefs.viewport;
      if (prefs.viewSizes && typeof prefs.viewSizes === "object"){
        Object.keys(prefs.viewSizes).forEach(k => {
          if (VIEWPORTS.some(v => v.id === prefs.viewSizes[k])) state.viewSizes[k] = prefs.viewSizes[k];
        });
      }
      if (prefs.zoom) state.zoom = prefs.zoom;
      if (prefs.sidebar) state.sidebar = Math.max(288, Number(prefs.sidebar) || 288);
      ensureVisibleScenario();
    }

    if (cfg.widths && cfg.widths.length){
      LADDER = cfg.widths.map(d => ({ ...d, level:true }));
      VIEWPORTS = LADDER.concat(DEVICES);
    }

    /* the views come after the ladder: they borrow their widths from it */
    VIEWS = normalizeViews(cfg.views);
    if (multi()){
      const noWidth = VIEWS.filter(v => !viewWidth(v));
      if (noWidth.length){
        /* a view with no width cannot be drawn, and drawing it at some
           default would measure a device nobody declared */
        window.PROTO_LOAD_ERROR = "vista sem largura: "
          + noWidth.map(v => `"${v.id}"`).join(", ")
          + ` — declare viewport (${VIEWPORTS.map(x => x.id).join(", ")}) ou w/h`;
        VIEWS = [];
      }
    }
    /* With views on the bench there is no single viewport to pick: the stage
       is the sum of the views, and each one carries its own device — swapped
       from the picker above that view. A stage-wide selector here would show
       a rung that describes nothing, so it goes, rather than sitting there
       disabled with a stale number in it. */
    if (multi()){
      const selVp = $("h-vp"), rot = $("h-rotate");
      if (selVp) selVp.hidden = true;
      if (rot) rot.hidden = true;
    }
    $("h-vp").innerHTML =
      `<optgroup label="Pontos de quebra">`
      + LADDER.map(v => `<option value="${v.id}">${v.label}</option>`).join("")
      + `</optgroup><optgroup label="Aparelhos">`
      + DEVICES.map(v => `<option value="${v.id}">${v.label}</option>`).join("")
      + `</optgroup>`;
    $("h-vp").value = state.viewport;
    $("h-zoomsel").value = state.zoom;

    $("h-vp").addEventListener("change", e => {
      state.viewport = e.target.value;
      /* In an Outline with a `largura` column, switching rung means switching
         row: the person asked to see that size, so it shows the case for
         that size instead of forcing the width back. */
      const s = scnById(state.scenario);
      if (s && isOutline(s)){
        const i = s.examples.tableRows.findIndex((_, ri) => {
          const lg = sampleWidth(s, ri);
          return lg && lg.id === state.viewport;
        });
        if (i > -1 && i !== state.example){ manualChoice = true; goto(s.id, state.step, i); return; }
      }
      fit();
    });
    $("h-zoomsel").addEventListener("change", e => { state.zoom = e.target.value; fit(); });
    $("h-rotate").addEventListener("click", () => { state.landscape = !state.landscape; fit(); });
    $("h-reset").addEventListener("click", reset);
    /* "View anyway" dismisses THIS set of failures. Reappearing on every
       verification with the same report is punishment, not a warning — but
       if the failures change the screen comes back, because then it is
       news. */
    let dismissedFailure = null;

    function failureSignature(){
      if (!suite || !suite.failures) return null;
      return suite.failures.map(f => f.scen + "|" + f.stp + "|" + f.reason).join("§");
    }

    showFailureSafely = () => showFailure(true);

    function showFailure(openScen){
      const panelEl = $("h-falha");
      if (openScen && failureSignature() === dismissedFailure) return;   /* already dismissed */
      panelEl.hidden = !openScen;
      if (openScen){
        const ta = $("h-falha-txt");
        ta.value = report();
        ta.focus(); ta.select();
      }
    }

    $("h-verify").addEventListener("click", async () => {
      const r = await verify();
      if (r && r.bad && !r.canceled) showFailure(true);
    });
    $("h-falha-copy").addEventListener("click", e => {
      const ta = $("h-falha-txt");
      ta.select();
      let finished = false;
      try { finished = document.execCommand("copy"); } catch { finished = false; }
      if (!finished && navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(()=>{});
      e.currentTarget.textContent = "Copiado";
      setTimeout(() => { e.currentTarget.textContent = "Copiar relatório"; }, 1500);
    });
    $("h-falha-ver").addEventListener("click", () => {
      dismissedFailure = failureSignature();
      showFailure(false);
    });

    $("h-checks").addEventListener("click", e => {
      /* with Alt, reopens the report even when dismissed; without Alt, jumps to
       the failure */
      if (e.altKey && suite && suite.bad){ dismissedFailure = null; showFailure(true); return; }
      const f = firstFailure();
      if (f) goto(f.id, f.step);
    });

    $("h-flags").addEventListener("click", e => {
      const side = $("h-side");
      side.hidden = !side.hidden;
      $("h-resize").hidden = side.hidden;
      e.currentTarget.setAttribute("aria-pressed", String(!side.hidden));
      requestAnimationFrame(fit);
    });

    /* link field: selects everything on focus (to copy), Enter to go */
    const inp = $("h-linkin");
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("input", () => inp.classList.remove("bad"));
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){
        if (applyHash(inp.value)){ inp.classList.remove("bad"); render(); fit(); inp.blur(); }
        else { inp.classList.add("bad"); inp.select(); }
      }
      if (e.key === "Escape"){ inp.value = linkValue(); inp.classList.remove("bad"); inp.blur(); }
    });
    inp.addEventListener("blur", () => { inp.classList.remove("bad"); inp.value = linkValue(); });

    function showSpec(open){
      const panel = $("h-spec"), btn = $("h-spec-btn");
      panel.hidden = !open;
      btn.textContent = open ? "Protótipo" : "Gherkin";
      btn.setAttribute("aria-pressed", String(open));
      if (open) $("h-spec-text").value = gherkin();
    }
    let runSuite = false, dataSel = null;

    function paintData(){
      $("h-dados-fix").value = JSON.stringify(cfg.data_ || {}, null, 2);
      const routes = (cfg.routes || []).map(r =>
        `<div class="rota"><b>${(r.httpMethod || "GET").toUpperCase()}</b> ${esc(r.pathStr)}</div>`).join("");

      /* the suite fires hundreds of 0ms requests; mixed with the screen's they
         become noise, so they are hidden by default */
      const fromSuite = network.log.filter(l => l.verifyState).length;
      const listEl = network.log.filter(l => runSuite || !l.verifyState);

      const filterText = fromSuite
        ? `<button class="h-mini" id="h-dados-filtro" aria-pressed="${runSuite}">`
          + (runSuite ? `ocultar ${fromSuite} da verificação` : `mostrar ${fromSuite} da verificação`)
          + `</button>`
        : "";

      const log = listEl.length
        ? listEl.slice().reverse().map(l =>
            `<button class="req${dataSel === l.id ? " on" : ""}" data-req="${l.id}">`
            + `<span class="m">${esc(l.httpMethod)}</span>`
            + `<span class="c">${esc(l.pathStr)}</span>`
            + `<span class="s ${l.status < 300 ? "ok" : "bad"}">${l.status}</span>`
            + `<span class="t">${l.ms}ms</span>`
            + (l.verifyState ? `<span class="v">suíte</span>` : "")
            + `</button>`).join("")
        : `<div class="vazio">Nenhum pedido ainda.</div>`;

      const sel = network.log.find(l => l.id === dataSel);
      const det = sel
        ? `<pre class="h-mon-det">${esc(
            `${sel.httpMethod} ${sel.pathStr}\nstatus ${sel.status}`
            + `${sel.obs ? "  (" + sel.obs + ")" : ""} · ${sel.ms}ms`
            + `${sel.verifyState ? " · pedido da verificação" : ""}\n`
            + (sel.origin
                ? `disparado por: ${sel.origin.kw} · ${sel.origin.nameStr}`
                  + (sel.origin.stp >= 0 ? ` (passo ${sel.origin.stp + 1})` : " (carga da tela)") + `\n`
                : "")
            + `\n`
            + `enviado:\n${sel.submission == null ? "  (sem corpo)" : JSON.stringify(sel.submission, null, 2)}\n\n`
            + `recebido:\n${sel.back == null ? "  (sem corpo)" : JSON.stringify(sel.back, null, 2)}`)}</pre>`
        : "";

      $("h-dados-log").innerHTML = routes + "<hr>" + filterText + log + det;
    }

    function showDados(openScen){
      $("h-dados").hidden = !openScen;
      $("h-dados-btn").textContent = openScen ? "Protótipo" : "Dados";
      $("h-dados-btn").setAttribute("aria-pressed", String(openScen));
      if (openScen) paintData();
    }
    $("h-mon-trig").addEventListener("click", () => { monitorOpen = !monitorOpen; paintMonitor(); });
    $("h-mon-list").addEventListener("click", e => {
      const b = e.target.closest("[data-req]");
      if (!b) return;
      const id = Number(b.dataset.req);
      monitorSel = (monitorSel === id ? null : id);   /* clicking again closes the detail */
      paintMonitor();
    });

    $("h-dados-btn").addEventListener("click", () => showDados($("h-dados").hidden));
    $("h-dados-limpar").addEventListener("click", () => {
      network.log.length = 0; dataSel = null; paintData();
    });
    $("h-dados-log").addEventListener("click", e => {
      if (e.target.closest("#h-dados-filtro")){ runSuite = !runSuite; paintData(); return; }
      const b = e.target.closest("[data-req]");
      if (!b) return;
      const id = Number(b.dataset.req);
      dataSel = (dataSel === id ? null : id);
      paintData();
    });

    $("h-spec-btn").addEventListener("click", () => showSpec($("h-spec").hidden));
    /* A page cannot read the sidecars it was loaded from — fetch does not
       reach a file:// sibling — so the single-file bundle is the command
       line's job. Bundled, the document already is the whole prototype. */
    const bundled = !!window.PROTO_BUNDLED;
    const appName = new URLSearchParams(location.search).get("app");
    const dl = {
      feature: () => download(slug() + ".feature", gherkin(), "text/plain"),
      api:     () => download("api.md", apiContract(), "text/markdown"),
      html:    () => download(slug() + ".html", source(), "text/html")
    };
    const flash = (btn, okText) => {
      const was = btn.textContent; btn.textContent = okText;
      setTimeout(() => { btn.textContent = was; }, 1200);
    };
    $("h-dl-feature").addEventListener("click", e => { dl.feature(); flash(e.currentTarget, "baixado"); });
    $("h-dl-api").addEventListener("click",     e => { dl.api();     flash(e.currentTarget, "baixado"); });
    if (bundled){
      $("h-dl-html").addEventListener("click", e => { dl.html(); flash(e.currentTarget, "baixado"); });
    } else {
      /* say where it comes from rather than hand over an empty bench */
      $("h-dl-html").disabled = true;
      $("h-dl-html").title = "O arquivo único sai pela linha de comando";
      $("h-dl-hint").textContent = "node verify.js apps/" + (appName || "<app>") + " --export handoff/";
    }
    $("h-dl-all").addEventListener("click", e => {
      /* one click per file, spaced out: a browser drops downloads fired in
         the same tick as if they were a popup burst */
      dl.feature();
      setTimeout(dl.api, 350);
      if (bundled) setTimeout(dl.html, 700);
      flash(e.currentTarget, "baixando…");
    });

    $("h-spec-copy").addEventListener("click", e => {
      const ta = $("h-spec-text");
      ta.select();
      let done = false;
      try { done = document.execCommand("copy"); } catch { done = false; }
      if (!done && navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(()=>{});
      e.currentTarget.textContent = "Copiado";
      setTimeout(() => { e.currentTarget.textContent = "Copiar"; }, 1400);
    });

    function setDimension(dimId, optId, toggle){
      const d = dim(dimId);
      if (!d) return;
      if (d.kind === "flags" && toggle){
        const cur = state.ctx[d.id] || [];
        state.ctx[d.id] = cur.indexOf(optId) > -1 ? cur.filter(x => x !== optId) : cur.concat(optId);
      } else {
        state.ctx[d.id] = optId;
      }
      suite = null;              /* the scope changed: the previous suite no longer applies */
      userCtx = clone(state.ctx);
      ensureVisibleScenario();
      replay().then(render);
    }

    $("h-side").addEventListener("change", e => {
      const sel = e.target.closest("select[data-dim]");
      if (sel) setDimension(sel.dataset.dim, sel.value, false);
    });

    $("h-side").addEventListener("input", e => {
      const i = e.target.closest("#h-busca");
      if (!i) return;
      search = i.value; searchFocused = true; render();
    });

    $("h-side").addEventListener("click", e => {
      if (e.target.closest("#h-toggle-ocultos")){ showHidden = !showHidden; render(); return; }
      if (e.target.closest("#h-so-falhas")){ onlyFailures = !onlyFailures; searchFocused = false; render(); return; }

      const g = e.target.closest("[data-group]");
      if (g){
        const nameStr = g.dataset.group;
        closedGroups.has(nameStr) ? closedGroups.delete(nameStr) : closedGroups.add(nameStr);
        searchFocused = false; render(); return;
      }

      const fix = e.target.closest("[data-fix]");
      if (fix){
        const s = scnById(fix.dataset.fix);
        applyFix(s);
        showHidden = false;
        goto(s.id, -1, 0);
        return;
      }

      const trig = e.target.closest("[data-dimopen]");
      if (trig){
        openDim = openDim === trig.dataset.dimopen ? null : trig.dataset.dimopen;
        render();
        return;
      }

      const chip = e.target.closest("[data-opt]");
      if (chip){ setDimension(chip.dataset.dim, chip.dataset.opt, true); return; }

      const row = e.target.closest("[data-ex]");
      if (row){ goto(row.dataset.scn, state.step, Number(row.dataset.ex)); return; }

      const step = e.target.closest("[data-step]");
      if (step){ goto(step.dataset.scn, Number(step.dataset.step)); return; }

      const hd = e.target.closest("[data-scn]");
      if (!hd) return;
      if (hd.dataset.scn === state.expanded){ state.expanded = null; render(); }
      else goto(hd.dataset.scn, -1, 0);
    });

    document.addEventListener("click", e => {
      /* clicking outside closes the panel — inside .h-dim itself, it does not */
      /* the event retargets to the host on its way out of the shadow tree,
         so the real origin has to come from the composed path */
      const path = e.composedPath ? e.composedPath() : [e.target];
      const inDim = path.some(n => n && n.classList && n.classList.contains("h-dim"));
      if (openDim && !inDim){ openDim = null; render(); }
    });

    /* ---------- arrow-key navigation ----------
       ↑↓ switches scenario, ←→ walks the steps. It does not hijack the
       arrows when focus is in a field (search, link, textarea) nor with a
       panel open — there the arrows belong to the text, not to navigation. */
    function typing(aim){
      if (!aim) return false;
      const tag = (aim.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || aim.isContentEditable;
    }

    document.addEventListener("keydown", e => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.key) < 0) return;
      const src = (e.composedPath && e.composedPath()[0]) || e.target;
      if (typing(src) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!$("h-spec").hidden || !$("h-falha").hidden || !$("h-dados").hidden) return;

      /* the arrows walk what is on show: jumping to a scenario inside a
         collapsed block would be navigating blind */
      const listEl = readingOrder(visible()).filter(x => {
        const pg = x.page || cfg.defaultPage || "única";
        if (closedGroups.has(pg)) return false;
        if (stateOf(x) && closedGroups.has(pg + "::estados")) return false;
        return true;
      });
      if (!listEl.length) return;
      const current = Math.max(0, listEl.findIndex(x => x.id === state.scenario));

      if (e.key === "ArrowDown" || e.key === "ArrowUp"){
        e.preventDefault();
        const i = e.key === "ArrowDown"
          ? Math.min(listEl.length - 1, current + 1)
          : Math.max(0, current - 1);
        if (i === current && state.step === -1) return;
        byKeyboard = true;
        goto(listEl[i].id, -1, 0);
        return;
      }

      /* ←→ within the scenario; at the end it crosses into the neighbour,
         because walking a journey should not hit a wall */
      const s = listEl[current];
      const n = (s.steps || []).length;
      e.preventDefault();
      byKeyboard = true;

      if (e.key === "ArrowRight"){
        if (state.step < n - 1) goto(s.id, state.step + 1, state.example);
        else if (current < listEl.length - 1) goto(listEl[current + 1].id, -1, 0);
      } else {
        if (state.step > -1) goto(s.id, state.step - 1, state.example);
        else if (current > 0){
          const prev = listEl[current - 1];
          goto(prev.id, (prev.steps || []).length - 1, 0);
        }
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (!$("h-spec").hidden) showSpec(false);
      else if (openDim){ openDim = null; render(); }
    });

    /* sidebar width: the minimum is the current width — shrinking past that
       would squeeze the Gherkin steps, which are what you read here */
    const setBarra = applySidebar;

    const grip = $("h-resize");
    grip.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      grip.setPointerCapture(ev.pointerId);
      grip.classList.add("ativo");
      const x0 = ev.clientX, w0 = state.sidebar;
      const move = e => setBarra(w0 + (e.clientX - x0));
      const release = () => {
        grip.classList.remove("ativo");
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", release);
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", release);
    });
    grip.addEventListener("dblclick", () => setBarra(MIN_SIDEBAR));
    grip.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); setBarra(state.sidebar - 24); }
      if (e.key === "ArrowRight") { e.preventDefault(); setBarra(state.sidebar + 24); }
    });

    setBarra(state.sidebar);

    window.addEventListener("resize", () => { setBarra(state.sidebar); });
    window.addEventListener("hashchange", () => {
      if (muteHash) return;
      if (applyHash()){ render(); fit(); }
    });

    baseData = JSON.stringify(cfg.data_ || {});
    installNetwork();
    bindDelegation();

    /* Paints the shell right away, before replaying a scenario or verifying
       anything. Whatever takes time after this — the replay, the suite, the
       network — meets an assembled screen instead of leaving the user on a
       blank one. The earlier regression (a blank screen until the suite
       finished) was only possible because the first paint depended on an
       async path. */
    buildSidebar();
    fit();
    const cameFromLink = applyHash();   /* reads BEFORE any write */
    started = true;
    if (cameFromLink) (pendingFlag || Promise.resolve()).then(render);
    else goto(state.scenario, -1, 0);
    fit();

    if (window.__PROTO_CHILD){
      /* verifier mode: no sidebar, no link, no preferences — it just runs the
         suite in its own world and returns the report */
      const send = (kindName, extra) => {
        try { parent.postMessage(Object.assign({ proto:1, kindName }, extra), "*"); } catch {}
      };
      externalProgress = () => {};
      const sendProgress = (doneCount, total) => send("progress", { doneCount, total });
      window.__protoProgress = sendProgress;
      setTimeout(async () => {
        const r = await verifyAll();
        send("result", { suite: {
          ok:r.ok, bad:r.bad, failures:r.failures || [], warnings:r.warnings || [],
          coverage:r.coverage || null, by:r.by || {}, skipped:r.skipped || 0
        } });
      }, 0);
      return;
    }

    /* Runs on its own when the file opens: the file is reopened on every
       edit, so every change goes through the suite without anyone having to
       remember. In a setTimeout because the Proto.on calls come AFTER
       init in the app script — verifying before that would report "no
       handler responds" for everything, which is a fault of the clock, not
       of the prototype. */
    if (cfg.verifyOnOpen !== false){
      setTimeout(async () => {
        const r = await verify();
        if (r && r.bad && !r.canceled) showFailure(true);
      }, 0);
    }
  }

  return { versionStr: VERSION,
    init, on, set, refresh, render, goto, gherkin, apiContract, source, download, verifyAll, verify, report, api, network,
    get verificationMode(){ return verificationMode; }, reset, fit, esc, state, VIEWPORTS };
})();

/* in the console: Proto.state, Proto.goto("id", 2), Proto.verifyAll() */
window.Proto = Proto;


/* ============================================================
   The loader
   ============================================================
   The bench is one fixed page and a prototype is three sidecars it
   pulls in by name: proto.html?app=<name> loads apps/<name>/styles.css,
   then data.js, then app.js — in that order, because app.js calls
   Proto.init and expects the fixtures to already exist.

   A missing file is the failure mode this design has to take seriously:
   a prototype is a folder now, and folders lose files in transit. So a
   sidecar that does not load says exactly which one, rather than
   leaving a blank bench that looks like a bug in the harness.
   ============================================================ */
(function loader(){
  /* a bundle inlines its own app, so there is nothing to fetch */
  if (window.PROTO_BUNDLED) return;
  const app = document.getElementById("app");
  const shout = (title, detail, hint) => {
    /* the gate reads this: an app that never loaded has no scenarios, and
       "0 ok" would otherwise be reported as a pass */
    window.PROTO_LOAD_ERROR = title + (detail ? " — " + detail : "");
    if (!app) return;
    app.innerHTML =
      '<div style="max-width:52ch;margin:12vh auto;padding:0 24px;'
      + 'font:14px/1.6 ui-sans-serif,system-ui,sans-serif;color:#e8eaef">'
      + '<h1 style="font-size:17px;margin:0 0 10px">' + title + '</h1>'
      + '<p style="margin:0 0 10px;color:#a6acbb">' + detail + '</p>'
      + (hint ? '<pre style="margin:0;padding:10px 12px;background:#14171d;'
              + 'border:1px solid #2c323e;border-radius:8px;overflow:auto;'
              + 'font:12px/1.5 ui-monospace,monospace;color:#e8eaef">'
              + hint + '</pre>' : '')
      + '</div>';
  };

  const name = new URLSearchParams(location.search).get("app");
  if (!name){
    shout("No app selected",
          "The bench loads a prototype by name. Open it with one:",
          "proto.html?app=product-editor\n\n"
        + "Each app is a folder under apps/ with styles.css, data.js and app.js.");
    return;
  }
  /* the name indexes a folder, so it may not wander out of apps/ */
  if (!/^[a-z0-9_][a-z0-9_-]*$/.test(name)){
    shout("Bad app name",
          "An app name is lowercase letters, digits, dashes and underscores. Got: " + Proto.esc(name));
    return;
  }

  const base = "apps/" + name + "/";
  const missing = file => shout(
    "Could not load " + file,
    "The bench is fine; this app is missing a file, or the name is wrong. "
    + "A prototype is three files and all three have to travel together.",
    base + "styles.css\n" + base + "data.js\n" + base + "app.js");

  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = base + "styles.css";
  css.onerror = () => missing(base + "styles.css");
  document.head.appendChild(css);

  const load = src => new Promise((ok, no) => {
    const el = document.createElement("script");
    el.src = src; el.onload = ok; el.onerror = () => no(src);
    document.body.appendChild(el);
  });

  /* A React prototype is compiled to .build/app.js; a vanilla one is app.js
     as written. Try the built one first and fall back, so both kinds load
     through the same bench and neither needs to declare which it is. */
  load(base + "data.js")
    .then(() => load(base + ".build/app.js").catch(() => load(base + "app.js")))
    .catch(missing);
})();
