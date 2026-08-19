/* A prototype: React, and every element comes from the design system.
   The harness has a mount hook, so it needs no knowledge of React. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Box } from "@12-apps/ui/mui/Box";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Button } from "@12-apps/ui/form/Button";

/* One React root per element the harness hands us, rendering into a container
   of its own — never straight into the harness's element. The suite draws into
   throwaway probes and clears them between passes; React would otherwise try to
   remove nodes that are no longer its children and throw NotFoundError on
   commit, asynchronously, where a try/catch around render cannot reach it.

   replaceChildren is what keeps it to exactly one: the harness does not clear
   the element before calling mount — it expects mount to own it — so appending
   a container per call silently stacked 25 rendered screens in one probe, and
   the audit then found an error mark belonging to a scenario that had finished
   long before. `display:contents` keeps the container out of layout, so the
   width rules still measure the real boxes. */
const roots = new WeakMap();
function rootFor(el){
  const entry = roots.get(el);
  if (entry && entry.host.parentNode === el) return entry.root;
  const host = document.createElement("div");
  host.style.display = "contents";
  el.replaceChildren(host);
  const root = createRoot(host);
  roots.set(el, { host, root });
  return root;
}

function Screen({ s }){
  return (
    <Box className="screen">
      <Heading>Itens</Heading>
      <Button data-act="recarregar">Recarregar</Button>
    </Box>
  );
}

Proto.init({
  title: "react demo",
  context: [],
  data_:  window.PROTO_DATA,
  routes: window.PROTO_ROUTES,
  scenarios: [],

  /* flushSync, not render: the harness measures the DOM on the very next
     line, and a concurrent commit would not be there yet. */
  mount: (el, state) => {
    const draw = () => flushSync(() => rootFor(el).render(<Screen s={state} />));
    try { draw(); }
    catch { roots.delete(el); draw(); }
  }
});
