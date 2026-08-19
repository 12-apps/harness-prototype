/* Fixture: a prototype that obeys the rule. Composition of its own
   components is allowed; only raw HTML is not. */
import { Box } from "@12-apps/ui/mui/Box";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Button } from "@12-apps/ui/form/Button";

function Row({ label }){
  return <Box><Button data-act="open">{label}</Button></Box>;
}

export default function Screen(){
  return (
    <Box>
      <Heading>Itens</Heading>
      <Row label="abrir" />
    </Box>
  );
}
