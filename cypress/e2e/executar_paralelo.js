// cypress/e2e/executar_paralelo.js
// Executa múltiplos testes Cypress em paralelo
// Execute: node cypress/e2e/executar_paralelo.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuração
const MAX_PARALELO = 3;  // 3 browsers simultâneos
const HEADED = true;     // true = com janela (necessário para sicredi.com.br)
const DIRETORIO = path.join(__dirname, 'paralelo');

async function main() {
  console.log('========================================');
  console.log('  Auditoria GA4 - Execução Paralela');
  console.log('========================================\n');

  // Lista arquivos de teste
  const arquivos = fs.readdirSync(DIRETORIO)
    .filter(f => f.endsWith('.cy.js'))
    .map(f => path.join(DIRETORIO, f));

  if (arquivos.length === 0) {
    console.log('Nenhum arquivo de teste encontrado.');
    console.log('Execute primeiro: node cypress/e2e/gerar_cenarios.js');
    return;
  }

  console.log(`📋 ${arquivos.length} cenários encontrados`);
  console.log(`🔄 Executando ${MAX_PARALELO} em paralelo`);
  console.log(`🖥️  Modo: ${HEADED ? 'HEADED (com janela)' : 'HEADLESS'}\n`);

  const inicio = Date.now();
  const resultados = [];
  let indice = 0;
  let emExecucao = 0;

  function executarProximo() {
    if (indice >= arquivos.length) return;

    const arquivo = arquivos[indice];
    const nome = path.basename(arquivo, '.cy.js');
    indice++;
    emExecucao++;

    console.log(`▶️  [${indice}/${arquivos.length}] Iniciando: ${nome}`);

    const inicioTeste = Date.now();
    
    const args = [
      'cypress', 'run',
      '--spec', arquivo,
      '--browser', 'chrome',
      '--quiet'
    ];
    if (HEADED) args.push('--headed');
    
    const proc = spawn('npx', args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => output += d.toString());

    proc.on('close', (code) => {
      emExecucao--;
      const duracao = ((Date.now() - inicioTeste) / 1000).toFixed(1);
      
      if (code === 0) {
        console.log(`✅ [${nome}] Concluído em ${duracao}s`);
        resultados.push({ nome, status: 'ok', duracao });
      } else {
        console.log(`❌ [${nome}] Falhou em ${duracao}s`);
        resultados.push({ nome, status: 'erro', duracao });
      }

      // Inicia próximo se houver
      if (indice < arquivos.length && emExecucao < MAX_PARALELO) {
        executarProximo();
      }

      // Finaliza quando todos terminarem
      if (emExecucao === 0 && indice >= arquivos.length) {
        finalizarRelatorio(resultados, inicio);
      }
    });

    // Inicia mais se ainda não atingiu o limite
    if (emExecucao < MAX_PARALELO && indice < arquivos.length) {
      executarProximo();
    }
  }

  // Inicia execução
  for (let i = 0; i < Math.min(MAX_PARALELO, arquivos.length); i++) {
    executarProximo();
  }
}

function finalizarRelatorio(resultados, inicio) {
  const duracao = ((Date.now() - inicio) / 1000 / 60).toFixed(1);
  const ok = resultados.filter(r => r.status === 'ok').length;
  const erro = resultados.filter(r => r.status === 'erro').length;

  console.log('\n========================================');
  console.log('  RELATÓRIO FINAL');
  console.log('========================================');
  console.log(`⏱️  Tempo total: ${duracao} minutos`);
  console.log(`✅ Sucesso: ${ok}`);
  console.log(`❌ Falhas: ${erro}`);
  console.log(`📊 Total: ${resultados.length}`);
  console.log('\n📁 Arquivos CSV gerados em: cypress/downloads/');
  
  // Lista CSVs gerados
  const downloads = path.join(__dirname, '..', 'downloads');
  if (fs.existsSync(downloads)) {
    const csvs = fs.readdirSync(downloads).filter(f => f.endsWith('.csv'));
    csvs.forEach(f => console.log(`   - ${f}`));
  }
}

main().catch(console.error);

