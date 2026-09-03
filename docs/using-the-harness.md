# Using the harness on a project

*For a team adopting this bench to specify their own screens. `CLAUDE.md` is
the short list of rules an agent must not get wrong, and
[`project-instructions.md`](project-instructions.md) is the full reference.
This page is the part that is neither: how a project starts, what it hands
over, and the traps that cost a round each time somebody meets them.*

---

## The language of the interface belongs to the project

Pick one language for every string a person reads and never write a screen in
another one, not even as a draft. Domain words go in that language too — if the
product says *comanda*, *mesa* and *garçom*, the prototype says them, and so do
the scenario texts, the Examples column headers and the exported `.feature`.
The harness itself is written in Portuguese and does not care what you choose;
mixing two languages in one screen is what it cannot help you with.

## Starting

```bash
git clone --depth 1 https://github.com/12-apps/harness-prototype.git
cd harness-prototype
pnpm install                        # pnpm, not npm — @12-apps/ui runs only-allow pnpm
cp -r apps/_react-template apps/<area>-<thing>
```

`pnpm` does not run dependency build scripts by default and says so at the end
of the install. If the gate then fails to build, that is why:

```bash
pnpm rebuild esbuild @12-apps/ui
```

**Read `apps/product-editor/app.jsx` end to end before writing a line.** It is
the only place that shows the real shape of `given`, `steps`, `examples`,
`network` and `mount`, and reading it first saves several rounds.
`apps/multi-view-demo/` is the reference for more than one screen at a time.

## Delivering is exporting

The folder is the working format. **The deliverable is the bundle:**

```bash
node verify.js apps/<name> --strict --export handoff/
```

That writes `handoff/<name>.html` — one file with the bench, the catalog, React
and the app inlined, and no external reference. That is the file you open,
attach and present. Sending the folder and asking someone to open
`proto.html?app=<name>` does not work off a server: the bench fetches its
sidecars, and `file://` will not serve them. **If you did not export, you did
not deliver.**

Read the output before presenting. On a hard failure the export refuses to
write, but with `--strict` and warnings only it **writes anyway** and then exits
`2` — a written bundle is not proof the run was clean.

To drive the folder locally instead of the bundle, serve the directory and open
the bench through `http://`:

```bash
python3 -m http.server 8080     # then open http://localhost:8080/proto.html?app=<name>
```

## The prototype is the specification

Scenarios are real Gherkin with clickable steps: clicking step N replays 1..N
from the `Dado`.

```js
{
  id:"criar-variacao", name:"Criar a primeira variação",
  page:"produto", tags:["@catálogo","@feliz","@pode:produto.editar"],
  impl:{ component:"ProdutoEditor", route:"/produtos/:id", moduleName:"catalogo/produtos" },
  given:{ text:"que o produto não tem variações",
          state: async (ex, api) => ({ produto: await api.get("/api/produtos/2") }) },
  steps:[
    { when:"o lojista toca em Adicionar variação", click:'[data-act="add"]' },
    { then:"a variação aparece na lista", check:(a, el) => el.querySelectorAll(".var").length === 1 }
  ]
}
```

- **Dado** is the world before the action, and it asks the API for it.
- **Quando** is a real action — `click`, `fill`, `choose`, `toggleCtl`,
  `waitFor`. It runs the handlers registered with `Proto.on` and fails when the
  element is not there.
- **Então** is `check(state, dom)` against the rendered DOM.
- A scenario with `examples:{ columns, tableRows }` becomes an **Esquema do
  Cenário** — use `<column>` in the texts.
- Write from the user's side: *the shopkeeper sees the combo price*, not *the
  component receives the price prop*.

**A pure state change is `apply`, not `applyState`.** The harness only calls
`applyState` paired with a `waitFor`. A loose `applyState` is ignored in
silence: the step "passes", the state does not move, and the next `Então` fails
without saying why.

## A journey, not a caption

`Dado … Então` with no action between them is a screenshot with a caption. The
verification asks for at least **two actions** per scenario on **different
targets**, with an `Então` **after** the last one; at least one journey of three
or more actions per page; and every page needs a journey that **arrives at it
from another screen**. Two scenarios walking the same controls in the same order
are reported as clones.

The label is checked against the screen:

| tag | means | checked by |
|---|---|---|
| `@feliz` | works end to end | no error on any step |
| `@conflito` | the server refuses | ends **with** a visible error |
| `@recuperacao` | breaks in the middle and the person comes out whole | the error appears **and** is gone at the end |
| `@retorno` | someone who has used it comes back | leaves the page and returns |

Every page needs `@feliz` **and** at least one of the other three.

## Three states per page

Every page uses `AsyncStateContainer` and marks `[data-estado="…"]`, with
`@carregando`, `@vazio` and `@erro` scenarios grouped by `page`. A state is a
**step of the journey**, not a destination.

For loading to be a step, fire the real request and leave it hanging:

```js
network:{ "GET /api/x":"pendente" },
given:{ state: async (ex, api) => { api.get("/api/x").catch(() => {}); return { loading:true }; } },
steps:[
  { then:"…", check:(a, el) => !!el.querySelector('[data-estado="carregando"]') },
  { when:"a resposta chega", waitFor:"GET /api/x",
    applyState:(a, payload) => ({ ...a, items:payload, loading:false }) }
]
```

**`@vazio` has to be genuinely empty.** Ask whether the empty you wrote is the
one a person would see — usually a fixture key is missing to produce the honest
silence.

**`@recuperacao` cannot come from `network`.** A dictated response holds
forever; it has no `once`. The failure comes from the *fixture*, which can end:

```js
// data.js
listaFalhaUmaVez: false,
// in the route: if (data_.listaFalhaUmaVez){ data_.listaFalhaUmaVez = false; throw new Error("Serviço indisponível"); }

// app.jsx
fixtureFailure:true,                       // a boolean, not the name of the key
given:{ state: async (ex, api) => { api.data_.listaFalhaUmaVez = true; /* … */ } }
```

## Data: the screen never invents, it asks

Fixtures and routes live in `data.js`; the harness intercepts `fetch` and the
fixtures return to their initial state for every scenario.

- **A write route has to change the fixtures.** Answering 200 without storing is
  a facade, and the audit compares before and after.
- **Every route from both ends**: success and failure
  (`network:{ "POST /api/…": 500 }`). A route nobody calls is a dead route — if
  the feature was not built, **delete the route** and leave a comment saying why.
- **Every call is born from a step.** Only in the `Dado` is it a screen load:
  mark the route `onLoad:true`.
- **A mutation leaves the browser.** `local:true` exempts an interface-only
  action (opening a sheet), but never a control whose label promises to store.

## More than one screen, and live data

When a flow needs two people, `views` declares them and each screen says what it
watches. The prototype still renders one screen; the harness calls `mount` once
per view.

```js
views:[
  { id:"cliente", label:"Cliente", actor:"cliente", viewport:"se",
    watches:{ comanda:"GET /api/comandas/7" } },
  { id:"cozinha", label:"Cozinha", actor:"cozinha", viewport:"ipad",
    watches:{ fila:"GET /api/cozinha/fila" } }
]
```

A write anywhere invalidates, every screen watching a touched query re-reads,
and every view holding it redraws — none of that is written by hand. `s.data.x`
is what the server last said and `s.dataError.x` is why it could not be read, so
`app` goes back to meaning this screen's own state.

A step says where it acts (`on:"cozinha"`), and what an action does to the other
screens is declared: `propagates:[…]` for the views that must change,
`unchanged:[…]` for the ones that must not. Writing moves the server, not a
screen — see `project-instructions.md` for how to specify the push that does.

## Store context

Three kinds of dimension in `context`: `kind:"escala"` (a plan, where `@pro`
holds from Pro upwards), `kind:"opcao"` (the user's role) and `kind:"flags"`
(switchable features). Options grant permissions (`allows:[…]`, `"*"` for all)
and a scenario demands one with `@pode:produto.editar`. A permission is **AND
across dimensions**: the plan enables, the role authorises.

## Components

React and `@12-apps/ui`, always. No lowercase tag, no `component="b"`, no markup
assembled as text — the gate reads the JSX before a browser starts and refuses.
A vanilla `app.js` is refused outright.

**Choose by what the component emits, not by its name.** `Badge` is MUI's Badge
— a marker attached to a child — so it is not a label, however much the name
suits. A label is `Text` with a `className`. Before reaching for something new,
read what it actually is:

```bash
find node_modules/.pnpm -path "*@12-apps+ui*/<group>/<Name>.js" | head -1 | xargs head -c 800
```

A dependable base for a screen: `Box` `Stack` `AppBar` `Heading` `Paragraph`
`Text` `Button` `Card` `CardContent` `Skeleton` `Alert` `EmptyState`.

An `exige` component needs `data-act`, `data-campo`, an `on…` prop or `href`. A
`data-act` with no `Proto.on` is reported, and a `Proto.on` with no element too
— when a handler is left orphaned, **delete the handler or reuse a `data-act`
that already exists**; never invent a button to silence the warning.

## Styles

**A prop before CSS.** `variant="text"` for a tab, `variant="outlined"` for
secondary, `color="success"` for the button that closes out work. CSS keeps what
belongs to *that screen*: density, arrangement, contrast.

Write against what the components really emit, not the markup you pictured.
Three traps that cost a round each: `AppBar` sets `flex-direction: column` on its
own; `Typography` brings its own colour, so painting the parent does not paint
the text inside; and emotion's specificity is 0,1,0, so `.app .MuiButton-root.btn`
wins where `.btn` alone does not.

Never hand-write a hex when a token exists.

## Width is a dimension

Declare the arrangement for each width in an Esquema do Cenário with a `largura`
column. Beyond that:

- **Arrangement belongs to the CSS**, through `@container`. A `data-colunas`
  fed from `s.widthPx` is the *declaration* the scenario checks; the query is
  what draws.
- The arrangement signature samples **only** these selectors: `[data-estado]`,
  `[data-colunas]`, `[data-acao]`, `.grade`, `.app-bd`, `.actions`, `.linha`,
  `.var`, `.card`, `.btn`. Changing the grid on a container outside that list is
  responding where nobody looks — name the thing that changes `.grade`.
- **The wide rule comes after the narrow one** in the cascade, or the narrow one
  erases it.
- The container measures the rung exactly — 768 at `md`, 1024 at `lg`, 1440 at
  `xlg`. Cut at the number you meant.

The verification still measures, rung by rung: the same arrangement all the way
up the ladder, horizontal overflow, a touch target under 44px, text under 12px
and a line over 75 characters.

## Before delivering — required

```bash
node verify.js apps/<name> --strict --export handoff/
```

- exit `0` **and** `[browser]` at the end of the line — without it the
  measurement rules did not run and the green does not count
- `handlers N/N`, not `N/M`
- `0 warning(s)` — green with a warning is not green
- the bundle exists in `handoff/` **and you opened it and looked**

Read the warnings even when it passes: `handlers 2/5` means three behaviours
have no scenario at all. Green is not the same as covered.

**And the gate does not judge appearance.** Take a picture at two rungs at least,
and look. To change the width from the console, the viewport selector lives in
the shadow root:

```js
const host = [...document.querySelectorAll("*")].find(e => e.shadowRoot?.getElementById("h-vp"));
const sel = host.shadowRoot.getElementById("h-vp");
sel.value = "md"; sel.dispatchEvent(new Event("change", { bubbles:true }));
```

`Proto.state.viewport` does not resize the stage — the selector is the way.
Two exceptions: a prototype that declares `views` has no stage-wide selector at
all (each view carries its own picker, `.h-view-vp`, in the light DOM), and on a
handheld the bench changes shape rather than scaling down.

## How this goes

Short, direct feedback — *"UI is not good"*, *"needs a remove-connection flow"*.
**Infer the scope and act**; do not ask for a specification before trying. Ask
one question only when the *what* is genuinely ambiguous, never about the *how*.
Expect five to fifteen rounds on the same file.

The order that works: `data.js` first, then a minimal screen in JSX with the
`data-act`s in place, then **the gate early and dirty**, failures before
warnings, CSS last. Doing CSS first is decorating a screen that is still going
to change.

After building: the change in short prose, with the reasoning where there was a
real decision, and what is worth poking at. Do not paste the code back or repeat
the list of features.

If you find a bug in what you were handed, say so at once and fix it in the same
step.
