/* Compounds whose PARTS carry the box structure the parent does not.

   Curated, like ui-interactions.js, and derived from the package source by a
   rule rather than by taste. A component X is here when all three hold of its
   own declaration:

     1. the caller can put things inside it (it takes `children`, or spreads
        `...rest` / `...props`);
     2. X itself supplies no padding;
     3. at least one X<Part> at the same import path does.

   That is the whole justification. Skip the part and you get an unpadded box,
   so the prototype writes the padding back by hand — which is exactly what
   apps/product-editor did:

       <Card className="card"><Heading/><Paragraph/></Card>
       .card{background:…;border:…;border-radius:…;padding:14px}

   CardContent wraps MuiCardContent, which supplies that padding already.

   The rule is deliberately narrow, and the derivation is what keeps it narrow.
   22 components have same-path siblings sharing their name; 16 drop out here.
   Form drops (no part carries structure — a Form full of Inputs is normal),
   AppHeader drops (the parent pads; its parts are props-driven), Command and
   Chart drop (they render their own parts), Avatar drops (AvatarGroup is a
   sibling, not a part). Demanding parts for any of those would be noise.

   Regenerating catalog/ui-catalog.js does NOT update this file. */
window.PROTO_UI_PARTS = {
 "Dialog": ["DialogActions", "DialogContent", "DialogHeader"],
 "Accordion": ["AccordionActions", "AccordionDetails", "AccordionSummary"],
 "Card": ["CardActions", "CardContent", "CardHeader", "CardMedia"],
 "Collapsible": ["CollapsibleContent", "CollapsibleTrigger"],
 "Drawer": ["DrawerContent", "DrawerHeader"],
 "Sidebar": ["SidebarContent", "SidebarFooter", "SidebarHeader"]
};
