# Proto — Harness Instructions

*(The rules of the harness itself. `CLAUDE.md` is the short version an agent
loads automatically; this is the long one. Everything about a specific product
— its vocabulary, its context dimensions, its settled UX decisions — belongs in
that product's own instructions, not here.)*

---

## What it is

Proto is a prototyping bench: one HTML file where a screen is designed and then
stress-tested before it becomes code. It is product-agnostic — the same harness
serves any prototype, and nothing in it knows what you are building.

This document covers the harness and the rules it enforces. Everything about a
specific product — its domain vocabulary, its interface language, its context
dimensions, its settled UX decisions — belongs in that product's own instructions.
`apps/product-editor/` carries a worked set of those, for a real product, beside the
prototype they describe.

The harness itself is English: identifiers, comments, filenames, tooling, these
docs. What language a prototype's interface is written in is the product's call,
not the harness's — the harness only insists that you pick one and hold to it,
because the scenario text and the screen are checked against each other.

## Starting point

**Do not rebuild the harness, and do not open it.** A prototype is three files:

```
cp -r apps/_react-template apps/<area>-<thing>
```

```
apps/<area>-<thing>/
  styles.css   the prototype's styles
  data.js      fixtures and routes
  app.jsx      context, scenarios and render — React, real components
```

Open it with `proto.html?app=<area>-<thing>`. The bench loads those three, in that
order, so `app.jsx` can count on the fixtures already existing.

A prototype is React — `app.jsx`, always. The rules below are read out of the
JSX source, so a vanilla `app.js` gives them nothing to read; the gate refuses
one outright rather than passing it on rules that never ran.

The harness is never copied: one `harness.js` and one `harness.css` serve every
prototype, and neither appears in the files you edit. The chrome also sits in a
shadow root, so nothing you write in `styles.css` can reach it — and nothing it
defines can reach your screen.

The filled-in reference is [`apps/product-editor/`](../apps/product-editor/) — read
it when you want the shape of real scenarios, routes and states.

The harness gives you: the width ladder, a resizable scenario bar with search, permalinks in the hash, saved preferences, a network monitor on the stage, a Data panel, Gherkin export, isolated verification in an iframe (with automatic resume), a blocking failure screen — and, on a phone, a bench that opens as the phone.

## The prototype is the specification

Scenarios are real Gherkin with clickable steps: clicking step N replays 1..N from
the `Given`. Declare the language your scenario text is written in with the usual
Gherkin header — `# language: pt` for Portuguese, and the keywords render to match.

```js
{
  id:"add-first-variant", name:"From the list to the first variant",
  page:"item", tags:["@catalog","@feliz","@pode:item.edit"],
  impl:{ component:"ItemEditor", route:"/items/:id", moduleName:"catalog/items" },
  given:{ text:"the user is on the item list",
          state: async (ex, api) => ({ page:"list", items: await api.get("/api/items") }) },
  steps:[
    { when:"the user opens an item", click:'[data-act="open-item"][data-id="2"]' },
    { then:"the editor opens", check:(a, el) => !!el.querySelector('[data-act="back"]') },
    { when:"they add a variant", click:'[data-act="add"]' },
    { then:"the variant appears", check:(a, el) => el.querySelectorAll(".var").length === 1 }
  ]
}
```

The keys are the harness's and are always English. The step text is your
specification's prose — write it in whatever language the product's interface uses,
and keep it consistent, because that text and the screen are checked against each
other. The journey tags (`@feliz`, `@conflito`, `@recuperacao`, `@retorno`) and the
state tags (`@carregando`, `@vazio`, `@erro`) are the harness's vocabulary and are
spelled as shown, whatever your prose language. `apps/product-editor/` shows a full
set written in Portuguese.

- `Given` (`Dado`) = the world before the action; fetched from the API.
- `When` (`Quando`) = a real action: `click`, `fill`, `choose`, `toggleCtl`, `waitFor`. It runs the `Proto.on` handlers and fails if the element does not exist. `applyState` is for pure state only.
- `Then` (`Então`) = `check(state, dom)` against the rendered DOM.
- `And` (`E`) **inherits the previous keyword**: an `And` after a `Then` is an assertion. An action written there is called out.
- **A step that changes state is a `When`, always** — whether it comes from a click, from `applyState` or from the response that arrived.

## A journey, not a loose assertion

`Dado … Então` with no action in between is not a scenario, it is a screenshot caption. Verification demands:

- at least **2 actions** per scenario (`minActions`), and at least one **3+ action** journey per page;
- a `Então` **after** the last action;
- actions on **different targets** — clicking the same button three times is not a path;
- every page needs a journey that **reaches it from another screen**;
- two scenarios walking the same controls in the same order are called out as clones.

**Journey types** (the label is checked against the screen):

| tag | is | checked by |
|---|---|---|
| `@feliz` | works end to end | no error in any step |
| `@conflito` | the server refuses (email exists, limit, 422) | ends **with** a visible error |
| `@recuperacao` | breaks midway and the person recovers | the error appears **and** is gone at the end |
| `@retorno` | someone who already used it comes back | leaves the page and returns |

Every page needs `@feliz` **and** at least one of the other three.

## Three states per page

Every page uses `AsyncStateContainer` and marks `[data-estado="…"]`. It needs a `@carregando`, `@vazio` and `@erro` scenario, grouped by `page`. The harness asserts on its own that the state appeared **at some point in the journey** — a state is a step, not a destination. `@erro` without a forced failure (`network` or `fixtureFailure`) is a happy path with the wrong label.

For loading to become a step: `network:{ "GET /api/x": "pendente" }` holds the response and a step releases it:

```js
{ when:"the response arrives", waitFor:"GET /api/items",
  applyState:(a, payload) => ({ ...a, items:payload, loading:false }) }
```

## Data: the screen never invents, it asks

Fixtures and routes live in the `DATA` zone; the harness intercepts `fetch`. Fixtures reset to their initial state for each scenario.

- **A write route has to change the fixtures.** Answering 200 without storing is a facade — a reload contradicts it and the audit calls it out.
- **Every route from both ends**: a success and an error scenario (`network:{ "POST /api/…": 500 }`). A route never called is a dead route.
- **Every call is born from a step.** Only in the `Dado` = screen load: mark `onLoad:true` on the route.
- **A mutation leaves the browser.** A step that changes the screen with no request is called out. `local: true` exempts an interface-only action — but **not** a control whose label promises to store (*Salvar*, *Confirmar*, *Excluir*…), and not when it changes server data with nobody persisting it afterwards.
- Latency is randomised between 250–750ms on screen; verification runs with no delay.

## Context dimensions

A prototype rarely serves one kind of user. `context` declares the axes that change
what a screen offers, and a scenario is verified in the context its own tags ask for.
Three kinds of dimension:

- `kind:"escala"` — an ordered scale, where the active level includes the ones below
  it. A subscription plan is the usual case: a tag applies from that level upwards.
- `kind:"opcao"` — an exclusive choice, such as the role of whoever is signed in.
- `kind:"flags"` — independent switches, for features that can be on or off.

Which dimensions exist, and what the levels are called, is the product's business —
declare them in `app.jsx`. The three `kind` values are the harness's own
vocabulary and are spelled as above.

Options grant permissions (`allows:[…]`, `"*"` = all); a scenario demands one with
`@pode:<permission>`. Permission is **AND across dimensions**: one dimension enables,
another authorises. **Every scenario is verified in the context its own tags ask
for** — the result does not depend on the chips ticked on screen.

## Width is a dimension, not a detail

The default ladder is `xxs 320 · xs 380 · sm 480 · md 768 · lg 1024 · xlg 1440` (change it in `widths`). Devices show up as `~xs`: they fall between rungs and inherit the one below.

**Do not ship "something that fits".** Declare the arrangement of each width in an `Esquema do Cenário` with a `largura` column — the harness sets the frame to that width before drawing and before checking:

```
Exemplos:
  | largura | colunas | onde   |
  | xxs     | 1       | rodape |
  | md      | 2       | topo   |
  | xlg     | 3       | topo   |
```

The Examples headers are Gherkin content and stay Portuguese; the row values are read back by those same names.

Picking a rung in the selector switches the example row, and vice versa.

On top of that, verification measures, rung by rung:

- **the same arrangement across the whole ladder** = it fit, it did not respond;
- **horizontal overflow**;
- **touch target < 44px** on xxs/xs/sm;
- **text < 12px**;
- **line > 75 characters** on lg/xlg;
- **content that exists when wide and vanishes when narrow** — a decision, or a lack of room?

Prefer `@container` over `@media`: the frame is the container.

## Opening it on a phone

A prototype of a phone screen is reviewed on a phone sooner or later, and
the bench that reviews it is not the same bench a computer needs. Open
`proto.html?app=<name>` — or the exported single-file `.html`, which is the
one that usually travels — on a handheld and the chrome changes shape:

- the viewport opens at **Este aparelho**: the frame *is* the screen, 1:1,
  edge to edge under the notch. What you touch is the real thing at the real
  width, and the `@container` rules answer to it. A 380px frame drawn inside
  a 390px screen is a picture of a phone shown on a phone;
- the scenario bar becomes a drawer over the stage, and closes when you pick
  something from it — the screen is what you came for;
- the rest of the controls fold into a row that opens on **⋯**;
- the journey gets a row of its own at the bottom — `‹ nome do cenário ·
  passo 2 de 5 ›` — because a phone has no arrow keys, and stepping is the
  bench's main interaction.

Two switches, and they answer different questions. The **shape** of the
chrome is the viewport alone — `max-width: 860px`, or short and coarse,
which is what a phone on its side is and no computer is (current handsets
are 874–956px wide in landscape, past any threshold a laptop window is also
past). So a narrow window on a computer gets the phone bench, which is how
you look at it without a phone. The **device view** asks for a coarse
pointer as well: a narrow window keeps the rung the file declares, because
a window is not a device. Neither switch reads the user agent.

Who chose the width decides what may change it, and there are three
answers. **Nobody** — the bench swaps it for the device when the shape
becomes a phone's, and back to the declared rung when it stops being one,
so rotating never strands you at a picture of a phone inside the phone.
**The scenario** — an `Esquema do Cenário` with a `largura` column takes the
frame to that width while you are on it, and gives it back when you leave.
**The person** — a rung picked from the selector, or one carried in a link,
is never taken back by either. Width is also the one saved preference a
handheld does not inherit.

A link is somebody saying *look at this one*, and it wins over all of that
— when it carries a width. A link made on a phone in device view carries
none, because the device view is that bench's default and the hash only
records departures from it: the recipient gets the scenario and the step,
at whatever width their own bench opens. Send `?viewport=xxs` (the selector
puts it in the link) when the width is the point.

Nothing about the specification changes, and the gate is not exposed to any
of it: `verify.js` drives the page at a fixed 1400×1000 with an ordinary
pointer, so it is never in phone form, and the in-page **Verificar** runs
the suite in an iframe at least 1000px wide. What the gate reports never
depends on what you happen to be holding.

## Several screens at once

A flow that needs two people needs two screens open together: someone orders,
someone else prepares it, and each has to see what the other did. That
behaviour lives *between* the screens, so one screen cannot hold it.

`views` declares who is watching, and on what. How many, and who they are, is
the product's business — the harness only insists on a width for each:

```js
views:[
  { id:"cliente", label:"Cliente", actor:"cliente", viewport:"se"   },
  { id:"garcom",  label:"Garçom",  actor:"garcom",  viewport:"se"   },
  { id:"cozinha", label:"Cozinha", actor:"cozinha", viewport:"ipad" }
]
```

`viewport` is a rung or a device from the ladder above, or a raw `w`/`h`.
`actor` names an option of an exclusive context dimension, so `state.can(…)`
inside a view answers for that view's person rather than for whoever is at the
bench — one dimension, several answers, because several people are on screen.

**The prototype still renders one screen.** It does not lay out a stage and it
does not know the other views exist. The harness calls `mount` once per view,
each in a frame the width of that view's device; `state.view` says which one it
is asking for, `state.rung` and `state.widthPx` answer for that view's frame,
and `state.waitingFor()` for that view's own requests — one screen's pending
request no longer puts the others into a skeleton they have no reason to show.

This is the whole design, and the reason everything else on this page keeps
working: **a view is an ordinary screen.** Each one is walked across the entire
ladder, owes its own arrangement, its own physical measurements, its own three
states and its own wiring. Three views owe three of everything, and the audit
says so by name — `a vista "Cozinha" da página "salao"…`. Declaring views
multiplies what the specification owes; it is not a way out of any of it.

Each view carries a picker above its frame, so you can look at the same screen
on another device without touching the file — the customer's comanda on a
tablet, say. That is the bench, not the specification: the suite and the audit
always measure the device the view **declares**, or looking at something would
quietly change what the gate approved. Resetar puts every view back on its own.

There is no stage-wide viewport selector when views are declared. The stage is
the sum of the views and no single rung describes it, so rather than show a
number that means nothing, the selector is not there.

### The data is live

`data_` was always one source of truth for the server. What was not one was the
client: every screen kept its own copy inside `app`, and somebody had to
remember to re-read it — which is how a kitchen's handler ends up fetching the
customer's comanda, something no real device can do for another.

So a screen declares what it watches, and the harness owns the copy:

```js
views:[
  { id:"cliente", viewport:"se",   watches:{ comanda:"GET /api/comandas/7" } },
  { id:"cozinha", viewport:"ipad", watches:{ fila:"GET /api/cozinha/fila"   } }
]
```

A view sees only the names it declares — `s.data.comanda`, and
`s.dataError.comanda` when the read failed. A screen that forgets to subscribe
goes stale, and the gate says so rather than the person noticing later.

**Every write invalidates and every watcher re-reads.** A route narrows what it
disturbs with `invalidates:["fila"]`; saying nothing invalidates everything,
which is the safe direction to be wrong in. The re-read goes through the same
interceptor as everything else, so it appears in the monitor and in `api.md` as
the request it really is.

`app` goes back to meaning this screen's own state: a draft, a selection, an
open panel. If it holds a copy of something a route returns, it is stale and
the layer should be holding it instead.

The four states come from the subscription rather than a flag:

```js
function estadoDe(valor, erro, hasContent){
  return erro                ? "erro"
       : valor === undefined ? "carregando"
       : !hasContent         ? "vazio"
       :                       "conteudo";
}
```

`Proto.refresh("fila")` re-reads by hand — pull to refresh, a real control.
Everything else re-reads because something was written.

### Writing is not the same as being told

A route held open is a subscription:

```js
network:{ "GET /api/comandas/:id":"pendente" }
```

The screen has asked and the server has not answered, which is exactly the
loading state; a `waitFor` step is the server answering. That distinction is
worth specifying, because it is the expensive part for whoever implements this:

```js
{ when:"a cozinha inicia", on:"cozinha", click:'[data-act="iniciar"]',
  unchanged:["cliente"] },            // writing moves the server, not a screen
{ when:"o servidor avisa o cliente", waitFor:"GET /api/comandas/:id",
  propagates:["cliente"] }            // only being told moves one
```

Without that pair the `.feature` says the customer's screen changed without
saying how the customer learned — and how they learn is the whole question.

### The step says where it acts

```js
{ when:"a cozinha inicia o preparo", on:"cozinha", click:'[data-act="iniciar"]' }
```

With views declared an action without `on` is refused: two screens are open and
the same control can be on both, so a step that does not name one has not said
what happens. The `.feature` carries the addressee — `Quando [cozinha] …` — so
the export reads as a script with parts rather than a monologue.

An `Então` may name one too. `on:"cliente"` scopes its `el` to that view;
`state.views` holds every view's root, so a single assertion can say *the
customer saw it change* and *the kitchen's board did not move*:

```js
{ then:"o cliente vê que chegou, e a cozinha segue igual", on:"cliente",
  check:(a, el, s) => !!el.querySelector('[data-situacao="entregue"]')
                   && !!s.views.cozinha.querySelector('[data-raia="pronto"] .ficha') }
```

### The choreography is declared, not hoped for

What one screen's action does to the others is the reason to have them open
together, so it is stated on the step and checked:

```js
{ when:"o garçom entrega na mesa", on:"garcom", click:'[data-act="entregar"]',
  propagates:["cliente"], unchanged:["cozinha"] }
```

`propagates` names the views that must have changed because of this step;
`unchanged` names the ones that must not have. The harness holds both
renderings and compares them, so neither is a matter of opinion. The second is
the harder half and the one nothing else can express: *the kitchen is done with
this plate, and whether it is already on the table is not its business.*

A prototype with several views and no such step is called out — it has drawn
the screens without specifying the thing that made them worth drawing together.

Two limits worth knowing before you lean on it. **The comparison is the whole
view's markup**, so it answers "did this screen change at all" and nothing
finer: there is no way to say *this part* must hold still, and a screen
carrying anything incidental — a clock, a counter, a freshly generated id —
will read as changed every time and cannot be declared `unchanged`. And
**a request fired after an `await` inside a handler loses its view**, so it
counts as nobody's and every view shows its loading state; fire what a screen
asks for at the top of the handler if that matters to you.

### On a phone, one screen at a time

A row of devices is the one arrangement a phone cannot hold: three of them at
their true widths is about 1800px asked to be 390, and every screen arrives at
a fifth of its size. So on a handheld the stage holds **one view**, at its own
device's width, and a row of names under it switches between them.

The step is what leads. `on:` already says which screen an action happens on,
so walking the journey with `›` takes the stage to that screen as it goes — the
export reads as a script with parts, and on a phone the bench plays it that
way. Tapping a name overrides that until the next step names one.

This is display and nothing else. Every view is still rendered, so `state.views`,
`propagates` and `unchanged` see exactly what they always saw; the suite still
measures each view at the device it declares, and a probe always draws all of
them. What changes on a phone is which one you are looking at.

Leaving `views` out changes nothing: a one-screen prototype takes exactly the
path it always did.

## Components — raw HTML is not allowed

A prototype is React, and **every element comes from `@12-apps/ui`**. Not "prefer
components". Not "claim your markup in a map". A raw tag fails the gate:

```
$ node verify.js apps/cardapio
  apps/cardapio/app.jsx:24  <button> is raw HTML. Use <Button> from @12-apps/ui/form/Button
✕ DO NOT SHIP. 1 violation(s) of the component rule — a prototype uses @12-apps/ui, never raw HTML.
```

This is checked on the **source**, before a browser starts — and it has to be. Once
`<Button>` renders, the design system emits a real `<button>` into the DOM, so
nothing downstream could tell it from one you typed.

What the check demands:

- no lowercase JSX elements at all — `<div>` is `<Box>`, `<p>` is `<Paragraph>`,
  `<h2>` is `<Heading>`. Fragments (`<>…</>`) are fine, they are not elements;
- and none of the three ways raw HTML reaches the DOM without being a tag:

  ```jsx
  <Text component="b">…</Text>                          {/* the tag as a prop  */}
  <Box dangerouslySetInnerHTML={{ __html: "<b>x</b>" }} />
  <Text>{`<div class="x"><h1>…</h1></div>`}</Text>       {/* markup as text     */}
  ```

  Use the prop the component already has — `<Text weight="bold">` — or the
  component that means it: a page header is `<AppBar>`, not
  `<Box component="header">`. `component={SomeComponent}` is composition and
  stays allowed. Step text is safe: `<colunas>` reads as a Gherkin placeholder,
  not a tag, because the check matches real HTML element names;
- every component imported from `@12-apps/ui`, nothing from anywhere else;
- every name present in `catalog/ui-catalog.md`, imported from the exact path it
  gives — a typo or a component that does not exist fails;
- components you define yourself are fine, and are reported as a warning rather
  than a failure. Composing design-system parts into a screen is the job, and
  everything a local renders is checked on the line that writes it; the warning
  exists so a screen built from five private components is visible as what it
  is.

The root `@12-apps/ui` barrel is intentionally empty, so import by subpath:

```jsx
import { Button } from "@12-apps/ui/form/Button";
import { Heading } from "@12-apps/ui/typography/Heading";
```

## Components that exist to be operated must be wired

Using the component is not the end of it. `catalog/ui-interactions.md` classifies
every component in the catalog by what the screen owes it:

| level | meaning |
|---|---|
| `exige` | always operable — a `CollapsibleTrigger` renders a button, a `SubmitButton` submits |
| `pode` | operable only if you give it a handler — a `Card`, an `Avatar`, a `Label` |
| `nunca` | not the thing to operate — a `CardContent`, a `ThemeProvider`, an icon |

These answer one question — *does the screen owe this component a step?* — and
none of them answers *should I use this component*. Every name in the catalog is
one to reach for, and `nunca` is the largest level precisely because that is
where the structure lives: `CardContent`, `DialogActions` and `SidebarHeader`
are what a Card, a Dialog and a Sidebar are built from. Reach for the parts. A
`<Card>` with hand-written children is how a prototype ends up re-implementing
the component's own padding in `styles.css`.

`nunca` also does not mean the component *cannot* take a handler — `Box` and
`Stack` are MUI re-exports, `Heading` spreads `...props`. It means it is not the
thing to operate: a clickable Box is a `Card`, a `Button` or a `ListItemButton`.

An `exige` component with nothing to do is a hole in the specification that reads
as a finished screen, so the gate rejects it:

```
$ node verify.js apps/cardapio
  apps/cardapio/app.jsx:71  <CollapsibleTrigger> is "exige" in catalog/ui-interactions.md — it always
  renders something to operate, so a screen that shows one owes a step. Give it data-act="…" (or
  data-campo="…" for a field) and a matching Proto.on, or use a component that is not operable.
```

The chain is checked in both directions, in the source:

```jsx
<Button data-act="save">Salvar</Button>          {/* the hook  */}
Proto.on("click", '[data-act="save"]', …)        {/* answers it */}
```

- an `exige` component with no `data-act`, no `data-campo`, no `on…` prop and no
  `href` → **unwired-component**;
- a `data-act` / `data-campo` no `Proto.on` answers → **hook-without-handler**, a
  control that looks live and is not;
- a `Proto.on` for a hook no element carries → **handler-without-hook**, dead code
  or an attribute renamed on one side only.

MUI often puts the real element behind a slot, and the check reads that too:

```jsx
<Input slotProps={{ htmlInput: { "data-campo": "preco" } }} />
```

Two things the source cannot see, so they are not accused: a hook built at runtime
(`data-act={id}`) and a hook arriving through a spread (`{...props}`). Both are
allowed; a file that builds hooks at runtime just turns off the dead-handler
direction, since "nowhere" would then be a guess. The runtime audit still covers
those: it walks the rendered screen and reports anything operable that no step
touches, plus every handler that no step fires (`handlers N/N` in the gate line).

## Compounds are used with their parts

Some components carry no box structure of their own — their parts do. `Card`
supplies no padding; `CardContent` does. Fill a Card by hand and you get an
unpadded box, so the padding goes back into `styles.css` and the component ends
up as a border drawn around your own layout:

```jsx
<Card className="card">                       {/* ✕ uncomposed-compound   */}
  <Heading level="h2">Margem</Heading>
  <Paragraph>…</Paragraph>
</Card>
```
```css
.card{background:…;border:1px solid …;border-radius:…;padding:14px}
```

That was `apps/product-editor`, and all four of those declarations were already
in the component. It now reads:

```jsx
<Card variant="outlined" className="card">
  <CardContent>
    <Heading level="h2">Margem</Heading>
    <Paragraph>…</Paragraph>
  </CardContent>
</Card>
```

Six components are checked — `Card`, `Dialog`, `Accordion`, `Collapsible`,
`Drawer`, `Sidebar` — and the list in `catalog/ui-composition.js` is derived,
not chosen: the parent must take children, supply no padding, and have a part
that does. `Form` is not on it, because no part of a Form carries structure and
a Form holding its own fields is exactly right. Nor is `AppHeader`, which pads
itself.

A part nested deeper counts — `<Card><Box><CardContent/></Box></Card>` is fine
— and children the source cannot read (`<Card>{body}</Card>`) are not accused.

## Rendering

The harness measures the DOM immediately after drawing, and React commits
concurrently, so a prototype mounts with `flushSync` — `apps/_react-template/app.jsx`
has the four lines that do it. Supply `mount`, not `render`; the harness has had a
mount hook all along and needs to know nothing about React.

`node verify.js apps/<name>` lints the source, builds it with esbuild (~300ms) and
then runs the suite. Build output goes to `apps/<name>/.build/` and is not committed.

## Before shipping — mandatory

```bash
pnpm install                   # once; pnpm, not npm — @12-apps/ui insists
node verify.js apps/<name>     # has to exit 0
```

The gate uses **Chromium when it finds one and has puppeteer to drive it** (marked `[browser]` in the output) and only then do the layout rules and the physical measurements apply. Without a browser it falls back to jsdom and those rules declare themselves unverifiable — everything else still applies.

The gate lints `app.jsx` before it builds it, so a syntax error is reported with a line number rather than leaving the page blank. Read the warnings even when it passes: `handlers 2/5` means three behaviours have no scenario. Green is not the same as covered. Details in [`gate.md`](gate.md).

## Escapes

They exist and must be a declared exception, never the way to silence a warning: `local`, `noNetwork`, `onLoad`, `journey:false`, `states:false`, `coveredRoutes:false`, `journeys:false`, `responsive:false`.

## How we work

Short, direct feedback — *"UI is not good"*, *"needs a remover conexao flow"*. **Infer the scope and execute**; do not ask for a specification before trying. A question only when the *what* is ambiguous, never about the *how*. Expect five to fifteen rounds on the same file.

After building: the change in short prose, with the reasoning where there was a real decision, and what is worth poking at. Do not paste the code back or repeat the feature list.

If you find a bug in what I sent, say so immediately and fix it in the same step.
