# Several screens at once — why `views` is shaped this way

*The reference for the feature is [`CLAUDE.md`](../CLAUDE.md) and
[`project-instructions.md`](project-instructions.md). This is the record of the
decision behind it: what was tried, what it measured, and why the design
turned out to be the opposite of the obvious one.*

---

## The problem

A flow that needs two people cannot be specified one screen at a time. Someone
orders; someone else prepares it; each has to see what the other did. The whole
behaviour is what happens on the *other* screen, and a prototype that draws one
screen has nowhere to put it.

The data half of that was never the problem. `cfg.data_` is one mutable fixture
store and `window.fetch` is intercepted process-wide, so two screens calling the
same route already read the same record — and a write route that answers `200`
without changing the fixtures is already refused as a facade. Propagation was
never something to build; it was already forced.

## The obvious design, and what it measured

The obvious thing is to let the prototype draw the stage: render the three
screens side by side inside the single frame the harness already has. That was
built first, as a spike, and it worked — 23 assertions, nine of them
cross-screen, no failures. The choreography ran.

It also produced two warnings that turned out to be the whole story:

```
! a página "salao" desenha o MESMO arranjo em toda a escada (xxs…xlg) — coube, mas não respondeu
! salao: transborda na horizontal — 1502px, 1442px, 1342px (em xxs, xs, sm, md, lg, xlg)
```

Three devices pinned at their real widths cannot respond to the stage — a phone
view that reflows when the stage narrows has stopped being a phone view. And
`375 + 375 + 1024` overflows the widest rung by about 366px, at every rung.

Then the measurement that decided the design. Shrinking a touch target inside
the *phone* view and inside the *kitchen's desktop* view flagged both at exactly
the same rungs:

```
! alvo [data-act="recarregar-salao"] menor que 44px para toque — 30×24px (em xxs, xs, sm)   ← phone
! alvo [data-act="recarregar-fila"]  menor que 44px para toque — 30×24px (em xxs, xs, sm)   ← desktop
```

`measuresPhysical` decides whether the finger rule applies from `rung.w <= 480`,
and `rung` was the **stage's**. So the rule fired on a desktop view, where no
finger is, and stayed silent on the phones at `xlg` — the only rung wide enough
to see the stage at all. It never stopped running. It stopped corresponding to
anything, while printing output that read like it worked. That is the failure
mode [`test-enforcement.js`](../scripts/test-enforcement.js) exists to catch,
and no amount of care inside a prototype could have fixed it.

## The design that came out of it

**The prototype must never compose the stage.** It keeps rendering one screen;
the harness calls `mount` once per declared view, each inside a frame the width
of that view's own device.

Everything follows from that one inversion:

- a view is an **ordinary screen**, so every rule already written for one screen
  applies to it unchanged — the ladder, the arrangement, the physical
  measurements, the three states, the wiring, the journey. `rungSignature` walks
  the ladder per view and reads that view's frame, never the row of frames;
- the stage stops being measured, because nothing renders into it. It is only an
  arrangement of frames, scaled to fit with the `transform: scale()` that `fit()`
  already applied to a single frame. Measurement happens at true device widths;
  display is a separate concern, as it always was;
- the discipline is **multiplied** by the views rather than escaped by them.
  Three views owe three arrangements, three sets of touch targets, three
  loading/empty/error states — and the audit names them:
  `a vista "Cozinha" da página "salao"…`.

The two structural warnings did not have to be worked around. They dissolved.

## What had to be added, not just rearranged

Three things genuinely did not exist before, because one screen cannot express
them:

**An addressee.** `on:"cozinha"` beside the `click`. With two screens open the
same control can be on both, so an action without it is refused. It carries into
the `.feature` as `Quando [cozinha] …`, which is what makes the export read as a
script with parts.

**A reader.** `on:` on an `Então` scopes `el` to one view; `state.views` reaches
the others, so one assertion can say *the customer saw it change* and *the
kitchen did not move*.

**The choreography itself.** `propagates:[…]` names the views a step must
change; `unchanged:[…]` the ones it must not. The harness holds both renderings
and compares them. The second is the harder half and the reason the feature is
worth having: *the kitchen is done with this plate, and whether it is already on
the table is not its business.* A prototype with several views and no such step
is called out — it drew the screens without specifying the thing that made them
worth drawing together.

Two smaller ones, both consequences of "one screen" being baked in deeper than
it looked: `state.can(…)` now answers for the view's `actor`, because several
roles are on the bench at once and "the role" stopped being one answer; and
`waitingFor()` is per view, because one screen's pending request was putting the
others into a skeleton they had no reason to show.

## The bug worth remembering

Callers build their `shown` state object *before* they know which view it is
for, so it carries the stage's answers — `view: null`, and the rung and width of
the bench. Spreading that over the per-view state silently won, and every view
drew as the first one and measured at somebody else's width. The painter
re-stamps `view`, `rung` and `widthPx` after the merge. Everything looked
plausible until it didn't; there is no way to notice it from the output.

## What holds it

[`scripts/test-multiview.js`](../scripts/test-multiview.js) boots the engine in
jsdom and feeds it prototypes that are wrong on purpose: a propagation that
never arrives, a screen declared unchanged that moved, a step that does not say
where it acts, a view nobody operates, a view that never reaches a state. Each
must be caught. It also carries the negative controls that matter more than the
positive ones — a correct propagation must **not** be reported, and a
single-screen prototype must see none of these rules at all.

The regression bar for the whole change is that `product-editor` still reports
`68 ok · 0 failing · 0 warning(s) · handlers 9/9`, unchanged. Declaring no
`views` takes the same code path it always did.
