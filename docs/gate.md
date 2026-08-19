# Verification gate — the shipping rule

**No prototype ships without passing this.** It applies to me, to you, and to any agent that edits the file.

```bash
npm install jsdom                              # once per session
node verify.js apps/<thing>
node verify.js apps/<thing> --strict
```

Add `--export <dir>` to write the handoff files — the `.feature`, `api.md` and the
prototype itself — when, and only when, the run passes.

| exit | means | what to do |
|---|---|---|
| `0` | passed | you can ship |
| `1` | there are failures | **do not ship** — the report goes to stderr, fix it and run again |
| `2` | passed with warnings and `--strict` was on | cover it or accept the debt |
| `3` | the file did not load | a syntax error, or it is not a harness prototype |

## What it rejects in the source, before a browser starts

A React prototype (`app.jsx`) is read as source first. These fail at exit `1`
without the suite ever running, because by the time the screen exists it is too
late to tell: once `<Button>` renders, the design system emits a real `<button>`
and nothing downstream can distinguish it from one an agent typed.

| kind | what it catches |
|---|---|
| `raw-html` | **any** lowercase JSX element — `<div>`, `<span>`, `<button>`, `<marquee>`, a web component. Not a blocklist: the check is "does the tag start lowercase". Fragments (`<>…</>`) are fine, they are not elements |
| `foreign-import` | a component from anywhere but `@12-apps/ui` |
| `not-in-catalog` | a name that is not in `catalog/ui-catalog.md` |
| `wrong-path` | the right name imported from the wrong subpath |
| `unknown-component` | `<Foo>` used but never imported |
| `unwired-component` | an `exige` component with no `data-act`, no `data-campo`, no `on…` prop and no `href` — an affordance that does nothing |
| `hook-without-handler` | a `data-act` / `data-campo` no `Proto.on` answers |
| `handler-without-hook` | a `Proto.on` for a hook no element carries |

The last three come from `catalog/ui-interactions.js`, which classifies every
component as `exige` (always operable), `pode` (operable if given a handler) or
`nunca` (inert). Only `exige` is enforced here; `pode` is left to the runtime
audit, which decides from the rendered DOM, and `nunca` has nothing to demand.

Components you define yourself are fine — composing design-system parts into a
screen is the job. Two things the source cannot see are deliberately not
accused: a hook built at runtime (`data-act={id}`) and one arriving through a
spread. The runtime audit covers both.

`docs/project-instructions.md` has the agent-facing version of all of this, with
the fixes rather than just the failures.

> **These checks apply to `app.jsx` only.** A vanilla `app.js` prototype builds
> its screen from template strings, and none of the above runs against it — raw
> HTML in an `app.js` passes the gate. Write prototypes as `app.jsx`.

## Two engines

The output says which one ran:

```
✓ product-editor.html — 68 ok · 0 failing · 0 warning(s) · handlers 9/9  [browser]
```

**With `[browser]`** — it found a Chromium and ran the suite inside it. Only then do the rules that depend on measuring boxes apply: per-rung arrangement, overflow, touch target, text size, line length. It looks in this order: `PROTO_CHROME`, the Puppeteer cache, `/opt/pw-browsers`, `/usr/bin/chromium`. **It also needs puppeteer installed** to drive the browser — finding the Chromium is not enough on its own.

**Without the marker** — it fell back to jsdom, which resolves the DOM but does no layout: `@container` never matches. The measurement rules declare themselves unverifiable instead of approving in the dark. Everything else (journeys, routes, states, permissions, disappearing content) still applies.

Either engine loads `proto.html?app=<name>` and lets the bench pull in the app's three files. jsdom does that with `resources: "usable"` over a `file://` url, so run the gate from the repo, where those relative paths resolve. A single-file bundle produced by `--export` needs none of that and can be checked anywhere.

To force a specific browser:

```bash
PROTO_CHROME=/path/to/chrome node verify.js file.html
```

## In CI

`.github/workflows/gate.yml` runs the gate on every pull request and on pushes to `main`. The runner ships a Chromium and the workflow installs puppeteer alongside jsdom, so CI runs in `[browser]` mode and the measurement rules count there.

It verifies every app under `apps/` and fails if it finds none. It skips folders whose name starts with `_`: the starter is empty and would only ever report `0 ok`, and a green that counts nothing is worse than no check at all.

Two failure modes are worth knowing about, because both once made this gate approve anything:

- `verifyAll()` is async. Calling it without `await` yields the pending Promise, whose `bad` is `undefined` — a falsy value that reads as "no failures".
- The browser path needs a Chromium **and** puppeteer. With only one of the two, the gate silently drops to jsdom and the measurement rules stop applying.

A green run that prints `undefined ok · undefined failing`, or that is missing the `[browser]` marker where you expected it, is not a pass. Read the counters, not just the checkmark.
