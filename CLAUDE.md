# Working in this repository

You are here to write a **prototype**: an executable specification of a screen,
which someone else will implement in the real product. The prototype IS the
spec — if a behaviour is not in it, it does not exist.

Read [`docs/project-instructions.md`](docs/project-instructions.md) before
writing one. This file is the part you must not get wrong.

## Do not open the harness

`harness.js`, `harness.css` and `proto.html` are the engine. One copy serves
every prototype and none of them appears in the files you edit. You never read
them to write a prototype, and you never copy them.

## A prototype is three files

```bash
cp -r apps/_react-template apps/<area>-<thing>
```

```
apps/<area>-<thing>/
  styles.css   the prototype's styles
  data.js      fixtures and routes
  app.jsx      context, scenarios and render — React, real components
```

Open it at `proto.html?app=<area>-<thing>`. `apps/product-editor/` is the
worked reference — read it for the shape of real scenarios, routes and states.

**It is `app.jsx`, always.** Every rule below is read out of the JSX source, so
a vanilla `app.js` gives them nothing to read. The gate refuses one at exit 3
rather than passing it on rules that never ran.

## The gate is the shipping rule

```bash
pnpm install                 # once; pnpm, not npm — @12-apps/ui insists
node verify.js apps/<name>   # has to exit 0
```

`0` ships. `1` is failures — do not ship. `2` is warnings under `--strict`.
`3` means the file did not load.

Read the counters, not the checkmark. `handlers 2/5` means three behaviours
have no scenario, and `[browser]` in the output is what tells you the
measurement rules actually applied — without it the gate fell back to jsdom and
those rules declared themselves unverifiable rather than approving in the dark.

## Every element comes from `@12-apps/ui`

This is checked in the source, before a browser starts, because it has to be:
once `<Button>` renders, the design system emits a real `<button>` and nothing
downstream can tell it from one you typed.

| the gate rejects | meaning |
|---|---|
| `raw-html` | **any** lowercase JSX element — `<div>`, `<span>`, `<button>`, `<marquee>`. Not a blocklist; the check is "does the tag start lowercase". Fragments (`<>…</>`) are fine |
| `html-via-prop` | `component="b"` / `as="span"` — a component told to render a raw tag. `component={SomeComponent}` is composition and is allowed |
| `html-via-innerhtml` | `dangerouslySetInnerHTML` |
| `html-in-string` | markup assembled as text. Gherkin placeholders like `<colunas>` are safe — the check matches real HTML element names |
| `foreign-import` | a component from anywhere but `@12-apps/ui` |
| `not-in-catalog` | a name that is not in `catalog/ui-catalog.md` |
| `wrong-path` | the right name from the wrong subpath |
| `unknown-component` | `<Foo>` used but never imported |
| `unwired-component` | an `exige` component with no `data-act`, no `data-campo`, no `on…` prop and no `href` |
| `hook-without-handler` | a `data-act` / `data-campo` that no `Proto.on` answers |
| `handler-without-hook` | a `Proto.on` for a hook no element carries |
| `uncomposed-compound` | a `Card`, `Dialog`, `Accordion`, `Collapsible`, `Drawer` or `Sidebar` filled by hand instead of with the parts that give it structure |

The root barrel is empty on purpose — import by subpath:

```jsx
import { Button } from "@12-apps/ui/form/Button";
import { Card, CardContent } from "@12-apps/ui/layout/Card";
```

Reach for the prop the component already has before reaching for CSS.
`<Text weight="bold">`, not `<Text component="b">`. A page header is
`<AppBar>`, not `<Box component="header">`. A clickable box is a `Card`, a
`Button` or a `ListItemButton`.

**Components you define yourself are fine** — composing catalog components into
a `<Row>` is the job, and it is reported as a warning only so a screen built
from five private components is visible as what it is.

## What the screen owes its components

`catalog/ui-interactions.md` classifies all 210 components:

- `exige` — always operable. Rendering one with nothing to do is a hole in the
  specification that reads as a finished screen, so the gate rejects it.
- `pode` — operable only if you give it a handler.
- `nunca` — not the thing to operate. **This is not "you don't need it"**: it is
  the largest level because that is where the structure lives, and skipping
  `CardContent` is how a prototype ends up re-implementing a component's
  padding in its own CSS.

The wiring joins up at both ends, and both ends are checked:

```jsx
<Button data-act="save">Salvar</Button>          {/* the hook  */}
Proto.on("click", '[data-act="save"]', …)        {/* answers it */}
```

## More than one screen at a time

Some flows need two people. Someone orders, someone else prepares it, and each
has to see what the other did — a single screen cannot specify that, because
the whole behaviour is what happens on the *other* one.

`views` declares them. How many and who they are is the product's business:

```js
Proto.init({
  views:[
    { id:"cliente", label:"Cliente", actor:"cliente", viewport:"se"   },
    { id:"cozinha", label:"Cozinha", actor:"cozinha", viewport:"ipad" }
  ],
  ...
})
```

**Your prototype still renders ONE screen.** It never lays out a stage and
never knows the others exist: the harness calls `mount` once per view, each in
a frame the width of that view's device, and `state.view` says which one it is
asking for. `state.can(…)` then answers for that view's `actor`, and
`state.waitingFor()` for that view's own requests.

That is what keeps every rule on this page applying: **a view is an ordinary
screen**, so each one is walked across the whole width ladder, owes its own
arrangement, its own touch targets, its own `@carregando` / `@vazio` / `@erro`,
and its own wiring. Three views owe three of everything. `views` multiplies the
specification; it is not a way out of any of it.

With views declared:

- **a step says where it acts** — `on:"cozinha"` beside the `click`. An action
  without it is refused: two screens are open and the same control can be on
  both. The `.feature` carries the addressee, so the export reads as a script
  with parts;
- **an assertion reads one screen** — `on:"cliente"` scopes `el` to that view;
  `state.views.cozinha` reaches another, which is how one `Então` says *the
  customer saw it and the kitchen did not move*;
- **the choreography is declared** — `propagates:["cliente"]` names the views a
  step must change, `unchanged:["cozinha"]` the ones it must not. The harness
  compares the renderings before and after. A prototype with several views and
  no such step is warned: what one screen's action does to the others is
  exactly the part that needed specifying.

On the bench each view carries a picker above its frame, for looking at the
same screen on another device. It never reaches the suite: verification and the
audit always measure the device the view **declares**.

Leaving `views` out changes nothing anywhere — a one-screen prototype takes the
same path it always did.

## What the specification owes itself

Beyond the components — the full list is in `docs/project-instructions.md`:

- a **journey**, not a loose assertion: `Given … Then` with no action between
  them is a screenshot with a caption;
- `@feliz` plus at least one `@conflito`, `@recuperacao` or `@retorno` per page;
- `@carregando`, `@vazio`, `@erro` per page, as steps of the journey;
- the screen never invents data — it asks. A write route answering `200`
  without storing is a facade;
- width is a dimension: the same arrangement at every rung is "it fit", not
  "it responded".

Escapes exist (`local`, `noNetwork`, `journey:false`, …) and are a declared
exception, never a way to silence a warning.

## Before you say it is done

Run the gate and read its output. If a rule fired, fix the prototype — do not
loosen the rule. `scripts/test-enforcement.js` exists because that has happened
before, and it fails the build when a rule stops biting.
