# Paladira — Product Instructions

*(An example of a product's own instructions. Paste these alongside
[`docs/project-instructions.md`](../docs/project-instructions.md), which covers the
harness itself and applies to every prototype regardless of product.)*

This file exists to show the split: everything here is true of **this** product and
nothing else. The harness has no opinion on any of it.

---

## What it is

Paladira is a platform for Brazilian food and retail shops: menu, catalog, tables and
tabs, kitchen, stock, deliveries, payments, team and reports. The `why` behind it,
its vocabulary and its settled UX decisions are in [`context.md`](context.md).

## Interface language

**Every interface string is Brazilian Portuguese.** Never write UI in English, not
even as a draft. Domain terms stay in Portuguese: mesa, comanda, pedido, cardápio,
ficha técnica, estoque, entrega, garçom.

Scenario prose follows the interface, so the scenarios carry `# language: pt` and are
written in Portuguese. The harness's own vocabulary is unaffected — the keys, the
journey tags (`@feliz`, `@conflito`, `@recuperacao`, `@retorno`) and the state tags
(`@carregando`, `@vazio`, `@erro`) are spelled the same in every prototype.

## Context dimensions

This product's axes, declared in the `▼ APP ▼` zone:

- `kind:"escala"` — the subscription plan, free → ultra. `@pro` applies from Pro
  upwards.
- `kind:"opcao"` — the signed-in role. `@garcom` applies only to the waiter.
- `kind:"flags"` — switchable features. `@cozinha` requires the kitchen to be on.

Permissions are granted by options (`allows:[…]`) and demanded by scenarios with
`@pode:produto.editar`. The plan enables and the role authorises, so a scenario only
runs where both agree.

## Components

Use `@12-apps/ui`. The 128 components are catalogued in
[`../catalog/ui-catalog.md`](../catalog/ui-catalog.md), with what each demands in
wiring in [`../catalog/ui-interactions.md`](../catalog/ui-interactions.md). Never
write a hex value when a token exists.
