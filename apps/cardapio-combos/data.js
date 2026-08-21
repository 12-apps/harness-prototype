/* Fixtures e rotas dos combos (FUT-268). A tela nunca inventa um registro: ela
   pede. Toda rota de escrita mexe no fixture — responder 200 sem guardar é
   fachada, e o portão diz isso.

   Dinheiro é sempre em centavos, inteiro, como no banco. O servidor é a
   autoridade do preço: o carrinho recalcula no servidor a cada mexida, e a
   tela só mostra o que voltou. */

window.PROTO_DATA = {
  slug: "cantina-do-porto",

  /* MenuItem: o item vendável. Não guarda estoque próprio — ele desce pela
     ficha (BOM) até o insumo, e é por isso que a baixa de um combo tem dois
     níveis: Combo → ComboItem(qtd) → MenuItem → BOM(qtd) → insumo. */
  products: {
    "m1": { id:"m1", nameStr:"Sanduíche do chef", priceCents:2800, categoria:"Lanches",  estacao:"Grelha"  },
    "m2": { id:"m2", nameStr:"Coca-Cola 350ml",   priceCents:800,  categoria:"Bebidas",  estacao:null      },
    "m3": { id:"m3", nameStr:"Batata frita",      priceCents:1500, categoria:"Porções",  estacao:"Fritura" },
    "m4": { id:"m4", nameStr:"Pastel de nata",    priceCents:750,  categoria:"Doces",    estacao:null      }
  },

  combos: {
    "c1": { id:"c1", nameStr:"Combo do chef", type:"FIXED_BUNDLE",
            descricao:"Sanduíche do chef com Coca-Cola gelada.",
            priceCents:3200, categoria:"Lanches", active:true, listed:true,
            items:[ { productId:"m1", quantity:1 }, { productId:"m2", quantity:1 } ],
            chargedQuantity:null, receivedQuantity:null, targetProductId:null },

    /* "compre 3, leve 4" — os nomes são chargedQuantity/receivedQuantity de
       propósito: buyQuantity/takeQuantity leem ao contrário do que se fala e
       é assim que sai promoção com off-by-one. Invariante: recebida > cobrada > 0. */
    "c2": { id:"c2", nameStr:"Pastel: leve 4, pague 3", type:"QUANTITY_DEAL",
            descricao:"Levou quatro pastéis, paga três.",
            priceCents:null, categoria:"Doces", active:true, listed:true,
            items:[], targetProductId:"m4", chargedQuantity:3, receivedQuantity:4 }
  },

  /* O motor de descontos (FUT-235) já está no ar. A regra decidida: a linha de
     combo é OPACA para desconto de item e de categoria — só desconto de pedido
     alcança, e alcança o preço do combo, nunca a soma das partes. */
  discounts: [
    { id:"d1", scope:"ITEM",  alvo:"m2", label:"10% em Coca-Cola 350ml", percent:10 },
    { id:"d2", scope:"ORDER", alvo:null, label:"5% no pedido",           percent:5  }
  ],

  cart: { lines: [] },

  /* O motor de descontos ligado para a loja. A rota não enxerga os chips da
     barra de contexto, então quem liga é o Dado do cenário. */
  descontosLigados: false,

  /* acima de qualquer id de fixture: um combo novo não pode nascer
     por cima de um que já existe */
  seq: 100,

  /* liga o "falha na primeira, funciona na segunda" — é o que deixa
     Tentar novamente chegar a um desfecho em vez de repetir o erro */
  combosFailOnce: false,
  menuFailsOnce: false,
  cartFailsOnce: false,
  productsFailOnce: false
};

(function(){
  const D = window.PROTO_DATA;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const nextId = (p) => p + (++D.seq);

  const somaDosComponentes = (data_, combo) =>
    (combo.items || []).reduce((total, it) => {
      const p = data_.products[it.productId];
      return total + (p ? p.priceCents * it.quantity : 0);
    }, 0);

  /* O que a vitrine mostra de um combo: os componentes com nome e quantidade,
     o preço do combo e, no caso da promoção, os termos falados. */
  function comboParaVitrine(data_, c){
    return {
      id:c.id, nameStr:c.nameStr, descricao:c.descricao, categoria:c.categoria,
      type:c.type, priceCents:c.priceCents,
      chargedQuantity:c.chargedQuantity, receivedQuantity:c.receivedQuantity,
      somaCents: somaDosComponentes(data_, c),
      alvo: c.targetProductId ? clone(data_.products[c.targetProductId]) : null,
      componentes: (c.items || []).map(it => ({
        productId:it.productId, quantity:it.quantity,
        nameStr:(data_.products[it.productId] || {}).nameStr || "(item removido)",
        unitPriceCents:(data_.products[it.productId] || {}).priceCents || 0,
        estacao:(data_.products[it.productId] || {}).estacao || null
      }))
    };
  }

  /* Preço de uma linha, servidor-autoritativo.
     - pacote fechado: o preço do combo, vezes a quantidade;
     - promoção: a cada `recebida` unidades, cobram-se `cobrada`; a sobra sai
       pelo preço cheio. É o que faz "leve 4 pague 3" valer também em 9 unidades. */
  function precoDaLinha(data_, line){
    if (line.comboId){
      const c = data_.combos[line.comboId];
      if (!c) throw new Error("Combo não encontrado");
      if (c.type === "FIXED_BUNDLE") return c.priceCents * line.quantity;
      const alvo = data_.products[c.targetProductId];
      const grupos = Math.floor(line.quantity / c.receivedQuantity);
      const resto  = line.quantity % c.receivedQuantity;
      return (grupos * c.chargedQuantity + resto) * alvo.priceCents;
    }
    return data_.products[line.productId].priceCents * line.quantity;
  }

  /* O avaliador de descontos, na ordem ITEM → CATEGORIA → PEDIDO, cada passe
     sobre o que sobrou. A linha de combo entra sem identidade de alvo, então
     nenhum desconto de item a enxerga — é isso que impede o duplo desconto. */
  function avaliar(data_, lines, descontosLigados){
    const detalhadas = lines.map(l => {
      const brutoCents = precoDaLinha(data_, l);
      return { ...l, brutoCents, discountCents:0 };
    });
    if (!descontosLigados) {
      const subtotal = detalhadas.reduce((t, l) => t + l.brutoCents, 0);
      return { lines:detalhadas, subtotalCents:subtotal, discountTotalCents:0, totalCents:subtotal, aplicados:[] };
    }

    const aplicados = [];
    data_.discounts.filter(d => d.scope === "ITEM").forEach(d => {
      detalhadas.forEach(l => {
        /* a linha de combo não tem menuItemId que um DiscountItem alcance */
        if (l.comboId) return;
        if (l.productId !== d.alvo) return;
        const corte = Math.round((l.brutoCents - l.discountCents) * d.percent / 100);
        l.discountCents += corte;
        aplicados.push({ id:d.id, label:d.label, scope:"ITEM", cents:corte });
      });
    });

    const subtotalCents = detalhadas.reduce((t, l) => t + l.brutoCents, 0);
    let descontoCents = detalhadas.reduce((t, l) => t + l.discountCents, 0);

    data_.discounts.filter(d => d.scope === "ORDER").forEach(d => {
      const base = subtotalCents - descontoCents;
      const corte = Math.round(base * d.percent / 100);
      /* rateio por maior resto: a soma por linha tem de bater exatamente com
         o desconto do pedido, senão sobra centavo e o CHECK do banco reprova */
      let restante = corte;
      const pesos = detalhadas.map(l => l.brutoCents - l.discountCents);
      const somaPesos = pesos.reduce((t, p) => t + p, 0) || 1;
      detalhadas.forEach((l, i) => {
        const parte = i === detalhadas.length - 1
          ? restante
          : Math.round(corte * pesos[i] / somaPesos);
        l.discountCents += parte;
        restante -= parte;
      });
      descontoCents += corte;
      aplicados.push({ id:d.id, label:d.label, scope:"ORDER", cents:corte });
    });

    /* nunca zera: o provedor recusa cobrança de R$ 0,00 e o pedido encalha */
    const totalCents = Math.max(1, subtotalCents - descontoCents);
    return { lines:detalhadas, subtotalCents, discountTotalCents:subtotalCents - totalCents,
             totalCents, aplicados };
  }

  function montarCarrinho(data_, descontosLigados){
    const avaliado = avaliar(data_, data_.cart.lines, descontosLigados);
    return {
      lines: avaliado.lines.map(l => {
        const c = l.comboId ? data_.combos[l.comboId] : null;
        return {
          lineId:l.lineId, quantity:l.quantity,
          comboId:l.comboId || null, productId:l.productId || null,
          nameStr: c ? c.nameStr : data_.products[l.productId].nameStr,
          type: c ? c.type : "ITEM",
          brutoCents:l.brutoCents, discountCents:l.discountCents,
          /* o snapshot dos componentes: o pedido guarda o que entrou no combo,
             para uma edição futura do produto não reescrever a história */
          componentes: c ? comboParaVitrine(data_, c).componentes : [],
          termos: c && c.type === "QUANTITY_DEAL"
            ? { chargedQuantity:c.chargedQuantity, receivedQuantity:c.receivedQuantity }
            : null
        };
      }),
      subtotalCents:avaliado.subtotalCents,
      discountTotalCents:avaliado.discountTotalCents,
      totalCents:avaliado.totalCents,
      aplicados:avaliado.aplicados
    };
  }

  /* As invariantes que o construtor promete e o servidor confere de novo. */
  function validarCombo(data_, corpo){
    if (!corpo.nameStr || !corpo.nameStr.trim()) throw new Error("O combo precisa de um nome");
    if (corpo.type === "FIXED_BUNDLE"){
      if ((corpo.items || []).length < 2)
        throw new Error("Um pacote fechado precisa de pelo menos 2 produtos");
      if (!(corpo.priceCents >= 0))
        throw new Error("O preço do combo não pode ser negativo");
    } else {
      if (!corpo.targetProductId) throw new Error("Escolha o produto da promoção");
      if (!(corpo.receivedQuantity > corpo.chargedQuantity && corpo.chargedQuantity > 0))
        throw new Error("A quantidade levada tem de ser maior que a cobrada");
    }
  }

  window.PROTO_ROUTES = [
    /* ------------------------------------------------------- admin: combos */
    { httpMethod:"GET", pathStr:"/api/admin/:slug/combos", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.combosFailOnce){ data_.combosFailOnce = false; throw new Error("Serviço de combos indisponível"); }
        return Object.values(data_.combos).map(c => comboParaVitrine(data_, c));
      } },

    { httpMethod:"GET", pathStr:"/api/admin/:slug/products", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.productsFailOnce){ data_.productsFailOnce = false; throw new Error("Não deu para carregar os produtos"); }
        return Object.values(data_.products).map(p => clone(p));
      } },

    { httpMethod:"POST", pathStr:"/api/admin/:slug/combos",
      responds: ({ payload, data_ }) => {
        const corpo = payload || {};
        validarCombo(data_, corpo);
        const id = nextId("c");
        data_.combos[id] = {
          id, nameStr:corpo.nameStr, descricao:corpo.descricao || "",
          type:corpo.type, priceCents:corpo.type === "FIXED_BUNDLE" ? corpo.priceCents : null,
          categoria:corpo.categoria || "Lanches", active:true, listed:true,
          items: corpo.type === "FIXED_BUNDLE" ? clone(corpo.items || []) : [],
          targetProductId: corpo.type === "QUANTITY_DEAL" ? corpo.targetProductId : null,
          chargedQuantity: corpo.type === "QUANTITY_DEAL" ? corpo.chargedQuantity : null,
          receivedQuantity: corpo.type === "QUANTITY_DEAL" ? corpo.receivedQuantity : null
        };
        return comboParaVitrine(data_, data_.combos[id]);
      } },

    { httpMethod:"PUT", pathStr:"/api/admin/:slug/combos/:id",
      responds: ({ params, payload, data_ }) => {
        const c = data_.combos[params.id];
        if (!c) throw new Error("Combo não encontrado");
        const corpo = { ...c, ...(payload || {}) };
        validarCombo(data_, corpo);
        Object.assign(c, {
          nameStr:corpo.nameStr, priceCents:corpo.priceCents,
          items:clone(corpo.items || []), listed:corpo.listed,
          chargedQuantity:corpo.chargedQuantity, receivedQuantity:corpo.receivedQuantity
        });
        return comboParaVitrine(data_, c);
      } },

    /* -------------------------------------------------- vitrine: o cardápio */
    { httpMethod:"GET", pathStr:"/api/menu/:slug", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.menuFailsOnce){ data_.menuFailsOnce = false; throw new Error("Cardápio indisponível"); }
        return {
          itens: Object.values(data_.products).map(p => clone(p)),
          /* combo inativo ou fora da vitrine nunca aparece */
          combos: Object.values(data_.combos)
            .filter(c => c.active && c.listed)
            .map(c => comboParaVitrine(data_, c))
        };
      } },

    /* ------------------------------------------------------------ carrinho */
    { httpMethod:"GET", pathStr:"/api/cart/:slug", onLoad:true,
      responds: ({ data_ }) => {
        if (data_.cartFailsOnce){ data_.cartFailsOnce = false; throw new Error("Carrinho indisponível"); }
        return montarCarrinho(data_, data_.descontosLigados);
      } },

    { httpMethod:"POST", pathStr:"/api/cart/:slug/items",
      responds: ({ payload, data_ }) => {
        const corpo = payload || {};
        if (corpo.comboId && !data_.combos[corpo.comboId]) throw new Error("Combo não encontrado");
        if (corpo.productId && !data_.products[corpo.productId]) throw new Error("Produto não encontrado");
        /* a identidade do combo entra na composição da linha, senão dois combos
           diferentes desabam na mesma linha do carrinho */
        const chave = corpo.comboId ? "combo:" + corpo.comboId : "item:" + corpo.productId;
        const existente = data_.cart.lines.find(l => l.compositionHash === chave);
        if (existente) existente.quantity += (corpo.quantity || 1);
        else data_.cart.lines.push({
          lineId:nextId("l"), compositionHash:chave,
          comboId:corpo.comboId || null, productId:corpo.productId || null,
          quantity:corpo.quantity || 1
        });
        return montarCarrinho(data_, data_.descontosLigados);
      } },

    { httpMethod:"PUT", pathStr:"/api/cart/:slug/items/:lineId",
      responds: ({ params, payload, data_ }) => {
        const linha = data_.cart.lines.find(l => l.lineId === params.lineId);
        if (!linha) throw new Error("Linha não encontrada");
        const q = (payload || {}).quantity;
        if (!(q > 0)) throw new Error("Quantidade inválida");
        linha.quantity = q;
        return montarCarrinho(data_, data_.descontosLigados);
      } },

    { httpMethod:"DELETE", pathStr:"/api/cart/:slug/items/:lineId",
      responds: ({ params, data_ }) => {
        const i = data_.cart.lines.findIndex(l => l.lineId === params.lineId);
        if (i < 0) throw new Error("Linha não encontrada");
        data_.cart.lines.splice(i, 1);
        return montarCarrinho(data_, data_.descontosLigados);
      } }
  ];
})();
