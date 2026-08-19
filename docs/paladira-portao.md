# Portão de verificação — regra de entrega

**Nenhum protótipo é entregue sem passar por isto.** Vale para mim, para você e para qualquer agente que editar o arquivo.

```bash
npm install jsdom                                   # uma vez por sessão
node paladira-verificar.js paladira-<coisa>.html
node paladira-verificar.js paladira-<coisa>.html --estrito
```

| saída | significa | o que fazer |
|---|---|---|
| `0` | passou | pode entregar |
| `1` | há falhas | **não entregue** — o relatório sai no stderr, corrija e rode de novo |
| `2` | passou com avisos e `--estrito` estava ligado | cobrir ou aceitar a dívida |
| `3` | o arquivo não carregou | erro de sintaxe, ou não é um protótipo do harness |

## Dois motores

A saída diz qual rodou:

```
✓ paladira-editor-produto.html — 68 ok · 0 falhando · 0 aviso(s) · handlers 9/9  [navegador]
```

**Com `[navegador]`** — achou um Chromium e rodou a suíte lá dentro. Só assim valem as regras que dependem de medir caixa: arranjo por degrau, transbordo, alvo de toque, tamanho de texto, comprimento de linha. Procura nesta ordem: `PALADIRA_CHROME`, o cache do Puppeteer, `/opt/pw-browsers`, `/usr/bin/chromium`.

**Sem a marca** — caiu no jsdom, que resolve DOM mas não faz layout: `@container` nunca casa. As regras de medida se declaram não verificáveis em vez de aprovar no escuro. Tudo o mais (jornadas, rotas, estados, permissões, sumiço de conteúdo) continua valendo.

Para forçar um navegador específico:

```bash
PALADIRA_CHROME=/caminho/para/chrome node paladira-verificar.js arquivo.html
```

## Por que existe

O harness verifica sozinho ao abrir, mas isso só protege quem já recebeu o arquivo. O portão protege antes: quem editou descobre que quebrou com as mãos ainda no código.

O que ele pega e uma revisão de olho não pega:

- **Cenário que ninguém abriu nesta sessão.** A suíte roda todos, sempre, cada um no contexto que as tags dele pedem.
- **Contrato rompido.** Renomear `data-act`, apagar um handler, desabilitar um botão — o passo deixa de agir e a falha diz qual elemento sumiu.
- **Fachada.** Rota de escrita que responde 200 sem alterar as fixtures; botão que diz *Salvar* e não pede nada.
- **"Algo que cabe".** Mesma disposição em toda a escada de larguras, alvo de 43px, linha de 217 caracteres.

## Antes de entregar, na ordem

1. `node --check` no bloco `<script>` — erro de sintaxe deixa a página em branco, e o portão não distingue isso de tela vazia.
2. `node paladira-verificar.js arquivo.html` — precisa sair `0`.
3. Ler os avisos mesmo quando passa. `handlers 2/5` quer dizer que três comportamentos não têm cenário nenhum. Verde não é o mesmo que coberto.
4. Só então apresentar o arquivo.

## Avisos que não bloqueiam mas contam dívida

- `afordância sem ação` — a tela convida a clicar e nada responde. Costuma ser bug de verdade.
- `existe e casa com a tela, mas nenhum passo o dispara` — comportamento sem cobertura.
- `só aparece dando certo` / `rota morta` — cobertura de rota pela metade.
- `não é jornada` / `só tem caminho feliz` — especificação rasa.
- `marcação crua` (modo `estrito`) — elemento com texto ou interação fora do mapa de componentes.
- `desenha o MESMO arranjo em toda a escada` — não respondeu a largura nenhuma.
- `alvo … menor que 44px` / `texto abaixo de 12px` / `linha acima de 75 caracteres`.

Use `--estrito` quando o protótipo for virar implementação: aí aviso vira falha.
