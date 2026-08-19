/* Fixtures and routes: every value the screen shows lives here.

   The screen never writes a record by hand — it asks. A write route has to
   change the fixtures, because answering 200 without storing is a facade and
   the gate says so. Swapping in a real backend means deleting this file and
   letting fetch out.

   Route shape:
     { httpMethod:"GET", pathStr:"/api/things", onLoad:true,
       responds: ({ params, payload, data_ }) => … }
   onLoad marks a call that belongs to loading the screen rather than to a
   step. Throw from `responds` to produce a failure the prototype must handle.
*/

window.PROTO_DATA = {};

window.PROTO_ROUTES = [];
