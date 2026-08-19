/* Fixture: every violation the component rule is supposed to catch.
   scripts/test-enforcement.js asserts each one is still reported. */
import { Button } from "@12-apps/ui/form/Button";
import { Sonner } from "@12-apps/ui/feedback/Sonner";
import { Card } from "@12-apps/ui/layout/Kard";
import { CollapsibleTrigger } from "@12-apps/ui/layout/Collapsible";
import { Thing } from "some-other-lib";
import { Text } from "@12-apps/ui/typography/Text";

export default function Screen(){
  return (
    <>
      <button data-act="x">raw</button>
      <div><p>also raw</p></div>
      <Button data-act="pay">fine</Button>
      {/* "exige" and nothing to operate: an affordance with no behaviour */}
      <CollapsibleTrigger />
      <Thing /><Card /><Sonner /><Missing />
      {/* raw HTML that is never a JSX tag: the tag picked by a prop, */}
      <Text component="b">bold by prop</Text>
      {/* markup injected as a string, */}
      <Button dangerouslySetInnerHTML={{ __html: "<b>x</b>" }} data-act="pay" />
      {/* and a screen assembled as HTML text. */}
      <Text>{hand()}</Text>
    </>
  );
}

/* markup as a string. The Gherkin placeholder beside it must NOT be reported:
   "<colunas>" is the harness's own step syntax, not a tag. */
function hand(){ return `<div class="x"><h1>hand rolled</h1></div>`; }
const step = "a lista aparece em <colunas> coluna(s)";

/* answers a hook no element carries, while "pay" above is answered by nobody */
Proto.on("click", '[data-act="nobody"]', () => {});
