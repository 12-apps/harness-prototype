/* Fixtures and routes do ciclo de vida de entidades (FUT-268).
   A tela nunca inventa um registro: ela pede. Toda rota de escrita mexe no
   fixture — responder 200 sem guardar é fachada, e o portão diz isso.

   As rotas são as do produto real, com o mesmo prefixo por loja:
   /api/admin/{slug}/…  (versões, lixeira, rascunhos, aprovações, config). */

window.PROTO_DATA = {
  slug: "cantina-do-porto",

  /* A terceira camada do portão de recurso: código && plano && loja.
     `entitled` não mora aqui de propósito — essa é a camada do plano, e o
     plano é uma dimensão de contexto. Aqui fica só o interruptor da loja. */
  lifecycle: {
    versioning: { enabled: true },
    drafts:     { enabled: true },
    approvals:  { enabled: true }
  },

  /* Quando ligado, uma escrita é estacionada como solicitação em vez de
     aplicada (202 · applied:false). No produto real quem decide é o servidor,
     a partir do ator que assina a requisição; aqui o fixture carrega a mesma
     decisão, porque a rota não enxerga o papel escolhido na barra. */
  parkWrites: false,

  products: {
    "p1": { id:"p1", nameStr:"Pastel de nata", priceStr:"7,50", version:3 },
    "p2": { id:"p2", nameStr:"Bolo de arroz",  priceStr:"5,00", version:1 }
  },

  /* Histórico por produto, mais novo primeiro. v1 é o retrato inteiro; as
     seguintes guardam só os campos que mudaram — por isso `changedFields`. */
  versions: {
    "p1": [
      { version:3, kind:"UPDATE", actorName:"Rita Camargo", createdAt:"2026-07-20T14:35:00Z",
        changedFields:["preco"], removedFields:[], restoredFromVersion:null,
        snapshot:{ nameStr:"Pastel de nata", priceStr:"7,50" } },
      { version:2, kind:"UPDATE", actorName:"Rita Camargo", createdAt:"2026-07-12T09:10:00Z",
        changedFields:["nome","preco"], removedFields:["descricao"], restoredFromVersion:null,
        snapshot:{ nameStr:"Pastel de nata", priceStr:"6,90" } },
      { version:1, kind:"CREATE", actorName:"Nuno Aguiar", createdAt:"2026-06-02T11:00:00Z",
        changedFields:[], removedFields:[], restoredFromVersion:null,
        snapshot:{ nameStr:"Pastelinho", priceStr:"5,50" } }
    ],
    "p2": []
  },

  /* Um rascunho aberto por item. `data` é o mesmo corpo que a gravação manda,
     por isso "Carregar rascunho" preenche o formulário pelo caminho de sempre. */
  drafts: {
    "d1": { id:"d1", entityId:"p1", updatedAt:"2026-07-21T08:20:00Z",
            data:{ nameStr:"Pastel de nata da casa", priceStr:"8,50" } }
  },

  /* A lixeira guarda a árvore: raiz mais dependentes, para a tela dizer o que
     um restaurar traz de volta junto. */
  bin: {
    "b1": { id:"b1", entityType:"product", entityId:"p9", label:"Queijada de Sintra",
            deletedByName:"Rita Camargo", deletedAt:"2026-07-18T16:02:00Z", status:"BINNED",
            children:[ { id:"c1", entityType:"product", label:"Queijada — unidade" },
                       { id:"c2", entityType:"product", label:"Queijada — caixa com 6" } ],
            snapshot:{ id:"p9", nameStr:"Queijada de Sintra", priceStr:"4,20", version:2 } }
  },

  requests: {
    "r1": { id:"r1", entityType:"product", entityId:"p2", action:"UPDATE",
            label:"Bolo de arroz", status:"PENDING", requestedByName:"Iara Bastos",
            requestedAt:"2026-07-21T10:05:00Z", decidedAt:null, decisionNote:null,
            apply:{ kind:"update", productId:"p2", body:{ priceStr:"5,50" } } }
  },

  seq: 100,

  /* liga o "falha na primeira, funciona na segunda" — é o que deixa
     Tentar de novo chegar a um desfecho em vez de repetir o erro para sempre */
  binFailsOnce: false,
  versionsFailOnce: false,
  productsFailOnce: false,
  draftFailsOnce: false,
  approvalsFailOnce: false,
  configFailsOnce: false,
  deleteFailsOnce: false
};

(function(){
  const D = window.PROTO_DATA;
  const nextId = (prefix) => prefix + (++D.seq);
  const clone  = (v) => JSON.parse(JSON.stringify(v));

  /* O corpo que uma escrita estacionada devolve. Guardar a solicitação é o que
     faz a página de Aprovações ter o que decidir depois. */
  function park(data_, entityId, action, label, apply){
    const id = nextId("r");
    data_.requests[id] = {
      id, entityType:"product", entityId, action, label, status:"PENDING",
      requestedByName:"Iara Bastos", requestedAt:"2026-07-22T09:00:00Z",
      decidedAt:null, decisionNote:null, apply
    };
    return { applied:false, entityId, requestId:id };
  }

  /* Grava uma versão nova no histórico do produto e mexe no published_version. */
  function pushVersion(data_, product, kind, changedFields, restoredFrom){
    const list = data_.versions[product.id] || (data_.versions[product.id] = []);
    /* um item pode já estar publicado numa versão sem ter linha registrada:
       o recurso pode ter sido ligado depois que ele foi criado */
    const version = (list.length ? list[0].version : (product.version || 0)) + 1;
    list.unshift({
      version, kind, actorName:"Rita Camargo", createdAt:"2026-07-22T09:00:00Z",
      changedFields, removedFields:[], restoredFromVersion: restoredFrom || null,
      snapshot:{ nameStr:product.nameStr, priceStr:product.priceStr }
    });
    product.version = version;
    return version;
  }

  window.PROTO_ROUTES = [
    /* ---------------------------------------------------------- configuração */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/config", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.configFailsOnce){ data_.configFailsOnce = false; throw new Error("Configuração indisponível"); }
        return { lifecycle: clone(data_.lifecycle) };
      } },

    { httpMethod:"PUT", pathStr:"/api/admin/:slug/config",
      responds: ({ payload, data_ }) => {
        const feature = payload && payload.feature;
        if (!feature || !data_.lifecycle[feature]) throw new Error("Recurso desconhecido");
        data_.lifecycle[feature].enabled = !!(payload && payload.enabled);
        return { lifecycle: clone(data_.lifecycle) };
      } },

    /* -------------------------------------------------------------- catálogo */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/products", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.productsFailOnce){ data_.productsFailOnce = false; throw new Error("Serviço indisponível"); }
        return Object.values(data_.products).map(p => ({
        id:p.id, nameStr:p.nameStr, priceStr:p.priceStr, version:p.version,
        hasDraft: Object.values(data_.drafts).some(d => d.entityId === p.id)
        }));
      } },

    { httpMethod:"PUT", pathStr:"/api/admin/:slug/products/:id",
      responds: ({ params, payload, data_ }) => {
        const p = data_.products[params.id];
        if (!p) throw new Error("Produto não encontrado");
        if (data_.parkWrites)
          return park(data_, p.id, "UPDATE", p.nameStr, { kind:"update", productId:p.id, body:clone(payload || {}) });
        const changed = [];
        if (payload && payload.nameStr !== undefined && payload.nameStr !== p.nameStr){
          p.nameStr = payload.nameStr; changed.push("nome");
        }
        if (payload && payload.priceStr !== undefined && payload.priceStr !== p.priceStr){
          p.priceStr = payload.priceStr; changed.push("preco");
        }
        pushVersion(data_, p, "UPDATE", changed);
        return { applied:true, entityId:p.id, requestId:null, product:clone(p) };
      } },

    /* exclusão é reversível: o item vai para a lixeira com sua árvore */
    { httpMethod:"DELETE", pathStr:"/api/admin/:slug/products/:id",
      responds: ({ params, data_ }) => {
        if (data_.deleteFailsOnce){ data_.deleteFailsOnce = false; throw new Error("Não foi possível excluir agora"); }
        const p = data_.products[params.id];
        if (!p) throw new Error("Produto não encontrado");
        if (data_.parkWrites)
          return park(data_, p.id, "DELETE", p.nameStr, { kind:"delete", productId:p.id });
        const entryId = "b-" + p.id;
        data_.bin[entryId] = {
          id:entryId, entityType:"product", entityId:p.id, label:p.nameStr,
          deletedByName:"Rita Camargo", deletedAt:"2026-07-22T09:00:00Z", status:"BINNED",
          children:[], snapshot:clone(p)
        };
        delete data_.products[p.id];
        return { applied:true, entityId:p.id, requestId:null };
      } },

    /* --------------------------------------------------------------- versões */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/products/:id/versions",
      responds: ({ params, data_ }) => {
        if (data_.versionsFailOnce){ data_.versionsFailOnce = false; throw new Error("Serviço de histórico indisponível"); }
        const p = data_.products[params.id];
        return { versions: clone(data_.versions[params.id] || []),
                 publishedVersion: p ? p.version : 0 };
      } },

    { httpMethod:"POST", pathStr:"/api/admin/:slug/products/:id/versions/:version/restore",
      responds: ({ params, data_ }) => {
        const p = data_.products[params.id];
        if (!p) throw new Error("Produto não encontrado");
        const target = (data_.versions[params.id] || [])
          .find(v => String(v.version) === String(params.version));
        if (!target) throw new Error("Versão não encontrada");
        if (data_.parkWrites)
          return park(data_, p.id, "UPDATE", p.nameStr,
                      { kind:"restore", productId:p.id, version:Number(params.version) });
        /* o esquema de hoje sempre ganha: o retrato é revalidado contra o
           modelo de escrita atual, campo desconhecido cai fora */
        p.nameStr  = target.snapshot.nameStr;
        p.priceStr = target.snapshot.priceStr;
        pushVersion(data_, p, "RESTORE", ["nome","preco"], Number(params.version));
        return { applied:true, entityId:p.id, requestId:null };
      } },

    /* ------------------------------------------------------------- rascunhos */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/products/:id/draft",
      responds: ({ params, data_ }) => {
        if (data_.draftFailsOnce){ data_.draftFailsOnce = false; throw new Error("Serviço de rascunhos indisponível"); }
        return { draft: clone(Object.values(data_.drafts).find(d => d.entityId === params.id) || null) };
      } },

    { httpMethod:"PUT", pathStr:"/api/admin/:slug/products/:id/draft",
      responds: ({ params, payload, data_ }) => {
        const existing = Object.values(data_.drafts).find(d => d.entityId === params.id);
        const draft = existing || { id:nextId("d"), entityId:params.id };
        draft.updatedAt = "2026-07-22T09:00:00Z";
        draft.data = clone(payload || {});
        data_.drafts[draft.id] = draft;
        return { draft: clone(draft) };
      } },

    { httpMethod:"POST", pathStr:"/api/admin/:slug/drafts/:draftId/publish",
      responds: ({ params, data_ }) => {
        const draft = data_.drafts[params.draftId];
        if (!draft) throw new Error("Rascunho não encontrado");
        const p = data_.products[draft.entityId];
        if (!p) throw new Error("Produto não encontrado");
        if (data_.parkWrites)
          return park(data_, p.id, "UPDATE", p.nameStr,
                      { kind:"update", productId:p.id, body:clone(draft.data) });
        /* publicar passa pelo mesmo caminho de escrita: vira versão */
        const changed = [];
        if (draft.data.nameStr !== p.nameStr){ p.nameStr = draft.data.nameStr; changed.push("nome"); }
        if (draft.data.priceStr !== p.priceStr){ p.priceStr = draft.data.priceStr; changed.push("preco"); }
        pushVersion(data_, p, "UPDATE", changed);
        delete data_.drafts[draft.id];
        return { applied:true, entityId:p.id, requestId:null };
      } },

    { httpMethod:"DELETE", pathStr:"/api/admin/:slug/drafts/:draftId",
      responds: ({ params, data_ }) => {
        const draft = data_.drafts[params.draftId];
        if (!draft) throw new Error("Rascunho não encontrado");
        delete data_.drafts[params.draftId];
        return { id:params.draftId };
      } },

    /* --------------------------------------------------------------- lixeira */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/recycle-bin", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.binFailsOnce){ data_.binFailsOnce = false; throw new Error("Serviço indisponível"); }
        return { entries: Object.values(data_.bin)
          .filter(e => e.status === "BINNED")
          .map(e => clone(e)) };
      } },

    { httpMethod:"POST", pathStr:"/api/admin/:slug/recycle-bin/:entryId/restore",
      responds: ({ params, data_ }) => {
        const entry = data_.bin[params.entryId];
        if (!entry) throw new Error("Item não encontrado na lixeira");
        const restored = clone(entry.snapshot);
        data_.products[restored.id] = restored;
        /* a linha fica como trilha de auditoria: vira RESTORED, não some */
        entry.status = "RESTORED";
        return { id:entry.id, entityId:restored.id };
      } },

    { httpMethod:"DELETE", pathStr:"/api/admin/:slug/recycle-bin/:entryId",
      responds: ({ params, data_ }) => {
        const entry = data_.bin[params.entryId];
        if (!entry) throw new Error("Item não encontrado na lixeira");
        entry.status = "PURGED";
        return { id:entry.id };
      } },

    /* ------------------------------------------------------------ aprovações */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/approvals", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.approvalsFailOnce){ data_.approvalsFailOnce = false; throw new Error("Serviço de aprovações indisponível"); }
        return { requests: Object.values(data_.requests).map(r => clone(r)) };
      } },

    { httpMethod:"POST", pathStr:"/api/admin/:slug/approvals/:id/approve",
      responds: ({ params, data_ }) => {
        const req = data_.requests[params.id];
        if (!req) throw new Error("Solicitação não encontrada");
        if (req.status !== "PENDING") throw new Error("Solicitação já decidida");
        const p = data_.products[req.entityId];
        /* aplicar de verdade: a versão gerada fica creditada a quem pediu */
        if (p && req.apply && req.apply.kind === "update"){
          const changed = [];
          const body = req.apply.body || {};
          if (body.nameStr !== undefined && body.nameStr !== p.nameStr){ p.nameStr = body.nameStr; changed.push("nome"); }
          if (body.priceStr !== undefined && body.priceStr !== p.priceStr){ p.priceStr = body.priceStr; changed.push("preco"); }
          pushVersion(data_, p, "UPDATE", changed);
        }
        if (p && req.apply && req.apply.kind === "restore"){
          const target = (data_.versions[p.id] || [])
            .find(v => String(v.version) === String(req.apply.version));
          if (target){
            p.nameStr = target.snapshot.nameStr;
            p.priceStr = target.snapshot.priceStr;
            pushVersion(data_, p, "RESTORE", ["nome","preco"], req.apply.version);
          }
        }
        if (p && req.apply && req.apply.kind === "delete"){
          const entryId = "b-" + p.id;
          data_.bin[entryId] = {
            id:entryId, entityType:"product", entityId:p.id, label:p.nameStr,
            deletedByName:"Iara Bastos", deletedAt:"2026-07-22T09:00:00Z", status:"BINNED",
            children:[], snapshot:clone(p)
          };
          delete data_.products[p.id];
        }
        req.status = "APPROVED";
        req.decidedAt = "2026-07-22T09:30:00Z";
        return { applied:true, entityId:req.entityId, requestId:req.id };
      } },

    { httpMethod:"POST", pathStr:"/api/admin/:slug/approvals/:id/reject",
      responds: ({ params, payload, data_ }) => {
        const req = data_.requests[params.id];
        if (!req) throw new Error("Solicitação não encontrada");
        if (req.status !== "PENDING") throw new Error("Solicitação já decidida");
        req.status = "REJECTED";
        req.decidedAt = "2026-07-22T09:30:00Z";
        req.decisionNote = (payload && payload.note) || null;
        return { id:req.id };
      } }
  ];
})();
