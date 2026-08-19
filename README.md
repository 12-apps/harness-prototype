# Paladira · harness de protótipos

Um arquivo HTML que serve de bancada para desenhar e **pressionar** a UI antes de virar código. O protótipo não é uma imagem do que será construído: é a especificação, executável, com cenários em Gherkin de verdade conferidos contra o DOM.

```bash
npm install jsdom
node paladira-verificar.js paladira-harness.html
# ✓ paladira-harness.html — 68 ok · 0 falhando · 0 aviso(s) · handlers 9/9  [navegador]
```

## Como se usa

1. Copie `paladira-harness.html` e renomeie para `paladira-<área>-<coisa>.html`.
2. Edite **somente** as três zonas marcadas dentro do arquivo:
   - `▼ DADOS ▼` — fixtures e rotas
   - `▼ APP ▼ (1 de 2)` — estilos do protótipo
   - `▼ APP ▼ (2 de 2)` — contexto, cenários e render
3. Abra no navegador. A suíte roda sozinha e bloqueia a tela se falhar.
4. Antes de entregar, rode o portão. Precisa sair `0`.

Nada fora das zonas se toca — é o harness, e ele é igual em todo protótipo.

## O que o harness dá

Escada de larguras (`xxs … xlg`), barra de cenários com busca e agrupamento, permalink no hash, preferências salvas, monitor de rede no palco, painel de Dados, exportação `.feature`, verificação isolada em iframe com retomada automática, e tela de falha bloqueante com relatório colável.

## O que ele cobra

O portão reprova o que uma revisão de olho não pega:

- **Jornada, não asserção solta** — `Dado … Então` sem ação no meio é print com legenda.
- **Variedade** — cada página precisa de `@feliz` e de pelo menos um `@conflito`, `@recuperacao` ou `@retorno`. O rótulo é conferido contra a tela.
- **Três estados por página** — `@carregando`, `@vazio`, `@erro`, como etapa da jornada.
- **A tela nunca inventa dado** — ela pede. Rota de escrita que responde `200` sem gravar é fachada.
- **Rótulo que promete gravar tem de gravar** — *Salvar* que não faz pedido é acusado, mesmo marcado como local.
- **Largura é dimensão** — arranjo igual em toda a escada é "coube", não "respondeu". Mais alvo de toque de 44px, texto de 12px, linha de 75 caracteres, transbordo e conteúdo que some no estreito.

Detalhes em [`docs/paladira-project-instructions.md`](docs/paladira-project-instructions.md).

## Dois motores

O portão usa **Chromium quando encontra um e tem o puppeteer para dirigi-lo** (marca `[navegador]` na saída) — só assim valem as regras que precisam medir caixa. Sem navegador cai no jsdom, e essas regras se declaram não verificáveis em vez de aprovar no escuro. Todo o resto continua valendo.

```bash
npm install --no-save puppeteer            # PUPPETEER_SKIP_DOWNLOAD=1 se já tem um Chrome
PALADIRA_CHROME=/caminho/para/chrome node paladira-verificar.js arquivo.html
```

Sem o puppeteer não adianta ter Chromium: o portão cai no jsdom. A marca
`[navegador]` na saída é o que diz qual motor valeu — confira antes de confiar
no verde.

## Mapa

| caminho | o que é |
|---|---|
| `paladira-harness.html` | o harness; copie por protótipo |
| `paladira-verificar.js` | o portão de linha de comando |
| `docs/` | instruções, regra de entrega e contexto do produto |
| `catalogo/` | os 128 componentes de `@12-apps/ui` e o que cada um exige de fiação |
| `scripts/gerar-catalogo.js` | regenera o catálogo a partir do pacote instalado |
| `exemplos/` | protótipo-demo completo, verde no portão |

## Catálogo de componentes

`catalogo/` é gerado, não escrito à mão. Quando `@12-apps/ui` mudar de versão:

```bash
npm install @12-apps/ui
node scripts/gerar-catalogo.js
```

O harness confere os nomes usados em `primitivas` contra o catálogo e não inventa caminho de import para nome que não existe.

## Licença

Interno.
