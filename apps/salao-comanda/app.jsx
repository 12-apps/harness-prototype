/* SPIKE — three actors on one stage, sharing one data layer.

   This is not a finished prototype. It exists to measure what a multi-device
   screen collides with in the harness as it stands today: three views side by
   side, each meant to be a different device, all reading the same fixtures
   through the same routes. What the gate says about it is the finding. */
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

/* One `app.error_` cannot say "the customer's screen is down but the kitchen's
   is fine": the harness models ONE screen with ONE state. Three views need
   three error fields, held by hand inside the single app state — and
   `s.waitingFor()` is global too, so a request from any view puts all three
   into carregando unless each keeps its own flag. */
function estadoDe(s, erro, hasContent){
  return (s.app.loading || s.waitingFor()) ? "carregando"
       : erro                              ? "erro"
       : !hasContent                       ? "vazio"
       :                                     "conteudo";
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
  const c = s.app.comanda;
  const st = estadoDe(s, s.app.erroCliente, !!(c && c.itens && c.itens.length));

  const body =
    st === "carregando" ? <Carregando label="Abrindo sua comanda…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h3">Não deu para abrir a comanda</Heading>
        <Paragraph>{s.app.erroCliente || ""}</Paragraph>
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
            <Text>{i.qtd}× {i.nameStr}</Text>
          </Box>
        ))}
      </Box>
    );

  return (
    <Box className="vista telefone" data-view="cliente">
      <Heading level="h2">Comanda · {(c && c.mesa) || "—"}</Heading>
      {body}
    </Box>
  );
}

/* ---------- the waiter's phone ---------- */
function VistaGarcom({ s }){
  const lista = s.app.pedidos;
  const st = estadoDe(s, s.app.erroGarcom, !!(lista && lista.length));

  const body =
    st === "carregando" ? <Carregando label="Carregando o salão…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h3">Salão fora do ar</Heading>
        <Paragraph>{s.app.erroGarcom || ""}</Paragraph>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h3">Nenhum pedido aberto</Heading>
        <Paragraph>Quando alguém pedir, aparece aqui.</Paragraph>
      </Box>
    ) : (
      <Box className="estado" data-estado="conteudo">
        {lista.map(p => (
          <Card className="linha" key={p.id}>
            <CardContent>
              <Text>{p.mesa}</Text>
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
    <Box className="vista telefone" data-view="garcom">
      <Heading level="h2">Salão</Heading>
      <Button className="btn" data-act="recarregar-salao">Atualizar</Button>
      {body}
    </Box>
  );
}

/* ---------- the kitchen's screen ---------- */
function Raia({ titulo, chave, fila, acao, rotulo }){
  const cards = fila.filter(c => c.status === chave);
  return (
    <Box className="raia" data-raia={chave}>
      <Heading level="h3">{titulo}</Heading>
      {cards.map(c => (
        <Card className="ficha" key={c.id}>
          <CardContent>
            <Text>{c.mesa}</Text>
            <Text>{c.itens} item(s)</Text>
            {acao && <Button className="btn" data-act={acao} data-id={c.id}>{rotulo}</Button>}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function VistaCozinha({ s }){
  const fila = s.app.fila;
  const st = estadoDe(s, s.app.erroCozinha, !!(fila && fila.length));

  const body =
    st === "carregando" ? <Carregando label="Carregando a fila…" /> :
    st === "erro" ? (
      <Box className="estado erro" data-estado="erro">
        <Heading level="h3">A fila não carregou</Heading>
        <Paragraph>{s.app.erroCozinha || ""}</Paragraph>
      </Box>
    ) :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h3">Nenhuma comanda na fila</Heading>
        <Paragraph>A cozinha está em dia.</Paragraph>
      </Box>
    ) : (
      <Box className="estado quadro" data-estado="conteudo">
        {s.app.writeError && <Alert className="aviso" data-erro="escrita">{s.app.writeError}</Alert>}
        <Raia titulo="Recebidos"  chave="recebido"   fila={fila} acao="iniciar"  rotulo="Iniciar" />
        <Raia titulo="Preparando" chave="preparando" fila={fila} acao="concluir" rotulo="Concluir" />
        <Raia titulo="Prontos"    chave="pronto"     fila={fila} />
        <Raia titulo="Prontos"    chave="entregue"   fila={fila} />
      </Box>
    );

  return (
    <Box className="vista mesa" data-view="cozinha">
      <Heading level="h2">Cozinha</Heading>
      <Button className="btn" data-act="recarregar-fila">Atualizar</Button>
      {body}
    </Box>
  );
}

/* The three devices on one stage. The harness draws ONE screen, so this is
   the only place they can go: side by side inside the single frame. */
function Palco({ s }){
  return (
    <Box className="palco">
      <VistaCliente s={s} />
      <VistaGarcom  s={s} />
      <VistaCozinha s={s} />
    </Box>
  );
}

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

  context: [],

  scenarios: [
    {
      id:"comanda-ciclo",
      name:"A comanda atravessa as três telas",
      page:"salao", tags:["@salao","@feliz"],
      given:{
        text:"que a mesa 7 pediu e as três telas estão abertas",
        state: async (ex, api) => ({
          page:"salao",
          comanda:  await api.get("/api/comandas/7"),
          fila:     await api.get("/api/cozinha/fila"),
          pedidos:  await api.get("/api/garcom/pedidos")
        })
      },
      steps:[
        { then:"o cliente vê que o pedido foi recebido",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-situacao="recebido"]') },
        { when:"a cozinha inicia o preparo", click:'[data-view="cozinha"] [data-act="iniciar"]' },
        { then:"o cliente passa a ver Preparando",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-situacao="preparando"]') },
        { then:"o garçom também vê Preparando",
          check:(a, el) => !!el.querySelector('[data-view="garcom"] [data-situacao="preparando"]') },
        { when:"a cozinha conclui", click:'[data-view="cozinha"] [data-act="concluir"]' },
        { then:"o garçom é chamado para pegar na cozinha",
          check:(a, el) => !!el.querySelector('[data-view="garcom"] [data-act="entregar"]') },
        { when:"o garçom entrega na mesa", click:'[data-view="garcom"] [data-act="entregar"]' },
        { then:"o cliente vê que chegou na mesa",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-situacao="entregue"]') },
        { then:"a cozinha continua com a ficha na raia de prontos",
          check:(a, el) => !!el.querySelector('[data-view="cozinha"] [data-raia="entregue"] .ficha') }
      ]
    },

    {
      id:"comanda-carregando",
      name:"As três telas enquanto a fila não chega",
      page:"salao", tags:["@salao","@carregando"],
      network:{ "GET /api/cozinha/fila":"pendente" },
      given:{
        text:"que a fila da cozinha ainda não respondeu",
        state: async (ex, api) => {
          api.get("/api/cozinha/fila");
          return { page:"salao", loading:true,
                   comanda: await api.get("/api/comandas/7"),
                   pedidos: await api.get("/api/garcom/pedidos") };
        }
      },
      steps:[
        { then:"as telas mostram o esqueleto",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"]') },
        { when:"a fila chega", waitFor:"GET /api/cozinha/fila",
          applyState:(a, payload) => ({ ...a, fila:payload, loading:false }) },
        { then:"a cozinha desenha o quadro",
          check:(a, el) => !!el.querySelector('[data-view="cozinha"] [data-raia="recebido"]') },
        { when:"o garçom atualiza o salão", click:'[data-view="garcom"] [data-act="recarregar-salao"]' },
        { then:"o garçom vê a mesa esperando",
          check:(a, el) => !!el.querySelector('[data-view="garcom"] [data-situacao="recebido"]') }
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
        text:"que a fila da cozinha caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.filaFalhaUmaVez = true;
          const base = { page:"salao",
                         comanda: await api.get("/api/comandas/7"),
                         pedidos: await api.get("/api/garcom/pedidos") };
          try { return { ...base, fila: await api.get("/api/cozinha/fila") }; }
          catch (e){ return { ...base, erroCozinha:e.message }; }
        }
      },
      steps:[
        { then:"a cozinha explica a falha em vez de ficar em branco",
          check:(a, el) => !!el.querySelector('[data-view="cozinha"] [data-estado="erro"]') },
        { when:"a cozinha tenta de novo", click:'[data-view="cozinha"] [data-act="recarregar-fila"]' },
        { then:"o quadro volta e a explicação some",
          check:(a, el) => !el.querySelector('[data-estado="erro"]')
                        && !!el.querySelector('[data-view="cozinha"] [data-raia="recebido"] .ficha') },
        { when:"a cozinha inicia o preparo", click:'[data-view="cozinha"] [data-act="iniciar"]' },
        { then:"o cliente vê Preparando depois da recuperação",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-situacao="preparando"]') }
      ]
    },

    {
      id:"comanda-vazia",
      name:"O salão sem nenhum pedido aberto",
      page:"salao", tags:["@salao","@vazio"],
      given:{
        text:"que ninguém pediu nada ainda",
        state: async (ex, api) => ({ page:"salao", comanda:null, fila:[], pedidos:[] })
      },
      steps:[
        { then:"as três telas convidam a começar",
          check:(a, el) => el.querySelectorAll('[data-estado="vazio"]').length === 3 },
        { when:"o garçom atualiza o salão", click:'[data-view="garcom"] [data-act="recarregar-salao"]' },
        { then:"o pedido que existia aparece para o garçom",
          check:(a, el) => !!el.querySelector('[data-view="garcom"] .linha') },
        { when:"a cozinha atualiza a fila", click:'[data-view="cozinha"] [data-act="recarregar-fila"]' },
        { then:"a cozinha passa a ver a ficha",
          check:(a, el) => !!el.querySelector('[data-view="cozinha"] .ficha') }
      ]
    },

    {
      id:"comanda-escrita-recusada",
      name:"A cozinha inicia e o servidor recusa",
      page:"salao", tags:["@salao","@conflito"],
      network:{ "POST /api/comandas/:id/status":
                { status:500, payload:{ error_:"Não foi possível mudar o status" } } },
      given:{
        text:"que o servidor vai recusar a mudança de status",
        state: async (ex, api) => ({
          page:"salao",
          comanda:  await api.get("/api/comandas/7"),
          fila:     await api.get("/api/cozinha/fila"),
          pedidos:  await api.get("/api/garcom/pedidos")
        })
      },
      steps:[
        { when:"a cozinha tenta iniciar o preparo", click:'[data-view="cozinha"] [data-act="iniciar"]' },
        { then:"a recusa aparece sem tirar o quadro da tela",
          check:(a, el) => !!el.querySelector('[data-view="cozinha"] [data-erro="escrita"]')
                        && !!el.querySelector('[data-view="cozinha"] [data-raia="recebido"] .ficha') },
        { when:"a cozinha recarrega a fila", click:'[data-view="cozinha"] [data-act="recarregar-fila"]' },
        { then:"o cliente continua vendo o pedido apenas recebido",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-situacao="recebido"]')
                        && !!el.querySelector('[data-view="cozinha"] [data-erro="escrita"]') }
      ]
    },

    {
      id:"comanda-tudo-fora",
      name:"Cliente e garçom sem resposta do servidor",
      page:"salao", tags:["@salao","@conflito"],
      network:{ "GET /api/comandas/:id":500, "GET /api/garcom/pedidos":500 },
      given:{
        text:"que a comanda e o salão estão fora do ar",
        state: async (ex, api) => {
          const base = { page:"salao", fila: await api.get("/api/cozinha/fila") };
          try { return { ...base, comanda: await api.get("/api/comandas/7"),
                                  pedidos: await api.get("/api/garcom/pedidos") }; }
          catch (e){ return { ...base, erroCliente:e.message, erroGarcom:e.message }; }
        }
      },
      steps:[
        { then:"o cliente vê a explicação em vez de uma tela vazia",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-estado="erro"]') },
        { when:"o cliente tenta de novo", click:'[data-view="cliente"] [data-act="recarregar-comanda"]' },
        { then:"a comanda continua fora do ar",
          check:(a, el) => !!el.querySelector('[data-view="cliente"] [data-estado="erro"]') },
        { when:"o garçom tenta atualizar o salão", click:'[data-view="garcom"] [data-act="recarregar-salao"]' },
        { then:"o salão também segue fora do ar, e a cozinha não",
          check:(a, el) => !!el.querySelector('[data-view="garcom"] [data-estado="erro"]')
                        && !!el.querySelector('[data-view="cozinha"] [data-raia="recebido"]') }
      ]
    }
  ],

  mount: (el, state) => {
    const draw = () => flushSync(() => rootFor(el).render(<Palco s={state} />));
    try { draw(); }
    catch { roots.delete(el); draw(); }
  }
});

/* Every write goes to the shared fixture and then every view re-reads it.
   Nothing here knows about "the other screens" — they are the same state. */
async function recarregarTudo(){
  const [comanda, fila, pedidos] = await Promise.all([
    Proto.api.get("/api/comandas/7"),
    Proto.api.get("/api/cozinha/fila"),
    Proto.api.get("/api/garcom/pedidos")
  ]);
  Proto.set({ comanda, fila, pedidos, loading:false, writeError:null,
              erroCliente:null, erroGarcom:null, erroCozinha:null });
}

async function mudarStatus(el, status){
  try {
    await Proto.api.post("/api/comandas/" + el.getAttribute("data-id") + "/status", { status });
    await recarregarTudo();
  } catch (err){
    Proto.set({ writeError: err.message });
  }
}

Proto.on("click", '[data-act="iniciar"]',  (e, el) => mudarStatus(el, "preparando"));
Proto.on("click", '[data-act="concluir"]', (e, el) => mudarStatus(el, "pronto"));
Proto.on("click", '[data-act="entregar"]', (e, el) => mudarStatus(el, "entregue"));

Proto.on("click", '[data-act="recarregar-fila"]', async () => {
  try { Proto.set({ fila: await Proto.api.get("/api/cozinha/fila"), erroCozinha:null }); }
  catch (err){ Proto.set({ erroCozinha:err.message }); }
});

Proto.on("click", '[data-act="recarregar-salao"]', async () => {
  try { Proto.set({ pedidos: await Proto.api.get("/api/garcom/pedidos"), erroGarcom:null }); }
  catch (err){ Proto.set({ erroGarcom:err.message }); }
});

Proto.on("click", '[data-act="recarregar-comanda"]', async () => {
  try { Proto.set({ comanda: await Proto.api.get("/api/comandas/7"), erroCliente:null }); }
  catch (err){ Proto.set({ erroCliente:err.message }); }
});
