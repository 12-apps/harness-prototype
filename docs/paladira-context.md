# Paladira — Contexto

*(Referência para o conhecimento do projeto. As regras ficam nas instruções; aqui fica o porquê.)*

---

## 1. O produto

Paladira é uma plataforma multi-loja para alimentação e varejo no Brasil. Uma loja roda a operação inteira por ela, e a superfície se divide em três:

**Storefront** — cardápio por categoria e subcategoria, destaques, ficha do produto com variações e extras pagos, favoritos, carrinho, mesa ou balcão, comanda, chamar garçom, checkout, histórico.

**Admin** — catálogo e editor de produto, categorias, estoque e ingredientes, fichas técnicas, cozinha e suas estações, mesas e setores, entregas e couriers, pedidos, pagamentos, equipe e papéis, relatórios, plano, marketplaces, marca.

**Operação** — o painel da cozinha, a tela do garçom, o quadro de entregas. Voltadas para quem está trabalhando, ao vivo, por turno.

As lojas variam muito e a UI precisa segurar todas: restaurante com mesas e cozinha, bar que só vende bebida, loja sem cozinha nenhuma. É para isso que existem as dimensões de contexto.

## 2. Vocabulário

| termo | é |
|---|---|
| loja / tenant | uma loja |
| mesa | mesa do salão |
| comanda | conta compartilhada da mesa, pede antes e paga depois |
| balcão | retirada, sem mesa |
| pedido | o que vai para a cozinha |
| cardápio | o menu público |
| ficha técnica | receita do produto |
| ingrediente | matéria-prima (RAW) ou sub-receita (PREP) |
| variação | tamanho, sabor |
| extras pagos | adicionais |
| destaques | prateleira em evidência |
| cozinha / estação | onde se prepara (Grelha, Fritura…) |
| estoque | por local |
| entrega / corrida | entrega e a corrida do courier |
| garçom | garçom |
| turno | turno de trabalho |

Há um MCP do Paladira ligado ao projeto com a API real. Quando precisar da forma verdadeira de uma entidade — campos de produto, estados de uma corrida, o que volta numa comanda — leia de lá em vez de inventar. Protótipo que bate com o modelo real vale muito mais.

## 3. A ideia central

**O protótipo é a especificação.** Não é uma imagem do que vai ser construído: é o contrato, executável, com os cenários em Gherkin de verdade e cada `Então` conferido contra o DOM. Quem for implementar recebe o `.feature` com as pistas de componente, rota e módulo, e os imports do `@12-apps/ui` já resolvidos.

Daí decorre quase tudo: se o protótipo é a especificação, ele não pode mentir. Não pode dizer "salvo" sem gravar, não pode ter botão que não faz nada, não pode ter tela que ninguém sabe como se alcança, não pode dizer que é responsivo porque coube.

## 4. O que a verificação cobra, e por quê

| regra | existe porque |
|---|---|
| jornada com 2+ ações, `Então` depois de agir | `Dado … Então` sem ação é print com legenda |
| tipos `@feliz` / `@conflito` / `@recuperacao` / `@retorno` | suíte só de caminho feliz é meia especificação |
| três estados por página, como etapa da jornada | carregando, vazio e erro são caminhos que o usuário encontra |
| toda rota nas duas pontas, toda chamada vinda de um passo | tratamento de erro descoberto em produção sai caro |
| rota de escrita tem de alterar as fixtures | 200 sem gravar é fachada; recarregar desmente |
| rótulo que promete gravar tem de gravar | *Salvar* que não salva é a mentira mais cara da UI |
| afordância precisa de handler; handler precisa de passo | botão morto e comportamento sem cobertura |
| `estrito` cobra marcação reivindicada por componente | evita recriar em produção o que a biblioteca já tem |
| arranjo diferente por degrau, alvo 44px, texto 12px, linha 75ch | "coube" não é o mesmo que "serve" |

Os escapes (`local`, `semRede`, `naCarga`, `jornada:false`, `estados:false`, `rotasCobertas:false`) existem porque exceções reais existem. Cada um é uma declaração explícita, e alguns são conferidos: `local: true` num controle chamado *Salvar* continua sendo acusado.

## 5. Decisões de UX já fechadas

Não relitigar sem motivo.

**Seletor de categorias.** Subcategoria é o item selecionável; categoria pai é cabeçalho por padrão, com opção de virar selecionável em três estados. Tudo expandido ao abrir, sem contagem de produtos, sem chips no gatilho. Busca insensível a acento com destaque do termo e hierarquia preservada. Selecionados fixos no topo. Rascunho + Aplicar; Esc descarta. Rodapé com contagem viva e Limpar que desabilita sozinho. Teclado completo. Abaixo de 480px vira bottom sheet com linhas de 42px.

**Provedor de pagamento.** OAuth é o estado padrão, não uma escolha oferecida de cara; chaves manuais são escape discreto dentro do painel, e os dois nunca aparecem juntos. Barra de ação grudada no fim do painel que está sendo preenchido. Remover conexão é modal com consequência escrita e saída "só pausar". `ativado` e `recebendo` são estados distintos.

**Geral.** Ação primária depois do formulário que ela confirma. Destrutivo com consequência explícita e escape. Estado concluído não se desfaz sozinho por causa de um toggle não relacionado.

## 6. Armadilhas que já custaram tempo

- **Scrim permanente.** Backdrop renderizado fora da condição "painel aberto" cobre a tela e come todo clique. A causa é invisível.
- **Falta de `<!DOCTYPE html>`.** Quirks mode quebra container query parecendo bug de CSS.
- **Query de DOM antes da primeira pintura.** Null deref — foi o bug mais frequente aqui.
- **Função perdida em substituição grande.** Depois de trocar blocos, confira a lista de funções.
- **`@media` dentro do quadro.** Responde à janela, não ao quadro; o seletor de largura perde o sentido. Use `@container`.
- **Medir elemento fora do documento.** `getComputedStyle` devolve vazio — e vazio se parece com "não muda em degrau nenhum".
- **Otimização que pula efeito.** Cache que devolve estado pronto sem refazer o passo faz o pedido não acontecer: some do monitor, some o carregando.

## 7. Como trabalhamos

Sessões longas e iterativas, cinco a quinze rodadas no mesmo arquivo. Retorno curto e direto; espera-se inferir o escopo e executar.

Conversas já se perderam no meio do caminho — por isso o harness e estas decisões vivem no conhecimento do projeto, não no histórico. O harness é arquivo, não descrição: descrição drifta, arquivo não.
