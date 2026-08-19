#!/usr/bin/env node
/* Regenera catalogo/ a partir do @12-apps/ui instalado.
   O catálogo é gerado porque escrever 128 caminhos de import à mão é
   como um nome errado entra na especificação. */
const fs = require("fs");
const path = require("path");

const pkgPath = require.resolve("@12-apps/ui/package.json", { paths: [process.cwd()] });
const pkg = require(pkgPath);
const saida = path.join(__dirname, "..", "catalogo");

const linhas = Object.keys(pkg.exports || {})
  .filter(k => k !== ".")
  .map(k => {
    const partes = k.split("/");
    return { nome: partes[partes.length - 1], grupo: partes[1], imp: "@12-apps/ui" + k.slice(1) };
  });

const cat = {};
linhas.forEach(r => { if (!cat[r.nome]) cat[r.nome] = r.imp; });

fs.writeFileSync(path.join(saida, "paladira-ui-catalogo.js"),
  `/* Catálogo de @12-apps/ui@${pkg.version} — gerado por scripts/gerar-catalogo.js.\n`
  + `   ${Object.keys(cat).length} componentes. Não edite à mão. */\n`
  + `window.PALADIRA_UI = ${JSON.stringify(cat, null, 2)};\n`);

const porGrupo = {};
linhas.forEach(r => (porGrupo[r.grupo] = porGrupo[r.grupo] || []).push(r));
let md = `# @12-apps/ui@${pkg.version} — catálogo\n\nGerado de package.json. ${linhas.length} entradas.\n`;
Object.keys(porGrupo).sort().forEach(g => {
  md += `\n## ${g}\n\n`;
  porGrupo[g].sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach(r => { md += `- \`${r.nome}\` — \`${r.imp}\`\n`; });
});
fs.writeFileSync(path.join(saida, "paladira-ui-catalogo.md"), md);

console.log(`catálogo gerado: ${Object.keys(cat).length} componentes de @12-apps/ui@${pkg.version}`);
console.log("obs: paladira-ui-interacoes.* é classificação curada — revise à mão quando a lib mudar.");
