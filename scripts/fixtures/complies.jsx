/* Fixture: a prototype that obeys the rule. Composition of its own
   components is allowed; only raw HTML is not. Every component that exists
   to be operated carries a hook, and every hook has a handler answering it. */
import { Box } from "@12-apps/ui/mui/Box";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Button } from "@12-apps/ui/form/Button";
import { Input } from "@12-apps/ui/form/Input";

function Row({ label }){
  return (
    <Box>
      <Button data-act="open">{label}</Button>
      {/* MUI puts the real input behind a slot, so the hook rides in the
          props object rather than as an attribute — the check reads both */}
      <Input slotProps={{ htmlInput: { "data-campo": "busca" } }} />
    </Box>
  );
}

export default function Screen(){
  return (
    <Box>
      <Heading>Itens</Heading>
      <Row label="abrir" />
    </Box>
  );
}

Proto.on("click", '[data-act="open"]', () => {});
Proto.on("input", '[data-campo="busca"]', () => {});
