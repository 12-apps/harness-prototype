/* Several views, one data layer — the reference for `views` in Proto.init.

   Three people watch the same order: the customer on a phone, the waiter on a
   phone, the kitchen on a screen at the pass. Nothing here composes a stage
   and nothing here knows the other screens exist. This file renders ONE
   screen; `views` declares who is watching, and the harness calls `mount`
   once per view, each in a frame the width of that view's device.

   That is what keeps every rule written for one screen applying to each of
   them: a view is an ordinary screen. Each one is walked across the whole
   width ladder, owes its own arrangement, its own touch targets and its own
   loading / empty / error states. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Box } from "@12-apps/ui/mui/Box";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Paragraph } from "@12-apps/ui/typography/Paragraph";
import { Text } from "@12-apps/ui/typography/Text";
import { Button } from "@12-apps/ui/form/Button";
import { Card } from "@12-apps/ui/layout/Card";
import { CardContent } from "@12-apps/ui/layout/Card";
import { Skeleton } from "@12-apps/ui/layout/Skeleton";
import { Badge } from "@12-apps/ui/data-display/Badge";
import { Alert } from "@12-apps/ui/data-display/Alert";

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

/* Each actor has its own word for the same record. This is the whole point of
   the multi-actor screen: one status, three readings of it. */
const PALAVRA = {
  cliente:  { recebido:"Pedido recebido", preparando:"Preparando", pronto:"Saindo da cozinha", entregue:"Na mesa" },
  garcom:   { recebido:"Aguardando",      preparando:"Preparando", pronto:"Pegar na cozinha", entregue:"Entregue" },
  cozinha:  { recebido:"Recebido",        preparando:"Preparando", pronto:"Pronto",           entregue:"Pronto" }
};

/* Each screen reads its own subscription, so "the customer's screen is down
   and the kitchen's is fine" needs nothing held by hand: `s.dataError` carries
   the failure of the queries THIS view watches, and nothing else. */
/* A subscription answers in one of three ways, and the fourth state falls out
   of the answer: not yet (undefined), could not (dataError), nothing there,
   or content. No flag in `app` and nothing to keep in step by hand. */
function estadoDe(valor, erro, hasContent){
  return erro                ? "erro"
       : valor === undefined ? "carregando"
       : !hasContent         ? "vazio"
       :                       "conteudo";
}

/* the refusal shows on the screen that tried, not on all of them */
function recusa(s){
  const w = s.app.writeError;
  return w && w.view === s.view ? w.message : null;
}

function Carregando({ label }){
  return (
    <Box className="estado" data-estado="carregando" aria-busy="true">
      <Skeleton />
      <Skeleton />
      <Paragraph>{label}</Paragraph>
    </Box>
  );
}

/* ---------- the customer's phone ---------- */
function VistaCliente({ s }){
  const c = s.data.comanda;
  const st = estadoDe(s.data.comanda, s.dataError.comanda, !!(c && c.itens && c.itens.length));

  const body =
    st === "carregando" ? <Carregando label="Abrindo sua comanda…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h3">Não deu para abrir a comanda</Heading>
        <Paragraph>{s.dataError.comanda || ""}</Paragraph>
        <Button className="btn" data-act="recarregar-comanda">Tentar de novo</Button>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h3">Sua comanda está vazia</Heading>
        <Paragraph>Escolha algo no cardápio para começar.</Paragraph>
        <Button className="btn" data-act="recarregar-comanda">Ver cardápio</Button>
      </Box>
    ) : (
      <Box className="estado" data-estado="conteudo">
        <Badge className="situacao" data-situacao={c.status}>{PALAVRA.cliente[c.status]}</Badge>
        {c.itens.map(i => (
          <Box className="linha" key={i.id}>
            <Text className="item">{i.qtd}× {i.nameStr}</Text>
          </Box>
        ))}
      </Box>
    );

  return (
    <Box className="vista telefone">
      <Heading level="h2">Comanda · {(c && c.mesa) || "—"}</Heading>
      {body}
    </Box>
  );
}

/* ---------- the waiter's phone ---------- */
function VistaGarcom({ s }){
  const lista = s.data.pedidos;
  const st = estadoDe(s.data.pedidos, s.dataError.pedidos, !!(lista && lista.length));

  const body =
    st === "carregando" ? <Carregando label="Carregando o salão…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h3">Salão fora do ar</Heading>
        <Paragraph>{s.dataError.pedidos || ""}</Paragraph>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h3">Nenhum pedido aberto</Heading>
        <Paragraph>Abra a comanda quando a mesa pedir.</Paragraph>
        {recusa(s) && <Alert className="aviso" data-erro="escrita">{recusa(s)}</Alert>}
        <Button className="btn" data-act="abrir-comanda">Abrir comanda na mesa 7</Button>
      </Box>
    ) : (
      <Box className="estado" data-estado="conteudo">
        {lista.map(p => (
          <Card className="linha" key={p.id}>
            <CardContent>
              <Text className="mesa">{p.mesa}</Text>
              <Badge className="situacao" data-situacao={p.status}>{PALAVRA.garcom[p.status]}</Badge>
              {p.status === "pronto" && (
                <Button className="btn" data-act="entregar" data-id={p.id}>Entreguei na mesa</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    );

  return (
    <Box className="vista telefone">
      <Heading level="h2">Salão</Heading>
      <Button className="btn" data-act="recarregar-salao">Atualizar</Button>
      {body}
    </Box>
  );
}

/* ---------- the kitchen's screen ---------- */
function Raia({ titulo, chave, estados, fila, acao, rotulo }){
  const quais = estados || [chave];
  const cards = fila.filter(c => quais.indexOf(c.status) > -1);
  return (
    <Box className="raia" data-raia={chave}>
      <Heading level="h3">{titulo}</Heading>
      {cards.map(c => (
        <Card className="ficha" key={c.id}>
          <CardContent>
            <Text className="mesa">{c.mesa}</Text>
            <Text className="qtd">{c.itens} item(s)</Text>
            {acao && <Button className="btn" data-act={acao} data-id={c.id}>{rotulo}</Button>}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function VistaCozinha({ s }){
  const fila = s.data.fila;
  const st = estadoDe(s.data.fila, s.dataError.fila, !!(fila && fila.length));

  const body =
    st === "carregando" ? <Carregando label="Carregando a fila…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h3">A fila não carregou</Heading>
        <Paragraph>{s.dataError.fila || ""}</Paragraph>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h3">Nenhuma comanda na fila</Heading>
        <Paragraph>A cozinha está em dia.</Paragraph>
      </Box>
    ) : (
      <Box className="estado quadro" data-estado="conteudo">
        {recusa(s) && <Alert className="aviso" data-erro="escrita">{recusa(s)}</Alert>}
        <Raia titulo="Recebidos"  chave="recebido"   fila={fila} acao="iniciar"  rotulo="Iniciar" />
        <Raia titulo="Preparando" chave="preparando" fila={fila} acao="concluir" rotulo="Concluir" />
        {/* the pass is done once the plate has left it: whether the waiter has
            already put it on the table is the waiter's business, not this
            screen's — which is exactly what unchanged:["cozinha"] specifies */}
        <Raia titulo="Prontos"    chave="pronto"     fila={fila} estados={["pronto","entregue"]} />
      </Box>
    );

  return (
    <Box className="vista mesa">
      <Heading level="h2">Cozinha</Heading>
      <Button className="btn" data-act="recarregar-fila">Atualizar</Button>
      {body}
    </Box>
  );
}

/* One screen per call. `s.view` says which one the harness is asking for. */
const TELAS = { cliente:VistaCliente, garcom:VistaGarcom, cozinha:VistaCozinha };

Proto.init({
  title: "salão · comanda em três telas",
  library: "@12-apps/ui",
  data_:  window.PROTO_DATA,
  routes: window.PROTO_ROUTES,
  viewport: "xlg",

  feature: {
    name: "Uma comanda, três telas",
    as:   "salão",
    want: "que cliente, garçom e cozinha vejam o mesmo pedido ao mesmo tempo",
    so:   "ninguém precise perguntar em que pé está",
    impl: { component:"SalaoComanda", route:"/salao", moduleName:"salao/comanda" }
  },

  /* Who is watching, and on what. Any number, any actors — the harness only
     needs a width for each. `actor` names an option of an exclusive context
     dimension, so `s.can(...)` inside a view answers for that view's person
     rather than for whoever is at the bench. */
  views: [
    /* Each screen says what it watches, and that is the whole of the
       synchronisation: a write anywhere invalidates, the harness re-reads,
       and every view holding that query redraws. No handler below fetches on
       another device's behalf, because no real device can. */
    { id:"cliente", label:"Cliente", actor:"cliente", viewport:"se",
      watches:{ comanda:"GET /api/comandas/7" } },
    { id:"garcom",  label:"Garçom",  actor:"garcom",  viewport:"se",
      watches:{ pedidos:"GET /api/garcom/pedidos" } },
    { id:"cozinha", label:"Cozinha", actor:"cozinha", viewport:"ipad",
      watches:{ fila:"GET /api/cozinha/fila" } }
  ],

  context: [
    {
      id:"papel", label:"Papel", kind:"opcao", value:"cliente",
      options:[
        { id:"cliente", label:"Cliente", allows:["comanda.ver"] },
        { id:"garcom",  label:"Garçom",  allows:["comanda.ver","mesa.entregar"] },
        { id:"cozinha", label:"Cozinha", allows:["comanda.ver","fila.operar"] }
      ]
    }
  ],

  scenarios: [
    /* Not one of these fetches anything. Each view declared what it watches,
       so the Dado only says what the world looks like; the harness reads it. */
    {
      id:"comanda-ciclo",
      name:"A comanda atravessa as três telas",
      page:"salao", tags:["@salao","@feliz"],
      given:{ text:"que a mesa 7 pediu e as três telas estão abertas",
              state:() => ({ page:"salao" }) },
      steps:[
        { then:"o cliente vê que o pedido foi recebido", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="recebido"]') },
        { when:"a cozinha inicia o preparo", on:"cozinha", click:'[data-act="iniciar"]',
          propagates:["cliente","garcom"] },
        { then:"o cliente passa a ver Preparando", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="preparando"]') },
        { then:"o garçom também vê Preparando", on:"garcom",
          check:(a, el) => !!el.querySelector('[data-situacao="preparando"]') },
        { when:"a cozinha conclui", on:"cozinha", click:'[data-act="concluir"]',
          propagates:["cliente","garcom"] },
        { then:"o garçom é chamado para pegar na cozinha", on:"garcom",
          check:(a, el) => !!el.querySelector('[data-act="entregar"]') },
        /* the one the whole feature exists for: the customer's screen has to
           move and the kitchen's has to stay exactly where it was */
        { when:"o garçom entrega na mesa", on:"garcom", click:'[data-act="entregar"]',
          propagates:["cliente","garcom"], unchanged:["cozinha"] },
        { then:"o cliente vê que chegou na mesa", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="entregue"]') },
        { then:"a cozinha continua com a ficha na raia de prontos", on:"cozinha",
          check:(a, el) => !!el.querySelector('[data-raia="pronto"] .ficha') }
      ]
    },

    {
      id:"comanda-abre",
      name:"O salão vazio e a comanda que abre nele",
      page:"salao", tags:["@salao","@vazio"],
      given:{
        text:"que nenhuma mesa pediu nada ainda",
        state: async (ex, api) => { api.data_.comandas = {}; return { page:"salao" }; }
      },
      steps:[
        { then:"as três telas convidam a começar",
          check:(a, el, s) => ["cliente","garcom","cozinha"]
            .every(v => !!s.views[v].querySelector('[data-estado="vazio"]')) },
        { when:"o garçom abre a comanda da mesa 7", on:"garcom", click:'[data-act="abrir-comanda"]',
          propagates:["cliente","garcom","cozinha"] },
        { then:"a cozinha passa a ver a ficha", on:"cozinha",
          check:(a, el) => !!el.querySelector('[data-raia="recebido"] .ficha') },
        { when:"a cozinha inicia o preparo", on:"cozinha", click:'[data-act="iniciar"]',
          propagates:["cliente"] },
        { then:"o cliente acompanha", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="preparando"]') }
      ]
    },

    {
      id:"comanda-carregando",
      name:"As três telas esperando cada uma a sua resposta",
      page:"salao", tags:["@salao","@carregando"],
      /* three devices open at once and three subscriptions are outstanding.
         They do not arrive together, and no screen waits for another's. */
      network:{ "GET /api/comandas/:id":"pendente",
                "GET /api/garcom/pedidos":"pendente",
                "GET /api/cozinha/fila":"pendente" },
      given:{ text:"que as três telas pediram e o servidor ainda não respondeu",
              state:() => ({ page:"salao" }) },
      steps:[
        { then:"as três telas mostram o esqueleto",
          check:(a, el, s) => ["cliente","garcom","cozinha"]
            .every(v => !!s.views[v].querySelector('[data-estado="carregando"]')) },
        { when:"a comanda do cliente chega", waitFor:"GET /api/comandas/:id",
          propagates:["cliente"], unchanged:["cozinha"] },
        { then:"o cliente vê o pedido recebido", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="recebido"]') },
        { when:"o salão do garçom chega", waitFor:"GET /api/garcom/pedidos",
          propagates:["garcom"] },
        { then:"o garçom vê a mesa esperando", on:"garcom",
          check:(a, el) => !!el.querySelector('[data-situacao="recebido"]') },
        { when:"a fila da cozinha chega", waitFor:"GET /api/cozinha/fila",
          propagates:["cozinha"] },
        { then:"a cozinha desenha o quadro", on:"cozinha",
          check:(a, el) => !!el.querySelector('[data-raia="recebido"] .ficha') },
        /* The distinction the whole layer exists to make. Writing moves the
           SERVER; it does not move anybody's screen. Each of these three is
           listening again and has not been answered yet, so the kitchen's own
           action reaches none of them — not even the kitchen. */
        { when:"a cozinha inicia o preparo", on:"cozinha", click:'[data-act="iniciar"]',
          unchanged:["cliente","garcom","cozinha"] },
        { when:"o servidor avisa as três telas", waitFor:true,
          propagates:["cliente","garcom","cozinha"] },
        { then:"só então o cliente vê Preparando", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="preparando"]') },
        { then:"e a cozinha vê a ficha na raia de preparando", on:"cozinha",
          check:(a, el) => !!el.querySelector('[data-raia="preparando"] .ficha') }
      ]
    },

    {
      id:"comanda-erro",
      name:"A fila cai e a cozinha se recupera",
      page:"salao", tags:["@salao","@erro","@recuperacao"],
      /* the failure comes from the fixtures (fails once, works next time), not
         from network: — that is what lets Tentar de novo reach an outcome */
      fixtureFailure:true,
      given:{
        text:"que a fila da cozinha caiu na primeira leitura",
        state: async (ex, api) => { api.data_.filaFalhaUmaVez = true; return { page:"salao" }; }
      },
      steps:[
        { then:"a cozinha explica a falha em vez de ficar em branco", on:"cozinha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { then:"e as outras telas seguem inteiras", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="recebido"]') },
        { when:"a cozinha tenta de novo", on:"cozinha", click:'[data-act="recarregar-fila"]',
          propagates:["cozinha"] },
        { then:"o quadro volta e a explicação some", on:"cozinha",
          check:(a, el) => !el.querySelector('[data-estado="erro"]')
                        && !!el.querySelector('[data-raia="recebido"] .ficha') },
        { when:"a cozinha inicia o preparo", on:"cozinha", click:'[data-act="iniciar"]',
          propagates:["cliente"] },
        { then:"o cliente vê Preparando depois da recuperação", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-situacao="preparando"]') }
      ]
    },

    {
      id:"comanda-escrita-recusada",
      name:"A cozinha inicia e o servidor recusa",
      page:"salao", tags:["@salao","@conflito"],
      network:{ "POST /api/comandas/:id/status":
                { status:500, payload:{ error_:"Não foi possível mudar o status" } } },
      given:{ text:"que o servidor vai recusar a mudança de status",
              state:() => ({ page:"salao" }) },
      steps:[
        { when:"a cozinha tenta iniciar o preparo", on:"cozinha", click:'[data-act="iniciar"]',
          unchanged:["cliente"] },
        { then:"a recusa aparece sem tirar o quadro da tela", on:"cozinha",
          check:(a, el) => !!el.querySelector('[data-erro="escrita"]')
                        && !!el.querySelector('[data-raia="recebido"] .ficha') },
        { when:"a cozinha recarrega a fila", on:"cozinha", click:'[data-act="recarregar-fila"]' },
        { then:"o cliente continua vendo o pedido apenas recebido", on:"cliente",
          check:(a, el, s) => !!el.querySelector('[data-situacao="recebido"]')
                           && !!s.views.cozinha.querySelector('[data-erro="escrita"]') }
      ]
    },

    {
      id:"comanda-tudo-fora",
      name:"Cliente e garçom sem resposta do servidor",
      page:"salao", tags:["@salao","@conflito"],
      network:{ "GET /api/comandas/:id":500, "GET /api/garcom/pedidos":500 },
      given:{ text:"que a comanda e o salão estão fora do ar",
              state:() => ({ page:"salao" }) },
      steps:[
        { then:"o cliente vê a explicação em vez de uma tela vazia", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o cliente tenta de novo", on:"cliente", click:'[data-act="recarregar-comanda"]' },
        { then:"a comanda continua fora do ar", on:"cliente",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o garçom tenta atualizar o salão", on:"garcom", click:'[data-act="recarregar-salao"]' },
        { then:"o salão também segue fora do ar, e a cozinha não", on:"garcom",
          check:(a, el, s) => !!el.querySelector('[data-estado="erro"]')
                           && !!s.views.cozinha.querySelector('[data-raia="recebido"]') }
      ]
    },

    {
      id:"comanda-abre-recusada",
      name:"O garçom tenta abrir a comanda e o servidor recusa",
      page:"salao", tags:["@salao","@conflito"],
      network:{ "POST /api/comandas":
                { status:500, payload:{ error_:"Não foi possível abrir a comanda" } } },
      given:{
        text:"que o salão está vazio e o servidor vai recusar a abertura",
        state: async (ex, api) => { api.data_.comandas = {}; return { page:"salao" }; }
      },
      steps:[
        { when:"o garçom tenta abrir a comanda", on:"garcom", click:'[data-act="abrir-comanda"]',
          unchanged:["cozinha"] },
        { then:"a recusa aparece sem tirar o convite da tela", on:"garcom",
          check:(a, el) => !!el.querySelector('[data-erro="escrita"]')
                        && !!el.querySelector('[data-estado="vazio"]') },
        { when:"o garçom atualiza o salão", on:"garcom", click:'[data-act="recarregar-salao"]' },
        { then:"o salão segue vazio e a cozinha também", on:"garcom",
          check:(a, el, s) => !!el.querySelector('[data-estado="vazio"]')
                           && !!s.views.cozinha.querySelector('[data-estado="vazio"]') }
      ]
    }
  ],

  mount: (el, state) => {
    const Tela = TELAS[state.view] || VistaCliente;
    const draw = () => flushSync(() => rootFor(el).render(<Tela s={state} />));
    try { draw(); }
    catch { roots.delete(el); draw(); }
  }
});

/* Nothing here re-reads anything, and nothing here mentions another screen.
   The write moves the server; every view that watches a query touched by it
   re-reads and redraws on its own. That is the whole synchronisation, and it
   is the harness's job because on real devices it cannot be anyone else's. */
async function mudarStatus(el, status, view){
  try {
    await Proto.api.post("/api/comandas/" + el.getAttribute("data-id") + "/status", { status });
    Proto.set({ writeError:null });
  } catch (err){
    Proto.set({ writeError:{ view, message: err.message } });
  }
}

Proto.on("click", '[data-act="iniciar"]',  (e, el) => mudarStatus(el, "preparando", "cozinha"));
Proto.on("click", '[data-act="concluir"]', (e, el) => mudarStatus(el, "pronto",     "cozinha"));
Proto.on("click", '[data-act="entregar"]', (e, el) => mudarStatus(el, "entregue",   "garcom"));

Proto.on("click", '[data-act="abrir-comanda"]', async () => {
  try {
    await Proto.api.post("/api/comandas", { mesa:7 });
    Proto.set({ writeError:null });
  } catch (err){
    Proto.set({ writeError:{ view:"garcom", message: err.message } });
  }
});

/* the only hand-written read left, and it is a real control: pull to refresh */
Proto.on("click", '[data-act="recarregar-fila"]',   () => Proto.refresh("fila"));

Proto.on("click", '[data-act="recarregar-salao"]',  () => Proto.refresh("pedidos"));

Proto.on("click", '[data-act="recarregar-comanda"]', () => Proto.refresh("comanda"));
