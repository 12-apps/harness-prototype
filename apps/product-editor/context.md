# Paladira — Context

*(Reference for the project knowledge. The rules live in the instructions; the why lives here.)*

---

## 1. The product

Paladira is a multi-shop platform for food and retail in Brazil. A shop runs its entire operation through it, and the surface splits into three:

**Storefront** — menu by category and subcategory, highlights, product sheet with variations and paid extras, favourites, cart, mesa or balcão, comanda, call a garçom, checkout, history.

**Admin** — catalog and product editor, categories, stock and ingredients, fichas técnicas, kitchen and its stations, mesas and sectors, deliveries and couriers, orders, payments, team and roles, reports, plan, marketplaces, branding.

**Operation** — the kitchen panel, the garçom's screen, the delivery board. Aimed at people who are working, live, by shift.

Shops vary a lot and the UI has to hold all of them: a restaurant with mesas and a kitchen, a bar that only sells drinks, a shop with no kitchen at all. That is what the context dimensions exist for.

## 2. Vocabulary

The domain terms stay Portuguese, in the product and in these docs.

| term | is |
|---|---|
| loja / tenant | a shop |
| mesa | a table in the dining room |
| comanda | the table's shared bill: order first, pay later |
| balcão | takeaway, no table |
| pedido | what goes to the kitchen |
| cardápio | the public menu |
| ficha técnica | the product's recipe |
| ingrediente | raw material (RAW) or sub-recipe (PREP) |
| variação | size, flavour |
| extras pagos | paid add-ons |
| destaques | the featured shelf |
| cozinha / estação | where things are prepared (Grelha, Fritura…) |
| estoque | stock, per location |
| entrega / corrida | the delivery and the courier's run |
| garçom | waiter |
| turno | work shift |

There is a Paladira MCP connected to the project with the real API. When you need the true shape of an entity — product fields, the states of a run, what comes back in a comanda — read it from there instead of inventing it. A prototype that matches the real model is worth far more.

## 3. The central idea

**The prototype is the specification.** It is not a picture of what will be built: it is the contract, executable, with real Gherkin scenarios and every `Então` checked against the DOM. Whoever implements it receives the `.feature` with the component, route and module hints, and the `@12-apps/ui` imports already resolved.

Almost everything follows from that: if the prototype is the specification, it cannot lie. It cannot say "salvo" without storing, it cannot have a button that does nothing, it cannot have a screen nobody knows how to reach, and it cannot claim to be responsive because it fit.

## 4. What verification demands, and why

| rule | exists because |
|---|---|
| a journey with 2+ actions, a `Então` after acting | `Dado … Então` with no action is a screenshot with a caption |
| the `@feliz` / `@conflito` / `@recuperacao` / `@retorno` types | a happy-path-only suite is half a specification |
| three states per page, as a step of the journey | loading, empty and error are paths the user meets |
| every route from both ends, every call born from a step | error handling discovered in production is expensive |
| a write route has to change the fixtures | 200 without storing is a facade; a reload contradicts it |
| a label that promises to store has to store | a *Salvar* that does not save is the costliest lie in the UI |
| an affordance needs a handler; a handler needs a step | dead buttons and uncovered behaviour |
| `strictMode` demands markup claimed by a component | avoids rebuilding in production what the library already has |
| a different arrangement per rung, 44px target, 12px text, 75ch line | "it fit" is not the same as "it works" |

The escapes (`local`, `noNetwork`, `onLoad`, `journey:false`, `states:false`, `coveredRoutes:false`) exist because real exceptions exist. Each one is an explicit declaration, and some are checked: `local: true` on a control called *Salvar* still gets called out.

## 5. UX decisions already settled

Do not relitigate without a reason.

**Category selector.** The subcategory is the selectable item; the parent category is a header by default, with the option of becoming selectable in three states. Everything expanded on open, no product counts, no chips on the trigger. Accent-insensitive search with the term highlighted and the hierarchy preserved. Selected items pinned to the top. Draft + Apply; Esc discards. A footer with a live count and a Clear that disables itself. Full keyboard support. Below 480px it becomes a bottom sheet with 42px rows.

**Payment provider.** OAuth is the default state, not a choice offered up front; manual keys are a discreet escape inside the panel, and the two never appear together. The action bar sticks to the end of the panel being filled in. Removing a connection is a modal with the consequence written out and a "just pause" exit. `ativado` and `recebendo` are distinct states.

**General.** The primary action comes after the form it confirms. Destructive actions carry an explicit consequence and an escape. A completed state does not undo itself because of an unrelated toggle.

## 6. Traps that have already cost time

- **A permanent scrim.** A backdrop rendered outside the "panel open" condition covers the screen and eats every click. The cause is invisible.
- **A missing `<!DOCTYPE html>`.** Quirks mode breaks container queries while looking like a CSS bug.
- **Querying the DOM before the first paint.** Null deref — the most frequent bug here.
- **A function lost in a large replacement.** After swapping blocks, check the list of functions.
- **`@media` inside the frame.** It responds to the window, not the frame; the width selector stops meaning anything. Use `@container`.
- **Measuring an element outside the document.** `getComputedStyle` returns empty — and empty looks just like "does not change on any rung".
- **An optimisation that skips an effect.** A cache that hands back ready state without redoing the step means the request never happens: it vanishes from the monitor, and so does the loading state.

## 7. How we work

Long, iterative sessions, five to fifteen rounds on the same file. Short, direct feedback; you are expected to infer the scope and execute.

Conversations have been lost midway before — which is why the harness and these decisions live in the project knowledge, not in the history. The harness is a file, not a description: descriptions drift, files do not.
