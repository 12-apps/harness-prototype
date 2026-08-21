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
import { Dashboard } from "@12-apps/ui/layout/Dashboard";
import { Autocomplete } from "@12-apps/ui/form/Autocomplete";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { ErrorState } from "@12-apps/ui/data-display/ErrorState";
import { LoadingState } from "@12-apps/ui/data-display/LoadingState";
import { List } from "@12-apps/ui/mui/List";
import { ListItem } from "@12-apps/ui/mui/ListItem";
import { ListItemText } from "@12-apps/ui/mui/ListItemText";

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

/* Os rótulos das promoções são os que o admin já usa (discount-labels.ts):
   um conjunto fechado no banco, com o valor cru como reserva — uma lista que
   mostra "PERCENTAGE" é muito melhor que uma que quebra. */
const TIPO_LABEL    = { PERCENTAGE:"Porcentagem", FIXED_AMOUNT:"Valor fixo" };
const ESCOPO_LABEL  = { ORDER:"Pedido", CATEGORY:"Categoria", ITEM:"Item" };
const GATILHO_LABEL = { AUTOMATIC:"Automático", CODE:"Código" };

/* O valor como o operador o lê: "10%" ou "R$ 15,00". Pontos-base dividem por
   100 na exibição — a unidade existe para "12,5%" sobreviver à ida e volta. */
const valorDoDesconto = (a) =>
  a.type === "PERCENTAGE"
    ? String(a.percentOffBp / 100).replace(".", ",") + "%"
    : reais(a.amountOffCents);

/* Um combo é UMA coisa: produtos com quantidade e um preço. O "leve 4, pague 3"
   não é um segundo tipo — é o que se lê quando o combo é N× de um produto só e
   o preço bate num número inteiro de unidades. O servidor deriva o selo. */

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
        <Paragraph>Junte produtos num preço só — dois sanduíches e uma Coca, ou quatro pastéis pelo preço de três.</Paragraph>
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
                <Box className="precos">
                  <Text className="preco">{reais(c.priceCents)}</Text>
                  <Text className="soma">{reais(c.somaCents)}</Text>
                </Box>
                {c.selo && <Badge className="tag promo">{c.selo}</Badge>}
                <Badge className="tag economia">economiza {reais(c.economiaCents)}</Badge>
                <Text className="componentes">
                  {c.componentes.map(x => x.quantity + "× " + x.nameStr).join(" + ")}
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

  /* o cabeçalho consolidado que todas as páginas do admin usam */
  return (
    <Box className="app">
      <Dashboard testIdPrefix="combos">
        <Dashboard.Breadcrumb items={[{ label:"Início", href:"/admin" }, { label:"Combos" }]} />
        <Dashboard.Header title="Combos">
          <Dashboard.Info title="Sobre os combos">
            Um combo junta produtos num preço próprio. Quatro pastéis pelo preço de três
            é um combo de quatro unidades do mesmo produto.
          </Dashboard.Info>
          <Dashboard.Spacer />
          {podeEditar && (
            <Dashboard.Action>
              <Button className="btn" data-act="novo-combo">Novo combo</Button>
            </Dashboard.Action>
          )}
        </Dashboard.Header>
        <Dashboard.Body>
          <Box className="nav">
            <Button className="btn ghost" data-act="ir-cardapio">Ver o cardápio</Button>
            <Button className="btn ghost" data-act="recarregar-combos">Recarregar</Button>
          </Box>
          <Aviso s={s} />
          <Box className="app-bd" data-async data-estado-atual={st}>{corpo}</Box>
        </Dashboard.Body>
      </Dashboard>
    </Box>
  );
}

/* -------------------------------------------------- admin: o construtor */

function ConstrutorScreen({ s }){
  const f = s.app.form || {};
  const busca = s.app.busca;                 /* { termo, itens, total } | null */
  const itens = f.items || [];
  const st = estadoDe(s, !!(busca && busca.itens && busca.itens.length));

  const unidades = itens.reduce((t, it) => t + it.quantity, 0);
  const somaCents = itens.reduce((t, it) => t + it.unitPriceCents * it.quantity, 0);
  const precoCents = Math.round(Number(f.priceReais || 0) * 100);

  /* as mesmas invariantes que o servidor confere de novo — aqui só chegam antes */
  const impedimento =
    !f.nameStr || !f.nameStr.trim() ? "Dê um nome ao combo"
    : unidades < 2 ? "Um combo precisa de pelo menos 2 unidades"
    : !(precoCents >= 0) ? "O preço do combo não pode ser negativo"
    : null;

  return (
    <Box className="app">
      <Dashboard testIdPrefix="construtor">
        <Dashboard.Breadcrumb items={[
          { label:"Início", href:"/admin" },
          { label:"Combos", href:"/admin/combos" },
          { label: s.app.editandoId ? "Editar" : "Novo" }
        ]} />
        <Dashboard.Header title={s.app.editandoId ? "Editar combo" : "Novo combo"}>
          <Dashboard.Info title="Como funciona">
            Busque produtos e escolha quantas unidades de cada, depois o preço do combo.
            Quatro do mesmo produto por um preço menor é “leve 4, pague 3”.
          </Dashboard.Info>
          <Dashboard.Spacer />
          <Dashboard.Action>
            <Button className="btn ghost" data-act="voltar-combos">Cancelar</Button>
          </Dashboard.Action>
          {/* o Salvar mora no cabeçalho: fica à vista por mais longa que a
              montagem fique, e nunca depende de rolar até o fim */}
          <Dashboard.Action>
            <Button className="btn" data-act="salvar-combo" disabled={!!impedimento}>
              Salvar combo
            </Button>
          </Dashboard.Action>
        </Dashboard.Header>

        <Dashboard.Body>
          <Aviso s={s} />
          <ErroDeAcao s={s} hook="construtor" />

          <Box className="construtor" data-async data-estado-atual={st}>
           <Box className="coluna catalogo">

            {/* uma loja tem centenas de produtos: quem procura é o autocomplete
                do catálogo, buscando no servidor, e escolher já põe no combo */}
            {/* O Autocomplete é o campo de busca (assíncrono, com estado de
                carregando). A lista de resultados abaixo é o seletor, por duas
                razões: a lista do próprio componente volta fechada a cada passo
                — o harness redesenha a tela a partir do estado, e um
                comportamento que a suíte não alcança não está especificado — e
                a linha de "nada encontrado" dele é a string inglesa
                "No results found", sem prop que a traduza. Numa tela pt-BR isso
                não pode aparecer, então o popup fica suprimido até o componente
                aceitar a cópia por fora. */}
            <Box className="busca-linha">
              <Autocomplete
                value={s.app.termo || ""}
                onChange={(val) => Proto.buscarProduto(val)}
                onSelect={(p) => {
                  /* o mesmo produto de novo é uma unidade a mais, não uma linha
                     nova: é assim que "4 pastéis" existe sem um segundo modelo */
                  const lista = itens.slice();
                  const i = lista.findIndex(x => x.productId === p.id);
                  if (i >= 0) lista[i] = { ...lista[i], quantity: lista[i].quantity + 1 };
                  else lista.push({ productId:p.id, quantity:1,
                                    nameStr:p.nameStr, unitPriceCents:p.priceCents });
                  Proto.set({ form:{ ...f, items: lista } });
                }}
                suggestions={[]}
                getKey={(p) => p.id}
                getLabel={(p) => p.nameStr}
                getDescription={(p) => p.categoria + " · " + reais(p.priceCents)}
                async
                isLoading={st === "carregando"}
                placeholder="Buscar produto pelo nome"
                inputAriaLabel="Buscar produto"
                inputClassName="campo campo-busca"
                itemClassName="sugestao"
                listClassName="dropdown-suprimido"
                maxVisibleItems={6}
                portal={false}
              />
            </Box>

            {/* o marcador de estado fica no invólucro: é ele que a suíte lê,
                e o componente do catálogo desenha o conteúdo */}
            {st === "carregando" ? (
              <Box className="resultado-estado" data-estado="carregando" aria-busy="true">
                <LoadingState variant="skeleton" message="Buscando produtos…" />
              </Box>
            ) : st === "erro" ? (
              <Box className="resultado-estado" data-estado="erro">
                <ErrorState title="Não deu para buscar"
                            message={s.app.error_ || ""}
                            retryLabel="Tentar novamente"
                            onRetry={() => Proto.buscarProduto(s.app.termo || "")} />
              </Box>
            ) : st === "vazio" ? (
              <Box className="resultado-estado" data-estado="vazio">
                <EmptyState variant="minimal"
                  title={busca && busca.termo ? "Nada com “" + busca.termo + "”" : "Busque um produto"}
                  description={busca && busca.termo
                    ? "Tente outro nome — a busca é pelo nome do produto no cardápio."
                    : "A loja tem centenas de produtos, então nada aparece antes de você buscar."} />
              </Box>
            ) : (
              <Box className="resultado-estado" data-estado="conteudo">
                <Text className="carimbo">
                  {busca.total + " encontrado(s)"
                    + (busca.total > busca.itens.length ? " · refine para ver os outros" : "")}
                </Text>
                <List className="lista-resultados">
                  {busca.itens.map(p => (
                    <ListItem key={p.id} className="resultado" divider>
                      <ListItemText primary={p.nameStr}
                                    secondary={p.categoria + " · " + reais(p.priceCents)} />
                      <Button className="btn ghost" data-act="por-no-combo" data-id={p.id}>
                        Pôr no combo
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
           </Box>

           <Box className="coluna sacola">
            <Box className="form">
              <Input
                label="Nome do combo"
                value={f.nameStr || ""}
                placeholder="Combo do chef"
                onChange={(e) => Proto.set({ form:{ ...f, nameStr:e.target.value } })}
                slotProps={{ htmlInput:{ className:"campo", "data-campo":"nome",
                                         "aria-label":"Nome do combo" } }}
              />
              <Input
                label="Preço do combo"
                value={(f.priceReais || "").replace(".", ",")}
                placeholder="0,00"
                onChange={(e) => Proto.set({ form:{ ...f, priceReais:e.target.value.replace(",", ".") } })}
                slotProps={{ htmlInput:{ className:"campo", "data-campo":"preco",
                                         inputMode:"decimal", "aria-label":"Preço do combo" } }}
              />
            </Box>
            <Box className="escolhidos" data-escolhidos>
              {itens.length === 0 ? (
                <Text className="carimbo">Nenhum produto ainda.</Text>
              ) : (
                <List className="lista-itens">
                  {itens.map(it => (
                    <ListItem key={it.productId} className="item-combo" divider>
                      <ListItemText
                        primary={it.nameStr}
                        secondary={reais(it.unitPriceCents) + " cada · "
                                   + reais(it.unitPriceCents * it.quantity) + " no total"}
                      />
                      <Box className="stepper">
                        <Button className="btn passo" data-act="menos-item" data-id={it.productId}>−</Button>
                        <Text className="i-qtd">{it.quantity}</Text>
                        <Button className="btn passo" data-act="mais-item" data-id={it.productId}>+</Button>
                        <Button className="btn ghost" data-act="tirar-item" data-id={it.productId}>Tirar</Button>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Box className="comparativo" data-comparativo>
              <Text className="linha-resumo">
                <Text className="rot">Soma das partes</Text>
                <Text className="soma">{reais(somaCents)}</Text>
              </Text>
              <Text className="linha-resumo forte">
                <Text className="rot">Preço do combo</Text>
                <Text className="preco">{reais(precoCents)}</Text>
              </Text>
              <Text className="linha-resumo">
                <Text className="rot">
                  {precoCents <= somaCents ? "Cliente economiza" : "Acima da soma das partes"}
                </Text>
                <Badge className="tag economia">{reais(Math.abs(somaCents - precoCents))}</Badge>
              </Text>
            </Box>

            {impedimento && (
              <Banner className="impedimento" data-impedimento>
                <Text>{impedimento}</Text>
              </Banner>
            )}
           </Box>
          </Box>
        </Dashboard.Body>
      </Dashboard>
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
                <Box className="precos">
                  <Text className="preco">{reais(c.priceCents)}</Text>
                  <Text className="soma">{reais(c.somaCents)}</Text>
                  {c.selo && <Badge className="tag promo">{c.selo}</Badge>}
                  <Text className="inclui">
                    Inclui: {c.componentes.map(x => x.quantity + "× " + x.nameStr).join(", ")}
                  </Text>
                </Box>
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
          <Card key={l.lineId} variant="outlined" className="linha-carrinho"
                data-linha={l.ehCombo ? "combo" : "item"}>
            <CardContent>
              <Text className="nome" weight="bold">{l.nameStr}</Text>
              <Text className="qtd">{l.quantity}×</Text>
              <Text className="bruto">{reais(l.brutoCents)}</Text>
              {l.discountCents > 0 && (
                <Badge className="tag desconto">− {reais(l.discountCents)}</Badge>
              )}
              {l.selo && <Badge className="tag promo">{l.selo}</Badge>}
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
            <Box className="cupom">
              <Input
                value={s.app.cupom || ""}
                placeholder="Cupom"
                slotProps={{ htmlInput:{ className:"campo", "data-campo":"cupom",
                                         "aria-label":"Código do cupom" } }}
              />
              <Button className="btn ghost" data-act="aplicar-cupom">Aplicar cupom</Button>
            </Box>

            {/* só o que o comprador pediu recusa em voz alta: uma promoção
                automática que não coube não vira ruído na tela */}
            {(cart.recusas || []).map((r, i) => (
              <Alert key={i} className="aviso" data-erro="cupom"
                     data-recusa={r.code || "cupom"}>{r.texto}</Alert>
            ))}

            <Text className="linha-total">Subtotal {reais(cart.subtotalCents)}</Text>
            <Text className="linha-total">Desconto − {reais(cart.discountTotalCents)}</Text>
            <Text className="linha-total total" weight="bold">
              Total {reais(cart.totalCents)}
            </Text>

            {(cart.aplicados || []).map(a => (
              <Badge key={a.discountId} className="tag aplicado" data-escopo={a.scope}>
                {a.name + " · " + ESCOPO_LABEL[a.scope] + " · " + TIPO_LABEL[a.type]
                  + " " + valorDoDesconto(a) + " · " + GATILHO_LABEL[a.trigger]
                  + " · − " + reais(a.amountCents)}
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
                        && el.textContent.indexOf("economiza R$ 5,00") > -1 },
        { and:"a promoção aparece com os termos falados",
          check:(a, el) => el.textContent.indexOf("leve 4, pague 3") > -1 },
        { when:"o lojista confere o combo no cardápio",
          click:'[data-act="ver-no-cardapio"][data-id="c1"]' },
        { then:"o cardápio mostra o combo com o que vem dentro",
          check:(a, el) => el.textContent.indexOf("Inclui: 2× Sanduíche do chef") > -1 },
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
        { when:"o lojista cria um combo", click:'[data-act="novo-combo"]', local:true },
        { then:"o construtor abre pedindo uma busca, sem desenhar produto nenhum",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]') },
        { when:"dá um nome ao combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo doce" } },
        { when:"busca por pastel", local:true, fill:{ sel:'.campo-busca input', val:"pastel" } },
        { when:"põe o pastel no combo", click:'[data-act="por-no-combo"][data-id="m4"]', local:true },
        { when:"põe outro", click:'[data-act="mais-item"][data-id="m4"]', local:true },
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

    {
      id:"combos-abrir-recusado",
      name:"Abrir um combo que o servidor não devolve",
      page:"combos", tags:["@combos","@conflito","@pode:combo.editar"],
      impl:{ component:"CombosAdmin", notes:"a lista fica de pé: o erro é da leitura, não da página" },
      network:{ "GET /api/admin/:slug/combos/:id":
                { status:500, payload:{ error_:"Não foi possível abrir o combo" } } },
      given:{
        text:"que o lojista está nos combos e a leitura vai falhar",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista tenta abrir o combo do chef",
          click:'[data-act="editar-combo"][data-id="c1"]' },
        { then:"a lista explica que não deu para abrir",
          check:(a, el) => !!el.querySelector('[data-erro="combos"]') },
        { and:"a lista continua inteira",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 },
        { when:"o lojista recarrega", click:'[data-act="recarregar-combos"]' },
        { then:"os combos continuam lá",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },

    /* ---------------------------------------------------------- construtor */
    {
      id:"construtor-monta",
      name:"Montar um combo de dois sanduíches e uma Coca",
      page:"construtor", tags:["@combos","@feliz","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", route:"/:tenantSlug/combos/novo",
             notes:"a busca é do servidor: a loja tem centenas de produtos" },
      given:{
        text:"que o lojista está na lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]', local:true },
        { then:"nenhum produto é desenhado antes de alguém buscar",
          check:(a, el) => !!el.querySelector('[data-estado="vazio"]')
                        && !el.querySelector(".resultado") },
        { when:"dá um nome ao combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo do chef" } },
        { when:"busca por sanduíche", local:true, fill:{ sel:'.campo-busca input', val:"sandu" } },
        { then:"só o que casa com o termo aparece",
          check:(a, el) => el.querySelectorAll(".resultado").length === 1 },
        { when:"põe o sanduíche no combo",
          click:'[data-act="por-no-combo"][data-id="m1"]', local:true },
        { when:"põe o segundo sanduíche",
          click:'[data-act="mais-item"][data-id="m1"]', local:true },
        { when:"busca por Coca", local:true, fill:{ sel:'.campo-busca input', val:"coca" } },
        { when:"põe a Coca no combo",
          click:'[data-act="por-no-combo"][data-id="m2"]', local:true },
        { then:"a soma das partes conta a quantidade de cada um",
          check:(a, el) => {
            const t = (el.querySelector("[data-comparativo]") || {}).textContent || "";
            return t.indexOf("Soma das partes") > -1 && t.indexOf("R$ 64,00") > -1;
          } },
        { when:"define o preço do combo", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"59,00" } },
        { when:"salva o combo", click:'[data-act="salvar-combo"]' },
        { then:"o combo novo entra na lista com o que tem dentro",
          check:(a, el) => el.querySelectorAll(".combo").length === 3
                        && el.textContent.indexOf("2× Sanduíche do chef + 1× Coca-Cola 350ml") > -1 }
      ]
    },
    {
      id:"construtor-leve-pague",
      name:"Quatro do mesmo produto viram “leve 4, pague 3”",
      page:"construtor", tags:["@combos","@feliz","@pode:combo.editar"],
      impl:{ component:"ComboBuilder",
             notes:"não há um segundo tipo: o selo é derivado de N× um produto e do preço" },
      given:{
        text:"que o lojista está na lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]', local:true },
        { when:"dá um nome", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Batata: leve 4, pague 3" } },
        { when:"busca por batata", local:true, fill:{ sel:'.campo-busca input', val:"batata" } },
        { when:"põe a batata no combo",
          click:'[data-act="por-no-combo"][data-id="m3"]', local:true },
        { when:"sobe para quatro unidades",
          click:'[data-act="mais-item"][data-id="m3"]', local:true },
        { when:"e mais uma", click:'[data-act="mais-item"][data-id="m3"]', local:true },
        { when:"e a quarta", click:'[data-act="mais-item"][data-id="m3"]', local:true },
        { when:"cobra o preço de três", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"45,00" } },
        { when:"salva", click:'[data-act="salvar-combo"]' },
        { then:"a lista lê o combo em voz alta, sem campo nenhum para isso",
          check:(a, el) => el.textContent.indexOf("leve 4, pague 3") > -1 }
      ]
    },
    {
      id:"construtor-carregando",
      name:"Buscar um produto e esperar o servidor",
      page:"construtor", tags:["@combos","@carregando","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"LoadingState só na caixa de resultados" },
      network:{ "GET /api/admin/:slug/products/busca/:termo": "pendente" },
      given:{
        text:"que o lojista buscou um produto e a resposta não chegou",
        state: async (ex, api) => {
          api.get(admin + "/products/busca/sandu").catch(() => {});
          return { page:"construtor", loading:true, termo:"sandu",
                   form:{ nameStr:"", priceReais:"", items:[] } };
        }
      },
      steps:[
        { then:"a caixa de resultados entra em carregamento, sem tela em branco",
          check:(a, el) => !!el.querySelector('[data-estado="carregando"]')
                        && !el.querySelector(".resultado") },
        { and:"a região é anunciada como ocupada",
          check:(a, el) => el.querySelector('[data-estado="carregando"]').getAttribute("aria-busy") === "true" },
        { when:"a resposta chega", waitFor:"GET /api/admin/:slug/products/busca/:termo",
          applyState:(a, payload) => ({ ...a, busca:payload, loading:false }) },
        { when:"o lojista desiste", click:'[data-act="voltar-combos"]' },
        { then:"a lista de combos aparece",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"construtor-busca-sem-resultado",
      name:"Busca que não acha nada não inventa produto",
      page:"construtor", tags:["@combos","@vazio","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"EmptyState com o termo buscado, para o lojista corrigir" },
      given:{
        text:"que o lojista está na lista de combos",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]', local:true },
        { when:"busca por algo que não existe", local:true,
          fill:{ sel:'.campo-busca input', val:"feijoada" } },
        { then:"a caixa diz o que foi buscado, sem inventar produto",
          check:(a, el) => (el.querySelector('[data-estado="vazio"]') || {}).textContent
                            .indexOf("feijoada") > -1 },
        { when:"o lojista volta para os combos", click:'[data-act="voltar-combos"]' },
        { then:"a lista continua completa",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"construtor-erro",
      name:"Busca fora do ar e a recuperação",
      page:"construtor", tags:["@combos","@erro","@recuperacao","@pode:combo.editar"],
      impl:{ component:"ComboBuilder", notes:"ErrorState dentro da caixa de resultados" },
      fixtureFailure:true,
      given:{
        text:"que o lojista buscou e a busca caiu na primeira tentativa",
        state: async (ex, api) => {
          api.data_.productsFailOnce = true;
          try {
            return { page:"construtor", termo:"sandu",
                     form:{ nameStr:"", priceReais:"", items:[] },
                     busca: await api.get(admin + "/products/busca/sandu") };
          } catch (e){
            return { page:"construtor", termo:"sandu",
                     form:{ nameStr:"", priceReais:"", items:[] }, error_:e.message };
          }
        }
      },
      steps:[
        { then:"a caixa explica a falha",
          check:(a, el) => !!el.querySelector('[data-estado="erro"]') },
        { when:"o lojista busca de novo", fill:{ sel:'.campo-busca input', val:"sandu" } },
        { then:"o resultado aparece e a explicação some",
          check:(a, el) => el.querySelectorAll(".resultado").length === 1
                        && !el.querySelector('[data-estado="erro"]') },
        { when:"o lojista volta para os combos", click:'[data-act="voltar-combos"]' },
        { then:"a lista carrega normalmente",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
      ]
    },
    {
      id:"construtor-invariante",
      name:"Uma unidade só não é combo até ganhar a segunda",
      page:"construtor", tags:["@combos","@feliz","@pode:combo.editar"],
      impl:{ component:"ComboBuilder",
             notes:"a invariante é a mesma no cliente e no servidor; aqui só chega antes" },
      given:{
        text:"que o lojista abriu um combo que já existe",
        state: async (ex, api) => ({ page:"combos", combos: await api.get(admin + "/combos") })
      },
      steps:[
        { when:"o lojista abre o combo do chef",
          click:'[data-act="editar-combo"][data-id="c1"]' },
        { then:"o combo abre com os dois produtos e as três unidades dentro",
          check:(a, el) => {
            const linhas = el.querySelectorAll(".item-combo");
            const t = el.textContent || "";
            return linhas.length === 2
                && t.indexOf("R$ 28,00 cada") > -1
                && t.indexOf("R$ 56,00 no total") > -1;
          } },
        { when:"o lojista tira a Coca", click:'[data-act="tirar-item"][data-id="m2"]', local:true },
        { when:"e baixa o sanduíche para um",
          click:'[data-act="menos-item"][data-id="m1"]', local:true },
        { then:"a tela diz que uma unidade só não é combo",
          check:(a, el) => (el.querySelector("[data-impedimento]") || {}).textContent
                            .indexOf("pelo menos 2 unidades") > -1 },
        { and:"o botão de salvar fica travado",
          check:(a, el) => !!el.querySelector('[data-act="salvar-combo"][disabled]') },
        { when:"o lojista devolve a segunda unidade",
          click:'[data-act="mais-item"][data-id="m1"]', local:true },
        { then:"o impedimento some e o salvar destrava",
          check:(a, el) => !el.querySelector("[data-impedimento]")
                        && !el.querySelector('[data-act="salvar-combo"][disabled]') },
        { when:"o lojista salva", click:'[data-act="salvar-combo"]' },
        { then:"o combo volta para a lista",
          check:(a, el) => el.querySelectorAll(".combo").length === 2 }
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
        { when:"o lojista abre o construtor", click:'[data-act="novo-combo"]', local:true },
        { when:"dá um nome que já existe", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo do chef" } },
        { when:"busca por sanduíche", local:true, fill:{ sel:'.campo-busca input', val:"sandu" } },
        { when:"põe duas unidades", click:'[data-act="por-no-combo"][data-id="m1"]', local:true },
        { when:"e mais uma", click:'[data-act="mais-item"][data-id="m1"]', local:true },
        { when:"tenta salvar", click:'[data-act="salvar-combo"]' },
        { then:"a tela mostra por que não salvou",
          check:(a, el) => !!el.querySelector('[data-erro="construtor"]') },
        { and:"o que ele montou continua na tela",
          check:(a, el) => el.querySelectorAll(".item-combo").length === 1
                        && el.querySelector('[data-campo="nome"]').value === "Combo do chef" }
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
        { when:"o lojista abre o combo do chef",
          click:'[data-act="editar-combo"][data-id="c1"]' },
        { when:"baixa o preço do combo", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"55,00" } },
        { when:"salva", click:'[data-act="salvar-combo"]' },
        { then:"a lista mostra o preço novo e a economia recalculada",
          check:(a, el) => el.textContent.indexOf("economiza R$ 9,00") > -1 }
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
        { when:"o lojista abre o combo do chef",
          click:'[data-act="editar-combo"][data-id="c1"]' },
        { when:"renomeia o combo", local:true,
          fill:{ sel:'[data-campo="nome"]', val:"Combo do chef II" } },
        { when:"baixa demais o preço", local:true,
          fill:{ sel:'[data-campo="preco"]', val:"1,00" } },
        { when:"tenta salvar", click:'[data-act="salvar-combo"]' },
        { then:"a tela mostra por que não salvou",
          check:(a, el) => !!el.querySelector('[data-erro="construtor"]') },
        { and:"o combo continua montado, sem perder os componentes",
          check:(a, el) => el.querySelectorAll(".item-combo").length === 2 }
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
          check:(a, el) => el.textContent.indexOf("Inclui: 2× Sanduíche do chef, 1× Coca-Cola 350ml") > -1
                        && el.textContent.indexOf("R$ 59,00") > -1 },
        { when:"o cliente põe o combo no carrinho", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"o combo ocupa uma linha só, com os componentes dentro",
          check:(a, el) => el.querySelectorAll(".linha-carrinho").length === 1
                        && el.querySelectorAll(".componente").length === 2 },
        { and:"o total é o preço do combo, não a soma das partes",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 59,00") > -1 }
      ]
    },
    {
      id:"cardapio-promocao",
      name:"Quatro pastéis entram como uma linha só",
      page:"cardapio", tags:["@combos","@feliz"],
      impl:{ component:"MenuCombos",
             notes:"não há maths de promoção: o combo tem um preço e a linha o multiplica" },
      given:{
        text:"que o cliente abriu o cardápio",
        state: async (ex, api) => ({ page:"cardapio", menu: await api.get("/api/menu/" + SLUG) })
      },
      steps:[
        { then:"o cardápio lê a promoção em voz alta",
          check:(a, el) => el.textContent.indexOf("leve 4, pague 3") > -1 },
        { when:"o cliente pega o combo de pastéis", click:'[data-act="por-no-carrinho"][data-id="c2"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { then:"os quatro pastéis ocupam uma linha só, pelo preço de três",
          check:(a, el) => el.querySelectorAll(".linha-carrinho").length === 1
                        && el.textContent.indexOf("4× Pastel de nata") > -1
                        && (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 22,50") > -1 },
        { when:"o cliente leva outro combo", click:'[data-act="mais-um"]' },
        { then:"oito pastéis custam o dobro, sem promoção nova",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 45,00") > -1 }
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
                            .indexOf("Total R$ 74,00") > -1 }
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
                            .indexOf("Desconto − R$ 2,95") > -1 },
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
                { status:500, payload:{ error_:"Não foi possível tirar a linha" } },
              "PUT /api/cart/:slug/coupon":
                { status:500, payload:{ error_:"Não foi possível aplicar o cupom" } } },
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
                        && el.querySelectorAll(".linha-carrinho").length === 1 },
        { when:"tenta ainda aplicar um cupom", local:true,
          fill:{ sel:'[data-campo="cupom"]', val:"CUPOM10" } },
        { when:"aplica o cupom", click:'[data-act="aplicar-cupom"]' },
        { then:"o cupom também é recusado e o carrinho continua de pé",
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
    },
    {
      id:"carrinho-cupom-aceito",
      name:"Cupom de valor fixo entra no pedido",
      page:"carrinho", tags:["@combos","@descontos","@feliz"],
      impl:{ component:"CartCombos",
             notes:"gatilho CODE: só vale se o comprador digitar; valor fixo limitado ao que resta" },
      given:{
        text:"que a loja tem CUPOM10 com pedido mínimo de R$ 50,00 e o cliente abriu o cardápio",
        state: async (ex, api) => {
          api.data_.descontosLigados = true;
          return { page:"cardapio", menu: await api.get("/api/menu/" + SLUG) };
        }
      },
      steps:[
        { when:"o cliente pega o combo do chef", click:'[data-act="por-no-carrinho"][data-id="c1"]' },
        { when:"pega também um sanduíche", click:'[data-act="por-item"][data-id="m1"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { when:"digita o cupom", local:true, fill:{ sel:'[data-campo="cupom"]', val:"CUPOM10" } },
        { when:"aplica o cupom", click:'[data-act="aplicar-cupom"]' },
        { then:"o cupom entra como promoção de pedido, por código, ao lado da automática",
          check:(a, el) => {
            const conta = (el.querySelector("[data-totais]") || {}).textContent || "";
            return conta.indexOf("Cupom CUPOM10") > -1
                && conta.indexOf("Código") > -1
                && conta.indexOf("Automático") > -1;
          } },
        { and:"a conta fecha com o automático e o cupom somados",
          check:(a, el) => (el.querySelector("[data-totais]") || {}).textContent
                            .indexOf("Total R$ 72,65") > -1 }
      ]
    },
    {
      id:"carrinho-cupom-recusado",
      name:"Cupom abaixo do mínimo é recusado com o motivo",
      page:"carrinho", tags:["@combos","@descontos","@conflito"],
      impl:{ component:"CartCombos",
             notes:"o mínimo é contra o subtotal INTOCADO, nunca contra um total correndo" },
      given:{
        text:"que a loja tem CUPOM10 com pedido mínimo de R$ 50,00 e o cliente abriu o cardápio",
        state: async (ex, api) => {
          api.data_.descontosLigados = true;
          return { page:"cardapio", menu: await api.get("/api/menu/" + SLUG) };
        }
      },
      steps:[
        { when:"o cliente pega só o combo de pastéis", click:'[data-act="por-no-carrinho"][data-id="c2"]' },
        { when:"abre o carrinho", click:'[data-act="ir-carrinho"]' },
        { when:"digita o cupom", local:true, fill:{ sel:'[data-campo="cupom"]', val:"CUPOM10" } },
        { when:"aplica o cupom", click:'[data-act="aplicar-cupom"]' },
        { then:"a recusa diz qual é o mínimo, em dinheiro",
          check:(a, el) => (el.querySelector("[data-recusa]") || {}).textContent
                            .indexOf("pedido mínimo de R$ 50,00") > -1 },
        { and:"a promoção automática de pedido continua valendo",
          check:(a, el) => !!el.querySelector('[data-escopo="ORDER"]') }
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

Proto.on("click", '[data-act="novo-combo"]', () => {
  Proto.set({ page:"construtor", editandoId:null, error_:null, erroAcao:null,
              busca:null, termo:"", form:{ nameStr:"", priceReais:"", items:[] } });
});

Proto.on("click", '[data-act="editar-combo"]', async (e, el) => {
  try {
    const c = await Proto.api.get(admin + "/combos/" + el.dataset.id);
    Proto.set({
      page:"construtor", editandoId:c.id, error_:null, erroAcao:null, busca:null, termo:"",
      form:{
        nameStr:c.nameStr,
        priceReais:(c.priceCents / 100).toFixed(2),
        items:(c.componentes || []).map(x => ({
          productId:x.productId, quantity:x.quantity,
          nameStr:x.nameStr, unitPriceCents:x.unitPriceCents
        }))
      }
    });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

/* ----------------------------------------------------------- construtor */

/* os campos são controlados pelo React (onChange no próprio componente); o
   Proto.on existe para o passo `preenche` da suíte, que escreve no DOM */
Proto.on("input", '[data-campo="nome"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), nameStr: el.value } });
});

Proto.on("input", '[data-campo="preco"]', (e, el, s) => {
  Proto.set({ form:{ ...(s.app.form || {}), priceReais: el.value.replace(",", ".") } });
});

/* Uma busca só sai com termo: pedir /busca/ vazio é rota que não existe.
   Apagar o campo volta ao estado de "busque alguma coisa", sem requisição. */
Proto.buscarProduto = async function(val){
  Proto.set({ termo: val });
  const termo = (val || "").trim();
  if (!termo){ Proto.set({ busca:null, error_:null }); return; }
  try {
    const r = await Proto.api.get(admin + "/products/busca/" + encodeURIComponent(termo));
    Proto.set({ busca:r, error_:null });
  } catch (err){ Proto.set({ error_:err.message }); }
};

/* o passo `preenche` da suíte escreve no DOM, o que não acorda o onChange do
   React — este ouvinte nativo é o que mantém a suíte e a pessoa no mesmo caminho */
Proto.on("input", ".campo-busca input", (e, el) => { Proto.buscarProduto(el.value); });

Proto.on("click", '[data-act="por-no-combo"]', (e, el, s) => {
  const f = s.app.form || {};
  const achado = ((s.app.busca || {}).itens || []).find(p => p.id === el.dataset.id);
  if (!achado) return;
  const lista = (f.items || []).slice();
  const i = lista.findIndex(x => x.productId === achado.id);
  /* o mesmo produto de novo é uma unidade a mais, não uma linha nova */
  if (i >= 0) lista[i] = { ...lista[i], quantity: lista[i].quantity + 1 };
  else lista.push({ productId:achado.id, quantity:1,
                    nameStr:achado.nameStr, unitPriceCents:achado.priceCents });
  Proto.set({ form:{ ...f, items: lista } });
});

Proto.on("click", '[data-act="mais-item"]', (e, el, s) => {
  const f = s.app.form || {};
  Proto.set({ form:{ ...f, items:(f.items || []).map(x =>
    x.productId === el.dataset.id ? { ...x, quantity:x.quantity + 1 } : x) } });
});

Proto.on("click", '[data-act="menos-item"]', (e, el, s) => {
  const f = s.app.form || {};
  Proto.set({ form:{ ...f, items:(f.items || [])
    .map(x => x.productId === el.dataset.id ? { ...x, quantity:x.quantity - 1 } : x)
    .filter(x => x.quantity > 0) } });
});

Proto.on("click", '[data-act="tirar-item"]', (e, el, s) => {
  const f = s.app.form || {};
  Proto.set({ form:{ ...f, items:(f.items || []).filter(x => x.productId !== el.dataset.id) } });
});

Proto.on("click", '[data-act="salvar-combo"]', async (e, el, s) => {
  const f = s.app.form || {};
  const corpo = {
    nameStr: f.nameStr,
    priceCents: Math.round(Number(f.priceReais || 0) * 100),
    items: (f.items || []).map(x => ({ productId:x.productId, quantity:x.quantity }))
  };
  try {
    if (s.app.editandoId) await Proto.api.put(admin + "/combos/" + s.app.editandoId, corpo);
    else await Proto.api.post(admin + "/combos", corpo);
    Proto.set({ page:"combos", combos: await Proto.api.get(admin + "/combos"),
                editandoId:null, erroAcao:null,
                aviso:{ tipo:"ok", texto:"Combo salvo." } });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
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

Proto.on("input", '[data-campo="cupom"]', (e, el) => Proto.set({ cupom: el.value }));

Proto.on("click", '[data-act="aplicar-cupom"]', async (e, el, s) => {
  try {
    const cart = await Proto.api.put(loja + "/coupon", { code: s.app.cupom || "" });
    Proto.set({ cart, erroAcao:null });
  } catch (err){ Proto.set({ erroAcao: err.message }); }
});

Proto.on("click", '[data-act="tentar-carrinho"]', async () => {
  try { Proto.set({ cart: await Proto.api.get(loja), error_:null }); }
  catch (e){ Proto.set({ error_:e.message }); }
});
