/* Ciclo de vida de itens do catálogo (FUT-268): histórico de versões, lixeira,
   rascunhos e aprovação de alterações.

   React, e todo elemento vem do design system — não há HTML cru neste arquivo.
   O contrato de DOM em que os cenários encostam (os data-* e as classes) é
   carregado pelos próprios componentes. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Box } from "@12-apps/ui/mui/Box";
import { AppBar } from "@12-apps/ui/mui/AppBar";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Paragraph } from "@12-apps/ui/typography/Paragraph";
import { Text } from "@12-apps/ui/typography/Text";
import { Button } from "@12-apps/ui/form/Button";
import { Input } from "@12-apps/ui/form/Input";
import { Switch } from "@12-apps/ui/form/Switch";
import { Card } from "@12-apps/ui/layout/Card";
import { CardContent } from "@12-apps/ui/layout/Card";
import { Skeleton } from "@12-apps/ui/layout/Skeleton";
import { Badge } from "@12-apps/ui/data-display/Badge";
import { Alert } from "@12-apps/ui/data-display/Alert";
import { Banner } from "@12-apps/ui/data-display/Banner";

/* Uma raiz React por elemento que o harness entrega, desenhando num container
   próprio — nunca direto no elemento do harness. A suíte desenha em sondas
   descartáveis e as limpa entre passagens; o React tentaria remover nós que já
   não são filhos dele e estouraria NotFoundError no commit, de forma assíncrona,
   onde um try/catch em volta do render não alcança.

   replaceChildren é o que mantém exatamente uma: o harness não limpa o elemento
   antes de chamar mount — ele espera que mount seja dono dele. `display:contents`
   mantém o container fora do layout, então as regras de largura continuam
   medindo as caixas de verdade. */
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

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short" });
const quando = (iso) => (iso ? DATA_HORA.format(new Date(iso)) : "—");

/* Os três recursos com bandeira. A lixeira não tem: excluir é reversível
   sempre, não é um recurso que a loja liga. */
const RECURSOS = [
  { key:"versioning", permissao:"lifecycle.versoes",    label:"Histórico de versões",
    descricao:"Registra cada alteração dos itens e permite restaurar versões anteriores." },
  { key:"drafts",     permissao:"lifecycle.rascunhos",  label:"Rascunhos",
    descricao:"Permite salvar alterações como rascunho e publicá-las depois." },
  { key:"approvals",  permissao:"lifecycle.aprovacoes", label:"Aprovação de alterações",
    descricao:"Alterações de quem não pode aprovar ficam aguardando decisão." }
];

const ACAO_LABEL   = { CREATE:"Criação", UPDATE:"Alteração", DELETE:"Exclusão" };
const VERSAO_LABEL = { CREATE:"Criação", UPDATE:"Alteração", RESTORE:"Restauração" };
const STATUS_FILTROS = [
  { value:"PENDING",  label:"Pendentes" },
  { value:"APPROVED", label:"Aprovadas" },
  { value:"REJECTED", label:"Rejeitadas" }
];
const VAZIO_POR_STATUS = {
  PENDING:  "Nenhuma solicitação pendente.",
  APPROVED: "Nenhuma solicitação aprovada.",
  REJECTED: "Nenhuma solicitação rejeitada."
};

/* O portão de três camadas: código && plano && loja. `entitled` é o plano —
   uma dimensão de contexto; `enabled` é o interruptor da loja, que vem da
   configuração buscada na API. */
const temNoPlano = (s, key) => s.can((RECURSOS.find(r => r.key === key) || {}).permissao);
const ligadoNaLoja = (s, key) => {
  const cfg = s.app.config && s.app.config.lifecycle;
  return !!(cfg && cfg[key] && cfg[key].enabled);
};
const recursoAtivo = (s, key) => temNoPlano(s, key) && ligadoNaLoja(s, key);

/* `state` numa tela diz ao harness qual dos quatro caminhos está aparecendo, e
   é contra isso que os três cenários obrigatórios de estado encostam. */
function estadoDe(s, temConteudo){
  return (s.app.loading || s.waitingFor()) ? "carregando"
       : s.app.error_                      ? "erro"
       : !temConteudo                      ? "vazio"
       :                                     "conteudo";
}

function Carregando({ barras, label }){
  return (
    <Box className="estado" data-estado="carregando" aria-busy="true">
      <Box className="esqueleto">
        {Array.from({ length: barras }, (_, i) => <Skeleton key={i} />)}
      </Box>
      <Paragraph>{label}</Paragraph>
    </Box>
  );
}

function Erro({ s, titulo, acao }){
  return (
    <Box className="estado erro" data-estado="erro">
      <Heading level="h2">{titulo}</Heading>
      <Paragraph>{s.app.error_ || ""}</Paragraph>
      <Button className="btn" data-act={acao}>Tentar novamente</Button>
    </Box>
  );
}

/* O aviso transitório das escritas: "enviada para aprovação" (202) e as
   confirmações de publicação e restauração. */
function Aviso({ s }){
  if (!s.app.aviso) return null;
  return (
    <Alert className="aviso" data-aviso={s.app.aviso.tipo}>
      <Text>{s.app.aviso.texto}</Text>
      <Button className="btn ghost" data-act="fechar-aviso">Fechar</Button>
    </Alert>
  );
}

function ErroDeAcao({ s, hook }){
  if (!s.app.erroAcao) return null;
  return <Alert className="aviso" data-erro={hook}>{s.app.erroAcao}</Alert>;
}

/* --------------------------------------------------------------- catálogo */

function CatalogoScreen({ s }){
  const itens = s.app.products;
  const st = estadoDe(s, !(itens && !itens.length));
  const colunas = s.rung === "xlg" ? 3 : (s.widthPx >= 768 ? 2 : 1);
  const acoes = s.widthPx >= 768 ? "linha" : "empilhado";

  const corpo =
    st === "carregando" ? <Carregando barras={4} label="Carregando o catálogo…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar o catálogo" acao="recarregar-catalogo" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">Nenhum produto no catálogo</Heading>
        <Paragraph>Um item excluído por engano continua na lixeira e pode voltar de lá.</Paragraph>
        <Button className="btn" data-act="ir-lixeira">Abrir a lixeira</Button>
      </Box>
    ) : (
      <Box data-estado="conteudo" data-colunas={colunas} data-acoes={acoes}>
        <ErroDeAcao s={s} hook="catalogo" />
        <Box className="grade">
          {(itens || []).map(p => (
            <Card key={p.id} variant="outlined" className="linha">
              <CardContent>
                <Text className="nome" weight="bold">{p.nameStr}</Text>
                <Text className="preco-linha">R$ {p.priceStr}</Text>
                <Badge className="tag versao">v{p.version}</Badge>
                {p.hasDraft && recursoAtivo(s, "drafts") && (
                  <Badge className="tag rascunho">Rascunho aberto</Badge>
                )}
                <Box className="linha-acoes">
                  <Button className="btn ghost" data-act="abrir-produto" data-id={p.id}>Editar</Button>
                  {recursoAtivo(s, "versioning") && (
                    <Button className="btn ghost" data-act="abrir-historico" data-id={p.id}>
                      Histórico de versões
                    </Button>
                  )}
                  <Button className="btn ghost" data-act="excluir-produto" data-id={p.id}>Excluir</Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Heading level="h1">Catálogo</Heading>
        <Paragraph>{itens ? itens.length + (itens.length === 1 ? " produto" : " produtos") : "—"}</Paragraph>
        <Box className="nav">
          <Button className="btn ghost" data-act="ir-lixeira">Lixeira</Button>
          {recursoAtivo(s, "approvals") && (
            <Button className="btn ghost" data-act="ir-aprovacoes">Aprovações</Button>
          )}
          <Button className="btn ghost" data-act="ir-recursos">Recursos</Button>
          <Button className="btn ghost" data-act="recarregar-catalogo">Recarregar</Button>
        </Box>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
    </Box>
  );
}

/* ---------------------------------------------------------------- produto */

function ProdutoScreen({ s }){
  const prod = s.app.produto;
  const form = s.app.form || { nameStr:"", priceStr:"" };
  const rascunhos = recursoAtivo(s, "drafts");
  const podeEditar = s.can("produto.editar");
  const st = estadoDe(s, !!s.app.draft);

  const faixaRascunho =
    !rascunhos ? null :
    st === "carregando" ? <Carregando barras={2} label="Procurando rascunho…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar o rascunho" acao="tentar-rascunho" /> :
    st === "vazio" ? (
      <Box className="estado compacto" data-estado="vazio">
        <Heading level="h2">Nenhum rascunho aberto</Heading>
        <Paragraph>Salve um rascunho para continuar depois sem mexer no que está no ar.</Paragraph>
      </Box>
    ) : (
      <Box className="faixa-rascunho" data-estado="conteudo">
        <Alert className="aviso" data-faixa="rascunho">
          <Text weight="bold">Este produto tem um rascunho não publicado.</Text>
          <Text>Atualizado em {quando(s.app.draft.updatedAt)}.</Text>
        </Alert>
        <Box className="linha-acoes">
          <Button className="btn ghost" data-act="carregar-rascunho">Carregar rascunho</Button>
          <Button className="btn" data-act="publicar-rascunho">Publicar</Button>
          <Button className="btn ghost" data-act="descartar-rascunho">Descartar</Button>
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="voltar-catalogo">← Catálogo</Button>
        <Heading level="h1">{prod ? prod.nameStr : "Produto"}</Heading>
        <Paragraph>{prod ? "Versão publicada v" + prod.version : "—"}</Paragraph>
      </AppBar>

      <Aviso s={s} />

      <Box className="app-bd" data-async data-estado-atual={st}>
        {faixaRascunho}
        <ErroDeAcao s={s} hook="produto" />

        {podeEditar ? (
          <Box className="form">
            <Input
              value={form.nameStr}
              placeholder="Nome do produto"
              slotProps={{ htmlInput:{ className:"campo", "data-campo":"nome", "aria-label":"Nome do produto" } }}
            />
            <Input
              value={form.priceStr}
              placeholder="0,00"
              slotProps={{ htmlInput:{ className:"campo", "data-campo":"preco", inputMode:"decimal",
                                       "aria-label":"Preço do produto" } }}
            />
          </Box>
        ) : (
          <Alert className="aviso">Você consulta este produto, mas quem edita é o gerente ou o dono.</Alert>
        )}

        {podeEditar && (
          <Box className="acoes acao-fixa">
            <Button className="btn" data-act="salvar">Salvar</Button>
            {rascunhos && <Button className="btn ghost" data-act="salvar-rascunho">Salvar rascunho</Button>}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------------- histórico */

function HistoricoScreen({ s }){
  const alvo = s.app.historicoDe || {};
  const hist = s.app.historico;
  const versoes = (hist && hist.versions) || [];
  const st = estadoDe(s, versoes.length > 0);
  const desligado = !recursoAtivo(s, "versioning");

  const corpo =
    desligado ? (
      <Alert className="aviso" data-recurso="desligado">
        O histórico de versões não está ativo para esta loja.
      </Alert>
    ) :
    st === "carregando" ? <Carregando barras={3} label="Carregando o histórico…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar o histórico" acao="tentar-historico" /> :
    st === "vazio" ? (
      <Box className="estado compacto" data-estado="vazio">
        <Heading level="h2">Nenhuma versão registrada</Heading>
        <Paragraph>Este item ainda não passou por nenhuma alteração.</Paragraph>
      </Box>
    ) : (
      <Box data-estado="conteudo">
        {versoes.map(v => (
          <Card key={v.version} variant="outlined" className="versao-linha">
            <CardContent>
              <Text weight="bold">v{v.version}</Text>
              <Badge className="tag">{VERSAO_LABEL[v.kind]}</Badge>
              {v.version === hist.publishedVersion && (
                <Badge className="tag atual">Versão atual</Badge>
              )}
              {v.restoredFromVersion !== null && (
                <Badge className="tag">a partir da v{v.restoredFromVersion}</Badge>
              )}
              <Text className="carimbo">{quando(v.createdAt)} · {v.actorName || "Sistema"}</Text>
              <Box className="campos">
                {v.changedFields.map(c => <Badge key={"c" + c} className="tag campo">{c}</Badge>)}
                {v.removedFields.map(r => <Badge key={"r" + r} className="tag campo">− {r}</Badge>)}
              </Box>
              {v.version !== hist.publishedVersion && (
                <Button className="btn ghost" data-act="restaurar-versao" data-v={v.version}>
                  Restaurar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="fechar-historico">← Catálogo</Button>
        <Heading level="h1">Histórico de versões — {alvo.nameStr || "item"}</Heading>
        <Paragraph>Restaurar não apaga nada: entra como uma versão nova.</Paragraph>
      </AppBar>

      <Aviso s={s} />
      <ErroDeAcao s={s} hook="historico" />

      {s.app.confirmarVersao !== null && s.app.confirmarVersao !== undefined && (
        <Banner className="confirmacao" data-confirmacao="versao">
          <Heading level="h2">Restaurar versão</Heading>
          <Paragraph>
            O conteúdo atual será substituído pela versão v{s.app.confirmarVersao}.
            Uma nova versão será registrada no histórico.
          </Paragraph>
          <Box className="linha-acoes">
            <Button className="btn ghost" data-act="cancelar-restauracao">Cancelar</Button>
            <Button className="btn" data-act="confirmar-restauracao">Restaurar</Button>
          </Box>
        </Banner>
      )}

      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
    </Box>
  );
}

/* ---------------------------------------------------------------- lixeira */

function LixeiraScreen({ s }){
  const entries = s.app.entries;
  const st = estadoDe(s, !(entries && !entries.length));

  const corpo =
    st === "carregando" ? <Carregando barras={3} label="Carregando a lixeira…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar a lixeira" acao="tentar-lixeira" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">A lixeira está vazia</Heading>
        <Paragraph>Itens excluídos aparecem aqui e podem ser restaurados.</Paragraph>
      </Box>
    ) : (
      <Box data-estado="conteudo">
        <ErroDeAcao s={s} hook="lixeira" />
        {(entries || []).map(e => (
          <Card key={e.id} variant="outlined" className="entrada">
            <CardContent>
              <Text weight="bold">{e.label}</Text>
              <Badge className="tag">Produto</Badge>
              <Text className="carimbo">
                Excluído em {quando(e.deletedAt)}{e.deletedByName ? " por " + e.deletedByName : ""}
              </Text>
              {e.children.length > 0 && (
                <Text className="filhos">Inclui: {e.children.map(c => c.label).join(", ")}</Text>
              )}
              <Box className="linha-acoes">
                <Button className="btn ghost" data-act="restaurar-item" data-id={e.id}>Restaurar</Button>
                <Button className="btn ghost" data-act="excluir-definitivo" data-id={e.id}>
                  Excluir definitivamente
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="voltar-catalogo">← Catálogo</Button>
        <Heading level="h1">Lixeira</Heading>
        <Paragraph>Restaure para trazer de volta ou exclua para sempre.</Paragraph>
        <Box className="nav">
          <Button className="btn ghost" data-act="tentar-lixeira">Recarregar</Button>
        </Box>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>

      {s.app.confirmarPurga && (
        <Banner className="confirmacao" data-confirmacao="purga">
          <Heading level="h2">Excluir definitivamente</Heading>
          <Paragraph>
            “{s.app.confirmarPurga.label}” será excluído para sempre, junto com seus itens
            vinculados. Esta ação não pode ser desfeita.
          </Paragraph>
          <Box className="linha-acoes">
            <Button className="btn ghost" data-act="cancelar-exclusao">Cancelar</Button>
            <Button className="btn" data-act="confirmar-exclusao">Excluir definitivamente</Button>
          </Box>
        </Banner>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------- aprovações */

function AprovacoesScreen({ s }){
  const status = s.app.statusFiltro || "PENDING";
  const todas = s.app.requests;
  const lista = (todas || []).filter(r => r.status === status);
  const st = estadoDe(s, !(todas && !lista.length));
  const desligado = !recursoAtivo(s, "approvals");
  const podeDecidir = s.can("produto.aprovar");

  const corpo =
    desligado ? (
      <Alert className="aviso" data-recurso="desligado">
        O recurso de aprovações não está ativo para esta loja.
      </Alert>
    ) :
    st === "carregando" ? <Carregando barras={3} label="Carregando as solicitações…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar as aprovações" acao="tentar-aprovacoes" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">{VAZIO_POR_STATUS[status]}</Heading>
        <Paragraph>Alterações de quem não pode aprovar param aqui antes de valer.</Paragraph>
      </Box>
    ) : (
      <Box data-estado="conteudo">
        <ErroDeAcao s={s} hook="aprovacoes" />
        <Box className="grade">
        {lista.map(r => (
          <Card key={r.id} variant="outlined" className="solicitacao">
            <CardContent>
              <Text weight="bold">{r.label}</Text>
              <Badge className="tag">{ACAO_LABEL[r.action]}</Badge>
              <Badge className="tag">Produto</Badge>
              <Text className="carimbo">
                Solicitado por {r.requestedByName || "Sistema"} em {quando(r.requestedAt)}
              </Text>
              {r.decidedAt && (
                <Text className="carimbo decidido">
                  Decidido em {quando(r.decidedAt)}{r.decisionNote ? " — " + r.decisionNote : ""}
                </Text>
              )}
              {r.status === "PENDING" && podeDecidir && (
                <Box className="linha-acoes">
                  <Button className="btn" data-act="aprovar" data-id={r.id}>Aprovar</Button>
                  <Button className="btn ghost" data-act="rejeitar" data-id={r.id}>Rejeitar</Button>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="voltar-catalogo">← Catálogo</Button>
        <Heading level="h1">Aprovações</Heading>
        <Paragraph>Alterações que ficaram aguardando decisão.</Paragraph>
      </AppBar>

      <Aviso s={s} />

      {!desligado && (
        <Box className="filtros">
          {STATUS_FILTROS.map(f => (
            <Button key={f.value} className={"btn chip" + (status === f.value ? " selecionado" : "")}
                    data-act="filtrar" data-status={f.value}>
              {f.label}
            </Button>
          ))}
        </Box>
      )}

      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>

      {s.app.rejeitando && (
        <Banner className="confirmacao" data-confirmacao="rejeicao">
          <Heading level="h2">Rejeitar “{s.app.rejeitando.label}”</Heading>
          <Input
            value={s.app.motivo || ""}
            placeholder="Motivo (opcional)"
            slotProps={{ htmlInput:{ className:"campo", "data-campo":"motivo",
                                     "aria-label":"Motivo da rejeição" } }}
          />
          <Box className="linha-acoes">
            <Button className="btn ghost" data-act="cancelar-rejeicao">Cancelar</Button>
            <Button className="btn" data-act="confirmar-rejeicao">Rejeitar</Button>
          </Box>
        </Banner>
      )}
    </Box>
  );
}

/* --------------------------------------------------------------- recursos */

function RecursosScreen({ s }){
  const cfg = s.app.config;
  const noPlano = RECURSOS.filter(r => temNoPlano(s, r.key));
  const st = estadoDe(s, !!cfg && noPlano.length > 0);

  const corpo =
    st === "carregando" ? <Carregando barras={3} label="Carregando as configurações…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar as configurações" acao="tentar-recursos" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">Nenhum recurso avançado no seu plano</Heading>
        <Paragraph>Histórico, rascunhos e aprovações entram a partir do plano Pro.</Paragraph>
      </Box>
    ) : (
      <Box data-estado="conteudo">
        <ErroDeAcao s={s} hook="recursos" />
        <Box className="grade">
        {RECURSOS.map(r => {
          const temPlano = temNoPlano(s, r.key);
          return (
            <Card key={r.key} variant="outlined" className="recurso">
              <CardContent>
                {/* o hook vai no input de verdade, atrás do slot: é ele que se
                    alterna, e a raiz do Switch é só a moldura */}
                <Switch
                  className="interruptor"
                  data-campo="recurso"
                  data-recurso={r.key}
                  checked={temPlano && ligadoNaLoja(s, r.key)}
                  disabled={!temPlano}
                  slotProps={{ input:{ "data-campo":"recurso", "data-recurso":r.key,
                                       "aria-label":r.label } }}
                />
                <Text weight="bold">{r.label}</Text>
                <Text className="carimbo">
                  {temPlano ? r.descricao : "Não incluído no seu plano."}
                </Text>
              </CardContent>
            </Card>
          );
        })}
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="voltar-catalogo">← Catálogo</Button>
        <Heading level="h1">Recursos</Heading>
        <Paragraph>Recursos avançados de edição do catálogo.</Paragraph>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
    </Box>
  );
}

function Screen({ s }){
  const pg = s.app.page || "catalogo";
  return pg === "produto"    ? <ProdutoScreen s={s} />
       : pg === "historico"  ? <HistoricoScreen s={s} />
       : pg === "lixeira"    ? <LixeiraScreen s={s} />
       : pg === "aprovacoes" ? <AprovacoesScreen s={s} />
       : pg === "recursos"   ? <RecursosScreen s={s} />
       :                       <CatalogoScreen s={s} />;
}

/* ------------------------------------------------------------------------ */

const SLUG = "cantina-do-porto";
const base = "/api/admin/" + SLUG;

Proto.init({
  title: "ciclo de vida do catálogo",

  library: "@12-apps/ui",

  data_: window.PROTO_DATA,
  routes: window.PROTO_ROUTES,
  latency: [250, 750],

  feature: {
    name: "Ciclo de vida dos itens do catálogo",
    as:   "lojista",
    want: "versionar, rascunhar e aprovar alterações do catálogo, e desfazer exclusões",
    so:   "uma edição errada não vire prejuízo e nada suma sem volta",
    impl: {
      component:"CicloDeVida",
      route:"/:tenantSlug/products",
      moduleName:"admin/lifecycle",
      notes:"pacote @repo/entity-lifecycle; UI em @12-apps/ui"
    }
  },

  /* O plano é a camada de habilitação (`entitled`) e o papel é a de
     autorização (`products:approve`). O interruptor da loja é a terceira, e
     essa vem da configuração buscada na API — não é uma dimensão. */
  context: [
    {
      id:"plano", label:"Plano", kind:"escala", value:"free",
      options:[
        { id:"free",  label:"Free"  },
        { id:"basic", label:"Basic" },
        { id:"pro",   label:"Pro",   allows:["lifecycle.versoes","lifecycle.rascunhos"] },
        { id:"ultra", label:"Ultra", allows:["lifecycle.aprovacoes"] }
      ]
    },
    {
      id:"papel", label:"Papel do usuário", kind:"opcao", value:"aprovador",
      options:[
        { id:"aprovador", label:"Aprovador", allows:["produto.editar","produto.aprovar"] },
        { id:"editor",    label:"Editor",    allows:["produto.editar"] },
        { id:"leitor",    label:"Leitor",    allows:["produto.ver"] }
      ]
    }
  ],

  scenarios: [
    /* ------------------------------------------------------------ catálogo */
    {
      id:"catalogo-percorre",
      name:"Percorrer o catálogo, abrir um item e voltar",
      page:"catalogo", tags:["@catalogo","@feliz"],
      impl:{ component:"ProductsAdmin", route:"/:tenantSlug/products" },
      given:{
        text:"que o lojista abriu o catálogo",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { then:"o catálogo lista os produtos com a versão publicada de cada um",
          check:(a, el) => el.querySelectorAll(".linha .versao").length === 2 },
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { then:"o editor abre no produto escolhido",
          check:(a, el) => (el.querySelector("h1") || {}).textContent === "Pastel de nata" },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo continua completo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 },
        { when:"o lojista recarrega a lista", click:'[data-act="recarregar-catalogo"]' },
        { then:"os produtos continuam lá depois de recarregar",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"catalogo-larguras",
      name:"O catálogo em cada largura",
      page:"catalogo", tags:["@catalogo","@retorno"],
      impl:{ component:"ProductsAdmin",
             notes:"grade por container query; as ações da linha empilham abaixo de md" },
      given:{
        text:"que o lojista abre o catálogo em <largura>",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { then:"a lista aparece em <colunas> coluna(s)",
          check:(a, el, s) => {
            /* mede as colunas de verdade quando há motor de layout; sem ele
               (o portão sem navegador) cai no que a tela declara */
            const g = el.querySelector(".grade");
            let medido = 0;
            try {
              const gtc = g && getComputedStyle(g).gridTemplateColumns;
              if (gtc && gtc !== "none" && gtc.indexOf("px") > -1) medido = gtc.trim().split(/\s+/).length;
            } catch {}
            if (medido) return medido === Number(s.ex.colunas);
            const c = el.querySelector("[data-colunas]");
            return !!c && c.getAttribute("data-colunas") === String(s.ex.colunas);
          } },
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { then:"a lixeira abre sem perder a largura",
          check:(a, el) => !!el.querySelector('[data-act="voltar-catalogo"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"as ações de cada linha ficam <acoes>",
          check:(a, el, s) => {
            const c = el.querySelector("[data-acoes]");
            return !!c && c.getAttribute("data-acoes") === String(s.ex.acoes);
          } }
      ],
      examples:{
        columns:["largura","colunas","acoes"],
        tableRows:[
          ["xxs", "1", "empilhado"],
          ["md",  "2", "linha"],
          ["xlg", "3", "linha"]
        ]
      }
    },
    {
      id:"catalogo-carregando",
      name:"Abrir o catálogo e esperar ele chegar",
      page:"catalogo", tags:["@catalogo","@carregando"],
      impl:{ component:"ProductsAdmin", notes:"AsyncStateContainer + LoadingState" },
      network:{ "GET /api/admin/:slug/products": "pendente" },
      given:{
        text:"que o lojista abriu o catálogo e a resposta ainda não chegou",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          api.get(base + "/products").catch(() => {});   /* deixado pendente de propósito */
          return { page:"catalogo", config, loading:true };
        }
      },
      steps:[
        { then:"a lista mostra o esqueleto no lugar das linhas",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a resposta do servidor chega", waitFor:"GET /api/admin/:slug/products",
          applyState:(a, payload) => ({ ...a, products:payload, loading:false }) },
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { then:"o editor abre com os dados que vieram da API",
          check:(a, el) => !!el.querySelector('[data-act="voltar-catalogo"]') }
      ]
    },
    {
      id:"catalogo-vazio-volta-da-lixeira",
      name:"Catálogo vazio: trazer um item de volta da lixeira",
      page:"catalogo", tags:["@catalogo","@vazio","@feliz"],
      impl:{ component:"ProductsAdmin", notes:"EmptyState com a ação principal dentro" },
      network:{ "GET /api/admin/:slug/products": { status:200, payload:[] } },
      given:{
        text:"que o catálogo está vazio e há um item na lixeira",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { then:"o catálogo aponta a lixeira em vez de ficar em branco",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"] [data-act="ir-lixeira"]') },
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { then:"a lixeira mostra o item excluído",
          check:(a, el) => el.querySelectorAll(".entrada").length === 1 },
        { when:"o lojista restaura o item", click:'[data-act="restaurar-item"][data-id="b1"]' },
        { then:"o item sai da lixeira",
          check:(a, el) => !el.querySelector('[data-act="restaurar-item"][data-id="b1"]') }
      ]
    },
    {
      id:"catalogo-erro",
      name:"Catálogo fora do ar e a recuperação",
      page:"catalogo", tags:["@catalogo","@erro","@recuperacao"],
      impl:{ component:"ProductsAdmin", notes:"ErrorState com recarregar" },
      /* a falha vem do fixture (falha uma vez, funciona na seguinte), não do
         network: — é o que deixa Tentar novamente chegar a um desfecho */
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu o catálogo e a API caiu na primeira tentativa",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          api.data_.productsFailOnce = true;
          try { return { page:"catalogo", config, products: await api.get(base + "/products") }; }
          catch (e){ return { page:"catalogo", config, error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha em vez de ficar em branco",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="recarregar-catalogo"]' },
        { then:"o catálogo carrega e a explicação some",
          check:(a, el) => el.querySelectorAll(".linha").length === 2
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { then:"o editor abre normalmente depois da recuperação",
          check:(a, el) => !!el.querySelector('[data-act="voltar-catalogo"]') }
      ]
    },
    {
      id:"catalogo-exclusao-estacionada",
      name:"Excluir com aprovação ligada: nada some antes da decisão",
      page:"catalogo", tags:["@catalogo","@ultra","@editor","@feliz"],
      impl:{ component:"ProductsAdmin",
             notes:"HTTP 202 · applied:false — Snackbar com PENDING_APPROVAL_MESSAGE" },
      given:{
        text:"que a loja exige aprovação e quem está editando não pode aprovar",
        state: async (ex, api) => {
          api.data_.parkWrites = true;
          return {
            page:"catalogo",
            config: await api.get(base + "/config"),
            products: await api.get(base + "/products")
          };
        }
      },
      steps:[
        { when:"o editor exclui um produto", click:'[data-act="excluir-produto"][data-id="p2"]' },
        { then:"a tela avisa que a alteração foi enviada para aprovação",
          check:(a, el) => !!el.querySelector('[data-aviso="pendente"]') },
        { and:"o produto continua no catálogo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 },
        { when:"o editor fecha o aviso", click:'[data-act="fechar-aviso"]', local:true },
        { when:"o editor recarrega o catálogo", click:'[data-act="recarregar-catalogo"]' },
        { then:"o produto continua lá mesmo depois de recarregar — nada foi aplicado",
          check:(a, el) => !el.querySelector('[data-aviso="pendente"]')
                        && el.querySelectorAll(".linha").length === 2 }
      ]
    },

    {
      id:"catalogo-exclui-e-desfaz",
      name:"Excluir por engano e desfazer pela lixeira",
      page:"catalogo", tags:["@catalogo","@recuperacao","@pode:produto.editar"],
      impl:{ component:"ProductsAdmin",
             notes:"excluir é soft delete: a árvore inteira vai para a lixeira" },
      fixtureFailure:true,
      given:{
        text:"que o lojista está no catálogo e a primeira tentativa de excluir vai falhar",
        state: async (ex, api) => {
          api.data_.deleteFailsOnce = true;
          return {
            page:"catalogo",
            config: await api.get(base + "/config"),
            products: await api.get(base + "/products")
          };
        }
      },
      steps:[
        { when:"o lojista exclui um produto e o servidor falha",
          click:'[data-act="excluir-produto"][data-id="p2"]' },
        { then:"a tela explica a falha sem tirar o produto da lista",
          check:(a, el) => !!el.querySelector('[data-erro="catalogo"]')
                        && el.querySelectorAll(".linha").length === 2 },
        { when:"o lojista tenta de novo", click:'[data-act="excluir-produto"][data-id="p2"]' },
        { then:"o produto sai do catálogo e o aviso de falha some",
          check:(a, el) => el.querySelectorAll(".linha").length === 1
                        && !el.querySelector('[data-erro="catalogo"]') },
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { then:"o produto excluído está guardado lá",
          check:(a, el) => el.textContent.indexOf("Bolo de arroz") > -1 },
        { when:"o lojista restaura o produto",
          click:'[data-act="restaurar-item"][data-id="b-p2"]' },
        { when:"volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo volta inteiro",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },

    /* ------------------------------------------------------------- produto */
    {
      id:"produto-publica-rascunho",
      name:"Do catálogo até publicar o rascunho aberto",
      page:"produto", tags:["@catalogo","@pro","@feliz","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"faixa de rascunho + Carregar/Publicar/Descartar" },
      given:{
        text:"que o lojista está no catálogo e um produto tem rascunho aberto",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o produto com rascunho", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { then:"a faixa avisa que há um rascunho não publicado",
          check:(a, el) => !!el.querySelector('[data-faixa="rascunho"]') },
        { when:"o lojista carrega o rascunho no formulário",
          click:'[data-act="carregar-rascunho"]', local:true },
        { then:"o formulário fica com o texto do rascunho",
          check:(a, el) => el.querySelector('[data-campo="nome"]').value === "Pastel de nata da casa" },
        { when:"o lojista publica o rascunho", click:'[data-act="publicar-rascunho"]' },
        { then:"a publicação é confirmada e a faixa some",
          check:(a, el) => !!el.querySelector('[data-aviso="ok"]')
                        && !el.querySelector('[data-faixa="rascunho"]') }
      ]
    },
    {
      id:"produto-carregando",
      name:"Abrir o produto e esperar o rascunho",
      page:"produto", tags:["@catalogo","@pro","@carregando"],
      impl:{ component:"ProductSheet", notes:"LoadingState com esqueleto, sem spinner solto" },
      network:{ "GET /api/admin/:slug/products/:id/draft": "pendente" },
      given:{
        text:"que o lojista abriu um produto e o rascunho ainda não chegou",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          const products = await api.get(base + "/products");
          api.get(base + "/products/p1/draft").catch(() => {});
          const p = products.find(x => x.id === "p1");
          return { page:"produto", config, products, produto:p,
                   form:{ nameStr:p.nameStr, priceStr:p.priceStr }, loading:true };
        }
      },
      steps:[
        { then:"a faixa mostra o esqueleto, não uma tela em branco",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { and:"a região é anunciada como ocupada",
          check:(a, el) => el.querySelector('[data-estado="carregando"]').getAttribute("aria-busy") === "true" },
        { when:"o rascunho chega", waitFor:"GET /api/admin/:slug/products/:id/draft",
          applyState:(a, payload) => ({ ...a, draft:payload.draft, loading:false }) },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo aparece de novo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"produto-sem-rascunho",
      name:"Produto sem rascunho: salvar o primeiro",
      page:"produto", tags:["@catalogo","@pro","@vazio","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"EmptyState da faixa de rascunho" },
      given:{
        text:"que o lojista está no catálogo e o segundo produto não tem rascunho",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o produto sem rascunho", click:'[data-act="abrir-produto"][data-id="p2"]' },
        { then:"a faixa diz que não há rascunho aberto",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista muda o preço", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"6,50" } },
        { when:"o lojista salva o rascunho", click:'[data-act="salvar-rascunho"]' },
        { then:"a faixa passa a mostrar o rascunho recém-guardado",
          check:(a, el) => !!el.querySelector('[data-faixa="rascunho"]')
                        && !el.querySelector('[data-estado="vazio"]') }
      ]
    },
    {
      id:"produto-rascunho-fora-do-ar",
      name:"Rascunho fora do ar e a recuperação",
      page:"produto", tags:["@catalogo","@pro","@erro","@recuperacao"],
      impl:{ component:"ProductSheet", notes:"ErrorState com Tentar novamente na faixa" },
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu um produto e a busca do rascunho caiu",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          const products = await api.get(base + "/products");
          const p = products.find(x => x.id === "p1");
          api.data_.draftFailsOnce = true;
          try {
            const r = await api.get(base + "/products/p1/draft");
            return { page:"produto", config, products, produto:p,
                     form:{ nameStr:p.nameStr, priceStr:p.priceStr }, draft:r.draft };
          } catch (e){
            return { page:"produto", config, products, produto:p,
                     form:{ nameStr:p.nameStr, priceStr:p.priceStr }, error_:e.message };
          }
        }
      },
      steps:[
        { then:"a faixa explica a falha em vez de sumir",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="tentar-rascunho"]' },
        { then:"o rascunho aparece e a explicação some",
          check:(a, el) => !!el.querySelector('[data-faixa="rascunho"]')
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo carrega normalmente",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"produto-salvar-recusado",
      name:"Salvar e receber recusa do servidor",
      page:"produto", tags:["@catalogo","@pro","@conflito","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"o erro fica junto do botão, sem perder o que foi digitado" },
      network:{ "PUT /api/admin/:slug/products/:id":
                { status:422, payload:{ error_:"Preço inválido para este item" } } },
      given:{
        text:"que o lojista está no catálogo e o servidor vai recusar a gravação",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o primeiro produto", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { and:"muda o preço", local:true, fill:{ sel:'[data-campo="preco"]', val:"9,90" } },
        { when:"tenta salvar", click:'[data-act="salvar"]' },
        { then:"a tela mostra por que não salvou",
          check:(a, el) => !!el.querySelector('[data-erro="produto"]') },
        { and:"o que ele digitou continua na tela",
          check:(a, el) => el.querySelector('[data-campo="preco"]').value === "9,90" }
      ]
    },
    {
      id:"produto-descarta-rascunho",
      name:"Voltar ao produto e descartar o rascunho que sobrou",
      page:"produto", tags:["@catalogo","@pro","@retorno","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"descartar não publica nada: o que está no ar não muda" },
      given:{
        text:"que o lojista já tinha aberto o produto com rascunho e voltou ao catálogo",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o produto com rascunho", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { when:"volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { when:"abre o produto de novo", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { then:"a faixa do rascunho continua lá",
          check:(a, el) => !!el.querySelector('[data-faixa="rascunho"]') },
        { when:"o lojista descarta o rascunho", click:'[data-act="descartar-rascunho"]' },
        { then:"a faixa some e o item publicado continua o mesmo",
          check:(a, el) => !el.querySelector('[data-faixa="rascunho"]')
                        && (el.querySelector("h1") || {}).textContent === "Pastel de nata" }
      ]
    },

    {
      id:"produto-salva-edicao",
      name:"Corrigir o nome e salvar",
      page:"produto", tags:["@catalogo","@pro","@feliz","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"gravar passa pelo ciclo de vida: nasce uma versão" },
      given:{
        text:"que o lojista está no catálogo",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o segundo produto", click:'[data-act="abrir-produto"][data-id="p2"]' },
        { when:"corrige o nome", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Bolo de arroz da casa" } },
        { when:"salva", click:'[data-act="salvar"]' },
        { then:"a gravação é confirmada e a versão publicada sobe",
          check:(a, el) => !!el.querySelector('[data-aviso="ok"]')
                        && el.textContent.indexOf("Versão publicada v2") > -1 },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo já mostra o nome corrigido",
          check:(a, el) => el.textContent.indexOf("Bolo de arroz da casa") > -1 }
      ]
    },
    {
      id:"produto-rascunho-recusado",
      name:"Salvar rascunho recusado pelo servidor",
      page:"produto", tags:["@catalogo","@pro","@conflito","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"o erro fica junto do formulário, sem perder o texto" },
      network:{ "PUT /api/admin/:slug/products/:id/draft":
                { status:500, payload:{ error_:"Não foi possível guardar o rascunho" } } },
      given:{
        text:"que o lojista está no catálogo e o servidor vai recusar o rascunho",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o produto com rascunho", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { and:"muda o nome", local:true, fill:{ sel:'[data-campo="nome"]', val:"Pastel de Belém" } },
        { when:"tenta salvar o rascunho", click:'[data-act="salvar-rascunho"]' },
        { then:"a tela explica que não deu para guardar",
          check:(a, el) => !!el.querySelector('[data-erro="produto"]') },
        { and:"o que ele digitou continua na tela",
          check:(a, el) => el.querySelector('[data-campo="nome"]').value === "Pastel de Belém" }
      ]
    },
    {
      id:"produto-publicacao-recusada",
      name:"Publicação do rascunho recusada pelo servidor",
      page:"produto", tags:["@catalogo","@pro","@conflito","@pode:produto.editar"],
      impl:{ component:"ProductSheet", notes:"a faixa continua: o rascunho não se perde na recusa" },
      network:{ "POST /api/admin/:slug/drafts/:draftId/publish":
                { status:500, payload:{ error_:"Não foi possível publicar o rascunho" } },
              "DELETE /api/admin/:slug/drafts/:draftId":
                { status:500, payload:{ error_:"Não foi possível descartar o rascunho" } } },
      given:{
        text:"que o lojista está no catálogo e o servidor vai recusar a publicação",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o produto com rascunho", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { when:"tenta publicar o rascunho", click:'[data-act="publicar-rascunho"]' },
        { then:"a tela explica a recusa",
          check:(a, el) => !!el.querySelector('[data-erro="produto"]') },
        { when:"tenta então descartar o rascunho", click:'[data-act="descartar-rascunho"]' },
        { then:"o descarte também é recusado e o rascunho não se perde",
          check:(a, el) => !!el.querySelector('[data-erro="produto"]')
                        && !!el.querySelector('[data-faixa="rascunho"]') }
      ]
    },

    /* ----------------------------------------------------------- histórico */
    {
      id:"historico-restaura",
      name:"Do catálogo até restaurar uma versão anterior",
      page:"historico", tags:["@catalogo","@pro","@feliz"],
      impl:{ component:"VersionHistoryDialog",
             notes:"Dialog + AlertDialog de confirmação; restaurar grava versão nova" },
      given:{
        text:"que o lojista está no catálogo e o item já mudou de preço",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o histórico do item", click:'[data-act="abrir-historico"][data-id="p1"]' },
        { then:"as três versões aparecem, com a atual marcada",
          check:(a, el) => el.querySelectorAll(".versao-linha").length === 3
                        && !!el.querySelector(".tag.atual") },
        { when:"o lojista pede para restaurar a v2", click:'[data-act="restaurar-versao"][data-v="2"]', local:true },
        { then:"a confirmação diz o que vai acontecer",
          check:(a, el) => !!el.querySelector('[data-act="confirmar-restauracao"]') },
        { when:"o lojista confirma", click:'[data-act="confirmar-restauracao"]' },
        { then:"a restauração é confirmada e vira uma versão nova no histórico",
          check:(a, el) => !!el.querySelector('[data-aviso="ok"]')
                        && el.querySelectorAll(".versao-linha").length === 4 }
      ]
    },
    {
      id:"historico-carregando",
      name:"Abrir o histórico e esperar a lista",
      page:"historico", tags:["@catalogo","@pro","@carregando"],
      impl:{ component:"VersionHistoryDialog", notes:"LoadingState dentro do Dialog" },
      network:{ "GET /api/admin/:slug/products/:id/versions": "pendente" },
      given:{
        text:"que o lojista abriu o histórico e a lista ainda não chegou",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          const products = await api.get(base + "/products");
          api.get(base + "/products/p1/versions").catch(() => {});
          return { page:"historico", config, products,
                   historicoDe:{ id:"p1", nameStr:"Pastel de nata" }, loading:true };
        }
      },
      steps:[
        { then:"o diálogo mostra o esqueleto no lugar das versões",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a lista chega", waitFor:"GET /api/admin/:slug/products/:id/versions",
          applyState:(a, payload) => ({ ...a, historico:payload, loading:false }) },
        { when:"o lojista fecha o histórico", click:'[data-act="fechar-historico"]' },
        { then:"o catálogo volta a aparecer",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"historico-vazio",
      name:"Item que nunca mudou não tem histórico",
      page:"historico", tags:["@catalogo","@pro","@vazio"],
      impl:{ component:"VersionHistoryDialog", notes:"lista vazia, sem inventar uma v1 falsa" },
      given:{
        text:"que o lojista está no catálogo e o segundo item nunca mudou",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o histórico do item sem alterações",
          click:'[data-act="abrir-historico"][data-id="p2"]' },
        { then:"o diálogo diz que não há versão registrada",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista fecha o histórico", click:'[data-act="fechar-historico"]' },
        { then:"o catálogo continua completo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"historico-erro",
      name:"Histórico fora do ar e a recuperação",
      page:"historico", tags:["@catalogo","@pro","@erro","@recuperacao"],
      impl:{ component:"VersionHistoryDialog", notes:"ErrorState dentro do Dialog" },
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu o histórico e o serviço caiu na primeira tentativa",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          const products = await api.get(base + "/products");
          api.data_.versionsFailOnce = true;
          try {
            return { page:"historico", config, products,
                     historicoDe:{ id:"p1", nameStr:"Pastel de nata" },
                     historico: await api.get(base + "/products/p1/versions") };
          } catch (e){
            return { page:"historico", config, products,
                     historicoDe:{ id:"p1", nameStr:"Pastel de nata" }, error_:e.message };
          }
        }
      },
      steps:[
        { then:"o diálogo explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="tentar-historico"]' },
        { then:"as versões aparecem e a explicação some",
          check:(a, el) => el.querySelectorAll(".versao-linha").length === 3
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista fecha o histórico", click:'[data-act="fechar-historico"]' },
        { then:"o catálogo volta inteiro",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"historico-restauracao-estacionada",
      name:"Restaurar com aprovação ligada: nada muda antes da decisão",
      page:"historico", tags:["@catalogo","@ultra","@editor","@feliz"],
      impl:{ component:"VersionHistoryDialog", notes:"202 · applied:false — aviso informativo" },
      given:{
        text:"que a loja exige aprovação e quem está restaurando não pode aprovar",
        state: async (ex, api) => {
          api.data_.parkWrites = true;
          return {
            page:"catalogo",
            config: await api.get(base + "/config"),
            products: await api.get(base + "/products")
          };
        }
      },
      steps:[
        { when:"o editor abre o histórico do item", click:'[data-act="abrir-historico"][data-id="p1"]' },
        { when:"pede para restaurar a v1", click:'[data-act="restaurar-versao"][data-v="1"]', local:true },
        { when:"confirma a restauração", click:'[data-act="confirmar-restauracao"]' },
        { then:"a tela avisa que a alteração foi enviada para aprovação",
          check:(a, el) => !!el.querySelector('[data-aviso="pendente"]') },
        { and:"o histórico continua com as mesmas três versões",
          check:(a, el) => el.querySelectorAll(".versao-linha").length === 3 }
      ]
    },
    {
      id:"historico-cancela",
      name:"Desistir da restauração deixa tudo como estava",
      page:"historico", tags:["@catalogo","@pro","@retorno"],
      impl:{ component:"VersionHistoryDialog", notes:"cancelar não dispara requisição nenhuma" },
      given:{
        text:"que o lojista está no catálogo",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o histórico do item", click:'[data-act="abrir-historico"][data-id="p1"]' },
        { when:"pede para restaurar a v2", click:'[data-act="restaurar-versao"][data-v="2"]', local:true },
        { when:"desiste", click:'[data-act="cancelar-restauracao"]', local:true },
        { then:"a confirmação sai e o histórico continua intacto",
          check:(a, el) => !el.querySelector('[data-act="confirmar-restauracao"]')
                        && el.querySelectorAll(".versao-linha").length === 3 },
        { when:"o lojista fecha o histórico", click:'[data-act="fechar-historico"]' },
        { then:"o catálogo continua com o preço de antes",
          check:(a, el) => el.textContent.indexOf("7,50") > -1 }
      ]
    },

    {
      id:"historico-restauracao-recusada",
      name:"Restauração recusada pelo servidor",
      page:"historico", tags:["@catalogo","@pro","@conflito"],
      impl:{ component:"VersionHistoryDialog", notes:"o histórico continua inteiro, com o erro ao lado" },
      network:{ "POST /api/admin/:slug/products/:id/versions/:version/restore":
                { status:500, payload:{ error_:"Não foi possível restaurar a versão" } } },
      given:{
        text:"que o lojista está no catálogo e o servidor vai recusar a restauração",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre o histórico do item", click:'[data-act="abrir-historico"][data-id="p1"]' },
        { when:"cogita restaurar a v1", click:'[data-act="restaurar-versao"][data-v="1"]', local:true },
        { when:"muda de ideia", click:'[data-act="cancelar-restauracao"]', local:true },
        { when:"escolhe a v2", click:'[data-act="restaurar-versao"][data-v="2"]', local:true },
        { when:"confirma a restauração", click:'[data-act="confirmar-restauracao"]' },
        { then:"a tela explica que não deu certo",
          check:(a, el) => !!el.querySelector('[data-erro="historico"]') },
        { and:"as três versões continuam na tela",
          check:(a, el) => el.querySelectorAll(".versao-linha").length === 3 }
      ]
    },

    /* ------------------------------------------------------------- lixeira */
    {
      id:"lixeira-restaura",
      name:"Do catálogo até trazer um item de volta",
      page:"lixeira", tags:["@catalogo","@feliz"],
      impl:{ component:"RecycleBinPage", route:"/:tenantSlug/recycle-bin" },
      given:{
        text:"que o lojista está no catálogo e há um item na lixeira",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { then:"a entrada mostra o que volta junto com ela",
          check:(a, el) => (el.querySelector(".filhos") || {}).textContent
                            .indexOf("Queijada — caixa com 6") > -1 },
        { when:"o lojista restaura a entrada", click:'[data-act="restaurar-item"][data-id="b1"]' },
        { then:"a lixeira fica vazia",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o item restaurado está no catálogo",
          check:(a, el) => el.querySelectorAll(".linha").length === 3
                        && el.textContent.indexOf("Queijada de Sintra") > -1 }
      ]
    },
    {
      id:"lixeira-carregando",
      name:"Abrir a lixeira e esperar as entradas",
      page:"lixeira", tags:["@catalogo","@carregando"],
      impl:{ component:"RecycleBinPage", notes:"AsyncStateContainer + LoadingState" },
      network:{ "GET /api/admin/:slug/recycle-bin": "pendente" },
      given:{
        text:"que o lojista abriu a lixeira e a resposta ainda não chegou",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          api.get(base + "/recycle-bin").catch(() => {});
          return { page:"lixeira", config, loading:true };
        }
      },
      steps:[
        { then:"a lixeira mostra o esqueleto",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a resposta chega", waitFor:"GET /api/admin/:slug/recycle-bin",
          applyState:(a, payload) => ({ ...a, entries:payload.entries, loading:false }) },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo aparece",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"lixeira-vazia",
      name:"Lixeira vazia e o caminho de volta",
      page:"lixeira", tags:["@catalogo","@vazio"],
      impl:{ component:"RecycleBinPage", notes:"EmptyState sem ação: não há o que restaurar" },
      network:{ "GET /api/admin/:slug/recycle-bin": { status:200, payload:{ entries:[] } } },
      given:{
        text:"que o lojista está no catálogo e nada foi excluído ainda",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { then:"a lixeira diz que está vazia",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo continua completo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"lixeira-erro",
      name:"Lixeira fora do ar e a recuperação",
      page:"lixeira", tags:["@catalogo","@erro","@recuperacao"],
      impl:{ component:"RecycleBinPage", notes:"ErrorState com Tentar novamente" },
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu a lixeira e a API caiu na primeira tentativa",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          api.data_.binFailsOnce = true;
          try { return { page:"lixeira", config, entries:(await api.get(base + "/recycle-bin")).entries }; }
          catch (e){ return { page:"lixeira", config, error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="tentar-lixeira"]' },
        { then:"as entradas aparecem e a explicação some",
          check:(a, el) => el.querySelectorAll(".entrada").length === 1
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo carrega normalmente",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"lixeira-exclusao-definitiva",
      name:"Excluir para sempre e conferir que não voltou",
      page:"lixeira", tags:["@catalogo","@retorno"],
      impl:{ component:"RecycleBinPage", notes:"AlertDialog destrutivo com a consequência escrita" },
      given:{
        text:"que o lojista está no catálogo e há um item na lixeira",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { when:"pede para excluir definitivamente", local:true,
          click:'[data-act="excluir-definitivo"][data-id="b1"]' },
        { then:"a confirmação diz que a ação não pode ser desfeita",
          check:(a, el) => el.textContent.indexOf("não pode ser desfeita") > -1 },
        { when:"o lojista confirma", click:'[data-act="confirmar-exclusao"]' },
        { then:"a lixeira fica vazia",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { when:"abre a lixeira de novo", click:'[data-act="ir-lixeira"]' },
        { then:"o item não voltou",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') }
      ]
    },
    {
      id:"lixeira-exclusao-recusada",
      name:"Exclusão definitiva recusada pelo servidor",
      page:"lixeira", tags:["@catalogo","@conflito"],
      impl:{ component:"RecycleBinPage", notes:"o erro fica na lista, sem derrubar a página" },
      network:{ "DELETE /api/admin/:slug/recycle-bin/:entryId":
                { status:500, payload:{ error_:"Não foi possível excluir a entrada" } } },
      given:{
        text:"que o lojista está no catálogo e o servidor vai recusar a exclusão",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre a lixeira", click:'[data-act="ir-lixeira"]' },
        { when:"pede para excluir definitivamente", local:true,
          click:'[data-act="excluir-definitivo"][data-id="b1"]' },
        { when:"confirma", click:'[data-act="confirmar-exclusao"]' },
        { then:"a tela explica que não deu certo",
          check:(a, el) => !!el.querySelector('[data-erro="lixeira"]') },
        { and:"a entrada continua na lixeira para tentar de novo",
          check:(a, el) => el.querySelectorAll(".entrada").length === 1 }
      ]
    },
    {
      id:"lixeira-cancela-exclusao",
      name:"Desistir da exclusão definitiva",
      page:"lixeira", tags:["@catalogo","@recuperacao"],
      impl:{ component:"RecycleBinPage", notes:"a saída da confirmação não dispara requisição" },
      network:{ "POST /api/admin/:slug/recycle-bin/:entryId/restore":
                { status:500, payload:{ error_:"Não foi possível restaurar a entrada" } } },
      given:{
        text:"que o lojista abriu a lixeira e o restaurar vai falhar",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          return { page:"lixeira", config, entries:(await api.get(base + "/recycle-bin")).entries };
        }
      },
      steps:[
        { when:"o lojista tenta restaurar e o servidor recusa",
          click:'[data-act="restaurar-item"][data-id="b1"]' },
        { then:"a tela explica a recusa",
          check:(a, el) => !!el.querySelector('[data-erro="lixeira"]') },
        { when:"o lojista pede para excluir definitivamente", local:true,
          click:'[data-act="excluir-definitivo"][data-id="b1"]' },
        { when:"desiste da exclusão", click:'[data-act="cancelar-exclusao"]', local:true },
        { when:"relê a lixeira", click:'[data-act="tentar-lixeira"]' },
        { then:"a entrada continua lá, sem erro na tela",
          check:(a, el) => !el.querySelector('[data-act="confirmar-exclusao"]')
                        && el.querySelectorAll(".entrada").length === 1
                        && !el.querySelector('[data-erro="lixeira"]') }
      ]
    },

    /* ---------------------------------------------------------- aprovações */
    {
      id:"aprovacoes-aprova",
      name:"Do catálogo até aprovar uma alteração parada",
      page:"aprovacoes", tags:["@catalogo","@ultra","@feliz","@pode:produto.aprovar"],
      impl:{ component:"ApprovalsPage", route:"/:tenantSlug/approvals" },
      given:{
        text:"que há uma alteração aguardando decisão",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o aprovador abre as aprovações", click:'[data-act="ir-aprovacoes"]' },
        { then:"a solicitação pendente aparece com quem pediu",
          check:(a, el) => el.querySelectorAll(".solicitacao").length === 1
                        && el.textContent.indexOf("Iara Bastos") > -1 },
        { when:"o aprovador aprova a solicitação", click:'[data-act="aprovar"][data-id="r1"]' },
        { then:"ela sai da fila de pendentes",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o aprovador olha as aprovadas", click:'[data-act="filtrar"][data-status="APPROVED"]' },
        { then:"a solicitação está lá, já decidida",
          check:(a, el) => el.querySelectorAll(".solicitacao").length === 1
                        && !!el.querySelector(".decidido") }
      ]
    },
    {
      id:"aprovacoes-carregando",
      name:"Abrir as aprovações e esperar a fila",
      page:"aprovacoes", tags:["@catalogo","@ultra","@carregando"],
      impl:{ component:"ApprovalsPage", notes:"LoadingState enquanto a fila não chega" },
      network:{ "GET /api/admin/:slug/approvals": "pendente" },
      given:{
        text:"que o aprovador abriu as aprovações e a fila ainda não chegou",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          api.get(base + "/approvals").catch(() => {});
          return { page:"aprovacoes", config, statusFiltro:"PENDING", loading:true };
        }
      },
      steps:[
        { then:"a página mostra o esqueleto",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a fila chega", waitFor:"GET /api/admin/:slug/approvals",
          applyState:(a, payload) => ({ ...a, requests:payload.requests, loading:false }) },
        { when:"o aprovador volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo aparece",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"aprovacoes-vazio",
      name:"Nenhuma solicitação rejeitada ainda",
      page:"aprovacoes", tags:["@catalogo","@ultra","@vazio"],
      impl:{ component:"ApprovalsPage", notes:"EmptyState por status, com o texto do filtro" },
      given:{
        text:"que só há uma solicitação pendente na loja",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o aprovador abre as aprovações", click:'[data-act="ir-aprovacoes"]' },
        { when:"filtra pelas rejeitadas", click:'[data-act="filtrar"][data-status="REJECTED"]' },
        { then:"a página diz que não há nenhuma rejeitada",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]')
                        && el.textContent.indexOf("Nenhuma solicitação rejeitada") > -1 },
        { when:"o aprovador volta para as pendentes", click:'[data-act="filtrar"][data-status="PENDING"]' },
        { then:"a fila de pendentes volta a aparecer",
          check:(a, el) => el.querySelectorAll(".solicitacao").length === 1 }
      ]
    },
    {
      id:"aprovacoes-erro",
      name:"Aprovações fora do ar e a recuperação",
      page:"aprovacoes", tags:["@catalogo","@ultra","@erro","@recuperacao"],
      impl:{ component:"ApprovalsPage", notes:"ErrorState com Tentar novamente" },
      fixtureFailure:true,
      given:{
        text:"que o aprovador abriu as aprovações e o serviço caiu na primeira tentativa",
        state: async (ex, api) => {
          const config = await api.get(base + "/config");
          api.data_.approvalsFailOnce = true;
          try {
            return { page:"aprovacoes", config, statusFiltro:"PENDING",
                     requests:(await api.get(base + "/approvals")).requests };
          } catch (e){
            return { page:"aprovacoes", config, statusFiltro:"PENDING", error_:e.message };
          }
        }
      },
      steps:[
        { then:"a página explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o aprovador tenta novamente", click:'[data-act="tentar-aprovacoes"]' },
        { then:"a fila aparece e a explicação some",
          check:(a, el) => el.querySelectorAll(".solicitacao").length === 1
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o aprovador volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo carrega normalmente",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"aprovacoes-rejeita-com-motivo",
      name:"Rejeitar com motivo e conferir na aba das rejeitadas",
      page:"aprovacoes", tags:["@catalogo","@ultra","@retorno","@pode:produto.aprovar"],
      impl:{ component:"ApprovalsPage",
             notes:"o motivo é opcional; no produto real é um Textarea" },
      given:{
        text:"que há uma alteração aguardando decisão",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o aprovador abre as aprovações", click:'[data-act="ir-aprovacoes"]' },
        { when:"pede para rejeitar a solicitação", local:true,
          click:'[data-act="rejeitar"][data-id="r1"]' },
        { when:"desiste", click:'[data-act="cancelar-rejeicao"]', local:true },
        { then:"a caixa de rejeição sai sem decidir nada",
          check:(a, el) => !el.querySelector('[data-confirmacao="rejeicao"]')
                        && el.querySelectorAll(".solicitacao").length === 1 },
        { when:"pede para rejeitar de novo", local:true,
          click:'[data-act="rejeitar"][data-id="r1"]' },
        { when:"escreve o motivo", local:true,
          fill:{ sel:'[data-campo="motivo"]', val:"Preço fora da tabela" } },
        { when:"confirma a rejeição", click:'[data-act="confirmar-rejeicao"]' },
        { then:"a fila de pendentes esvazia",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o aprovador olha as rejeitadas", click:'[data-act="filtrar"][data-status="REJECTED"]' },
        { then:"a solicitação aparece com o motivo escrito",
          check:(a, el) => el.textContent.indexOf("Preço fora da tabela") > -1 }
      ]
    },
    {
      id:"aprovacoes-decisao-recusada",
      name:"Decisão recusada pelo servidor",
      page:"aprovacoes", tags:["@catalogo","@ultra","@conflito","@pode:produto.aprovar"],
      impl:{ component:"ApprovalsPage", notes:"o erro fica na lista, a solicitação continua pendente" },
      network:{ "POST /api/admin/:slug/approvals/:id/approve":
                { status:409, payload:{ error_:"Solicitação já decidida por outra pessoa" } },
              "POST /api/admin/:slug/approvals/:id/reject":
                { status:500, payload:{ error_:"Não foi possível registrar a rejeição" } } },
      given:{
        text:"que outra pessoa decidiu a solicitação antes",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o aprovador abre as aprovações", click:'[data-act="ir-aprovacoes"]' },
        { when:"tenta aprovar", click:'[data-act="aprovar"][data-id="r1"]' },
        { then:"a tela explica que a decisão não valeu",
          check:(a, el) => !!el.querySelector('[data-erro="aprovacoes"]') },
        { and:"a solicitação continua na fila",
          check:(a, el) => el.querySelectorAll(".solicitacao").length === 1 },
        { when:"o aprovador tenta rejeitar", local:true,
          click:'[data-act="rejeitar"][data-id="r1"]' },
        { when:"confirma a rejeição", click:'[data-act="confirmar-rejeicao"]' },
        { then:"a rejeição também é recusada e a solicitação segue pendente",
          check:(a, el) => !!el.querySelector('[data-erro="aprovacoes"]')
                        && el.querySelectorAll(".solicitacao").length === 1 }
      ]
    },
    {
      id:"aprovacoes-desligado",
      name:"Loja sem aprovações ligadas",
      page:"aprovacoes", tags:["@catalogo","@ultra"],
      impl:{ component:"ApprovalsPage", notes:"403 do servidor vira aviso amigável, não ErrorState" },
      given:{
        text:"que a loja desligou a aprovação de alterações",
        state: async (ex, api) => {
          api.data_.lifecycle.approvals.enabled = false;
          const config = await api.get(base + "/config");
          return { page:"aprovacoes", config, statusFiltro:"PENDING",
                   requests:(await api.get(base + "/approvals")).requests };
        }
      },
      steps:[
        { then:"a página diz que o recurso não está ativo",
          check:(a, el) => !!el.querySelector('[data-recurso="desligado"]') },
        { and:"os filtros nem aparecem",
          check:(a, el) => !el.querySelector('[data-act="filtrar"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo não oferece mais o atalho de aprovações",
          check:(a, el) => !el.querySelector('[data-act="ir-aprovacoes"]') },
        { when:"o lojista recarrega o catálogo", click:'[data-act="recarregar-catalogo"]' },
        { then:"o catálogo continua completo",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },

    /* ------------------------------------------------------------ recursos */
    {
      id:"recursos-desliga-rascunhos",
      name:"Desligar rascunhos e ver o botão sumir do produto",
      page:"recursos", tags:["@catalogo","@pro","@feliz"],
      impl:{ component:"ConfigFeaturesPage", route:"/:tenantSlug/config/features",
             notes:"Switch otimista; o interruptor da loja é a terceira camada do portão" },
      given:{
        text:"que o lojista está no catálogo com rascunhos ligados",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre os recursos", click:'[data-act="ir-recursos"]' },
        { then:"os três recursos aparecem, e o que o plano não inclui vem travado",
          check:(a, el) => el.querySelectorAll(".recurso").length === 3
                        && el.textContent.indexOf("Não incluído no seu plano.") > -1 },
        { when:"o lojista desliga os rascunhos",
          toggleCtl:'input[data-campo="recurso"][data-recurso="drafts"]' },
        { when:"volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { when:"abre o primeiro produto", click:'[data-act="abrir-produto"][data-id="p1"]' },
        { then:"o produto não oferece mais salvar rascunho",
          check:(a, el) => !el.querySelector('[data-act="salvar-rascunho"]')
                        && !el.querySelector('[data-faixa="rascunho"]') }
      ]
    },
    {
      id:"recursos-carregando",
      name:"Abrir os recursos e esperar a configuração",
      page:"recursos", tags:["@catalogo","@pro","@carregando"],
      impl:{ component:"ConfigFeaturesPage", notes:"LoadingState enquanto a config não chega" },
      network:{ "GET /api/admin/:slug/config": "pendente" },
      given:{
        text:"que o lojista abriu os recursos e a configuração ainda não chegou",
        state: async (ex, api) => {
          api.get(base + "/config").catch(() => {});
          return { page:"recursos", loading:true };
        }
      },
      steps:[
        { then:"a página mostra o esqueleto",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a configuração chega", waitFor:"GET /api/admin/:slug/config",
          applyState:(a, payload) => ({ ...a, config:payload, loading:false }) },
        { when:"o lojista desliga o histórico de versões",
          toggleCtl:'input[data-campo="recurso"][data-recurso="versioning"]' },
        { then:"o interruptor responde e a configuração continua na tela",
          check:(a, el) => el.querySelectorAll(".recurso").length === 3
                        && !el.querySelector('[data-erro="recursos"]') }
      ]
    },
    {
      id:"recursos-sem-plano",
      name:"Plano sem os recursos avançados",
      page:"recursos", tags:["@catalogo","@vazio"],
      impl:{ component:"ConfigFeaturesPage",
             notes:"a loja pode desligar sempre; ligar depende do plano" },
      given:{
        text:"que a loja está num plano sem os recursos avançados",
        state: async (ex, api) => ({
          page:"catalogo",
          config: await api.get(base + "/config"),
          products: await api.get(base + "/products")
        })
      },
      steps:[
        { when:"o lojista abre os recursos", click:'[data-act="ir-recursos"]' },
        { then:"a página explica que o plano não inclui nenhum deles",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo não oferece histórico nas linhas",
          check:(a, el) => !el.querySelector('[data-act="abrir-historico"]') }
      ]
    },
    {
      id:"recursos-erro",
      name:"Configuração fora do ar e a recuperação",
      page:"recursos", tags:["@catalogo","@pro","@erro","@recuperacao"],
      impl:{ component:"ConfigFeaturesPage", notes:"ErrorState com Tentar novamente" },
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu os recursos e a configuração caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.configFailsOnce = true;
          try { return { page:"recursos", config: await api.get(base + "/config") }; }
          catch (e){ return { page:"recursos", error_:e.message }; }
        }
      },
      steps:[
        { then:"a página explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="tentar-recursos"]' },
        { then:"os recursos aparecem e a explicação some",
          check:(a, el) => el.querySelectorAll(".recurso").length === 3
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista volta para o catálogo", click:'[data-act="voltar-catalogo"]' },
        { then:"o catálogo carrega normalmente",
          check:(a, el) => el.querySelectorAll(".linha").length === 2 }
      ]
    },
    {
      id:"recursos-falha-reverte",
      name:"Interruptor recusado pelo servidor volta ao que era",
      page:"recursos", tags:["@catalogo","@ultra","@conflito"],
      impl:{ component:"ConfigFeaturesPage",
             notes:"escrita otimista: em caso de falha o Switch volta e o erro aparece" },
      network:{ "PUT /api/admin/:slug/config":
                { status:500, payload:{ error_:"Não foi possível atualizar os recursos" } } },
      given:{
        text:"que o lojista abriu os recursos e o servidor vai recusar a mudança",
        state: async (ex, api) => ({ page:"recursos", config: await api.get(base + "/config") })
      },
      steps:[
        { when:"o lojista tenta desligar as aprovações",
          toggleCtl:'input[data-campo="recurso"][data-recurso="approvals"]' },
        { then:"a tela explica que não deu para atualizar",
          check:(a, el) => !!el.querySelector('[data-erro="recursos"]') },
        { when:"tenta também desligar os rascunhos",
          toggleCtl:'input[data-campo="recurso"][data-recurso="drafts"]' },
        { then:"a recusa continua na tela e nenhum interruptor ficou virado",
          check:(a, el) => !!el.querySelector('[data-erro="recursos"]')
                        && el.querySelectorAll(".recurso").length === 3
                        && el.querySelectorAll('input[data-campo="recurso"]:checked').length === 3 }
      ]
    }
  ],

  /* flushSync, não render: o harness mede o DOM na linha seguinte, e um commit
     concorrente ainda não estaria lá. */
  mount(el, state){
    const draw = () => flushSync(() => rootFor(el).render(<Screen s={state} />));
    try { draw(); }
    catch { roots.delete(el); draw(); }
  },

  defaultPage: "catalogo"
});

/* ------------------------------------------------------------- navegação */

Proto.on("click", '[data-act="ir-lixeira"]', async () => {
  try {
    const r = await Proto.api.get(base + "/recycle-bin");
    Proto.set({ page:"lixeira", entries:r.entries, error_:null, erroAcao:null, aviso:null });
  } catch (e){ Proto.set({ page:"lixeira", error_:e.message }); }
});

Proto.on("click", '[data-act="ir-aprovacoes"]', async () => {
  try {
    const r = await Proto.api.get(base + "/approvals");
    Proto.set({ page:"aprovacoes", requests:r.requests, statusFiltro:"PENDING",
                error_:null, erroAcao:null, aviso:null });
  } catch (e){ Proto.set({ page:"aprovacoes", statusFiltro:"PENDING", error_:e.message }); }
});

Proto.on("click", '[data-act="ir-recursos"]', async () => {
  try {
    const config = await Proto.api.get(base + "/config");
    Proto.set({ page:"recursos", config, error_:null, erroAcao:null, aviso:null });
  } catch (e){ Proto.set({ page:"recursos", error_:e.message }); }
});

Proto.on("click", '[data-act="voltar-catalogo"]', async () => {
  try {
    Proto.set({ page:"catalogo", products: await Proto.api.get(base + "/products"),
                error_:null, erroAcao:null, aviso:null, confirmarPurga:null,
                confirmarVersao:null, rejeitando:null });
  } catch (e){ Proto.set({ page:"catalogo", error_:e.message }); }
});

Proto.on("click", '[data-act="recarregar-catalogo"]', async () => {
  try { Proto.set({ products: await Proto.api.get(base + "/products"), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});

Proto.on("click", '[data-act="fechar-aviso"]', () => Proto.set({ aviso:null }));

/* --------------------------------------------------------------- catálogo */

/* abrir o produto é uma requisição: o rascunho dele é buscado na hora */
Proto.on("click", '[data-act="abrir-produto"]', async (e, el, s) => {
  const prod = (s.app.products || []).find(p => p.id === el.dataset.id);
  const comum = { page:"produto", produto:prod, error_:null, erroAcao:null, aviso:null,
                  form:{ nameStr:prod.nameStr, priceStr:prod.priceStr } };
  try {
    const r = await Proto.api.get(base + "/products/" + prod.id + "/draft");
    Proto.set({ ...comum, draft:r.draft });
  } catch (err){ Proto.set({ ...comum, draft:null, error_:err.message }); }
});

Proto.on("click", '[data-act="abrir-historico"]', async (e, el, s) => {
  const prod = (s.app.products || []).find(p => p.id === el.dataset.id);
  const comum = { page:"historico", historicoDe:prod, confirmarVersao:null,
                  error_:null, erroAcao:null, aviso:null };
  try {
    Proto.set({ ...comum, historico: await Proto.api.get(base + "/products/" + prod.id + "/versions") });
  } catch (err){ Proto.set({ ...comum, historico:null, error_:err.message }); }
});

Proto.on("click", '[data-act="excluir-produto"]', async (e, el) => {
  try {
    const r = await Proto.api.del(base + "/products/" + el.dataset.id);
    if (r && r.applied === false){
      Proto.set({ aviso:{ tipo:"pendente", texto:"Alteração enviada para aprovação." }, erroAcao:null });
      return;
    }
    Proto.set({ products: await Proto.api.get(base + "/products"),
                aviso:{ tipo:"ok", texto:"Item movido para a lixeira." }, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

/* ---------------------------------------------------------------- produto */

Proto.on("input", '[data-campo="nome"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), nameStr: el.value } });
});

Proto.on("input", '[data-campo="preco"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), priceStr: el.value } });
});

Proto.on("click", '[data-act="salvar"]', async (e, el, s) => {
  const prod = s.app.produto;
  try {
    const r = await Proto.api.put(base + "/products/" + prod.id, s.app.form);
    if (r && r.applied === false){
      Proto.set({ aviso:{ tipo:"pendente", texto:"Alteração enviada para aprovação." }, erroAcao:null });
      return;
    }
    Proto.set({ produto:r.product, aviso:{ tipo:"ok", texto:"Produto salvo." }, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

Proto.on("click", '[data-act="salvar-rascunho"]', async (e, el, s) => {
  const prod = s.app.produto;
  try {
    const r = await Proto.api.put(base + "/products/" + prod.id + "/draft", s.app.form);
    Proto.set({ draft:r.draft, aviso:{ tipo:"ok", texto:"Rascunho salvo." }, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

/* carregar é só preenchimento de formulário — não sai da tela */
Proto.on("click", '[data-act="carregar-rascunho"]', (e, el, s) => {
  const d = s.app.draft;
  if (!d) return;
  Proto.set({ form:{ nameStr:d.data.nameStr, priceStr:d.data.priceStr } });
});

Proto.on("click", '[data-act="publicar-rascunho"]', async (e, el, s) => {
  const d = s.app.draft;
  try {
    const r = await Proto.api.post(base + "/drafts/" + d.id + "/publish", {});
    if (r && r.applied === false){
      Proto.set({ aviso:{ tipo:"pendente", texto:"Alteração enviada para aprovação." }, erroAcao:null });
      return;
    }
    const products = await Proto.api.get(base + "/products");
    Proto.set({ products, draft:null,
                produto: products.find(p => p.id === (s.app.produto || {}).id),
                aviso:{ tipo:"ok", texto:"Rascunho publicado." }, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

Proto.on("click", '[data-act="descartar-rascunho"]', async (e, el, s) => {
  const d = s.app.draft;
  try {
    await Proto.api.del(base + "/drafts/" + d.id);
    Proto.set({ draft:null, aviso:{ tipo:"ok", texto:"Rascunho descartado." }, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

Proto.on("click", '[data-act="tentar-rascunho"]', async (e, el, s) => {
  const prod = s.app.produto;
  try {
    const r = await Proto.api.get(base + "/products/" + prod.id + "/draft");
    Proto.set({ draft:r.draft, error_:null });
  } catch (err){ Proto.set({ error_:err.message }); }
});

/* -------------------------------------------------------------- histórico */

Proto.on("click", '[data-act="restaurar-versao"]', (e, el) => {
  Proto.set({ confirmarVersao: Number(el.dataset.v) });
});

Proto.on("click", '[data-act="cancelar-restauracao"]', () => Proto.set({ confirmarVersao:null }));

Proto.on("click", '[data-act="confirmar-restauracao"]', async (e, el, s) => {
  const v = s.app.confirmarVersao;
  const id = (s.app.historicoDe || {}).id;
  try {
    const r = await Proto.api.post(base + "/products/" + id + "/versions/" + v + "/restore", {});
    if (r && r.applied === false){
      Proto.set({ confirmarVersao:null, erroAcao:null,
                  aviso:{ tipo:"pendente", texto:"Alteração enviada para aprovação." } });
      return;
    }
    Proto.set({ confirmarVersao:null, erroAcao:null,
                historico: await Proto.api.get(base + "/products/" + id + "/versions"),
                aviso:{ tipo:"ok", texto:"Versão v" + v + " restaurada." } });
  } catch (err){ Proto.set({ confirmarVersao:null, erroAcao:err.message }); }
});

Proto.on("click", '[data-act="tentar-historico"]', async (e, el, s) => {
  const id = (s.app.historicoDe || {}).id;
  try {
    Proto.set({ historico: await Proto.api.get(base + "/products/" + id + "/versions"), error_:null });
  } catch (err){ Proto.set({ error_:err.message }); }
});

Proto.on("click", '[data-act="fechar-historico"]', async () => {
  try {
    Proto.set({ page:"catalogo", products: await Proto.api.get(base + "/products"),
                historico:null, confirmarVersao:null, error_:null, aviso:null });
  } catch (e){ Proto.set({ page:"catalogo", error_:e.message }); }
});

/* ---------------------------------------------------------------- lixeira */

Proto.on("click", '[data-act="restaurar-item"]', async (e, el) => {
  try {
    await Proto.api.post(base + "/recycle-bin/" + el.dataset.id + "/restore", {});
    const r = await Proto.api.get(base + "/recycle-bin");
    Proto.set({ entries:r.entries, erroAcao:null,
                aviso:{ tipo:"ok", texto:"Item restaurado." } });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

Proto.on("click", '[data-act="excluir-definitivo"]', (e, el, s) => {
  const entry = (s.app.entries || []).find(x => x.id === el.dataset.id);
  Proto.set({ confirmarPurga: entry || null });
});

Proto.on("click", '[data-act="cancelar-exclusao"]', () => Proto.set({ confirmarPurga:null, erroAcao:null }));

Proto.on("click", '[data-act="confirmar-exclusao"]', async (e, el, s) => {
  const entry = s.app.confirmarPurga;
  try {
    await Proto.api.del(base + "/recycle-bin/" + entry.id);
    const r = await Proto.api.get(base + "/recycle-bin");
    Proto.set({ entries:r.entries, confirmarPurga:null, erroAcao:null,
                aviso:{ tipo:"ok", texto:"Item excluído definitivamente." } });
  } catch (err){ Proto.set({ confirmarPurga:null, erroAcao:err.message }); }
});

Proto.on("click", '[data-act="tentar-lixeira"]', async () => {
  try {
    const r = await Proto.api.get(base + "/recycle-bin");
    Proto.set({ entries:r.entries, error_:null });
  } catch (err){ Proto.set({ error_:err.message }); }
});

/* ------------------------------------------------------------- aprovações */

Proto.on("click", '[data-act="filtrar"]', async (e, el) => {
  const status = el.dataset.status;
  try {
    const r = await Proto.api.get(base + "/approvals");
    Proto.set({ statusFiltro:status, requests:r.requests, error_:null, erroAcao:null });
  } catch (err){ Proto.set({ statusFiltro:status, error_:err.message }); }
});

Proto.on("click", '[data-act="aprovar"]', async (e, el) => {
  try {
    await Proto.api.post(base + "/approvals/" + el.dataset.id + "/approve", {});
    const r = await Proto.api.get(base + "/approvals");
    Proto.set({ requests:r.requests, erroAcao:null,
                aviso:{ tipo:"ok", texto:"Solicitação aprovada." } });
  } catch (err){ Proto.set({ erroAcao:err.message }); }
});

Proto.on("click", '[data-act="rejeitar"]', (e, el, s) => {
  const req = (s.app.requests || []).find(x => x.id === el.dataset.id);
  Proto.set({ rejeitando: req || null, motivo:"" });
});

Proto.on("click", '[data-act="cancelar-rejeicao"]', () => Proto.set({ rejeitando:null, motivo:"" }));

Proto.on("input", '[data-campo="motivo"]', (e, el) => Proto.set({ motivo: el.value }));

Proto.on("click", '[data-act="confirmar-rejeicao"]', async (e, el, s) => {
  const req = s.app.rejeitando;
  try {
    await Proto.api.post(base + "/approvals/" + req.id + "/reject",
                         s.app.motivo ? { note:s.app.motivo } : {});
    const r = await Proto.api.get(base + "/approvals");
    Proto.set({ requests:r.requests, rejeitando:null, motivo:"", erroAcao:null,
                aviso:{ tipo:"ok", texto:"Solicitação rejeitada." } });
  } catch (err){ Proto.set({ rejeitando:null, erroAcao:err.message }); }
});

Proto.on("click", '[data-act="tentar-aprovacoes"]', async () => {
  try {
    const r = await Proto.api.get(base + "/approvals");
    Proto.set({ requests:r.requests, error_:null });
  } catch (err){ Proto.set({ error_:err.message }); }
});

/* --------------------------------------------------------------- recursos */

Proto.on("change", '[data-campo="recurso"]', async (e, el, s) => {
  const key = el.dataset.recurso || el.getAttribute("data-recurso");
  const cfg = (s.app.config && s.app.config.lifecycle) || {};
  const alvo = !(cfg[key] && cfg[key].enabled);
  /* escrita otimista: a tela vira primeiro e volta atrás se o servidor recusar */
  Proto.set({ config:{ lifecycle:{ ...cfg, [key]:{ enabled:alvo } } }, erroAcao:null });
  try {
    const r = await Proto.api.put(base + "/config", { feature:key, enabled:alvo });
    Proto.set({ config:r, erroAcao:null });
  } catch (err){
    Proto.set({ config:{ lifecycle:{ ...cfg, [key]:{ enabled:!alvo } } }, erroAcao:err.message });
  }
});

Proto.on("click", '[data-act="tentar-recursos"]', async () => {
  try { Proto.set({ config: await Proto.api.get(base + "/config"), error_:null }); }
  catch (err){ Proto.set({ error_:err.message }); }
});
