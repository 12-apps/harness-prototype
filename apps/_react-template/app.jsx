/* A prototype: React, and every element comes from the design system.
   The harness has a mount hook, so it needs no knowledge of React. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Box } from "@12-apps/ui/mui/Box";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Button } from "@12-apps/ui/form/Button";

/* One React root per element the harness hands us. It renders into throwaway
   probes as well as the stage, and it may clobber a probe's DOM between
   passes while scanning — so a root that can no longer render gets replaced. */
const roots = new WeakMap();
function rootFor(el){
  let r = roots.get(el);
  if (!r){ r = createRoot(el); roots.set(el, r); }
  return r;
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
