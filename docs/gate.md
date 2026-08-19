# Verification gate — the shipping rule

**No prototype ships without passing this.** It applies to me, to you, and to any agent that edits the file.

```bash
npm install jsdom                              # once per session
node verify.js <thing>.html
node verify.js <thing>.html --strict
```

| exit | means | what to do |
|---|---|---|
| `0` | passed | you can ship |
| `1` | there are failures | **do not ship** — the report goes to stderr, fix it and run again |
| `2` | passed with warnings and `--strict` was on | cover it or accept the debt |
| `3` | the file did not load | a syntax error, or it is not a harness prototype |

## Two engines

The output says which one ran:

```
✓ product-editor.html — 68 ok · 0 failing · 0 warning(s) · handlers 9/9  [browser]
```

**With `[browser]`** — it found a Chromium and ran the suite inside it. Only then do the rules that depend on measuring boxes apply: per-rung arrangement, overflow, touch target, text size, line length. It looks in this order: `PROTO_CHROME`, the Puppeteer cache, `/opt/pw-browsers`, `/usr/bin/chromium`. **It also needs puppeteer installed** to drive the browser — finding the Chromium is not enough on its own.

**Without the marker** — it fell back to jsdom, which resolves the DOM but does no layout: `@container` never matches. The measurement rules declare themselves unverifiable instead of approving in the dark. Everything else (journeys, routes, states, permissions, disappearing content) still applies.

To force a specific browser:

```bash
PROTO_CHROME=/path/to/chrome node verify.js file.html
```

## In CI

`.github/workflows/gate.yml` runs the gate on every pull request and on pushes to `main`. The runner ships a Chromium and the workflow installs puppeteer alongside jsdom, so CI runs in `[browser]` mode and the measurement rules count there.

It verifies every prototype it finds — `examples/`, and anything copied to the repo root — and fails if it finds none. It skips `proto.html`, which is the bench itself: with empty zones the gate passes it with `0 ok`, and a green that counts nothing is worse than no check at all.

Two failure modes are worth knowing about, because both once made this gate approve anything:

- `verifyAll()` is async. Calling it without `await` yields the pending Promise, whose `bad` is `undefined` — a falsy value that reads as "no failures".
- The browser path needs a Chromium **and** puppeteer. With only one of the two, the gate silently drops to jsdom and the measurement rules stop applying.

A green run that prints `undefined ok · undefined failing`, or that is missing the `[browser]` marker where you expected it, is not a pass. Read the counters, not just the checkmark.
