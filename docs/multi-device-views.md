# Simultaneous views — feasibility, effort, risk, strategy

*An assessment of showing one flow on several devices at once — a customer's
phone, a waiter's phone and a kitchen screen watching the same order — with the
answers measured against the harness rather than argued from it.*

---

## The verdict in one paragraph

**The behaviour half is already done; the device half is the whole job.** Three
actors sharing one record, propagating through one data layer, with assertions
that cross from one actor's screen to another's, needs **no change to the
harness at all** — it was built and it passes the gate. What does not work is
the *device*: the harness draws one frame at one width, and every measurement
rule it has decides what to apply from that single width. Put three devices on
that one stage and the width discipline does not fail loudly — it keeps
producing output that no longer corresponds to anything. That is the risk worth
managing, and it decides the strategy.

---

## What was measured

[`apps/salao-comanda/`](../apps/salao-comanda/) is a working spike: one order,
three views, side by side in the single frame. The kitchen starts the order, the
customer and waiter see it change, the kitchen completes it, the waiter is
called, the waiter delivers, the customer sees it arrive and the kitchen's board
does not move. Exactly the choreography in the request.

```
✓ salao-comanda — 23 ok · 0 failing · 2 warning(s) · handlers 6/6  [browser]
  ! a página "salao" desenha o MESMO arranjo em toda a escada (xxs…xlg) — coube, mas não respondeu
  ! salao: transborda na horizontal — 1502px, 1442px, 1342px (em xxs, xs, sm, md, lg, xlg)
```

Twenty-three assertions, nine of them cross-actor, every handler covered, no
failures. The two remaining warnings are both about width, and both are
structural.

---

## Why the data half is free

The intuition in the request is right, and it is right for a specific reason:

- **`cfg.data_` is one mutable fixture store, and `window.fetch` is intercepted
  process-wide** (`installNetwork`, harness.js:711). Every view calling
  `GET /api/cozinha/fila` hits the same object. There is no per-view data
  isolation to dismantle.
- **A write route must change the fixtures or the gate calls it a facade**
  (harness.js:800). So propagation is not something a multi-view prototype adds
  — it is something the existing rule already forces.
- **`cfg.mount(el, state)` is already called against arbitrary elements** — the
  live `#app`, the action probe, the audit probe, the per-rung layout probe.
  Rendering N views is the existing capability called N times.
- **Rendering at a forced width is already routine.** `rungSignature` draws the
  same state at six widths into an off-screen probe every verification run
  (harness.js:1871). Display is already decoupled from measurement: `fit()`
  renders the frame at its true width and applies `transform: scale()`.

In the spike, nothing sends a message between views. `recarregarTudo()` re-reads
the three routes after any write, and the shared fixture does the rest.

---

## Why the device half is the whole problem

### 1. One frame, one width — and three devices do not fit

`fit()` sizes a single `#h-frame` and `state.rung` is one global value derived
from it. Two phones and a kitchen screen is `375 + 375 + 1024` plus gaps ≈
**1806px**; the widest rung on the ladder is **1440**. The stage overflows at
every rung, including the one you would actually use.

### 2. The measurement rules read the stage, not the view

This is the finding that matters. In `measuresPhysical` (harness.js:1806):

```js
const narrow = rung.w <= 480;
if (narrow && (r.height < 44 || r.width < 44)) …
```

`rung` is the **stage's** rung. Shrinking a touch target inside a *phone* view
and inside the *kitchen's desktop* view produces the identical result:

```
! alvo [data-act="recarregar-salao"] menor que 44px para toque — 30×24px (em xxs, xs, sm)   ← phone view
! alvo [data-act="recarregar-fila"]  menor que 44px para toque — 30×24px (em xxs, xs, sm)   ← desktop view
```

The finger rule fires on the desktop view, where no finger is, and is silent on
the phone views at `xlg` — the only rung wide enough to see the stage. It does
not stop running. It stops corresponding to anything, while still printing
output that reads like it works. `scripts/test-enforcement.js` exists because
that failure mode has happened before.

`layoutSignature` has the same shape: it hashes the whole root, so three views
collapse into one signature and "did this page respond to width" becomes
unanswerable.

### 3. The step has no addressee

`{ when:"…", click:'[data-act="iniciar"]' }` is a global selector. The spike
works around it with `'[data-view="cozinha"] [data-act="iniciar"]'`, which runs
correctly — but the exported `.feature`, which is the actual deliverable, cannot
say *the kitchen* did this. A multi-actor specification whose Gherkin does not
name the actor has lost the thing that made it worth writing.

### 4. One page means one of everything

`pageOf(app)` returns `app.page` — a single value. Collapsing three actors into
one page makes rules **weaker**, quietly:

- `@carregando` / `@vazio` / `@erro` are owed once, not once per actor;
- the "every page needs an entry journey" rule is skipped outright when there is
  only one page (`Object.keys(pages).length > 1`, harness.js:2301);
- `@retorno` becomes inexpressible — there is nowhere to return from.

The spike also had to hand-roll `erroCliente` / `erroGarcom` / `erroCozinha`,
because one `app.error_`, one `[data-estado]` and one global `waitingFor()`
cannot say *the customer's screen is down and the kitchen's is fine*.

---

## Effort

Sized by touch points in a 3,900-line engine, not by invented days. The work is
threading one invariant — *there is one screen* — into *there are N*.

| | what it is | size | dominated by |
|---|---|---|---|
| **Tier 0** | a multi-actor prototype in userland, no engine change | **S** | already done — `apps/salao-comanda` |
| **Tier 1** | real per-device frames and per-view measurement | **M–L** | ~13 sites, two of them genuinely hard |
| **Tier 2** | rules that understand actors and propagation | **M** | new rule design, not plumbing |

**Tier 1's thirteen sites.** Mechanical: the shell markup, `fit()`, `vp()`,
`state.rung` / `state.widthPx`, `network.inFlightScreen` → `waitingFor()`,
`pageOf`, `gherkin()`, `buildSidebar`/`stepRow`, `encodeHash`/`applyHash`.
Genuinely hard, and where the schedule will actually go:

- **per-view measurement** — `rungSignature`, `layoutSignature`,
  `measuresPhysical` and `offerOf` must each run against one view at that
  view's own width, not the stage's;
- **cache keying** — `buildStateInternal`'s memo key ends in a single width
  (`s.id|axis|k|ctxSig|wid`, harness.js:1305). With per-view widths this key is
  wrong, and it is wrong *silently*: it serves a state built at the wrong
  widths.

**Tier 2** is where the value is. Once views are first-class, the harness can
check the thing that makes them interesting, which no existing rule covers:
*the kitchen acted — did the customer's view change?* and its inverse, which the
request asks for by name: *the kitchen's board did not move.* The engine has
both DOMs before and after; nothing but the missing view concept stops it.

---

## Risks, worst first

1. **Silent rule decay.** Measured above: the width rules keep printing, having
   stopped meaning anything. *Mitigation: write the enforcement cases first.* Add
   multi-view fixtures to `scripts/test-enforcement.js` — a too-small target
   inside a phone view **must** fail — before the feature exists.
2. **Every prototype pays for a feature few use.** *Mitigation: absent `views`
   takes today's exact code path, not an equivalent one.* `product-editor` must
   still report `68 ok · 0 failing · 0 warning(s)` unchanged.
3. **Verification cost multiplies.** The arrangement pass is already
   scenarios × rows × 6 rungs, and it runs on every file open (`verifyOnOpen`).
   *Mitigation: walk the ladder for the view under test only; never
   cross-product the views.*
4. **An unreadable specification.** Three actors interleaved in one `.feature` is
   the deliverable, and it can easily become unreadable. *Mitigation: the
   addressee belongs in the step prose and in the export, not only in a key. If
   the exported feature does not read like a screenplay, the feature has failed
   whatever the code does.*
5. **The 3-device / 2-phone limit will leak.** The fourth actor — a POS, a
   manager's dashboard, a pickup display — arrives soon after the third.
   *Mitigation: do not encode "3" or "two must be phones" in the engine.* Make it
   the default template. The real constraint is stage width, and it is better
   expressed as one.
6. **Role stops being a global dimension.** `kind:"opcao"` with `allows:[…]`
   assumes one active role: `contextOf`, `reasons` and `state.can` all read one
   answer. Multi-view puts three roles on screen at once. *Mitigation: a view
   declares its actor and `can()` becomes view-scoped inside `mount`, while the
   global dimension keeps meaning "who is operating the bench".* This is a
   conceptual decision, not plumbing, and it is expensive to reverse.

---

## Strategy

**The framing that makes this tractable: a multi-view prototype is N ordinary
screens plus a choreography.** Not one wide screen. Get that right and none of
the existing discipline has to be weakened — it applies per view, exactly as it
does today, and the choreography gets new rules of its own.

Concretely, the ladder should keep walking **each view** from `xxs` to `xlg` —
the customer's phone is a real responsive screen and still owes an arrangement
at every rung. The stage is only an arrangement of frames and should never be
measured as a screen.

**Reuse `fit()`'s existing trick.** Each frame renders at its true device width
and is scaled down with `transform: scale()` to fit the stage. Measurement then
happens at the true width — which is what makes rule 2 correct rather than
merely quieter — and display is a separate concern. The harness already
separates these; nothing new is needed.

Sequence:

1. **Freeze the specification shape on the spike, before touching the engine.**
   `apps/salao-comanda` already runs the full choreography. Decide the step
   addressee (`on:"cozinha"`), the view-scoped `check`, and what the `.feature`
   should read like — and get those agreed while they are still cheap to change.
2. **Write the enforcement cases.** Multi-view fixtures in
   `scripts/test-enforcement.js` that fail today and must fail after. Risk 1 is
   the one that ruins this feature, and this is the only thing that holds it.
3. **Tier 1, behind an opt-in `views` key.** Per-view frames, per-view widths,
   per-view measurement. Regression bar: `product-editor` unchanged at
   `68 ok · 0 failing · 0 warning(s)`, and the spike converted to real frames
   with the two structural warnings **gone** — that is the acceptance test, and
   it is precise.
4. **Tier 2: propagation as a rule.** Positive and negative — *the customer saw
   it* and *the kitchen did not move*. This is the only part that adds something
   the harness cannot express today, and it is why the feature is worth
   building rather than working around.

The spike is not throwaway. It is the regression fixture for steps 3 and 4: the
same journey, the same assertions, re-run after every engine change. That is the
cheapest available insurance against the failure mode that matters, and it is
already paid for.
