# What this prototype is for

`salao-comanda` is a **spike**, not a finished screen. It exists to measure what
a multi-actor, multi-device prototype collides with in the harness as it stands,
so that [`docs/multi-device-views.md`](../../docs/multi-device-views.md) argues
from measurements instead of from reading the engine.

It is a real prototype and it passes the gate. Run it:

```bash
node verify.js apps/salao-comanda
# ✓ salao-comanda — 23 ok · 0 failing · 2 warning(s) · handlers 6/6  [browser]
#   ! a página "salao" desenha o MESMO arranjo em toda a escada (…) — coube, mas não respondeu
#   ! salao: transborda na horizontal — 1502px, 1442px, 1342px (em xxs, xs, sm, md, lg, xlg)
```

## What it demonstrates

One order, read by three actors — the customer's phone, the waiter's phone and
the kitchen's screen — side by side inside the single frame the harness draws.
The kitchen starts the order; the customer and the waiter see it. The kitchen
finishes it; the waiter is called to fetch it. The waiter delivers; the customer
sees it arrive and the kitchen's board does not move.

Nothing in `app.jsx` sends a message between the views. Every view reads the same
record through the same routes, so the shared fixture **is** the propagation.
That is the half of this problem the harness already solves.

## The two warnings are the finding

Both are structural, not sloppiness:

- **the same arrangement on every rung** — three views pinned at their real
  device widths cannot respond to the stage's width, because a phone view that
  reflows when the stage narrows is no longer a phone view;
- **horizontal overflow at every rung** — 375 + 375 + 1024 plus gaps is about
  1806px, and the widest rung on the ladder is 1440.

## The experiment worth re-running

The measurement rules are decided by the **stage's** ladder rung, not by the
width of the view a control lives in. To see it, shrink a touch target in the
phone views only:

```css
.vista.telefone .btn { min-height:24px; height:24px; min-width:30px; width:30px; padding:0 }
```

```
! salao: alvo [data-act="recarregar-salao"] menor que 44px para toque — 30×24px (em xxs, xs, sm)
```

Then do the same in the kitchen's desktop view (`.vista.mesa .btn`) and read the
rungs again:

```
! salao: alvo [data-act="recarregar-fila"] menor que 44px para toque — 30×24px (em xxs, xs, sm)
```

Identical. The finger rule fires on the desktop view, where no finger is, and
stays silent on the phone views at `xlg` — the only rung at which the stage is
wide enough to look at. The rule does not stop running; it stops meaning
anything.

## What the prototype had to hand-roll

`app.jsx` carries `erroCliente`, `erroGarcom` and `erroCozinha` as separate
fields. A single `app.error_` cannot say *the customer's screen is down and the
kitchen's is fine* — `[data-estado]`, `AsyncStateContainer` and `waitingFor()`
all describe one screen. Three screens need three of everything, by hand.
