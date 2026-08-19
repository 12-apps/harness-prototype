# Proto · prototype harness

A single HTML file that serves as a bench for designing and **stress-testing** UI before it becomes code. The prototype is not a picture of what will be built: it is the specification, executable, with real Gherkin scenarios checked against the DOM.

```bash
npm install jsdom
node verify.js proto.html
# ✓ proto.html — 68 ok · 0 failing · 0 warning(s) · handlers 9/9  [browser]
```

## How it is used

1. Copy `proto.html` and rename it to `<area>-<thing>.html`.
2. Edit **only** the three marked zones inside the file:
   - `▼ DATA ▼` — fixtures and routes
   - `▼ APP ▼ (1 of 2)` — the prototype's styles
   - `▼ APP ▼ (2 of 2)` — context, scenarios and render
3. Open it in a browser. The suite runs on its own and blocks the screen if it fails.
4. Before shipping, run the gate. It has to exit `0`.

Nothing outside the zones gets touched — that is the harness, and it is the same in every prototype.

## Product-agnostic

The harness knows nothing about what you are building. Identifiers, comments,
filenames, tooling and docs are English; what language a prototype's interface is
written in is the product's call, and the harness only asks that you hold to one,
since the scenario text and the screen are checked against each other.

Anything specific to a product — its domain vocabulary, its interface language, its
context dimensions, its settled UX decisions — belongs in that product's own
instructions, not here. `examples/` carries a worked set of those for a real product,
written in Brazilian Portuguese, next to the demo prototype they describe.

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

Details in [`docs/project-instructions.md`](docs/project-instructions.md).

## Two engines

The gate uses **Chromium when it finds one and has puppeteer to drive it** (marked `[browser]` in the output) — only then do the rules that need to measure boxes apply. Without a browser it falls back to jsdom, and those rules declare themselves unverifiable instead of approving in the dark. Everything else still applies.

```bash
npm install --no-save puppeteer            # PUPPETEER_SKIP_DOWNLOAD=1 if you already have a Chrome
PROTO_CHROME=/path/to/chrome node verify.js file.html
```

Having a Chromium is not enough on its own: without puppeteer the gate falls back to jsdom. The `[browser]` marker in the output is what tells you which engine applied — check it before trusting a green run.

## Map

| path | what it is |
|---|---|
| `proto.html` | the harness; copy it per prototype |
| `verify.js` | the command-line gate |
| `docs/` | harness instructions and the shipping rule |
| `catalog/` | the 128 components of `@12-apps/ui` and what each one demands in wiring |
| `scripts/generate-catalog.js` | regenerates the catalog from the installed package |
| `examples/` | a demo prototype, plus the product instructions and context it was built from |

## Component catalog

`catalog/` is generated, not hand-written. When `@12-apps/ui` changes version:

```bash
npm install @12-apps/ui
node scripts/generate-catalog.js
```

The harness checks the names used in `primitives` against the catalog, and does not invent an import path for a name that does not exist.

## License

Internal.
