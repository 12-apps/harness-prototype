#!/usr/bin/env node
/* ============================================================
   PALADIRA · portão de verificação
   ============================================================
   Roda a suíte do protótipo FORA do navegador e devolve código de
   saída. Serve para quem edita o arquivo — humano ou agente — não
   entregar uma tela que já nasce quebrada.

     node paladira-verificar.js paladira-editor-produto.html
     node paladira-verificar.js arquivo.html --estrito

   Saída:
     0  passou
     1  há falhas — NÃO entregue, corrija primeiro
     2  passou mas há avisos, e --estrito estava ligado
     3  o arquivo não pôde ser carregado

   Precisa de jsdom:  npm install jsdom
   ============================================================ */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const arquivo = args.find(a => !a.startsWith("--"));
const estrito = args.includes("--estrito");

if (!arquivo){
  console.error("uso: node paladira-verificar.js <arquivo.html> [--estrito]");
  process.exit(3);
}
if (!fs.existsSync(arquivo)){
  console.error("arquivo não encontrado: " + arquivo);
  process.exit(3);
}

/* ------------------------------------------------------------------
   Motor de layout no portão

   As regras de arranjo por degrau e as medidas físicas (transbordo,
   alvo de toque, tamanho de texto, comprimento de linha) precisam de
   alguém que meça caixas. jsdom não mede: ele resolve o DOM, não o
   layout, e container query nunca casa. Então o portão procura um
   Chromium; achando, roda a suíte lá dentro e TUDO vale. Não achando,
   cai no jsdom e as regras que dependem de medida se declaram não
   verificáveis em vez de aprovar no escuro.
   ------------------------------------------------------------------ */
function acharChromium(){
  const candidatos = [
    process.env.PALADIRA_CHROME,
    "/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"
  ].filter(Boolean);
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  try {
    const achado = execSync("ls -d /root/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | head -1",
      { encoding:"utf8" }).trim();
    if (achado && fs.existsSync(achado)) return achado;
  } catch {}
  return null;
}

function acharPuppeteer(){
  const caminhos = [
    "puppeteer",
    "/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer"
  ];
  for (const c of caminhos){ try { return require(c); } catch {} }
  return null;
}

async function rodarNoNavegador(arquivo, chrome, pptr){
  const b = await pptr.launch({
    headless: "new", executablePath: chrome,
    args:["--no-sandbox","--disable-dev-shm-usage","--font-render-hinting=none"]
  });
  try {
    const pg = await b.newPage();
    await pg.setViewport({ width:1400, height:1000 });
    const erros = [];
    pg.on("pageerror", e => erros.push(String(e.message).split("\n")[0]));
    await pg.goto("file://" + path.resolve(arquivo), { waitUntil:"load" });
    await pg.waitForFunction("window.Paladira && typeof window.Paladira.verifyAll === 'function'", { timeout:20000 });
    const r = await pg.evaluate(async () => {
      const s = await window.Paladira.verifyAll();
      return { ok:s.ok, bad:s.bad, avisos:s.avisos || [], infos:s.infos || [],
               cobertura:s.cobertura || null, relatorio: s.bad ? window.Paladira.relatorio() : "" };
    });
    r.erros = erros;
    return r;
  } finally { await b.close(); }
}

let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch {
  console.error("jsdom não está instalado. Rode:  npm install jsdom");
  process.exit(3);
}

/* navegador primeiro: é o único jeito de as regras de layout valerem */
const chrome = acharChromium();
const pptr = chrome ? acharPuppeteer() : null;

if (chrome && pptr){
  rodarNoNavegador(arquivo, chrome, pptr).then(r => {
    const avisos = r.avisos || [];
    const cob = r.cobertura;
    const linha = `${r.ok} ok · ${r.bad} falhando · ${avisos.length} aviso(s)`
      + (cob ? ` · handlers ${cob.exercitados}/${cob.total}` : "") + "  [navegador]";

    if (r.bad){
      console.error(r.relatorio);
      console.error(`\n✕ NÃO ENTREGUE. ${linha}`);
      process.exit(1);
    }
    console.log(`✓ ${path.basename(arquivo)} — ${linha}`);
    avisos.forEach(a => console.log("  ! " + a));
    (r.infos || []).forEach(i => console.log("  · " + i));
    (r.erros || []).forEach(e => console.log("  ! erro de página: " + e));
    if (avisos.length && estrito){
      console.error("\n✕ --estrito: avisos contam como falha.");
      process.exit(2);
    }
    process.exit(0);
  }).catch(e => {
    console.error("✕ o navegador falhou: " + e.message);
    process.exit(3);
  });
} else {
  viaJsdom();
}

function viaJsdom(){
const html = fs.readFileSync(arquivo, "utf8");
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://paladira.local/" + path.basename(arquivo)
});
const w = dom.window;

/* jsdom não faz layout: sem isto o palco mede 0 e a escala vira NaN */
Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
  get(){ return this.id === "h-stage" ? 1280 : 0; }, configurable: true
});
Object.defineProperty(w.HTMLElement.prototype, "clientHeight", {
  get(){ return this.id === "h-stage" ? 900 : 0; }, configurable: true
});

const erros = [];
w.addEventListener("error", e => erros.push(e.message));

w.addEventListener("load", () => {
  /* os Paladira.on são registrados depois do init, então a suíte só vale
     depois que o script do app terminou — mesma razão do setTimeout lá */
  setTimeout(async () => {
    const P = w.Paladira;
    if (!P || typeof P.verifyAll !== "function"){
      console.error("✕ " + arquivo + " não expõe o harness Paladira — é um protótipo do harness?");
      process.exit(3);
    }

    let r;
    try { r = await P.verifyAll(); }
    catch (e){
      console.error("✕ a verificação estourou: " + e.message);
      process.exit(3);
    }

    const avisos = r.avisos || [];
    const cob = r.cobertura;
    const linha = `${r.ok} ok · ${r.bad} falhando · ${avisos.length} aviso(s)`
      + (cob ? ` · handlers ${cob.exercitados}/${cob.total}` : "");

    if (r.bad){
      console.error(P.relatorio());
      console.error(`\n✕ NÃO ENTREGUE. ${linha}`);
      process.exit(1);
    }

    console.log(`✓ ${path.basename(arquivo)} — ${linha}`);

    if (avisos.length){
      avisos.forEach(a => console.log("  ! " + a));
      if (cob && cob.exercitados < cob.total){
        console.log(`  ! ${cob.total - cob.exercitados} handler(s) sem nenhum passo que os dispare`);
      }
      if (estrito){
        console.error("\n✕ --estrito: avisos contam como falha.");
        process.exit(2);
      }
    }

    if (erros.length){
      console.log("  ! erros de página: " + erros.join("; "));
    }
    process.exit(0);
  }, 0);
});
}
