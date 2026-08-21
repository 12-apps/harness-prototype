/* Combos e promoções por quantidade (FUT-268): o construtor no admin e a
   vitrine que os vende, do cardápio até o carrinho.

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

/* Dinheiro chega em centavos e é formatado só na borda. */
const reais = (cents) =>
  "R$ " + (Math.round(cents || 0) / 100).toFixed(2).replace(".", ",");

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

function ErroDeAcao({ s, hook }){
  if (!s.app.erroAcao) return null;
  return <Alert className="aviso" data-erro={hook}>{s.app.erroAcao}</Alert>;
}

function Aviso({ s }){
  if (!s.app.aviso) return null;
  return (
    <Alert className="aviso" data-aviso={s.app.aviso.tipo}>
      <Text>{s.app.aviso.texto}</Text>
      <Button className="btn ghost" data-act="fechar-aviso">Fechar</Button>
    </Alert>
  );
}

/* O selo falado da promoção. "leve 4, pague 3" é como o lojista diz — e é por
   isso que os campos se chamam cobrada/recebida e não compra/leva. */
const termosFalados = (c) =>
  "leve " + c.receivedQuantity + ", pague " + c.chargedQuantity;

/* ------------------------------------------------- admin: lista de combos */

function CombosScreen({ s }){
  const combos = s.app.combos;
  const st = estadoDe(s, !(combos && !combos.length));
  const podeEditar = s.can("combo.editar");
  const colunas = s.rung === "xlg" ? 3 : (s.widthPx >= 768 ? 2 : 1);

  const corpo =
    st === "carregando" ? <Carregando barras={4} label="Carregando os combos…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar os combos" acao="recarregar-combos" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">Nenhum combo ainda</Heading>
        <Paragraph>Junte produtos num preço só, ou monte uma promoção por quantidade.</Paragraph>
        {podeEditar && <Button className="btn" data-act="novo-combo">Criar combo</Button>}
      </Box>
    ) : (
      <Box data-estado="conteudo" data-colunas={colunas}>
        <ErroDeAcao s={s} hook="combos" />
        <Box className="grade">
          {(combos || []).map(c => (
            <Card key={c.id} variant="outlined" className="combo">
              <CardContent>
                <Text className="nome" weight="bold">{c.nameStr}</Text>
                {c.type === "FIXED_BUNDLE" ? (
                  <Box className="precos">
                    <Text className="preco">{reais(c.priceCents)}</Text>
                    <Text className="soma">{reais(c.somaCents)}</Text>
                    <Badge className="tag economia">
                      economiza {reais(c.somaCents - c.priceCents)}
                    </Badge>
                  </Box>
                ) : (
                  <Badge className="tag promo">{termosFalados(c)}</Badge>
                )}
                <Text className="componentes">
                  {c.type === "FIXED_BUNDLE"
                    ? c.componentes.map(x => x.quantity + "× " + x.nameStr).join(" + ")
                    : "Vale para " + (c.alvo ? c.alvo.nameStr : "—")}
                </Text>
                {podeEditar && (
                  <Box className="linha-acoes">
                    <Button className="btn ghost" data-act="editar-combo" data-id={c.id}>Editar</Button>
                    <Button className="btn ghost" data-act="ver-no-cardapio" data-id={c.id}>
                      Ver no cardápio
                    </Button>
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
        <Heading level="h1">Combos</Heading>
        <Paragraph>{combos ? combos.length + (combos.length === 1 ? " combo" : " combos") : "—"}</Paragraph>
        <Box className="nav">
          {podeEditar && <Button className="btn" data-act="novo-combo">Novo combo</Button>}
          <Button className="btn ghost" data-act="ir-cardapio">Ver o cardápio</Button>
          <Button className="btn ghost" data-act="recarregar-combos">Recarregar</Button>
        </Box>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
    </Box>
  );
}

/* -------------------------------------------------- admin: o construtor */

function ConstrutorScreen({ s }){
  const f = s.app.form || {};
  const produtos = s.app.produtos;
  const st = estadoDe(s, !!(produtos && produtos.length));
  const pacote = f.type === "FIXED_BUNDLE";

  const escolhidos = f.items || [];
  const somaCents = escolhidos.reduce((t, it) => {
    const p = (produtos || []).find(x => x.id === it.productId);
    return t + (p ? p.priceCents * it.quantity : 0);
  }, 0);
  const precoCents = Number(f.priceReais || 0) * 100;

  /* As mesmas invariantes que o servidor confere de novo: o construtor só
     não deixa chegar lá com o erro óbvio. */
  const impedimento =
    !f.nameStr || !f.nameStr.trim() ? "Dê um nome ao combo"
    : pacote && escolhidos.length < 2 ? "Um pacote fechado precisa de pelo menos 2 produtos"
    : pacote && !(precoCents >= 0) ? "O preço do combo não pode ser negativo"
    : !pacote && !f.targetProductId ? "Escolha o produto da promoção"
    : !pacote && !(Number(f.receivedQuantity) > Number(f.chargedQuantity) && Number(f.chargedQuantity) > 0)
      ? "A quantidade levada tem de ser maior que a cobrada"
    : null;

  const corpo =
    st === "carregando" ? <Carregando barras={4} label="Carregando os produtos…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar os produtos" acao="tentar-produtos" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">Nenhum produto no cardápio</Heading>
        <Paragraph>Um combo junta produtos que já existem — cadastre-os antes.</Paragraph>
      </Box>
    ) : (
      <Box data-estado="conteudo">
        <ErroDeAcao s={s} hook="construtor" />

        <Box className="tipos">
          <Button className={"btn chip" + (pacote ? " selecionado" : "")}
                  data-act="tipo-combo" data-tipo="FIXED_BUNDLE">Pacote fechado</Button>
          <Button className={"btn chip" + (!pacote ? " selecionado" : "")}
                  data-act="tipo-combo" data-tipo="QUANTITY_DEAL">Promoção por quantidade</Button>
        </Box>

        <Box className="form">
          <Input
            value={f.nameStr || ""}
            placeholder="Nome do combo"
            slotProps={{ htmlInput:{ className:"campo", "data-campo":"nome",
                                     "aria-label":"Nome do combo" } }}
          />
        </Box>

        {pacote ? (
          <Box className="bloco" data-bloco="pacote">
            <Heading level="h2">Produtos do pacote</Heading>
            <Box className="grade">
              {(produtos || []).map(p => {
                const escolhido = escolhidos.find(x => x.productId === p.id);
                return (
                  <Card key={p.id} variant="outlined"
                        className={"produto" + (escolhido ? " escolhido" : "")}>
                    <CardContent>
                      <Text weight="bold">{p.nameStr}</Text>
                      <Text className="preco-item">{reais(p.priceCents)}</Text>
                      {escolhido && <Badge className="tag">{escolhido.quantity}× no pacote</Badge>}
                      <Button className="btn ghost" data-act="alternar-produto" data-id={p.id}>
                        {escolhido ? "Tirar do pacote" : "Pôr no pacote"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            <Box className="form">
              <Input
                value={(f.priceReais || "").replace(".", ",")}
                placeholder="0,00"
                slotProps={{ htmlInput:{ className:"campo", "data-campo":"preco",
                                         inputMode:"decimal", "aria-label":"Preço do combo" } }}
              />
            </Box>

            {/* a referência que faz o lojista enxergar o desconto que está dando */}
            <Box className="comparativo" data-comparativo>
              <Text className="soma">Soma das partes {reais(somaCents)}</Text>
              <Text className="preco">Preço do combo {reais(precoCents)}</Text>
              <Badge className="tag economia">
                {precoCents <= somaCents
                  ? "cliente economiza " + reais(somaCents - precoCents)
                  : "acima da soma das partes"}
              </Badge>
            </Box>
          </Box>
        ) : (
          <Box className="bloco" data-bloco="promocao">
            <Heading level="h2">Promoção por quantidade</Heading>
            <Box className="grade">
              {(produtos || []).map(p => (
                <Card key={p.id} variant="outlined"
                      className={"produto" + (f.targetProductId === p.id ? " escolhido" : "")}>
                  <CardContent>
                    <Text weight="bold">{p.nameStr}</Text>
                    <Text className="preco-item">{reais(p.priceCents)}</Text>
                    <Button className="btn ghost" data-act="alvo-promocao" data-id={p.id}>
                      {f.targetProductId === p.id ? "É este" : "Escolher"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
            <Box className="form">
              <Input
                value={f.receivedQuantity || ""}
                placeholder="leva quantos"
                slotProps={{ htmlInput:{ className:"campo", "data-campo":"levada",
                                         inputMode:"numeric", "aria-label":"Quantidade levada" } }}
              />
              <Input
                value={f.chargedQuantity || ""}
                placeholder="paga quantos"
                slotProps={{ htmlInput:{ className:"campo", "data-campo":"cobrada",
                                         inputMode:"numeric", "aria-label":"Quantidade cobrada" } }}
              />
            </Box>
            <Box className="comparativo" data-comparativo>
              <Text className="frase">
                {"Fica assim no cardápio: leve " + (f.receivedQuantity || "—")
                  + ", pague " + (f.chargedQuantity || "—")}
              </Text>
            </Box>
          </Box>
        )}

        {impedimento && (
          <Banner className="impedimento" data-impedimento>
            <Text>{impedimento}</Text>
          </Banner>
        )}
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="voltar-combos">← Combos</Button>
        <Heading level="h1">{s.app.editandoId ? "Editar combo" : "Novo combo"}</Heading>
        <Paragraph>Junte produtos num preço só, ou dê unidades de graça por quantidade.</Paragraph>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
      {st === "conteudo" && (
        <Box className="acoes acao-fixa">
          <Button className="btn" data-act="salvar-combo" disabled={!!impedimento}>
            Salvar combo
          </Button>
        </Box>
      )}
    </Box>
  );
}

/* ---------------------------------------------------- vitrine: o cardápio */

function CardapioScreen({ s }){
  const menu = s.app.menu;
  const combos = (menu && menu.combos) || [];
  const itens = (menu && menu.itens) || [];
  const st = estadoDe(s, !!(menu && (combos.length || itens.length)));
  const colunas = s.rung === "xlg" ? 3 : (s.widthPx >= 768 ? 2 : 1);

  const corpo =
    st === "carregando" ? <Carregando barras={4} label="Carregando o cardápio…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar o cardápio" acao="tentar-cardapio" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">Cardápio ainda vazio</Heading>
        <Paragraph>Quando a loja publicar itens e combos, eles aparecem aqui.</Paragraph>
      </Box>
    ) : (
      <Box data-estado="conteudo" data-colunas={colunas}>
        <ErroDeAcao s={s} hook="cardapio" />
        <Box className="grade">
          {combos.map(c => (
            <Card key={c.id} variant="outlined" className="combo-card">
              <CardContent>
                <Text className="nome" weight="bold">{c.nameStr}</Text>
                <Text className="desc">{c.descricao}</Text>
                {c.type === "FIXED_BUNDLE" ? (
                  <Box className="precos">
                    <Text className="preco">{reais(c.priceCents)}</Text>
                    <Text className="soma">{reais(c.somaCents)}</Text>
                    <Text className="inclui">
                      Inclui: {c.componentes.map(x => x.quantity + "× " + x.nameStr).join(", ")}
                    </Text>
                  </Box>
                ) : (
                  <Box className="precos">
                    <Badge className="tag promo">{termosFalados(c)}</Badge>
                    <Text className="inclui">
                      {c.alvo ? c.alvo.nameStr + " · " + reais(c.alvo.priceCents) + " cada" : ""}
                    </Text>
                  </Box>
                )}
                <Button className="btn" data-act="por-no-carrinho" data-id={c.id}>
                  Adicionar
                </Button>
              </CardContent>
            </Card>
          ))}
          {itens.map(p => (
            <Card key={p.id} variant="outlined" className="item-card">
              <CardContent>
                <Text className="nome" weight="bold">{p.nameStr}</Text>
                <Text className="preco">{reais(p.priceCents)}</Text>
                <Button className="btn ghost" data-act="por-item" data-id={p.id}>Adicionar</Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Heading level="h1">Cardápio</Heading>
        <Paragraph>{combos.length ? combos.length + " combo(s) na vitrine" : "Sem combos na vitrine"}</Paragraph>
        <Box className="nav">
          <Button className="btn ghost" data-act="ir-carrinho">Carrinho</Button>
          <Button className="btn ghost" data-act="voltar-combos">Admin</Button>
        </Box>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
    </Box>
  );
}

/* ---------------------------------------------------- vitrine: o carrinho */

function CarrinhoScreen({ s }){
  const cart = s.app.cart;
  const lines = (cart && cart.lines) || [];
  const st = estadoDe(s, !(cart && !lines.length));

  const corpo =
    st === "carregando" ? <Carregando barras={3} label="Carregando o carrinho…" /> :
    st === "erro" ? <Erro s={s} titulo="Não deu para carregar o carrinho" acao="tentar-carrinho" /> :
    st === "vazio" ? (
      <Box className="estado" data-estado="vazio">
        <Heading level="h2">Carrinho vazio</Heading>
        <Paragraph>Escolha um combo no cardápio para começar.</Paragraph>
        <Button className="btn" data-act="ir-cardapio">Ver o cardápio</Button>
      </Box>
    ) : (
      <Box data-estado="conteudo" data-layout={s.widthPx >= 768 ? "duas-colunas" : "empilhado"}>
        <ErroDeAcao s={s} hook="carrinho" />
        <Box className="carrinho-layout">
        <Box className="linhas grade">
        {lines.map(l => (
          <Card key={l.lineId} variant="outlined" className="linha-carrinho" data-linha={l.type}>
            <CardContent>
              <Text className="nome" weight="bold">{l.nameStr}</Text>
              <Text className="qtd">{l.quantity}×</Text>
              <Text className="bruto">{reais(l.brutoCents)}</Text>
              {l.discountCents > 0 && (
                <Badge className="tag desconto">− {reais(l.discountCents)}</Badge>
              )}
              {l.termos && (
                <Badge className="tag promo">
                  {"leve " + l.termos.receivedQuantity + ", pague " + l.termos.chargedQuantity}
                </Badge>
              )}
              {/* o combo é UMA linha, e os componentes ficam à vista dentro dela —
                  é esse retrato que o pedido guarda depois */}
              {l.componentes.length > 0 && (
                <Box className="componentes-linha">
                  {l.componentes.map(x => (
                    <Text key={x.productId} className="componente">
                      {x.quantity}× {x.nameStr}
                    </Text>
                  ))}
                </Box>
              )}
              <Box className="linha-acoes">
                <Button className="btn ghost" data-act="mais-um" data-id={l.lineId}>+1</Button>
                <Button className="btn ghost" data-act="tirar-linha" data-id={l.lineId}>Tirar</Button>
              </Box>
            </CardContent>
          </Card>
        ))}
        </Box>

        <Card variant="outlined" className="totais" data-totais>
          <CardContent>
            <Text className="linha-total">Subtotal {reais(cart.subtotalCents)}</Text>
            <Text className="linha-total">Desconto − {reais(cart.discountTotalCents)}</Text>
            <Text className="linha-total total" weight="bold">
              Total {reais(cart.totalCents)}
            </Text>
            {(cart.aplicados || []).map(a => (
              <Badge key={a.id} className="tag aplicado" data-escopo={a.scope}>
                {a.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
        </Box>
      </Box>
    );

  return (
    <Box className="app">
      <AppBar className="app-hd" position="sticky" color="transparent" elevation={0}>
        <Button className="voltar" data-act="ir-cardapio">← Cardápio</Button>
        <Heading level="h1">Carrinho</Heading>
        <Paragraph>{lines.length ? lines.length + " linha(s)" : "Nada aqui ainda"}</Paragraph>
      </AppBar>
      <Aviso s={s} />
      <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
    </Box>
  );
}

function Screen({ s }){
  const pg = s.app.page || "combos";
  return pg === "construtor" ? <ConstrutorScreen s={s} />
       : pg === "cardapio"   ? <CardapioScreen s={s} />
       : pg === "carrinho"   ? <CarrinhoScreen s={s} />
       :                       <CombosScreen s={s} />;
}

/* ------------------------------------------------------------------------ */

const SLUG = "cantina-do-porto";
const admin = "/api/admin/" + SLUG;
const loja  = "/api/cart/" + SLUG;

Proto.init({
  title: "combos e promoções",

  library: "@12-apps/ui",

  data_: window.PROTO_DATA,
  routes: window.PROTO_ROUTES,
  latency: [250, 750],

  feature: {
    name: "Combos e promoções por quantidade",
    as:   "lojista",
    want: "vender produtos juntos por um preço próprio, ou dar unidades por quantidade",
    so:   "o ticket suba sem eu inventar desconto na hora do caixa",
    impl: {
      component:"Combos",
      route:"/:tenantSlug/combos",
      moduleName:"catalogo/combos",
      notes:"Combo + ComboItem (FUT-269); preço servidor-autoritativo (FUT-272)"
    }
  },

  context: [
    {
      id:"papel", label:"Papel do usuário", kind:"opcao", value:"dono",
      options:[
        { id:"dono",     label:"Dono",     allows:["combo.editar","combo.ver"] },
        { id:"operador", label:"Operador", allows:["combo.ver"] }
      ]
    },
    {
      id:"flags", label:"Funcionalidades", kind:"flags", value:[],
      options:[
        { id:"descontos", label:"Motor de descontos" }
      ]
    }
  ],

  scenarios: [
    /* -------------------------------------------------------------- combos */
    {
      id:"combos-percorre",
      name:"Ver os combos e conferir um no cardápio",
      page:"combos", tags:["@combos","@feliz"],
      impl:{ component:"CombosAdmin", route:"/:tenantSlug/combos" },
      given:{
        text:"que o lojista abriu a lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { then:"o pacote fechado mostra o preço do combo ao lado da soma das partes",
          check:(a, el) => !!el.querySelector(".combo .economia")
                        && el.textContent.indexOf("economiza R$ 4,00") > -1 },
        { and:"a promoção aparece com os termos falados",
          check:(a, el) => el.textContent.indexOf("leve 4, pague 3") > -1 },
        { when:"o lojista confere o combo no cardápio",
          click:'[data-act="ver-no-cardapio"][data-id="c1"]' },
        { then:"o cardápio mostra o combo com o que vem dentro",
          check:(a, el) => el.textContent.indexOf("Inclui: 1× Sanduíche do chef") > -1 },
        { when:"o lojista volta para o admin", click:'[data-act="voltar-combos"]' },
        { then:"a lista de combos continua completa",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"combos-larguras",
      name:"A lista de combos em cada largura",
      page:"combos", tags:["@combos","@retorno"],
      impl:{ component:"CombosAdmin", notes:"grade por container query" },
      given:{
        text:"que o lojista abre os combos em <largura>",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { then:"a lista aparece em <colunas> coluna(s)",
          check:(a, el, s) => {
            /* mede as colunas de verdade quando há motor de layout; sem ele
               cai no que a tela declara */
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
        { when:"o lojista abre o cardápio", click:'[data-act="ir-cardapio"]' },
        { then:"o cardápio abre sem perder a largura",
          check:(a, el) => !!el.querySelector('[data-act="ir-carrinho"]') },
        { when:"o lojista volta para os combos", click:'[data-act="voltar-combos"]' },
        { then:"a lista continua em <colunas> coluna(s)",
          check:(a, el, s) => {
            const c = el.querySelector("[data-colunas]");
            return !!c && c.getAttribute("data-colunas") === String(s.ex.colunas);
          } }
      ],
      examples:{
        columns:["largura","colunas"],
        tableRows:[ ["xxs","1"], ["md","2"], ["xlg","3"] ]
      }
    },
    {
      id:"combos-carregando",
      name:"Abrir os combos e esperar a lista",
      page:"combos", tags:["@combos","@carregando"],
      impl:{ component:"CombosAdmin", notes:"AsyncStateContainer + LoadingState" },
      network:{ "GET /api/admin/:slug/combos": "pendente" },
      given:{
        text:"que o lojista abriu os combos e a resposta ainda não chegou",
        state: async (ex, api) => {
          api.get(admin + "/combos").catch(() => {});   /* deixado pendente de propósito */
          return { page:"combos", loading:true };
        }
      },
      steps:[
        { then:"a lista mostra o esqueleto no lugar dos combos",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a resposta chega", waitFor:"GET /api/admin/:slug/combos",
          applyState:(a, payload) => ({ ...a, combos:payload, loading:false }) },
        { when:"o lojista abre o cardápio", click:'[data-act="ir-cardapio"]' },
        { then:"o cardápio abre com os combos que vieram da API",
          check:(a, el) => el.querySelectorAll(".combo-card").length === 2 }
      ]
    },
    {
      id:"combos-vazio",
      name:"Loja sem combos: criar o primeiro pacote",
      page:"combos", tags:["@combos","@vazio","@feliz","@pode:combo.editar"],
      impl:{ component:"CombosAdmin", notes:"EmptyState com a ação principal dentro" },
      network:{ "GET /api/admin/:slug/combos": { status:200, payload:[] } },
      given:{
        text:"que a loja ainda não montou nenhum combo",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { then:"a lista convida a criar o primeiro",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"] [data-act="novo-combo"]') },
        { when:"o lojista cria um combo", click:'[data-act="novo-combo"]' },
        { then:"o construtor abre no pacote fechado",
          check:(a, el) => !!el.querySelector('[data-bloco="pacote"]') },
        { when:"dá um nome ao combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo doce" } },
        { when:"põe a Coca no pacote", click:'[data-act="alternar-produto"][data-id="m2"]', local:true },
        { when:"põe o pastel no pacote", click:'[data-act="alternar-produto"][data-id="m4"]', local:true },
        { when:"define o preço", local:true, fill:{ sel:'[data-campo="preco"]', val:"13,00" } },
        { when:"salva o primeiro combo da loja", click:'[data-act="salvar-combo"]' },
        { then:"a loja sai do zero com o combo guardado",
          check:(a, el) => !!el.querySelector('[data-aviso="ok"]') }
      ]
    },
    {
      id:"combos-erro",
      name:"Combos fora do ar e a recuperação",
      page:"combos", tags:["@combos","@erro","@recuperacao"],
      impl:{ component:"CombosAdmin", notes:"ErrorState com recarregar" },
      /* a falha vem do fixture (falha uma vez, funciona na seguinte), não do
         network: — é o que deixa Tentar novamente chegar a um desfecho */
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu os combos e a API caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.combosFailOnce = true;
          try { return { page:"combos", combos: await api.get(admin + "/combos") }; }
          catch (e){ return { page:"combos", error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha em vez de ficar em branco",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="recarregar-combos"]' },
        { then:"os combos aparecem e a explicação some",
          check:(a, el) => el.querySelectorAll(".combo").length === 2
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista abre o cardápio", click:'[data-act="ir-cardapio"]' },
        { then:"o cardápio carrega normalmente depois da recuperação",
          check:(a, el) => el.querySelectorAll(".combo-card").length === 2 }
      ]
    },
    {
      id:"combos-so-leitura",
      name:"Operador vê os combos e não consegue mexer",
      page:"combos", tags:["@combos","@operador"],
      impl:{ component:"CombosAdmin", notes:"RBAC: combo.editar separa ver de mexer" },
      given:{
        text:"que quem abriu a lista é um operador",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { then:"os combos aparecem como consulta, sem editar",
          check:(a, el) => el.querySelectorAll(".combo").length === 2
                        && !el.querySelector('[data-act="editar-combo"]') },
        { and:"não há como criar um combo novo",
          check:(a, el) => !el.querySelector('[data-act="novo-combo"]') },
        { when:"o operador abre o cardápio", click:'[data-act="ir-cardapio"]' },
        { when:"põe um combo no carrinho pelo cliente",
          click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"fecha o aviso", click:'[data-act="fechar-aviso"]', local:true },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"a vitrine e o carrinho continuam disponíveis para ele",
          check:(a, el) => el.querySelectorAll(".linha-carrinho").length === 1 }
      ]
    },

    /* ---------------------------------------------------------- construtor */
    {
      id:"construtor-pacote",
      name:"Montar um pacote fechado e salvar",
      page:"construtor", tags:["@combos","@feliz","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", route:"/:tenantSlug/combos/novo",
             notes:"a soma das partes fica ao lado do preço, para o lojista ver o desconto que dá" },
      given:{
        text:"que o lojista está na lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]' },
        { when:"dá um nome ao combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo da casa" } },
        { when:"põe o sanduíche no pacote", click:'[data-act="alternar-produto"][data-id="m1"]', local:true },
        { when:"põe a batata no pacote", click:'[data-act="alternar-produto"][data-id="m3"]', local:true },
        { then:"a soma das partes aparece para comparar",
          check:(a, el) => (el.querySelector("[data-comparativo]") || {}).textContent
                            .indexOf("Soma das partes R$ 43,00") > -1 },
        { when:"define o preço do combo", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"38,00" } },
        { then:"o construtor mostra quanto o cliente economiza",
          check:(a, el) => el.textContent.indexOf("economiza R$ 5,00") > -1 },
        { when:"salva o combo", click:'[data-act="salvar-combo"]' },
        { then:"o combo novo entra na lista",
          check:(a, el) => el.querySelectorAll(".combo").length === 3
                        && el.textContent.indexOf("Combo da casa") > -1 }
      ]
    },
    {
      id:"construtor-promocao",
      name:"Montar uma promoção por quantidade",
      page:"construtor", tags:["@combos","@feliz","@pode:combo.editar"],
      impl:{ component:"ComboBuilder",
             notes:"campos cobrada/levada: buyQuantity/takeQuantity leem ao contrário do falado" },
      given:{
        text:"que o lojista está na lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]' },
        { when:"escolhe promoção por quantidade",
          click:'[data-act="tipo-combo"][data-tipo="QUANTITY_DEAL"]', local:true },
        { when:"dá um nome", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Batata: leve 3, pague 2" } },
        { when:"escolhe a batata", click:'[data-act="alvo-promocao"][data-id="m3"]', local:true },
        { when:"diz que leva 3", local:true, fill:{ sel:'[data-campo="levada"]', val:"3" } },
        { when:"diz que paga 2", local:true, fill:{ sel:'[data-campo="cobrada"]', val:"2" } },
        { then:"o construtor mostra como fica falado no cardápio",
          check:(a, el) => el.textContent.indexOf("leve 3, pague 2") > -1 },
        { when:"salva a promoção", click:'[data-act="salvar-combo"]' },
        { then:"a promoção nova entra na lista",
          check:(a, el) => el.querySelectorAll(".combo").length === 3 }
      ]
    },
    {
      id:"construtor-carregando",
      name:"Abrir o construtor e esperar os produtos",
      page:"construtor", tags:["@combos","@carregando","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"LoadingState enquanto o catálogo não chega" },
      network:{ "GET /api/admin/:slug/products": "pendente" },
      given:{
        text:"que o lojista abriu o construtor e os produtos não chegaram",
        state: async (ex, api) => {
          api.get(admin + "/products").catch(() => {});
          return { page:"construtor", loading:true,
                   form:{ type:"FIXED_BUNDLE", items:[], nameStr:"" } };
        }
      },
      steps:[
        { then:"o construtor mostra o esqueleto no lugar dos produtos",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { and:"a região é anunciada como ocupada",
          check:(a, el) => el.querySelector('[data-estado="carregando"]').getAttribute("aria-busy") === "true" },
        { when:"os produtos chegam", waitFor:"GET /api/admin/:slug/products",
          applyState:(a, payload) => ({ ...a, produtos:payload, loading:false }) },
        { when:"o lojista volta para os combos", click:'[data-act="voltar-combos"]' },
        { then:"a lista de combos aparece",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"construtor-sem-produtos",
      name:"Construtor sem produtos para juntar",
      page:"construtor", tags:["@combos","@vazio","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"um combo junta produtos que já existem" },
      network:{ "GET /api/admin/:slug/products": { status:200, payload:[] } },
      given:{
        text:"que o lojista está nos combos e o cardápio não tem produtos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]' },
        { then:"o construtor explica que não há o que juntar",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { and:"não oferece salvar um combo vazio",
          check:(a, el) => !el.querySelector('[data-act="salvar-combo"]') },
        { when:"o lojista volta para os combos", click:'[data-act="voltar-combos"]' },
        { then:"a lista continua completa",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"construtor-erro",
      name:"Produtos fora do ar e a recuperação",
      page:"construtor", tags:["@combos","@erro","@recuperacao","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"ErrorState com Tentar novamente" },
      fixtureFailure:true,
      given:{
        text:"que o lojista abriu o construtor e o catálogo caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.productsFailOnce = true;
          try {
            return { page:"construtor", form:{ type:"FIXED_BUNDLE", items:[], nameStr:"" },
                     produtos: await api.get(admin + "/products") };
          } catch (e){
            return { page:"construtor", form:{ type:"FIXED_BUNDLE", items:[], nameStr:"" },
                     error_:e.message };
          }
        }
      },
      steps:[
        { then:"o construtor explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista tenta novamente", click:'[data-act="tentar-produtos"]' },
        { then:"os produtos aparecem e a explicação some",
          check:(a, el) => el.querySelectorAll(".produto").length === 4
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista volta para os combos", click:'[data-act="voltar-combos"]' },
        { then:"a lista carrega normalmente",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"construtor-invariante",
      name:"Tirar um produto trava o pacote até ele voltar",
      page:"construtor", tags:["@combos","@feliz","@pode:combo.editar"],
      impl:{ component:"ComboBuilder",
             notes:"a invariante é a mesma no cliente e no servidor; aqui só chega antes" },
      given:{
        text:"que o lojista abriu um pacote fechado que já existe",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o combo do chef", click:'[data-act="editar-combo"][data-id="c1"]' },
        { then:"o pacote abre com os dois produtos dentro",
          check:(a, el) => el.querySelectorAll(".produto.escolhido").length === 2 },
        { when:"o lojista tira a Coca do pacote",
          click:'[data-act="alternar-produto"][data-id="m2"]', local:true },
        { then:"a tela diz por que agora não dá para salvar",
          check:(a, el) => (el.querySelector("[data-impedimento]") || {}).textContent
                            .indexOf("pelo menos 2 produtos") > -1 },
        { and:"o botão de salvar fica travado",
          check:(a, el) => !!el.querySelector('[data-act="salvar-combo"][disabled]') },
        { when:"o lojista devolve a Coca ao pacote",
          click:'[data-act="alternar-produto"][data-id="m2"]', local:true },
        { then:"o impedimento some e o salvar destrava",
          check:(a, el) => !el.querySelector("[data-impedimento]")
                        && !el.querySelector('[data-act="salvar-combo"][disabled]') },
        { when:"o lojista salva", click:'[data-act="salvar-combo"]' },
        { then:"o combo volta inteiro para a lista, com a economia de sempre",
          check:(a, el) => el.querySelectorAll(".combo").length === 2
                        && el.textContent.indexOf("economiza R$ 4,00") > -1 }
      ]
    },
    {
      id:"construtor-recusado",
      name:"Servidor recusa o combo e nada se perde",
      page:"construtor", tags:["@combos","@conflito","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"o servidor confere as mesmas invariantes de novo" },
      network:{ "POST /api/admin/:slug/combos":
                { status:422, payload:{ error_:"Já existe um combo com esse nome" } } },
      given:{
        text:"que o lojista está nos combos e o servidor vai recusar a criação",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]' },
        { when:"dá um nome ao combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo do chef" } },
        { when:"põe o sanduíche no pacote", click:'[data-act="alternar-produto"][data-id="m1"]', local:true },
        { when:"põe a batata no pacote", click:'[data-act="alternar-produto"][data-id="m3"]', local:true },
        { when:"tenta salvar", click:'[data-act="salvar-combo"]' },
        { then:"a tela mostra por que não salvou",
          check:(a, el) => !!el.querySelector('[data-erro="construtor"]') },
        { and:"o que ele montou continua na tela",
          check:(a, el) => el.querySelector('[data-campo="nome"]').value === "Combo do chef" }
      ]
    },
    {
      id:"construtor-edita",
      name:"Voltar num combo e mudar o preço",
      page:"construtor", tags:["@combos","@retorno","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"editar reusa o mesmo construtor" },
      given:{
        text:"que o lojista está na lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o combo do chef", click:'[data-act="editar-combo"][data-id="c1"]' },
        { then:"o construtor abre com o pacote já montado",
          check:(a, el) => el.querySelectorAll(".produto.escolhido").length === 2 },
        { when:"baixa o preço do combo", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"30,00" } },
        { when:"salva", click:'[data-act="salvar-combo"]' },
        { then:"a lista mostra o preço novo e a economia recalculada",
          check:(a, el) => el.textContent.indexOf("economiza R$ 6,00") > -1 }
      ]
    },

    {
      id:"construtor-edicao-recusada",
      name:"Servidor recusa a edição do combo",
      page:"construtor", tags:["@combos","@conflito","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"o combo em edição continua montado na tela" },
      network:{ "PUT /api/admin/:slug/combos/:id":
                { status:422, payload:{ error_:"Preço abaixo do custo dos componentes" } } },
      given:{
        text:"que o lojista está nos combos e o servidor vai recusar a edição",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o combo do chef", click:'[data-act="editar-combo"][data-id="c1"]' },
        { when:"renomeia o combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo do chef II" } },
        { when:"baixa demais o preço", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"1,00" } },
        { when:"tenta salvar", click:'[data-act="salvar-combo"]' },
        { then:"a tela mostra por que não salvou",
          check:(a, el) => !!el.querySelector('[data-erro="construtor"]') },
        { and:"o pacote continua montado, sem perder os componentes",
          check:(a, el) => el.querySelectorAll(".produto.escolhido").length === 2 }
      ]
    },

    /* ------------------------------------------------------------ cardápio */
    {
      id:"cardapio-compra-combo",
      name:"Do cardápio ao carrinho com o combo numa linha só",
      page:"cardapio", tags:["@combos","@feliz"],
      impl:{ component:"MenuCombos", route:"/:tenantSlug",
             notes:"o combo entra como UMA linha, com os componentes à vista" },
      given:{
        text:"que o cliente abriu o cardápio",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { then:"o combo mostra o que vem dentro e o preço do combo",
          check:(a, el) => el.textContent.indexOf("Inclui: 1× Sanduíche do chef, 1× Coca-Cola 350ml") > -1
                        && el.textContent.indexOf("R$ 32,00") > -1 },
        { when:"o cliente põe o combo no carrinho", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"o combo ocupa uma linha só, com os componentes dentro",
          check:(a, el) => el.querySelectorAll(".linha-carrinho").length === 1
                        && el.querySelectorAll(".componente").length === 2 },
        { and:"o total é o preço do combo, não a soma das partes",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 32,00") > -1 }
      ]
    },
    {
      id:"cardapio-promocao",
      name:"Promoção por quantidade cobra as unidades certas",
      page:"cardapio", tags:["@combos","@feliz"],
      impl:{ component:"MenuCombos",
             notes:"a cada `recebida` unidades cobram-se `cobrada`; a sobra sai pelo preço cheio" },
      given:{
        text:"que o cliente abriu o cardápio",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { then:"a promoção aparece com os termos falados",
          check:(a, el) => el.textContent.indexOf("leve 4, pague 3") > -1 },
        { when:"o cliente pega a promoção", click:'[data-act="por-no-carrinho"][data-id="c2"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"uma unidade sozinha ainda sai pelo preço cheio",
          check:(a, el) => el.textContent.indexOf("R$ 7,50") > -1 },
        { when:"o cliente sobe para duas", click:'[data-act="mais-um"]' },
        { when:"sobe para três", click:'[data-act="mais-um"]' },
        { when:"sobe para quatro", click:'[data-act="mais-um"]' },
        { then:"quatro pastéis custam três",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 22,50") > -1 }
      ]
    },
    {
      id:"cardapio-carregando",
      name:"Abrir o cardápio e esperar a vitrine",
      page:"cardapio", tags:["@combos","@carregando"],
      impl:{ component:"MenuCombos", notes:"AsyncStateContainer + LoadingState" },
      network:{ "GET /api/menu/:slug": "pendente" },
      given:{
        text:"que o cliente abriu o cardápio e a vitrine não chegou",
        state: async (ex, api) => {
          api.get("/api/menu/" + SLUG).catch(() => {});
          return { page:"cardapio", loading:true };
        }
      },
      steps:[
        { then:"o cardápio mostra o esqueleto",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a vitrine chega", waitFor:"GET /api/menu/:slug",
          applyState:(a, payload) => ({ ...a, menu:payload, loading:false }) },
        { when:"o cliente põe o combo no carrinho", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { then:"o carrinho recebe a linha do combo",
          check:(a, el) => !!el.querySelector('[data-aviso="ok"]') }
      ]
    },
    {
      id:"cardapio-sem-combo",
      name:"Combo fora da vitrine não aparece para o cliente",
      page:"cardapio", tags:["@combos","@vazio"],
      impl:{ component:"MenuCombos", notes:"active/listed filtram antes do contrato do cardápio" },
      network:{ "GET /api/menu/:slug": { status:200, payload:{ itens:[], combos:[] } } },
      given:{
        text:"que a loja tirou tudo da vitrine",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { then:"o cardápio explica que não há nada publicado",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o cliente abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"o carrinho também está vazio",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"o cliente volta ao cardápio", click:'[data-act="ir-cardapio"]' },
        { then:"a vitrine continua vazia, sem inventar item",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') }
      ]
    },
    {
      id:"cardapio-erro",
      name:"Cardápio fora do ar e a recuperação",
      page:"cardapio", tags:["@combos","@erro","@recuperacao"],
      impl:{ component:"MenuCombos", notes:"ErrorState com Tentar novamente" },
      fixtureFailure:true,
      given:{
        text:"que o cliente abriu o cardápio e ele caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.menuFailsOnce = true;
          try { return { page:"cardapio", menu: await api.get("/api/menu/" + SLUG) }; }
          catch (e){ return { page:"cardapio", error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o cliente tenta novamente", click:'[data-act="tentar-cardapio"]' },
        { then:"a vitrine aparece e a explicação some",
          check:(a, el) => el.querySelectorAll(".combo-card").length === 2
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o cliente põe o combo no carrinho", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { then:"a compra segue normalmente depois da recuperação",
          check:(a, el) => !!el.querySelector('[data-aviso="ok"]') }
      ]
    },
    {
      id:"cardapio-combo-recusado",
      name:"Servidor recusa a linha do combo",
      page:"cardapio", tags:["@combos","@conflito"],
      impl:{ component:"MenuCombos", notes:"o erro fica na vitrine, sem derrubar a página" },
      network:{ "POST /api/cart/:slug/items":
                { status:409, payload:{ error_:"Combo esgotado por enquanto" } } },
      given:{
        text:"que o cliente abriu o cardápio e o servidor vai recusar a linha",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { when:"o cliente tenta pôr o combo no carrinho",
          click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { then:"a vitrine explica que não deu",
          check:(a, el) => !!el.querySelector('[data-erro="cardapio"]') },
        { and:"o combo continua na vitrine para tentar de novo",
          check:(a, el) => el.querySelectorAll(".combo-card").length === 2 },
        { when:"o cliente tenta um item avulso", click:'[data-act="por-item"][data-id="m3"]' },
        { then:"o item avulso também esbarra na mesma recusa",
          check:(a, el) => !!el.querySelector('[data-erro="cardapio"]') }
      ]
    },

    /* ------------------------------------------------------------ carrinho */
    {
      id:"carrinho-monta-conta",
      name:"Combo e item avulso somam certo na conta",
      page:"carrinho", tags:["@combos","@feliz"],
      impl:{ component:"CartCombos", route:"/:tenantSlug/carrinho",
             notes:"servidor autoritativo: cada mexida recalcula e a tela só mostra" },
      given:{
        text:"que o cliente abriu o cardápio",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { when:"o cliente pega o combo do chef", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"pega também uma batata", click:'[data-act="por-item"][data-id="m3"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"as duas linhas aparecem, com o combo mostrando o que tem dentro",
          check:(a, el) => el.querySelectorAll(".linha-carrinho").length === 2
                        && el.querySelectorAll(".componente").length === 2 },
        { and:"o total é o combo mais a batata",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 47,00") > -1 }
      ]
    },
    {
      id:"carrinho-desconto-nao-entra-no-combo",
      name:"Desconto de item não alcança dentro do combo",
      page:"carrinho", tags:["@combos","@descontos","@retorno"],
      impl:{ component:"CartCombos",
             notes:"regra decidida em FUT-272: a linha de combo é opaca para ITEM e CATEGORIA" },
      given:{
        text:"que a loja tem 10% em Coca-Cola e 5% no pedido, e o cliente abriu o cardápio",
        state: async (ex, api) => {
          /* a rota não enxerga os chips da barra: quem liga o motor é o Dado */
          api.data_.descontosLigados = true;
          return { page:"cardapio", menu: await api.get("/api/menu/" + SLUG) };
        }
      },
      steps:[
        { when:"o cliente pega o combo, que traz uma Coca dentro",
          click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"os 10% da Coca não entram: só o desconto de pedido aparece",
          check:(a, el) => !!el.querySelector('[data-escopo="ORDER"]')
                        && !el.querySelector('[data-escopo="ITEM"]') },
        { and:"o desconto do pedido incide sobre o preço do combo",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Desconto − R$ 1,60") > -1 },
        { when:"o cliente volta ao cardápio", click:'[data-act="ir-cardapio"]' },
        { when:"pega uma Coca avulsa", click:'[data-act="por-item"][data-id="m2"]' },
        { when:"volta ao carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"agora sim os 10% valem, porque a Coca está fora do combo",
          check:(a, el) => !!el.querySelector('[data-escopo="ITEM"]') }
      ]
    },
    {
      id:"carrinho-carregando",
      name:"Abrir o carrinho e esperar a conta",
      page:"carrinho", tags:["@combos","@carregando"],
      impl:{ component:"CartCombos", notes:"LoadingState enquanto o total não volta" },
      network:{ "GET /api/cart/:slug": "pendente" },
      given:{
        text:"que o cliente abriu o carrinho e a conta não voltou",
        state: async (ex, api) => {
          api.get(loja).catch(() => {});
          return { page:"carrinho", loading:true };
        }
      },
      steps:[
        { then:"o carrinho mostra o esqueleto",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"] .esqueleto') },
        { when:"a conta chega", waitFor:"GET /api/cart/:slug",
          applyState:(a, payload) => ({ ...a, cart:payload, loading:false }) },
        { when:"o cliente vai ao cardápio", click:'[data-act="ir-cardapio"]' },
        { then:"a vitrine aparece",
          check:(a, el) => el.querySelectorAll(".combo-card").length === 2 }
      ]
    },
    {
      id:"carrinho-vazio",
      name:"Carrinho vazio leva de volta ao cardápio",
      page:"carrinho", tags:["@combos","@vazio","@feliz"],
      impl:{ component:"CartCombos", notes:"EmptyState com a saída dentro" },
      given:{
        text:"que o cliente abriu o carrinho sem ter pego nada",
        state: async (ex, api) => ({ page:"carrinho", cart: await api.get(loja) })
      },
      steps:[
        { then:"o carrinho convida a ver o cardápio",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"] [data-act="ir-cardapio"]') },
        { when:"o cliente vai ao cardápio", click:'[data-act="ir-cardapio"]' },
        { when:"pega o combo do chef", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"volta ao carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"o carrinho sai do vazio com o combo dentro",
          check:(a, el) => el.querySelectorAll(".linha-carrinho").length === 1
                        && !el.querySelector('[data-estado="vazio"]') }
      ]
    },
    {
      id:"carrinho-erro",
      name:"Carrinho fora do ar e a recuperação",
      page:"carrinho", tags:["@combos","@erro","@recuperacao"],
      impl:{ component:"CartCombos", notes:"ErrorState com Tentar novamente" },
      fixtureFailure:true,
      given:{
        text:"que o cliente abriu o carrinho e ele caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.cartFailsOnce = true;
          try { return { page:"carrinho", cart: await api.get(loja) }; }
          catch (e){ return { page:"carrinho", error_:e.message }; }
        }
      },
      steps:[
        { then:"a tela explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o cliente tenta novamente", click:'[data-act="tentar-carrinho"]' },
        { then:"o carrinho responde e a explicação some",
          check:(a, el) => !el.querySelector('[data-estado="erro"]') },
        { when:"o cliente vai ao cardápio", click:'[data-act="ir-cardapio"]' },
        { then:"a vitrine carrega normalmente",
          check:(a, el) => el.querySelectorAll(".combo-card").length === 2 }
      ]
    },
    {
      id:"carrinho-tira-linha",
      name:"Tirar a linha do combo esvazia a conta",
      page:"carrinho", tags:["@combos","@conflito"],
      impl:{ component:"CartCombos", notes:"tirar a linha leva o combo inteiro, não uma parte" },
      network:{ "PUT /api/cart/:slug/items/:lineId":
                { status:500, payload:{ error_:"Não foi possível mudar a quantidade" } },
              "DELETE /api/cart/:slug/items/:lineId":
                { status:500, payload:{ error_:"Não foi possível tirar a linha" } } },
      given:{
        text:"que o cliente já tem o combo no carrinho e o servidor vai recusar a quantidade",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { when:"o cliente pega o combo", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { when:"tenta subir a quantidade", click:'[data-act="mais-um"]' },
        { then:"a tela explica que não deu",
          check:(a, el) => !!el.querySelector('[data-erro="carrinho"]') },
        { when:"tenta então tirar a linha", click:'[data-act="tirar-linha"]' },
        { then:"a recusa continua e a linha não se perde",
          check:(a, el) => !!el.querySelector('[data-erro="carrinho"]')
                        && el.querySelectorAll(".linha-carrinho").length === 1 }
      ]
    },
    {
      id:"carrinho-esvazia",
      name:"Tirar o combo devolve o carrinho ao vazio",
      page:"carrinho", tags:["@combos","@retorno"],
      impl:{ component:"CartCombos", notes:"a linha some inteira: um combo não se desmonta no carrinho" },
      given:{
        text:"que o cliente abriu o cardápio",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { when:"o cliente pega o combo", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"o combo está lá com os dois componentes",
          check:(a, el) => el.querySelectorAll(".componente").length === 2 },
        { when:"o cliente tira a linha", click:'[data-act="tirar-linha"]' },
        { then:"o carrinho volta ao vazio inteiro, sem sobrar componente solto",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]')
                        && !el.querySelector(".componente") }
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

  defaultPage: "combos"
});

/* ------------------------------------------------------------- navegação */

Proto.on("click", '[data-act="recarregar-combos"]', async () => {
  try { Proto.set({ combos: await Proto.api.get(admin + "/combos"), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});

Proto.on("click", '[data-act="voltar-combos"]', async () => {
  try {
    Proto.set({ page:"combos", combos: await Proto.api.get(admin + "/combos"),
                error_:null, erroAcao:null, aviso:null, editandoId:null });
  } catch (e){ Proto.set({ page:"combos", error_:e.message }); }
});

Proto.on("click", '[data-act="ir-cardapio"]', async () => {
  try {
    Proto.set({ page:"cardapio", menu: await Proto.api.get("/api/menu/" + SLUG),
                error_:null, erroAcao:null, aviso:null });
  } catch (e){ Proto.set({ page:"cardapio", error_:e.message }); }
});

Proto.on("click", '[data-act="ir-carrinho"]', async () => {
  try {
    Proto.set({ page:"carrinho", cart: await Proto.api.get(loja),
                error_:null, erroAcao:null, aviso:null });
  } catch (e){ Proto.set({ page:"carrinho", error_:e.message }); }
});

Proto.on("click", '[data-act="fechar-aviso"]', () => Proto.set({ aviso:null }));

/* --------------------------------------------------------------- combos */

/* ver no cardápio é a mesma vitrine que o cliente vê — não uma prévia falsa */
Proto.on("click", '[data-act="ver-no-cardapio"]', async () => {
  try {
    Proto.set({ page:"cardapio", menu: await Proto.api.get("/api/menu/" + SLUG), error_:null });
  } catch (e){ Proto.set({ page:"cardapio", error_:e.message }); }
});

Proto.on("click", '[data-act="novo-combo"]', async () => {
  try {
    const produtos = await Proto.api.get(admin + "/products");
    Proto.set({ page:"construtor", produtos, editandoId:null, error_:null, erroAcao:null,
                form:{ type:"FIXED_BUNDLE", nameStr:"", items:[], priceReais:"",
                       targetProductId:null, chargedQuantity:"", receivedQuantity:"" } });
  } catch (e){
    Proto.set({ page:"construtor", editandoId:null, error_:e.message,
                form:{ type:"FIXED_BUNDLE", nameStr:"", items:[], priceReais:"" } });
  }
});

Proto.on("click", '[data-act="editar-combo"]', async (e, el, s) => {
  const c = (s.app.combos || []).find(x => x.id === el.dataset.id);
  try {
    const produtos = await Proto.api.get(admin + "/products");
    Proto.set({
      page:"construtor", produtos, editandoId:c.id, error_:null, erroAcao:null,
      form:{
        type:c.type, nameStr:c.nameStr,
        items:(c.componentes || []).map(x => ({ productId:x.productId, quantity:x.quantity })),
        priceReais: c.priceCents != null ? (c.priceCents / 100).toFixed(2) : "",
        targetProductId:c.alvo ? c.alvo.id : null,
        chargedQuantity:c.chargedQuantity || "", receivedQuantity:c.receivedQuantity || ""
      }
    });
  } catch (err){ Proto.set({ page:"construtor", editandoId:c.id, error_:err.message }); }
});

/* ----------------------------------------------------------- construtor */

Proto.on("click", '[data-act="tipo-combo"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), type: el.dataset.tipo } });
});

Proto.on("input", '[data-campo="nome"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), nameStr: el.value } });
});

Proto.on("input", '[data-campo="preco"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), priceReais: el.value.replace(",", ".") } });
});

Proto.on("input", '[data-campo="levada"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), receivedQuantity: el.value } });
});

Proto.on("input", '[data-campo="cobrada"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), chargedQuantity: el.value } });
});

Proto.on("click", '[data-act="alternar-produto"]', (e, el, s) => {
  const f = s.app.form || {};
  const itens = (f.items || []).slice();
  const i = itens.findIndex(x => x.productId === el.dataset.id);
  if (i >= 0) itens.splice(i, 1);
  else itens.push({ productId: el.dataset.id, quantity: 1 });
  Proto.set({ form:{ ...f, items: itens } });
});

Proto.on("click", '[data-act="alvo-promocao"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), targetProductId: el.dataset.id } });
});

Proto.on("click", '[data-act="salvar-combo"]', async (e, el, s) => {
  const f = s.app.form || {};
  const corpo = {
    nameStr: f.nameStr, type: f.type,
    items: f.items || [],
    priceCents: Math.round(Number(f.priceReais || 0) * 100),
    targetProductId: f.targetProductId,
    chargedQuantity: Number(f.chargedQuantity) || null,
    receivedQuantity: Number(f.receivedQuantity) || null
  };
  try {
    if (s.app.editandoId) await Proto.api.put(admin + "/combos/" + s.app.editandoId, corpo);
    else await Proto.api.post(admin + "/combos", corpo);
    Proto.set({ page:"combos", combos: await Proto.api.get(admin + "/combos"),
                editandoId:null, erroAcao:null,
                aviso:{ tipo:"ok", texto:"Combo salvo." } });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

Proto.on("click", '[data-act="tentar-produtos"]', async () => {
  try { Proto.set({ produtos: await Proto.api.get(admin + "/products"), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});

/* ------------------------------------------------------------- cardápio */

Proto.on("click", '[data-act="por-no-carrinho"]', async (e, el) => {
  try {
    const cart = await Proto.api.post(loja + "/items", { comboId: el.dataset.id, quantity:1 });
    Proto.set({ cart, erroAcao:null, aviso:{ tipo:"ok", texto:"Combo no carrinho." } });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

Proto.on("click", '[data-act="por-item"]', async (e, el) => {
  try {
    const cart = await Proto.api.post(loja + "/items", { productId: el.dataset.id, quantity:1 });
    Proto.set({ cart, erroAcao:null, aviso:{ tipo:"ok", texto:"Item no carrinho." } });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

Proto.on("click", '[data-act="tentar-cardapio"]', async () => {
  try { Proto.set({ menu: await Proto.api.get("/api/menu/" + SLUG), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});

/* ------------------------------------------------------------- carrinho */

Proto.on("click", '[data-act="mais-um"]', async (e, el, s) => {
  const linha = ((s.app.cart || {}).lines || [])
    .find(l => l.lineId === el.dataset.id) || ((s.app.cart || {}).lines || [])[0];
  try {
    const cart = await Proto.api.put(loja + "/items/" + linha.lineId,
                                     { quantity: linha.quantity + 1 });
    Proto.set({ cart, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

Proto.on("click", '[data-act="tirar-linha"]', async (e, el, s) => {
  const linha = ((s.app.cart || {}).lines || [])
    .find(l => l.lineId === el.dataset.id) || ((s.app.cart || {}).lines || [])[0];
  try {
    const cart = await Proto.api.del(loja + "/items/" + linha.lineId);
    Proto.set({ cart, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

Proto.on("click", '[data-act="tentar-carrinho"]', async () => {
  try { Proto.set({ cart: await Proto.api.get(loja), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});
