/* Fixture: a prototype that obeys the rule. Composition of its own
   components is allowed; only raw HTML is not. Every component that exists
   to be operated carries a hook, and every hook has a handler answering it. */
import { Box } from "@12-apps/ui/mui/Box";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Button } from "@12-apps/ui/form/Button";
import { Input } from "@12-apps/ui/form/Input";
import { Card } from "@12-apps/ui/layout/Card";
import { CardContent } from "@12-apps/ui/layout/Card";
import { Form } from "@12-apps/ui/form/Form";

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
      {/* a compound composed with its parts, including one nested a level down */}
      <Card><CardContent><Heading>direto</Heading></CardContent></Card>
      <Card><Box><CardContent><Heading>aninhado</Heading></CardContent></Box></Card>
      {/* children the source cannot see are not accused */}
      <Card>{slot()}</Card>
      {/* and Form is NOT a checked compound: no part of it carries structure,
          so a Form holding its fields directly is exactly right */}
      <Form data-act="save"><Input slotProps={{ htmlInput: { "data-campo": "nome" } }} /></Form>
    </Box>
  );
}

function slot(){ return null; }

Proto.on("click", '[data-act="open"]', () => {});
Proto.on("input", '[data-campo="busca"]', () => {});
Proto.on("click", '[data-act="save"]', () => {});
Proto.on("input", '[data-campo="nome"]', () => {});
