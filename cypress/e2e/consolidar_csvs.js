// cypress/e2e/consolidar_csvs.js
// Consolida todos os CSVs em um arquivo único

const fs = require('fs');
const path = require('path');

const PASTA_ORIGEM = 'C:/temp/sicredi-audit';
const ARQUIVO_FINAL = 'C:/temp/sicredi-audit/_CONSOLIDADO.csv';

function consolidar() {
  console.log('📊 Consolidando CSVs...\n');

  const arquivos = fs.readdirSync(PASTA_ORIGEM)
    .filter(f => f.endsWith('.csv') && !f.startsWith('_'));

  if (arquivos.length === 0) {
    console.log('❌ Nenhum CSV encontrado em', PASTA_ORIGEM);
    return;
  }

  let header = '';
  let todasLinhas = [];
  let stats = { total: 0, comGA: 0, semGA: 0 };

  arquivos.forEach((arquivo, i) => {
    const caminho = path.join(PASTA_ORIGEM, arquivo);
    const linhas = fs.readFileSync(caminho, 'utf8').split('\n').filter(l => l.trim());

    if (i === 0 && linhas.length > 0) {
      header = linhas[0];
    }

    // Pula header, adiciona dados
    linhas.slice(1).forEach(linha => {
      if (linha.trim()) {
        todasLinhas.push(linha);
        stats.total++;
        if (linha.includes(',Sim,')) {
          stats.comGA++;
        } else {
          stats.semGA++;
        }
      }
    });
  });

  // Ordena por timestamp
  todasLinhas.sort();

  // Escreve arquivo consolidado
  const conteudo = header + '\n' + todasLinhas.join('\n') + '\n';
  fs.writeFileSync(ARQUIVO_FINAL, conteudo, 'utf8');

  console.log('✅ Consolidação completa!\n');
  console.log('📁 Arquivos processados:', arquivos.length);
  console.log('📝 Total de linhas:', stats.total);
  console.log('   ✅ Com GA:', stats.comGA);
  console.log('   ❌ Sem GA:', stats.semGA);
  console.log('\n💾 Arquivo gerado:', ARQUIVO_FINAL);
}

consolidar();

