# Proto · prototype harness

A bench for designing and **stress-testing** UI before it becomes code. The prototype is not a picture of what will be built: it is the specification, executable, with real Gherkin scenarios checked against the DOM.

```bash
pnpm install
node verify.js apps/product-editor
# ✓ product-editor — 68 ok · 0 failing · 0 warning(s) · handlers 9/9  [browser]
```

## One harness, many prototypes

The harness exists once. A prototype is three small files that it loads by name:

```
harness.js     the engine — you never open it
harness.css    the chrome
proto.html     the bench: a loader, and it never changes
apps/
  _react-template/  copy this to start
  product-editor/
    styles.css   the prototype's styles
    data.js      fixtures and routes
    app.jsx      context, scenarios and render — React, real components
```

Open `proto.html?app=product-editor`. Ten prototypes still means one harness —
nothing is copied per prototype, and an agent writing one never opens the engine,
because the engine is not in any of the files it touches.

A missing sidecar says which file is missing, by name. That matters: a prototype is
a folder now, and folders lose files in transit.

## How it is used

1. `cp -r apps/_react-template apps/<area>-<thing>`
2. Fill its three files:
   - `data.js` — fixtures and routes
   - `styles.css` — the prototype's styles
   - `app.jsx` — context, scenarios and render (React, real components)
3. Open `proto.html?app=<area>-<thing>`. The suite runs on its own and blocks the
   screen if it fails.
4. Before shipping, run the gate. It has to exit `0`:

```bash
node verify.js apps/<area>-<thing>
```

CI verifies every app under `apps/`, and fails if it finds none. It skips folders
starting with `_`: the starter is empty and would only ever report `0 ok`, which is a
green that counts nothing.

Nothing outside the zones gets touched — that is the harness, and it is the same in every prototype.

## Product-agnostic

The harness knows nothing about what you are building. Identifiers, comments,
filenames, tooling and docs are English; what language a prototype's interface is
written in is the product's call, and the harness only asks that you hold to one,
since the scenario text and the screen are checked against each other.

Anything specific to a product — its domain vocabulary, its interface language, its
context dimensions, its settled UX decisions — belongs in that product's own
instructions, not here. `apps/product-editor/` carries a worked set of those for a
real product, written in Brazilian Portuguese, beside the prototype they describe.

## Handing it to whoever implements it

The prototype is the specification, so handing it over should not mean handing over a
folder to reverse-engineer. Three files come out of the run the gate already does:

```bash
node verify.js apps/my-screen --export handoff/
# → handoff/: my-screen.feature, api.md, my-screen.html
```

| file | what it carries |
|---|---|
| `<name>.feature` | the scenarios as Gherkin, with the component and route hints |
| `api.md` | every declared route, with a request and response **actually observed** while the scenarios ran — not an example someone wrote and never checked |
| `<name>.html` | **one self-contained file** — bench, catalog and app inlined. Nothing travels with it, so nothing can be dropped on the way |
| `source/` | the prototype's own files. The bundle is for looking at; this is what gets implemented |

The `.feature` and `api.md` are a click away in the browser too, under **Gherkin**. The
single-file bundle comes from the command line: a page cannot read the sidecars it was
loaded from. `--export` only writes when the gate passes — handing over a specification
that failed its own checks is worse than handing over nothing.

The folder is the working format; the bundle is the deliverable.

They are on the API too (`Proto.gherkin()`, `Proto.apiContract()`, `Proto.source()`),
so an agent can produce them without a browser.

## What the harness gives you

A width ladder (`xxs … xlg`), a scenario bar with search and grouping, permalinks in the hash, saved preferences, a network monitor on the stage, a Data panel, `.feature` export, isolated verification in an iframe with automatic resume, and a blocking failure screen with a pasteable report.

## What it demands

The gate rejects what a visual review does not catch:

- **A journey, not a loose assertion** — `Given … Then` with no action in between is a screenshot with a caption.
- **Variety** — every page needs `@feliz` and at least one `@conflito`, `@recuperacao` or `@retorno`. The label is checked against the screen.
- **Three states per page** — `@carregando`, `@vazio`, `@erro`, as a step of the journey.
- **The screen never invents data** — it asks. A write route that answers `200` without storing is a facade.
- **A label that promises to save has to save** — a *Salvar* that makes no request is called out, even when marked as local.
- **Width is a dimension** — the same arrangement across the whole ladder is "it fit", not "it responded". Plus a 44px touch target, 12px text, a 75-character line, overflow, and content that disappears when narrow.

And, checked in the source before a browser starts:

- **Every element is a component** — no lowercase JSX element at all, and none of the ways raw HTML gets in without being a tag: `component="b"`, `dangerouslySetInnerHTML`, markup built as a string. A vanilla `app.js` is refused outright, because none of this can be read out of template strings.
- **Every component comes from the catalog** — from `@12-apps/ui`, by the exact subpath `catalog/ui-catalog.md` gives.
- **A component that exists to be operated is wired** — an `exige` component with nothing to do is a hole in the specification that reads as a finished screen. Checked both ways: a hook no handler answers, and a handler for a hook no element carries.
- **A compound is used with its parts** — a `Card` filled by hand has no padding, so the padding comes back as CSS and the component becomes a border drawn around your own layout.

[`CLAUDE.md`](CLAUDE.md) is the short version an agent loads automatically; [`docs/project-instructions.md`](docs/project-instructions.md) is the long one.

## Two engines

The gate uses **Chromium when it finds one and has puppeteer to drive it** (marked `[browser]` in the output) — only then do the rules that need to measure boxes apply. Without a browser it falls back to jsdom, and those rules declare themselves unverifiable instead of approving in the dark. Everything else still applies.

```bash
pnpm add -D puppeteer                      # PUPPETEER_SKIP_DOWNLOAD=1 if you already have a Chrome
PROTO_CHROME=/path/to/chrome node verify.js apps/<name>
```

Having a Chromium is not enough on its own: without puppeteer the gate falls back to jsdom. The `[browser]` marker in the output is what tells you which engine applied — check it before trusting a green run.

## Map

| path | what it is |
|---|---|
| `CLAUDE.md` | what an agent must know before writing a prototype, loaded automatically |
| `harness.js` | the engine. Loaded by every prototype, edited by none |
| `harness.css` | the chrome, loaded inside a shadow root |
| `proto.html` | the bench: a loader, `?app=<name>`. Never changes |
| `apps/<name>/` | a prototype: `styles.css`, `data.js`, `app.jsx` |
| `verify.js` | the command-line gate |
| `docs/` | harness instructions and the shipping rule |
| `catalog/ui-catalog.*` | the 210 components of `@12-apps/ui`, generated from the installed package |
| `catalog/ui-interactions.*` | what the screen owes each one: `exige` / `pode` / `nunca` |
| `catalog/ui-composition.js` | the six compounds whose parts carry their box structure |
| `scripts/lint-prototype.js` | the component rules, read out of the JSX source |
| `scripts/test-enforcement.js` | fails the build when a rule stops biting, or the docs stop matching it |
| `scripts/generate-catalog.js` | regenerates the catalog from the installed package |
| `apps/product-editor/` | a filled-in prototype to read, with the product instructions and context it came from |

## Component catalog

`catalog/` is generated, never hand-written, and it is generated from the
**installed package** — not from its file names:

```bash
node scripts/generate-catalog.js               # pnpm-installs @12-apps/ui, then reads it
node scripts/generate-catalog.js --no-install   # use what is already there
node scripts/generate-catalog.js --version 5.3.0
```

pnpm, not npm: the package's own `preinstall` runs `only-allow pnpm`.

It reads the names each built entry actually exports, so a name in the catalog is
a name you can import from the path beside it — verified by bundling all 210 at
once. The generator it replaced took the last segment of each export path as the
component name, which invented 24 components that do not exist (`charts`,
`tokens`, `utils`, and a turborepo scaffolding `button` that alerts *"Hello from
your app!"*) and mis-named 3 that do.

The gate checks every component a prototype imports against this catalog: a name that is not in it, or the right name from the wrong path, fails the build.

Note `catalog/ui-interactions.*` is curated by hand, not generated: it says, per
component, whether the screen owes it a step (`exige` = always operable, `pode` =
operable if given a handler, `nunca` = not the thing to operate). Every level was
read off the component's own declaration in the package source rather than
guessed from its name — `CardContent` is a container, `CollapsibleTrigger`
renders a button, `Label` takes an `onClick` and styles itself as clickable.

The levels say what the screen owes a component, never whether to use it.
`nunca` is the largest of the three because that is where the structure lives.

`catalog/ui-composition.js` is the other half of that: the six compounds whose
parts carry the box structure the parent does not, so the gate can reject a
`Card` filled by hand and padded back with CSS. Its list is derived — parent
takes children, parent supplies no padding, a part does — which is what keeps
`Form` and `AppHeader` off it.

It is enforced, not advisory: the gate rejects a prototype that renders an
`exige` component with nothing to operate, a hook no `Proto.on` answers, or a
handler for a hook no element carries — checked in the source, with a line
number, before a browser starts. See "Components that exist to be operated must
be wired" in `docs/project-instructions.md`.

Regenerating the catalog does not update it. Two things keep the gap visible:
the generator prints the names it wrote that still have no level, and
`scripts/test-enforcement.js` fails the build on any component the
classification misses (or any level left behind for a component that is gone).
All 210 are covered today.

## License

Internal.
