# The worked reference for `views`

Three people watch one order: the customer on a phone, the waiter on a phone,
the kitchen on a screen at the pass. The kitchen starts it and the other two
see it; the kitchen finishes and the waiter is called; the waiter delivers, the
customer sees it arrive — **and the kitchen's board does not move**, because the
pass is done with a plate once it has left it.

```bash
node verify.js apps/multi-view-demo
# ✓ multi-view-demo — 30 ok · 0 failing · 0 warning(s) · handlers 6/6  [browser]
```

## What to read it for

**`app.jsx` draws one screen.** There is no stage in this file and nothing in it
knows the other views exist. `views` declares who is watching; the harness calls
`mount` once per view and `state.view` says which one it is asking for. The
three view components are three ordinary screens.

**`styles.css` is ordinary too** — plain `@container` rules against `frame`,
because each view's own frame is the container. Each view is walked across the
whole ladder, so each owes an arrangement, a measure for its prose and
finger-sized targets, exactly like a single-screen prototype.

**The choreography is on the steps.** In `comanda-ciclo`:

```js
{ when:"o garçom entrega na mesa", on:"garcom", click:'[data-act="entregar"]',
  propagates:["cliente","garcom"], unchanged:["cozinha"] }
```

That last clause is the one worth the whole feature, and it is checked: break it
by giving the kitchen a separate "Entregues" lane and the gate says
`a vista "cozinha" mudou depois deste passo`.

**Nothing sends a message between the views.** Every view reads the same record
through the same routes, so the shared fixture *is* the propagation — the
handlers just re-read after a write.

## What it still does by hand

`app` is one state object, so the per-view error fields (`erroCliente`,
`erroGarcom`, `erroCozinha`) are held by hand: one `error_` cannot say *the
customer's screen is down and the kitchen's is fine*. `waitingFor()` is per view
in the harness, but which view an error belongs to is the prototype's own
bookkeeping.
