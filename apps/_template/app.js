/* Context, scenarios and render — the specification itself.
   Loaded after data.js, so PROTO_DATA and PROTO_ROUTES already exist.

   The gate wants a journey, not a loose assertion: at least two actions on
   different targets, a Then after the last one, every page reachable from
   another screen, and @carregando / @vazio / @erro per page.
   docs/project-instructions.md has the full list; apps/product-editor is a
   worked example. */

Proto.init({
  title: "prototype",

  /* axes that change what the screen offers: { id, label, kind, value, options } */
  context: [],

  data_:  window.PROTO_DATA,
  routes: window.PROTO_ROUTES,

  scenarios: [],

  render: () => `
    <div class="empty">
      <h1>Empty bench</h1>
      <p>Write the prototype in this app's three files.</p>
    </div>`
});

/* Delegated handlers survive a re-render, and a step's `click` runs these:
     Proto.on("click", '[data-act="save"]', async (e, el, s) => { … }); */
