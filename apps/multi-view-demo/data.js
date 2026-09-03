/* Fixtures and routes for the multi-actor spike.

   One order, three actors looking at it. The point of the spike: every view
   reads the SAME record through the SAME routes, so a status write by the
   kitchen is visible to the customer and the waiter with nobody wiring a
   message between them. The shared fixture IS the propagation. */

window.PROTO_DATA = {
  comandas: {
    "7": {
      id:"7", mesa:"Mesa 7", status:"recebido",
      itens:[
        { id:"i1", nameStr:"Pizza margherita", qtd:1 },
        { id:"i2", nameStr:"Suco de laranja",  qtd:2 }
      ]
    }
  },
  /* switches on "fails the first time, works the second" — lets Tentar de novo
     reach an outcome instead of repeating the error forever */
  filaFalhaUmaVez: false
};

/* the lifecycle every view reads, each showing its own word for it */
const ORDEM = ["recebido", "preparando", "pronto", "entregue"];

window.PROTO_ROUTES = [
  { httpMethod:"GET", pathStr:"/api/comandas/:id", onLoad:true,
    responds: ({ params, data_ }) => {
      const c = data_.comandas[params.id];
      if (!c) throw new Error("comanda não encontrada");
      return JSON.parse(JSON.stringify(c));
    } },

  { httpMethod:"GET", pathStr:"/api/cozinha/fila", onLoad:true,
    responds: ({ data_ }) => {
      if (data_.filaFalhaUmaVez){ data_.filaFalhaUmaVez = false; throw new Error("Serviço indisponível"); }
      return Object.values(data_.comandas)
        .map(c => ({ id:c.id, mesa:c.mesa, status:c.status, itens:c.itens.length }));
    } },

  { httpMethod:"GET", pathStr:"/api/garcom/pedidos", onLoad:true,
    responds: ({ data_ }) => Object.values(data_.comandas)
      .map(c => ({ id:c.id, mesa:c.mesa, status:c.status })) },

  { httpMethod:"POST", pathStr:"/api/comandas/:id/status",
    responds: ({ params, payload, data_ }) => {
      const c = data_.comandas[params.id];
      if (!c) throw new Error("comanda não encontrada");
      const next = payload && payload.status;
      if (ORDEM.indexOf(next) < 0) throw new Error("status desconhecido: " + next);
      if (ORDEM.indexOf(next) <= ORDEM.indexOf(c.status)){
        throw new Error("a comanda já passou de " + next);
      }
      c.status = next;              /* really stores it: the other views read this */
      return JSON.parse(JSON.stringify(c));
    } }
];
