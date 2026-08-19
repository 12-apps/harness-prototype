/* Fixture: every violation the component rule is supposed to catch.
   scripts/test-enforcement.js asserts each one is still reported. */
import { Button } from "@12-apps/ui/form/Button";
import { Sonner } from "@12-apps/ui/feedback/Sonner";
import { Card } from "@12-apps/ui/layout/Kard";
import { Thing } from "some-other-lib";

export default function Screen(){
  return (
    <>
      <button data-act="x">raw</button>
      <div><p>also raw</p></div>
      <Button>fine</Button>
      <Thing /><Card /><Sonner /><Missing />
    </>
  );
}
