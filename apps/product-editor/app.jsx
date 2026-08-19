import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Box } from "@12-apps/ui/mui/Box";
import { AppBar } from "@12-apps/ui/mui/AppBar";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Paragraph } from "@12-apps/ui/typography/Paragraph";
import { Text } from "@12-apps/ui/typography/Text";
import { Button } from "@12-apps/ui/form/Button";
import { Input } from "@12-apps/ui/form/Input";
import { Card } from "@12-apps/ui/layout/Card";
import { Skeleton } from "@12-apps/ui/layout/Skeleton";
import { Badge } from "@12-apps/ui/data-display/Badge";
import { Alert } from "@12-apps/ui/data-display/Alert";
import { Banner } from "@12-apps/ui/data-display/Banner";

/* One React root per element the harness hands us, rendering into a container
   of its own — never straight into the harness's element. The suite draws into
   throwaway probes and clears them between passes; React would otherwise try to
   remove nodes that are no longer its children and throw NotFoundError on
   commit, asynchronously, where a try/catch around render cannot reach it.

   replaceChildren is what keeps it to exactly one: the harness does not clear
   the element before calling mount — it expects mount to own it — so appending
   a container per call silently stacked 25 rendered screens in one probe, and
   the audit then found an error mark belonging to a scenario that had finished
   long before. `display:contents` keeps the container out of layout, so the
   width rules still measure the real boxes. */
const roots = new WeakMap();
function rootFor(el){
  const entry = roots.get(el);
  if (entry && entry.host.parentNode === el) return entry.root;
  const host = document.createElement("div");
  host.style.display = "contents";
  el.replaceChildren(host);
  const root = createRoot(host);
  roots.set(el, { host, root });
  return root;
}

/* `state` on a screen tells the harness which of the four paths is showing,
   and it is what the three mandatory state scenarios asserts against. */
function stateOf(s, hasContent){
  return (s.app.loading || s.waitingFor()) ? "carregando"
       : s.app.error_                      ? "erro"
       : !hasContent                       ? "vazio"
       :                                     "conteudo";
}

function Loading({ bars, label }){
  return (
    <Box className="estado" data-estado="carregando" aria-busy="true">
      <Box className="esqueleto">
        {Array.from({ length: bars }, (_, i) => <Skeleton key={i} />)}
      </Box>
      <Paragraph>{label}</Paragraph>
    </Box>
  );
}

function ListScreen({ s }){
  const items = s.app.products;
  const st = stateOf(s, !(items && !items.length));
  const columns = s.rung === "xlg" ? 3 : (s.widthPx >= 768 ? 2 : 1);

  const body =
    st === "carregando" ? <Loading bars={4} label="Carregando o cardápio…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h2">Não deu para carregar o cardápio</Heading>
        <Paragraph>{s.app.error_ || ""}</Paragraph>
        <Button className="btn" data-act="recarregar-lista">Tentar de novo</Button>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        {s.app.listError && <Alert className="aviso" data-erro="lista">{s.app.listError}</Alert>}
        <Heading level="h2">Nenhum produto no cardápio</Heading>
        <Paragraph>Cadastre o primeiro item para a loja abrir.</Paragraph>
        <Button className="btn" data-act="novo-produto">Criar produto</Button>
      </Box>
    ) : (
      <Box data-estado="conteudo" data-colunas={columns}
           data-acao={s.widthPx >= 768 ? "topo" : "rodape"}>
        <Box className="grade">
          {(items || []).map(p => (
            <Button key={p.id} className="linha" data-act="abrir-produto" data-id={p.id}>
              <Text className="nome">
                <Text weight="bold">{p.nameStr}</Text>
                <Text className="cat">{p.category}</Text>
              </Text>
              <Text className="qtd">
                {p.variants} {p.variants === 1 ? "variação" : "variações"}
              </Text>
            </Button>
          ))}
        </Box>
        <Box className="acao-fixa">
          <Button className="btn" data-act="novo-produto">Novo produto</Button>
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Heading level="h1">Cardápio</Heading>
        <Paragraph>
          {items ? items.length + (items.length === 1 ? " produto" : " produtos") : "—"}
        </Paragraph>
        <Button className="voltar" data-act="recarregar-lista">Recarregar</Button>
      </AppBar>
      <Box className="app-bd" data-async data-estado-atual={st}>{body}</Box>
    </Box>
  );
}

function ProductScreen({ s }){
  const prod = s.app.product;
  const vars = (prod && prod.variants) || [];
  const canEdit = s.can("produto.editar");
  const incomplete = vars.some(v => !v.price);
  const st = stateOf(s, vars.length || s.app.payment);

  const body =
    st === "carregando" ? <Loading bars={3} label="Carregando o produto…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h2">Não deu para carregar</Heading>
        <Paragraph>{s.app.error_ || ""}</Paragraph>
        <Button className="btn" data-act="tentar">Tentar de novo</Button>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        {s.app.variantError && <Alert className="aviso" data-erro="variacao">{s.app.variantError}</Alert>}
        <Heading level="h2">Nenhuma variação ainda</Heading>
        <Paragraph>Crie tamanhos ou sabores sem duplicar o produto.</Paragraph>
        {canEdit && <Button className="btn" data-act="add">Adicionar variação</Button>}
      </Box>
    ) : (
      <Box data-estado="conteudo" data-colunas={s.widthPx >= 768 ? 2 : 1}
           data-acao={s.widthPx >= 768 ? "topo" : "rodape"}>
        {s.app.variantError && <Alert className="aviso" data-erro="variacao">{s.app.variantError}</Alert>}
        {s.app.saved && <Badge className="tag">Produto salvo</Badge>}
        {s.app.saveError && <Alert className="aviso" data-erro="salvar">{s.app.saveError}</Alert>}
        {s.app.payment && (
          <Badge className="tag" data-pg="ok">Pagamento aprovado · {s.app.payment.id}</Badge>
        )}
        {s.app.paymentError && <Alert className="aviso" data-pg="erro">{s.app.paymentError}</Alert>}

        {!canEdit && (
          <Alert className="aviso">
            Você pode consultar este produto, mas quem edita preço é o gerente ou o dono.
          </Alert>
        )}

        <Box className="grade">
          {vars.map((v, i) => (
            <Card key={v.id || i} className="var">
              <Text weight="bold">{v.nameStr}</Text>
              {canEdit ? (
                <Input
                  value={v.price}
                  placeholder="0,00"
                  slotProps={{ htmlInput: {
                    className: "preco", "data-campo": "preco", "data-i": i,
                    inputMode: "decimal", "aria-label": "Preço de " + v.nameStr
                  } }}
                />
              ) : (
                <Text>{v.price ? "R$ " + v.price : "sem preço"}</Text>
              )}
            </Card>
          ))}

          {s.app.blocked && (
            <Banner className="trava">
              <Heading level="h2">Limite de variações do plano</Heading>
              <Paragraph>
                Este plano vai até {String(s.app.limite || 0)}. Suba de plano para criar mais.
              </Paragraph>
            </Banner>
          )}

          {s.app.margin && s.can("relatorio.margem") && (
            <Card className="card" data-card="margem">
              <Heading level="h2">Margem por variação</Heading>
              <Paragraph>Custo da ficha técnica contra o preço de venda de cada tamanho.</Paragraph>
            </Card>
          )}

          {s.flag("cozinha") && (
            <Card className="card">
              <Heading level="h2">Cozinha</Heading>
              <Paragraph>Cada variação pode ter tempo de preparo diferente.</Paragraph>
            </Card>
          )}

          {s.flag("estoque") && (
            <Card className="card">
              <Heading level="h2">SKU e estoque</Heading>
              <Paragraph>Cada variação baixa do estoque separadamente.</Paragraph>
            </Card>
          )}

          {canEdit && vars.length > 0 && (
            <Button className="btn ghost" data-act="add">Adicionar variação</Button>
          )}
          <Button className="btn ghost" data-act="pagar">Confirmar pagamento</Button>
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="voltar">← Cardápio</Button>
        <Heading level="h1">{prod ? prod.nameStr : "Produto"}</Heading>
        <Paragraph>
          {vars.length ? vars.length + (vars.length === 1 ? " variação" : " variações") : "Sem variações"}
        </Paragraph>
      </AppBar>

      <Box className="app-bd" data-async data-estado-atual={st}>{body}</Box>

      {canEdit && st === "conteudo" && (
        <Box className="actions acao-fixa">
          <Button className="btn" data-act="salvar" disabled={incomplete || !vars.length}>
            Salvar
          </Button>
        </Box>
      )}
    </Box>
  );
}

function Screen({ s }){
  /* the page comes from the state; when in doubt, whatever has a list is
     the list */
  const pg = s.app.page || (s.app.products ? "lista" : "produto");
  return pg === "lista" ? <ListScreen s={s} /> : <ProductScreen s={s} />;
}

/* Context, scenarios and render — the specification itself.
   Loaded after data.js, so PROTO_DATA and PROTO_ROUTES already exist.

   React, and every element comes from the design system: there is no raw
   HTML in this file and the gate refuses to run one that has any. The DOM
   contract the scenarios assert on — the data-* hooks and the class names —
   is carried through on the components, which is why the same 68 checks
   still hold after the port. */

Proto.init({
  title: "editor de produto",

  library: "@12-apps/ui",

  data_: window.PROTO_DATA,
  routes: window.PROTO_ROUTES,
  latency: [250, 750],   /* a random range, on screen only; verification runs with no delay */


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

  /* flushSync, not render: the harness measures the DOM on the very next
     line, and a concurrent commit would not be there yet. */
  mount(el, state){
    const draw = () => flushSync(() => rootFor(el).render(<Screen s={state} />));
    try { draw(); }
    catch { roots.delete(el); draw(); }
  },

  defaultPage: "produto"
});

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
