/* Fixtures and routes. Every value the screen shows lives here: the screen
   never writes a record by hand, it asks. A write route has to change the
   fixtures — answering 200 without storing is a facade, and the gate says so.
   Swapping in a real backend means deleting this file and letting fetch out. */

window.PROTO_DATA = {
  products: {
    "1": {
      id:"1", nameStr:"Pizza margherita", category:"Pizzas",
      variants:[
        { id:"v1", nameStr:"Pequena", price:"18,00" },
        { id:"v2", nameStr:"Média",   price:"24,00" },
        { id:"v3", nameStr:"Grande",  price:"31,00" }
      ]
    },
    "2": { id:"2", nameStr:"Calabresa", category:"Pizzas", variants:[] }
  },
  planLimits: { free:1, basic:3, pro:10, ultra:50 },
  /* switches on "fails the first time, works the second" — lets Tentar de
     novo reach an outcome instead of repeating the error forever */
  listFailsOnce: false
};

window.PROTO_ROUTES = [
  { httpMethod:"POST", pathStr:"/api/produtos",
    responds: ({ payload, data_ }) => {
      const id = String(Object.keys(data_.products).length + 1);
      const newer = { id, nameStr:(payload && payload.nameStr) || "Produto sem nome",
                     category:(payload && payload.category) || "Sem categoria", variants:[] };
      data_.products[id] = newer;
      return newer;
    } },

  { httpMethod:"GET", pathStr:"/api/produtos",
    responds: ({ data_ }) => {
      if (data_.listFailsOnce){ data_.listFailsOnce = false; throw new Error("Serviço indisponível"); }
      return Object.values(data_.products).map(p => ({
        id:p.id, nameStr:p.nameStr, category:p.category, variants:p.variants.length
      }));
    } },

  { httpMethod:"GET", pathStr:"/api/produtos/:id",
    responds: ({ params, data_ }) => {
      const p = data_.products[params.id];
      if (!p) throw new Error("produto não encontrado");
      return JSON.parse(JSON.stringify(p));
    } },

  { httpMethod:"POST", pathStr:"/api/produtos/:id/variacoes",
    responds: ({ params, payload, data_ }) => {
      const p = data_.products[params.id];
      if (!p) throw new Error("produto não encontrado");
      const fresh = { id:"v" + (p.variants.length + 1) + "-" + params.id,
                     nameStr:(payload && payload.nameStr) || "Nova",
                     price:(payload && payload.price) || "18,00" };
      p.variants.push(fresh);        /* really stores it: a reload has to keep it */
      return fresh;
    } },

  { httpMethod:"PUT", pathStr:"/api/produtos/:id",
    responds: ({ params, payload, data_ }) => {
      const p = data_.products[params.id];
      if (!p) throw new Error("produto não encontrado");
      Object.assign(p, payload || {}, { updatedAt:"2026-08-15T12:00:00Z" });
      return JSON.parse(JSON.stringify(p));
    } },

  { httpMethod:"POST", pathStr:"/api/pagamentos",
    responds: ({ payload, data_ }) => {
      data_.payments = data_.payments || [];
      const pg = { id:"pi_" + (data_.payments.length + 1),
                   status:"aprovado", val:(payload && payload.val) || 0 };
      data_.payments.push(pg);
      return pg;
    } },

];
