# Paladira — Project Instructions

*(Cole no campo de instruções do projeto. Os arquivos citados vivem no conhecimento do projeto.)*

---

## O que é

Paladira é uma plataforma para lojas brasileiras de alimentação e varejo: cardápio, catálogo, mesas e comandas, cozinha, estoque, entregas, pagamentos, equipe e relatórios. Este projeto serve para desenhar e pressionar a UI antes de virar código.

**Toda string de interface é português do Brasil.** Nunca escreva UI em inglês, nem como rascunho. Termos de domínio ficam em português: mesa, comanda, pedido, cardápio, ficha técnica, estoque, entrega, garçom.

## Ponto de partida

**Não recrie o harness. Copie `paladira-harness.html`** e edite **somente** as zonas marcadas:

- `▼ DADOS ▼` — fixtures e rotas
- `▼ APP ▼ (1 de 2)` — estilos do protótipo
- `▼ APP ▼ (2 de 2)` — contexto, cenários e render

Tudo fora dessas zonas é o harness. Renomeie para `paladira-<área>-<coisa>.html`.

O harness entrega: escada de larguras, barra de cenários redimensionável com busca, permalink no hash, preferências salvas, monitor de rede no palco, painel de Dados, exportação Gherkin, verificação isolada em iframe (com retomada automática) e tela de falha bloqueante.

## O protótipo é a especificação

Cenários são Gherkin de verdade (`# language: pt`) com passos clicáveis: clicar no passo N reproduz 1..N a partir do `Dado`.

```js
{
  id:"criar-variacao", name:"Do cardápio até criar a primeira variação",
  pagina:"produto", tags:["@catálogo","@feliz","@pode:produto.editar"],
  impl:{ componente:"ProdutoEditor", rota:"/produtos/:id", modulo:"catalogo/produtos" },
  given:{ text:"que o lojista está no cardápio",
          state: async (ex, api) => ({ pagina:"lista", produtos: await api.get("/api/produtos") }) },
  steps:[
    { when:"o lojista abre Calabresa", clique:'[data-act="abrir-produto"][data-id="2"]' },
    { then:"o editor abre", check:(a, el) => !!el.querySelector('[data-act="voltar"]') },
    { when:"toca em Adicionar variação", clique:'[data-act="add"]' },
    { then:"a variação aparece", check:(a, el) => el.querySelectorAll(".var").length === 1 }
  ]
}
```

- `Dado` = o mundo antes da ação; busca pela API.
- `Quando` = ação real: `clique`, `preenche`, `escolhe`, `alterna`, `aguarda`. Roda os handlers de `Paladira.on` e falha se o elemento não existir. `apply` só para estado puro.
- `Então` = `check(estado, dom)` contra o DOM renderizado.
- `E` **herda a palavra anterior**: `E` depois de `Então` é asserção. Ação escrita ali é acusada.
- **Passo que muda o estado é `Quando`, sempre** — venha de clique, de `apply` ou da resposta que chegou.

## Jornada, não asserção solta

`Dado … Então` sem ação no meio não é cenário, é legenda de print. A verificação cobra:

- pelo menos **2 ações** por cenário (`minAcoes`), e ao menos uma jornada de **3+ ações** por página;
- um `Então` **depois** da última ação;
- ações em **alvos diferentes** — clicar três vezes no mesmo botão não é percurso;
- cada página precisa de uma jornada que **chegue nela vindo de outra tela**;
- dois cenários que percorrem os mesmos controles na mesma ordem são acusados como clone.

**Tipos de jornada** (o rótulo é conferido contra a tela):

| tag | é | conferido por |
|---|---|---|
| `@feliz` | funciona de ponta a ponta | nenhum erro em nenhum passo |
| `@conflito` | o servidor recusa (e-mail existe, limite, 422) | termina **com** erro visível |
| `@recuperacao` | quebra no meio e a pessoa se recupera | erro aparece **e** some no fim |
| `@retorno` | quem já usou volta | sai da página e volta |

Cada página precisa de `@feliz` **e** de pelo menos um dos outros três.

## Três estados por página

Toda página usa `AsyncStateContainer` e marca `[data-estado="…"]`. Precisa de cenário `@carregando`, `@vazio` e `@erro`, agrupados por `pagina`. O harness assere sozinho que o estado apareceu **em algum ponto da jornada** — estado é etapa, não destino. `@erro` sem falha forçada (`rede` ou `falhaNasFixtures`) é caminho feliz de rótulo errado.

Para carregando virar etapa: `rede:{ "GET /api/x": "pendente" }` segura a resposta e um passo a solta:

```js
{ when:"a resposta chega", aguarda:"GET /api/produtos",
  aplica:(a, corpo) => ({ ...a, produtos:corpo, carregando:false }) }
```

## Dados: a tela nunca inventa, ela pede

Fixtures e rotas ficam na zona `DADOS`; o harness intercepta `fetch`. As fixtures voltam ao estado inicial a cada cenário.

- **Rota de escrita precisa alterar as fixtures.** Responder 200 sem gravar é fachada — o recarregar desmente e a auditoria acusa.
- **Toda rota nas duas pontas**: cenário de sucesso e de erro (`rede:{ "POST /api/…": 500 }`). Rota nunca chamada é rota morta.
- **Toda chamada nasce de um passo.** Só no `Dado` = carregamento de tela: marque `naCarga:true` na rota.
- **Mutação sai do navegador.** Passo que muda a tela sem pedido é acusado. `local: true` isenta ação de interface — mas **não** vale para controle cujo rótulo promete gravar (*Salvar*, *Confirmar*, *Excluir*…), nem quando altera dado do servidor sem ninguém persistir depois.
- Latência sorteada de 250–750ms na tela; a verificação roda sem atraso.

## Contexto da loja

Três tipos de dimensão em `contexto`:

- `kind:"escala"` — plano (free → ultra). `@pro` vale de Pro para cima.
- `kind:"opcao"` — papel do usuário. `@garcom` vale só no garçom.
- `kind:"flags"` — funcionalidades ligáveis. `@cozinha` exige ligada.

Opções concedem permissões (`permite:[…]`, `"*"` = todas); um cenário exige com `@pode:produto.editar`. Permissão é **E entre dimensões**: o plano habilita, o papel autoriza. **Cada cenário é verificado no contexto que as tags dele pedem** — o resultado não depende dos chips marcados na tela.

## Largura é dimensão, não detalhe

A escada padrão é `xxs 320 · xs 380 · sm 480 · md 768 · lg 1024 · xlg 1440` (troque em `larguras`). Aparelhos aparecem como `~xs`: caem entre degraus e herdam o de baixo.

**Não entregue "algo que cabe".** Declare o arranjo de cada largura num `Esquema do Cenário` com coluna `largura` — o harness põe o quadro naquela largura antes de desenhar e de conferir:

```
Exemplos:
  | largura | colunas | onde   |
  | xxs     | 1       | rodape |
  | md      | 2       | topo   |
  | xlg     | 3       | topo   |
```

Escolher um degrau no seletor troca a linha do exemplo, e vice-versa.

Além disso a verificação mede, degrau a degrau:

- **arranjo igual na escada inteira** = coube, não respondeu;
- **transbordo horizontal**;
- **alvo de toque < 44px** em xxs/xs/sm;
- **texto < 12px**;
- **linha > 75 caracteres** em lg/xlg;
- **conteúdo que existe no largo e some no estreito** — decisão ou falta de espaço?

Prefira `@container` a `@media`: o quadro é o container.

## Componentes

Use `@12-apps/ui` — 128 componentes em `paladira-ui-catalogo.md`, com o que exige fiação em `paladira-ui-interacoes.md` (60 exigem, 37 podem, 31 nunca). O mapa `primitivas` liga seletor a componente **pelo nome**; o caminho do import sai do catálogo, e nome fora dele é acusado sem gerar import inventado. `estrito: true` exige que toda marcação com texto ou interação esteja reivindicada. Nunca escreva hex quando existe token.

## Antes de entregar — obrigatório

```bash
npm install jsdom                                  # uma vez por sessão
node paladira-verificar.js paladira-<coisa>.html   # precisa sair 0
```

O portão usa **Chromium quando encontra um** (marca `[navegador]` na saída) e só aí as regras de layout e as medidas físicas valem. Sem navegador cai no jsdom e essas regras se declaram não verificáveis — o resto continua valendo.

Antes disso, `node --check` no bloco `<script>`: erro de sintaxe deixa a página em branco. Leia os avisos mesmo quando passa: `handlers 2/5` quer dizer que três comportamentos não têm cenário. Verde não é o mesmo que coberto. Detalhes em `paladira-portao.md`.

## Escapes

Existem e devem ser exceção declarada, nunca o jeito de calar um aviso: `local`, `semRede`, `naCarga`, `jornada:false`, `estados:false`, `rotasCobertas:false`, `jornadas:false`, `responsivo:false`.

## Como trabalhamos

Retorno curto e direto — *"UI is not good"*, *"needs a remover conexao flow"*. **Infira o escopo e execute**; não peça especificação antes de tentar. Uma pergunta só quando o *o quê* estiver ambíguo, nunca sobre o *como*. Espere de cinco a quinze rodadas no mesmo arquivo.

Depois de construir: mudança em prosa curta, com o raciocínio onde houve decisão real, e o que vale cutucar. Não cole o código de volta nem repita a lista de funcionalidades.

Se encontrar um bug no que eu mandei, diga na hora e conserte no mesmo passo.
