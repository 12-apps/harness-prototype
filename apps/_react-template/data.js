/* Fixtures and routes. Plain JS — this is data, not a component. */
window.PROTO_DATA = { items: { "1": { id:"1", name:"Primeiro item" } } };
window.PROTO_ROUTES = [
  { httpMethod:"GET", pathStr:"/api/items", onLoad:true,
    responds: ({ data_ }) => Object.values(data_.items) }
];
