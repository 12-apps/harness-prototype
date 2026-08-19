/* Context, scenarios and render — the specification itself.
   Loaded after data.js, so PROTO_DATA and PROTO_ROUTES already exist. */

Proto.init({
  title: "editor de produto",

  library: "@12-apps/ui",

  data_: window.PROTO_DATA,
  routes: window.PROTO_ROUTES,
  latency: [250, 750],   /* a random range, on screen only; verification runs with no delay */

  /* demands that every piece of markup with text or interaction is claimed
     by a component from the map below */
  strictMode: true,

  /* The mapping between the prototype's markup and what the library already
     has. Prototyping by hand is fast; the map keeps the home-made version
     from becoming a new component in production. It goes into the .feature
     as "# ui:". */
  primitives: {
    ".btn":               "Button",
    ".card":              "Card",
    ".var":               "Card",
    ".empty":             "EmptyState",
    ".aviso":             "Alert",
    ".trava":             "Banner",
    ".tag":               "Badge",
    ".app-hd":            "AppHeader",
    ".actions":           "ContentToolbar",
    "[data-async]":       "AsyncStateContainer",
    "[data-estado=vazio]":      "EmptyState",
    "[data-estado=erro]":       "ErrorState",
    "[data-estado=carregando]": "LoadingState",
    "[data-card=margem]": "StatCard",
    /* text and fields are components too — without this, strict mode reports
       raw markup, which is exactly the point */
    "h1, h2":             "Heading",
    ".linha":             "Button",
    ".linha b, .linha .cat, .linha .qtd, .linha .nome, .var span": "Text",
    ".voltar":            "Button",
    "[data-act=recarregar-lista]": "Button",
    ".app-hd p, .card p, .estado p, .trava p": "Paragraph",
    ".var b":             "Text",
    "input.preco":        "Input"
  },

  feature: {
    name: "Variações de produto",
    as:   "lojista",
    want: "cadastrar tamanhos diferentes do mesmo produto",
    so:   "o cliente escolha no cardápio sem eu duplicar o item",
    /* inherited by every scenario that does not declare its own */
    impl: {
      component:"ProdutoEditor",
      route:"/produtos/:id",
      moduleName:"catalogo/produtos",
      notes:"Button, Alert e TextField de @12-apps/ui"
    }
  },

  context: [
    {
      id:"plano", label:"Plano", kind:"escala", value:"pro",
      options:[
        { id:"free",  label:"Free"  },
        { id:"basic", label:"Basic", allows:["produto.variacoes"] },
        { id:"pro",   label:"Pro",   allows:["relatorio.margem"] },
        { id:"ultra", label:"Ultra", allows:["api.usar"] }
      ]
    },
    {
      id:"papel", label:"Papel do usuário", kind:"opcao", value:"dono",
      options:[
        { id:"dono",    label:"Dono",    allows:["*"] },
        { id:"gerente", label:"Gerente", allows:["produto.editar","relatorio.margem"] },
        { id:"garcom",  label:"Garçom",  allows:["mesa.atender"] }
      ]
    },
    {
      id:"flags", label:"Funcionalidades", kind:"flags", value:["cozinha"],
      options:[
        { id:"cozinha", label:"Cozinha" },
        { id:"estoque", label:"SKU e estoque" }
      ]
    }
  ],

  scenarios: [
    {
      id:"cardapio-navega",
      name:"Percorrer o cardápio e voltar",
      page:"lista", tags:["@catálogo","@feliz"],
      impl:{ component:"CardapioLista", route:"/produtos" },
      given:{
        text:"que o lojista abriu o cardápio",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { then:"o cardápio lista os produtos com quantas variações cada um tem",
          check:(a, el) => el.querySelectorAll(".linha .qtd").length === 2 },
        { when:"o lojista abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { then:"o editor abre com as variações que vieram da API",
          check:(a, el) => el.querySelectorAll(".var").length === 3 },
        { when:"o lojista volta para o cardápio", click:'[data-act="voltar"]' },
        { then:"o cardápio continua completo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 },
        { when:"o lojista recarrega a lista", click:'[data-act="recarregar-lista"]' },
        { then:"os produtos continuam lá depois de recarregar",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"produto-consulta",
      name:"Consultar dois produtos seguidos",
      page:"produto", tags:["@catálogo","@feliz"],
      impl:{ component:"ProdutoEditor", route:"/produtos/:id" },
      given:{
        text:"que o lojista abriu o cardápio",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { then:"vê os três tamanhos com preço",
          check:(a, el) => el.querySelectorAll(".var").length === 3 },
        { when:"volta para o cardápio", click:'[data-act="voltar"]' },
        { when:"abre Calabresa", click:'[data-act="abrir-produto"][data-id="2"]' },
        { then:"o editor troca de produto sem sobrar dado do anterior",
          check:(a, el) => el.querySelectorAll(".var").length === 0
                        && (el.querySelector("h1") || {}).textContent === "Calabresa" }
      ]
    },
    {
      id:"cardapio-larguras",
      name:"O cardápio em cada largura",
      page:"lista", tags:["@catálogo","@retorno"],
      impl:{ component:"CardapioLista", notes:"grade por container query; ação fixa no rodapé até sm" },
      given:{
        text:"que o lojista abre o cardápio em <largura>",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { then:"a lista aparece em <colunas> coluna(s)",
          check:(a, el, s) => {
            /* measures the real columns when there is a layout engine; without
               one (the gate with no browser) it falls back to what the
               screen declares */
            const g = el.querySelector(".grade");
            let measured = 0;
            try {
              const gtc = g && getComputedStyle(g).gridTemplateColumns;
              if (gtc && gtc !== "none" && gtc.indexOf("px") > -1) measured = gtc.trim().split(/\s+/).length;
            } catch {}
            if (measured) return measured === Number(s.ex.colunas);
            const c = el.querySelector("[data-colunas]");
            return !!c && c.getAttribute("data-colunas") === String(s.ex.colunas);
          } },
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"]' },
        { then:"o editor abre sem perder a largura",
          check:(a, el) => !!el.querySelector('[data-act="voltar"]') },
        { when:"o lojista volta", click:'[data-act="voltar"]' },
        { then:"a ação principal fica <onde>",
          check:(a, el, s) => {
            const c = el.querySelector("[data-acao]");
            return !!c && c.getAttribute("data-acao") === String(s.ex.onde);
          } }
      ],
      examples:{
        columns:["largura","colunas","onde"],
        tableRows:[
          ["xxs", "1", "rodape"],
          ["md",  "2", "topo"],
          ["xlg", "3", "topo"]
        ]
      }
    },
    {
      id:"lista-carregando",
      name:"Abrir o cardápio e esperar ele chegar",
      page:"lista", tags:["@catálogo","@carregando"],
      impl:{ component:"CardapioLista", route:"/produtos", notes:"AsyncStateContainer + LoadingState" },
      network:{ "GET /api/produtos": "pendente" },
      given:{
        text:"que o lojista abriu o cardápio e a resposta ainda não chegou",
        state: async (ex, api) => {
          api.get("/api/produtos").catch(() => {});   /* left stalled on purpose */
          return { page:"lista", loading:true };
        }
      },
      steps:[
        { then:"a lista mostra o esqueleto no lugar das linhas",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a resposta do servidor chega", waitFor:"GET /api/produtos",
          applyState:(a, payload) => ({ ...a, products:payload, loading:false }) },
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"]' },
        { then:"o editor abre com os dados que vieram da API",
          check:(a, el) => !!el.querySelector('[data-act="voltar"]') }
      ]
    },
    {
      id:"lista-vazia",
      name:"Loja nova: do cardápio vazio ao primeiro produto",
      page:"lista", tags:["@catálogo","@vazio","@feliz","@pode:produto.editar"],
      impl:{ component:"CardapioLista", route:"/produtos", notes:"EmptyState com a ação principal dentro" },
      network:{ "GET /api/produtos": { status:200, payload:[] } },
      given:{
        text:"que a loja acabou de abrir e não cadastrou nada",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { then:"o cardápio convida a criar o primeiro produto",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"] [data-act="novo-produto"]') },
        { when:"o lojista cria o primeiro produto", click:'[data-act="novo-produto"]' },
        { then:"o editor abre no produto recém-criado",
          check:(a, el) => !!el.querySelector('[data-act="voltar"]') },
        { when:"o lojista adiciona a primeira variação", click:'[data-act="add"]' },
        { then:"a variação aparece com preço próprio",
          check:(a, el) => el.querySelectorAll(".var").length === 1 },
        { when:"o lojista salva", click:'[data-act="salvar"]' },
        { then:"a loja sai do zero com o produto salvo",
          check:(a, el) => !!el.querySelector(".tag") }
      ]
    },
    {
      id:"lista-erro",
      name:"Cardápio fora do ar e a tentativa de voltar",
      page:"lista", tags:["@catálogo","@erro","@recuperacao"],
      impl:{ component:"CardapioLista", route:"/produtos", notes:"ErrorState com recarregar" },
      /* the failure comes from the fixtures (fails once, works next time), not
         from network: — that is what lets Tentar de novo reach an outcome */
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu o cardápio e a API caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.listFailsOnce = true;
          try { return { page:"lista", products: await api.get("/api/produtos") }; }
          catch (e){ return { page:"lista", error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha em vez de ficar em branco",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta de novo", click:'[data-act="recarregar-lista"]' },
        { then:"o cardápio carrega e a explicação some",
          check:(a, el) => el.querySelectorAll(".linha").length === 2
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"]' },
        { then:"o editor abre normalmente depois da recuperação",
          check:(a, el) => !!el.querySelector('[data-act="voltar"]') }
      ]
    },
    {
      id:"criar-produto-falha",
      name:"Criar produto e receber recusa do servidor",
      page:"lista", tags:["@catálogo","@conflito"],
      impl:{ component:"CardapioLista", notes:"o erro fica dentro do EmptyState, sem trocar de tela" },
      network:{ "GET /api/produtos": { status:200, payload:[] },
              "POST /api/produtos": { status:500, payload:{ error_:"Não foi possível criar o produto" } } },
      given:{
        text:"que o cardápio está vazio e o servidor vai recusar a criação",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista tenta criar o produto", click:'[data-act="novo-produto"]' },
        { then:"o erro aparece sem tirar o convite da tela",
          check:(a, el) => !!el.querySelector('[data-erro="lista"]')
                        && !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista pede a lista de novo", click:'[data-act="recarregar-lista"]' },
        { then:"o cardápio segue vazio, sem levar embora o aviso do erro",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') }
      ]
    },
    {
      id:"produto-carregando",
      name:"Abrir um produto e esperar o detalhe",
      page:"produto", tags:["@catálogo","@carregando","@retorno"],
      impl:{ component:"AsyncStateContainer", notes:"LoadingState com esqueleto, sem spinner solto" },
      network:{ "GET /api/produtos/:id": "pendente" },
      given:{
        text:"que o lojista tocou num produto e o detalhe ainda não chegou",
        state: async (ex, api) => {
          api.get("/api/produtos/1").catch(() => {});
          return { page:"produto", loading:true };
        }
      },
      steps:[
        { then:"o editor mostra o esqueleto, não uma tela em branco",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { and:"a região é anunciada como ocupada",
          check:(a, el) => el.querySelector('[data-estado="carregando"]').getAttribute("aria-busy") === "true" },
        { when:"o detalhe chega", waitFor:"GET /api/produtos/:id",
          applyState:(a, payload) => ({ ...a, product:payload, loading:false }) },
        { when:"o lojista volta para o cardápio", click:'[data-act="voltar"]' },
        { then:"o cardápio aparece de novo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"catalogo-vazio",
      name:"Produto sem variações: criar a primeira e salvar",
      page:"produto", tags:["@catálogo","@vazio","@pode:produto.editar"],
      impl:{ component:"AsyncStateContainer", notes:"EmptyState com a ação principal dentro" },
      given:{
        text:"que o lojista está no cardápio e o produto 2 não tem variações",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Calabresa", click:'[data-act="abrir-produto"][data-id="2"]' },
        { then:"o editor convida a criar a primeira variação",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"] [data-act="add"]') },
        { when:"o lojista adiciona a variação", click:'[data-act="add"]' },
        { then:"a lista sai do vazio",
          check:(a, el) => el.querySelectorAll(".var").length === 1 && !el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista salva", click:'[data-act="salvar"]' },
        { then:"a confirmação aparece",
          check:(a, el) => !!el.querySelector(".tag") }
      ]
    },
    {
      id:"produto-fora-do-ar",
      name:"Detalhe do produto fora do ar",
      page:"produto", tags:["@catálogo","@erro","@recuperacao"],
      impl:{ component:"AsyncStateContainer", notes:"ErrorState com ação de tentar de novo" },
      network:{ "GET /api/produtos/:id": 503 },
      given:{
        text:"que o lojista tocou num produto e a API do catálogo caiu",
        state: async (ex, api) => {
          try { return { page:"produto", product: await api.get("/api/produtos/1") }; }
          catch (e){ return { page:"produto", error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha em vez de ficar vazia",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta de novo", click:'[data-act="tentar"]' },
        { then:"a explicação continua enquanto a API não volta",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista volta para o cardápio", click:'[data-act="voltar"]' },
        { then:"o cardápio carrega normalmente",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"primeira-variacao",
      name:"Do cardápio até criar e salvar a primeira variação",
      page:"produto", tags:["@catálogo","@basic","@pode:produto.editar","@feliz"],
      impl:{ component:"ProdutoEditor", route:"/produtos/:id", moduleName:"catalogo/produtos" },
      given:{
        text:"que o lojista está no cardápio",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Calabresa", click:'[data-act="abrir-produto"][data-id="2"]' },
        { when:"toca em Adicionar variação", click:'[data-act="add"]' },
        { then:"a variação aparece na lista com preço próprio",
          check:(a, el) => el.querySelectorAll(".var").length === 1 },
        { and:"o convite de lista vazia sai da tela",
          check:(a, el) => !el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista corrige o preço", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"22,00" } },
        { when:"salva o produto", click:'[data-act="salvar"]' },
        { then:"a confirmação aparece com a variação na tela",
          check:(a, el) => !!el.querySelector(".tag") && el.querySelectorAll(".var").length === 1 }
      ]
    },
    {
      id:"limite-por-plano",
      name:"Esbarrar no limite de variações do plano",
      page:"produto", tags:["@catálogo","@pode:produto.editar"],
      impl:{ component:"VariacoesLista", notes:"o limite vem do plano do tenant, não do formulário" },
      network: ex => (ex.resultado === "bloqueio"
        ? { "POST /api/produtos/:id/variacoes": { status:409, payload:{ error_:"Limite do plano atingido" } } }
        : {}),
      given:{
        text:"que a loja está no plano <plano> e já usou <usadas> variações",
        state: async (ex, api) => {
          const p = await api.get("/api/produtos/1");
          p.variants = p.variants.slice(0, Number(ex.usadas));
          return { page:"produto", product:p, limite:Number(ex.limite) };
        }
      },
      steps:[
        { when:"o lojista tenta adicionar mais uma variação", click:'[data-act="add"]' },
        { then:"a loja fica com <resultado>",
          check:(a, el, s) => s.ex.resultado === "bloqueio"
            ? !!el.querySelector('[data-erro="variacao"]')
            : !el.querySelector('[data-erro="variacao"]') },
        { when:"o lojista volta para o cardápio", click:'[data-act="voltar"]' },
        { then:"o cardápio continua acessível",
          check:(a, el) => el.querySelectorAll(".linha").length >= 2 }
      ],
      examples:{
        columns:["plano","limite","usadas","resultado"],
        tableRows:[
          ["Free",  "1", "1", "bloqueio"],
          ["Basic", "3", "2", "variação nova"],
          ["Pro",  "10", "3", "variação nova"]
        ]
      }
    },
    {
      id:"criar-variacao-falha",
      name:"Criação da variação recusada pelo servidor",
      page:"produto", tags:["@catálogo","@pode:produto.editar","@conflito"],
      impl:{ component:"VariacoesLista", notes:"o erro fica na lista, sem derrubar a página inteira" },
      network:{ "POST /api/produtos/:id/variacoes": { status:500, payload:{ error_:"Não foi possível criar a variação" } } },
      given:{
        text:"que o lojista está no cardápio e o servidor vai recusar a criação",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Calabresa", click:'[data-act="abrir-produto"][data-id="2"]' },
        { when:"tenta adicionar uma variação", click:'[data-act="add"]' },
        { then:"a tela explica que não deu certo",
          check:(a, el) => !!el.querySelector('[data-erro="variacao"]') },
        { and:"o convite continua na tela para tentar de novo",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') }
      ]
    },
    {
      id:"salvar-falha",
      name:"Salvar e receber recusa do servidor",
      page:"produto", tags:["@catálogo","@pode:produto.editar","@conflito"],
      impl:{ component:"ProdutoEditor", notes:"o erro fica junto do botão, sem perder o que foi digitado" },
      network:{ "PUT /api/produtos/:id": { status:422, payload:{ error_:"Preço inválido para a variação Pequena" } } },
      given:{
        text:"que o lojista está no cardápio e o servidor vai recusar o salvamento",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { and:"muda o preço da primeira variação", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"19,90" } },
        { when:"tenta salvar", click:'[data-act="salvar"]' },
        { then:"a tela mostra por que não salvou",
          check:(a, el) => !!el.querySelector('[data-erro="salvar"]') },
        { and:"o que ele digitou continua na tela",
          check:(a, el) => el.querySelectorAll(".var").length === 3 }
      ]
    },
    {
      id:"resposta-do-provedor",
      name:"Pagar o pedido e ver a resposta do provedor",
      page:"produto", tags:["@catálogo"],
      impl:{ component:"CheckoutPagamento", route:"/pedidos/:id/pagamento",
             notes:"Alert para recusa, ErrorState para indisponibilidade" },
      network: ex => ({ "POST /api/pagamentos": ex.resposta === "sucesso" ? null : {
        status: Number(ex.status), payload: { error_: ex.mensagem } } }),
      given:{
        text:"que o lojista está no cardápio e o provedor vai responder <resposta>",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { when:"confirma o pagamento", click:'[data-act="pagar"]' },
        { then:"a loja vê <tela>",
          check:(a, el, s) => s.ex.resposta === "sucesso"
            ? !!el.querySelector('[data-pg="ok"]')
            : !!el.querySelector('[data-pg="erro"]') },
        { and:"o texto explica o que aconteceu, sem jargão do provedor",
          check:(a, el, s) => s.ex.resposta === "sucesso"
            ? true
            : (el.querySelector('[data-pg="erro"]') || {}).textContent.indexOf(s.ex.mensagem) > -1 }
      ],
      examples:{
        columns:["resposta","status","mensagem","tela"],
        tableRows:[
          ["sucesso",         "200", "—",                              "confirmação"],
          ["cartão recusado", "402", "Cartão recusado pelo banco",     "aviso recuperável"],
          ["provedor fora",   "503", "Pagamentos indisponíveis agora", "aviso de indisponibilidade"]
        ]
      }
    },
    {
      id:"garcom-nao-edita",
      name:"Garçom abre o produto e não consegue editar",
      page:"produto", tags:["@garcom"],
      impl:{ component:"ProdutoEditor", notes:"somente leitura: sem campos, sem barra de ação" },
      given:{
        text:"que quem está no cardápio é um garçom",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o garçom abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { then:"os preços aparecem como texto, não como campo",
          check:(a, el) => el.querySelectorAll(".var").length === 3 && !el.querySelector('[data-campo="preco"]') },
        { and:"o botão Salvar não aparece",
          check:(a, el) => !el.querySelector('[data-act="salvar"]') },
        { and:"a tela explica por que está só de leitura",
          check:(a, el) => !!el.querySelector(".aviso") },
        { when:"o garçom volta para o cardápio", click:'[data-act="voltar"]' },
        { then:"o cardápio continua disponível para ele",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"margem-por-variacao",
      name:"Acompanhar margem por variação",
      page:"produto", tags:["@pro","@pode:relatorio.margem"],
      impl:{ component:"MargemCard", moduleName:"relatorios/margem" },
      given:{
        text:"que a loja acompanha margem e o lojista está no cardápio",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos"), margin:true })
      },
      steps:[
        { when:"o lojista abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { then:"o cartão de margem aparece no editor",
          check:(a, el) => !!el.querySelector('[data-card="margem"]') },
        { when:"o lojista volta para o cardápio", click:'[data-act="voltar"]' },
        { when:"recarrega o cardápio", click:'[data-act="recarregar-lista"]' },
        { then:"a lista volta inteira depois de consultar a margem",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"preparo-cozinha",
      name:"Ajustar preparo e salvar com a cozinha ligada",
      page:"produto", tags:["@cozinha","@pode:produto.editar"],
      impl:{ component:"ProdutoEditor", notes:"bloco de preparo por variação" },
      given:{
        text:"que a loja prepara os pedidos na cozinha e o lojista está no cardápio",
        state: async (ex, api) => ({ page:"lista", products: await api.get("/api/produtos") })
      },
      steps:[
        { when:"o lojista abre Pizza margherita", click:'[data-act="abrir-produto"][data-id="1"]' },
        { then:"o bloco da cozinha aparece junto das variações",
          check:(a, el) => el.textContent.indexOf("tempo de preparo") > -1 },
        { when:"o lojista salva o produto", click:'[data-act="salvar"]' },
        { then:"a confirmação aparece sem tirar as variações da tela",
          check:(a, el) => !!el.querySelector(".tag") && el.querySelectorAll(".var").length === 3 }
      ]
    }
  ],

  render(s){
    /* the page comes from the state; when in doubt, whatever has a list is
     the list */
    const pg = s.app.page || (s.app.products ? "lista" : "produto");
    return pg === "lista" ? listScreen(s) : productScreen(s);
  },

  defaultPage: "produto"
});

function listScreen(s){
  const items = s.app.products;
  const st_ = (s.app.loading || s.waitingFor()) ? "carregando"
               : s.app.error_       ? "erro"
               : (items && !items.length) ? "vazio"
               : "conteudo";

  const payload =
    st_ === "carregando" ? `
      <div class="estado" data-estado="carregando" aria-busy="true">
        <div class="esqueleto"><i></i><i></i><i></i><i></i></div>
        <p>Carregando o cardápio…</p>
      </div>` :
    st_ === "erro" ? `
      <div class="estado erro" data-estado="erro">
        <h2>Não deu para carregar o cardápio</h2>
        <p>${Proto.esc(s.app.error_ || "")}</p>
        <button class="btn" data-act="recarregar-lista">Tentar de novo</button>
      </div>` :
    st_ === "vazio" ? `
      <div class="estado" data-estado="vazio">
        ${s.app.listError ? `<div class="aviso" data-erro="lista">${Proto.esc(s.app.listError)}</div>` : ``}
        <h2>Nenhum produto no cardápio</h2>
        <p>Cadastre o primeiro item para a loja abrir.</p>
        <button class="btn" data-act="novo-produto">Criar produto</button>
      </div>` : `
      <div data-estado="conteudo" data-colunas="${s.rung === "xlg" ? 3 : (s.widthPx >= 768 ? 2 : 1)}"
           data-acao="${s.widthPx >= 768 ? "topo" : "rodape"}">
        <div class="grade">
        ${(items || []).map(p => `
          <button class="linha" data-act="abrir-produto" data-id="${Proto.esc(p.id)}">
            <span class="nome">
              <b>${Proto.esc(p.nameStr)}</b>
              <span class="cat">${Proto.esc(p.category)}</span>
            </span>
            <span class="qtd">${p.variants} ${p.variants === 1 ? "variação" : "variações"}</span>
          </button>`).join("")}
        </div>
        <div class="acao-fixa"><button class="btn" data-act="novo-produto">Novo produto</button></div>
      </div>`;

  return `
    <div class="app">
      <header class="app-hd">
        <h1>Cardápio</h1>
        <p>${items ? items.length + (items.length === 1 ? " produto" : " produtos") : "—"}</p>
        <button class="voltar" data-act="recarregar-lista">Recarregar</button>
      </header>
      <div class="app-bd" data-async data-estado-atual="${st_}">${payload}</div>
    </div>`;
}

function productScreen(s){
    const prod = s.app.product;
    const vars = (prod && prod.variants) || [];
    const canEdit = s.can("produto.editar");
    const incomplete = vars.some(v => !v.price);

    /* AsyncStateContainer: the four paths live in one place, and each marks
       data-estado — that is what the harness asserts on its own. */
    const st_ = (s.app.loading || s.waitingFor()) ? "carregando"
                 : s.app.error_       ? "erro"
                 : (!vars.length && !s.app.payment) ? "vazio"
                 : "conteudo";

    const loading = `
      <div class="estado" data-estado="carregando" aria-busy="true">
        <div class="esqueleto"><i></i><i></i><i></i></div>
        <p>Carregando o produto…</p>
      </div>`;

    const error_ = `
      <div class="estado erro" data-estado="erro">
        <h2>Não deu para carregar</h2>
        <p>${Proto.esc(s.app.error_ || "")}</p>
        <button class="btn" data-act="tentar">Tentar de novo</button>
      </div>`;

    const empty = `
      <div class="estado" data-estado="vazio">
        ${s.app.variantError ? `<div class="aviso" data-erro="variacao">${Proto.esc(s.app.variantError)}</div>` : ``}
        <h2>Nenhuma variação ainda</h2>
        <p>Crie tamanhos ou sabores sem duplicar o produto.</p>
        ${canEdit ? `<button class="btn" data-act="add">Adicionar variação</button>` : ``}
      </div>`;

    const content = `
      <div data-estado="conteudo" data-colunas="${s.widthPx >= 768 ? 2 : 1}"
           data-acao="${s.widthPx >= 768 ? "topo" : "rodape"}">
        ${s.app.variantError ? `<div class="aviso" data-erro="variacao">${Proto.esc(s.app.variantError)}</div>` : ``}
        ${s.app.saved ? `<span class="tag">Produto salvo</span>` : ``}
        ${s.app.saveError ? `<div class="aviso" data-erro="salvar">${Proto.esc(s.app.saveError)}</div>` : ``}
        ${s.app.payment ? `<span class="tag" data-pg="ok">Pagamento aprovado · ${Proto.esc(s.app.payment.id)}</span>` : ``}
        ${s.app.paymentError ? `<div class="aviso" data-pg="erro">${Proto.esc(s.app.paymentError)}</div>` : ``}

        ${!canEdit ? `<div class="aviso">
          Você pode consultar este produto, mas quem edita preço é o gerente ou o dono.
        </div>` : ``}

        <div class="grade">
        ${vars.map((v, i) => `
          <div class="var">
            <b>${Proto.esc(v.nameStr)}</b>
            ${canEdit
              ? `<input class="preco" data-campo="preco" data-i="${i}" inputmode="decimal"
                        value="${Proto.esc(v.price)}" placeholder="0,00"
                        aria-label="Preço de ${Proto.esc(v.nameStr)}">`
              : `<span>${v.price ? "R$ " + Proto.esc(v.price) : "sem preço"}</span>`}
          </div>`).join("")}

        ${s.app.blocked ? `<div class="trava">
          <h2>Limite de variações do plano</h2>
          <p>Este plano vai até ${Proto.esc(String(s.app.limite || 0))}. Suba de plano para criar mais.</p>
        </div>` : ``}

        ${s.app.margin && s.can("relatorio.margem") ? `
        <div class="card" data-card="margem">
          <h2>Margem por variação</h2>
          <p>Custo da ficha técnica contra o preço de venda de cada tamanho.</p>
        </div>` : ``}

        ${s.flag("cozinha") ? `
        <div class="card">
          <h2>Cozinha</h2>
          <p>Cada variação pode ter tempo de preparo diferente.</p>
        </div>` : ``}

        ${s.flag("estoque") ? `
        <div class="card">
          <h2>SKU e estoque</h2>
          <p>Cada variação baixa do estoque separadamente.</p>
        </div>` : ``}

        ${canEdit && vars.length ? `<button class="btn ghost" data-act="add">Adicionar variação</button>` : ``}
        <button class="btn ghost" data-act="pagar">Confirmar pagamento</button>
        </div>
      </div>`;

    const payload = st_ === "carregando" ? loading
                : st_ === "erro"       ? error_
                : st_ === "vazio"      ? empty
                : content;

    return `
      <div class="app">
        <header class="app-hd">
          <button class="voltar" data-act="voltar">← Cardápio</button>
          <h1>${prod ? Proto.esc(prod.nameStr) : "Produto"}</h1>
          <p>${vars.length ? vars.length + (vars.length === 1 ? " variação" : " variações") : "Sem variações"}</p>
        </header>

        <div class="app-bd" data-async data-estado-atual="${st_}">${payload}</div>

        ${canEdit && st_ === "conteudo" ? `<div class="actions acao-fixa">
          <button class="btn" data-act="salvar" ${incomplete || !vars.length ? "disabled" : ""}>Salvar</button>
        </div>` : ``}
      </div>`;
}

/* navigating is a request: opening the product fetches the detail, going
       back refetches the list */
Proto.on("click", '[data-act="abrir-produto"]', async (e, el) => {
  try {
    const p = await Proto.api.get(`/api/produtos/${el.dataset.id}`);
    Proto.set({ page:"produto", product:p, error_:null, saved:false });
  } catch (err){ Proto.set({ page:"produto", error_:err.message }); }
});

Proto.on("click", '[data-act="novo-produto"]', async () => {
  try {
    const newer = await Proto.api.post("/api/produtos", { nameStr:"Novo produto", category:"Sem categoria" });
    Proto.set({ page:"produto", product:newer, listError:null });
  } catch (err){ Proto.set({ listError: err.message }); }
});

Proto.on("click", '[data-act="voltar"]', async () => {
  try { Proto.set({ page:"lista", products: await Proto.api.get("/api/produtos"), error_:null }); }
  catch (err){ Proto.set({ page:"lista", error_:err.message }); }
});

Proto.on("click", '[data-act="recarregar-lista"]', async () => {
  try { Proto.set({ products: await Proto.api.get("/api/produtos"), error_:null }); }
  catch (err){ Proto.set({ error_:err.message }); }
});

/* asks the API and only then updates the screen — no inventing the record */
Proto.on("click", '[data-act="add"]', async (e, el, s) => {
  const prod = s.app.product;
  const vars = (prod && prod.variants) || [];
  const names = ["Pequena","Média","Grande","Família"];
  try {
    const fresh = await Proto.api.post(`/api/produtos/${prod.id}/variacoes`,
      { nameStr:names[vars.length] || "Nova", price:"18,00" });
    Proto.set({ product:{ ...prod, variants:vars.concat(fresh) }, saved:false, variantError:null });
  } catch (err){
    /* an item failure does not bring the page down: the AsyncStateContainer
       stays in the state it was in and the warning sits next to the list */
    Proto.set({ variantError: err.message });
  }
});

Proto.on("input", '[data-campo="preco"]', (e, el, s) => {
  const prod = s.app.product;
  const vars = ((prod && prod.variants) || []).slice();
  const i = Number(el.dataset.i);
  if (!vars[i]) return;
  vars[i] = { ...vars[i], price: el.value };
  Proto.set({ product:{ ...prod, variants:vars }, saved:false });
});

Proto.on("click", '[data-act="pagar"]', async (e, el, s) => {
  try {
    const pg = await Proto.api.post("/api/pagamentos", { val:4200 });
    Proto.set({ payment:pg, paymentError:null });
  } catch (err){
    Proto.set({ paymentError:err.message, statusPagamento:err.status });
  }
});

Proto.on("click", '[data-act="tentar"]', async () => {
  try { Proto.set({ product: await Proto.api.get("/api/produtos/1"), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});

Proto.on("click", '[data-act="salvar"]', async (e, el, s) => {
  const prod = s.app.product;
  try {
    const saved = await Proto.api.put(`/api/produtos/${prod.id}`, { variants: prod.variants });
    Proto.set({ product:saved, saved:true, saveError:null });
  } catch (err){
    Proto.set({ saveError: err.message, saved:false });
  }
});
