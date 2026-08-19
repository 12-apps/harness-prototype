/* Fixture: every violation the component rule is supposed to catch.
   scripts/test-enforcement.js asserts each one is still reported. */
import { Button } from "@12-apps/ui/form/Button";
import { Sonner } from "@12-apps/ui/feedback/Sonner";
import { Card } from "@12-apps/ui/layout/Kard";
import { CollapsibleTrigger } from "@12-apps/ui/layout/Collapsible";
import { Thing } from "some-other-lib";

export default function Screen(){
  return (
    <>
      <button data-act="x">raw</button>
      <div><p>also raw</p></div>
      <Button data-act="pay">fine</Button>
      {/* "exige" and nothing to operate: an affordance with no behaviour */}
      <CollapsibleTrigger />
      <Thing /><Card /><Sonner /><Missing />
    </>
  );
}

/* answers a hook no element carries, while "pay" above is answered by nobody */
Proto.on("click", '[data-act="nobody"]', () => {});
