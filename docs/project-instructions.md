# Proto — Harness Instructions

*(Paste this into the project instructions field, together with your product's own
instructions. The files it mentions live in the project knowledge.)*

---

## What it is

Proto is a prototyping bench: one HTML file where a screen is designed and then
stress-tested before it becomes code. It is product-agnostic — the same harness
serves any prototype, and nothing in it knows what you are building.

This document covers the harness and the rules it enforces. Everything about a
specific product — its domain vocabulary, its interface language, its context
dimensions, its settled UX decisions — belongs in that product's own instructions.
`examples/` carries a worked set of those, for a real product, next to the demo
prototype they describe.

The harness itself is English: identifiers, comments, filenames, tooling, these
docs. What language a prototype's interface is written in is the product's call,
not the harness's — the harness only insists that you pick one and hold to it,
because the scenario text and the screen are checked against each other.

## Starting point

**Do not rebuild the harness. Copy `proto.html`** and edit **only** the marked zones:

- `▼ DATA ▼` — fixtures and routes
- `▼ APP ▼ (1 of 2)` — the prototype's styles
- `▼ APP ▼ (2 of 2)` — context, scenarios and render

Everything outside those zones is the harness. Rename the file to `<area>-<thing>.html`.

The harness gives you: the width ladder, a resizable scenario bar with search, permalinks in the hash, saved preferences, a network monitor on the stage, a Data panel, Gherkin export, isolated verification in an iframe (with automatic resume) and a blocking failure screen.

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
spelled as shown, whatever your prose language. `examples/` shows a full set written
in Portuguese.

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
declare them in the `▼ APP ▼` zone. The three `kind` values are the harness's own
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

## Components

When the product has a component library, map to it. For `@12-apps/ui` the 128 components are listed in `ui-catalog.md`, with what needs wiring in `ui-interactions.md` (60 require it, 37 may, 31 never). The `primitives` map links a selector to a component **by name**; the import path comes from the catalog, and a name outside it is called out instead of generating an invented import. `strictMode: true` demands that every piece of markup with text or interaction is claimed. Never write a hex value when a token exists.

## Before shipping — mandatory

```bash
npm install jsdom                                # once per session
node verify.js <thing>.html    # has to exit 0
```

The gate uses **Chromium when it finds one and has puppeteer to drive it** (marked `[browser]` in the output) and only then do the layout rules and the physical measurements apply. Without a browser it falls back to jsdom and those rules declare themselves unverifiable — everything else still applies.

Before that, `node --check` on the `<script>` block: a syntax error leaves the page blank. Read the warnings even when it passes: `handlers 2/5` means three behaviours have no scenario. Green is not the same as covered. Details in `gate.md`.

## Escapes

They exist and must be a declared exception, never the way to silence a warning: `local`, `noNetwork`, `onLoad`, `journey:false`, `states:false`, `coveredRoutes:false`, `journeys:false`, `responsive:false`.

## How we work

Short, direct feedback — *"UI is not good"*, *"needs a remover conexao flow"*. **Infer the scope and execute**; do not ask for a specification before trying. A question only when the *what* is ambiguous, never about the *how*. Expect five to fifteen rounds on the same file.

After building: the change in short prose, with the reasoning where there was a real decision, and what is worth poking at. Do not paste the code back or repeat the feature list.

If you find a bug in what I sent, say so immediately and fix it in the same step.
