// cypress/e2e/gerar_apresentacao.js
// Gera apresentação executiva HTML dos resultados da auditoria

const fs = require('fs');
const path = require('path');

const PASTA_CSV = 'C:/temp/sicredi-audit';
const ARQUIVO_HTML = 'C:/temp/sicredi-audit/_APRESENTACAO.html';

function analisarDados() {
  const arquivos = fs.readdirSync(PASTA_CSV)
    .filter(f => f.endsWith('.csv') && !f.startsWith('_'));

  let dados = {
    totalCenarios: arquivos.length,
    totalElementos: 0,
    comGA: 0,
    semGA: 0,
    porCenario: [],
    topAcoes: {},
    topRotulos: {},
    porPosicao: { header: 0, corpo: 0, modal: 0, hero: 0, outros: 0 }
  };

  arquivos.forEach(arquivo => {
    const caminho = path.join(PASTA_CSV, arquivo);
    const linhas = fs.readFileSync(caminho, 'utf8').split('\n').filter(l => l.trim());
    const cenarioNome = arquivo.replace('.csv', '');
    let cenarioComGA = 0, cenarioSemGA = 0;

    linhas.slice(1).forEach(linha => {
      if (!linha.trim()) return;
      dados.totalElementos++;
      
      const cols = linha.split(',');
      const posicao = cols[2] || '';
      const temGA = cols[5] === 'Sim';
      const acao = cols[8] || '';
      const rotulo = cols[9] || '';

      if (temGA) {
        dados.comGA++;
        cenarioComGA++;
        if (acao) dados.topAcoes[acao] = (dados.topAcoes[acao] || 0) + 1;
        if (rotulo) dados.topRotulos[rotulo] = (dados.topRotulos[rotulo] || 0) + 1;
      } else {
        dados.semGA++;
        cenarioSemGA++;
      }

      if (posicao.includes('header')) dados.porPosicao.header++;
      else if (posicao.includes('modal')) dados.porPosicao.modal++;
      else if (posicao.includes('hero')) dados.porPosicao.hero++;
      else if (posicao.includes('corpo')) dados.porPosicao.corpo++;
      else dados.porPosicao.outros++;
    });

    dados.porCenario.push({
      nome: cenarioNome,
      total: cenarioComGA + cenarioSemGA,
      comGA: cenarioComGA,
      semGA: cenarioSemGA,
      cobertura: cenarioComGA + cenarioSemGA > 0 
        ? Math.round((cenarioComGA / (cenarioComGA + cenarioSemGA)) * 100) 
        : 0
    });
  });

  // Ordena top ações
  dados.topAcoesArray = Object.entries(dados.topAcoes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  dados.topRotulosArray = Object.entries(dados.topRotulos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Ordena cenários por cobertura
  dados.cenariosMenorCobertura = [...dados.porCenario]
    .sort((a, b) => a.cobertura - b.cobertura)
    .slice(0, 10);

  dados.cenariosMaiorCobertura = [...dados.porCenario]
    .sort((a, b) => b.cobertura - a.cobertura)
    .slice(0, 10);

  return dados;
}

function gerarHTML(dados) {
  const cobertura = Math.round((dados.comGA / dados.totalElementos) * 100);
  const dataAtual = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', month: 'long', year: 'numeric' 
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auditoria GA4 - Sicredi</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --verde-sicredi: #00A651;
      --verde-escuro: #007A3D;
      --amarelo: #FFD100;
      --cinza-escuro: #1a1a2e;
      --cinza-medio: #2d2d44;
      --branco: #ffffff;
      --vermelho: #e74c3c;
      --laranja: #f39c12;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: linear-gradient(135deg, var(--cinza-escuro) 0%, #0f0f1a 100%);
      color: var(--branco);
      min-height: 100vh;
    }
    
    .slide {
      min-height: 100vh;
      padding: 60px 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    .slide-cover {
      background: linear-gradient(135deg, var(--verde-sicredi) 0%, var(--verde-escuro) 100%);
      text-align: center;
    }
    
    .logo-placeholder {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 40px;
      color: var(--amarelo);
    }
    
    h1 {
      font-size: 3.5rem;
      font-weight: 700;
      margin-bottom: 20px;
    }
    
    h2 {
      font-size: 2.5rem;
      font-weight: 600;
      margin-bottom: 40px;
      color: var(--verde-sicredi);
    }
    
    h3 {
      font-size: 1.5rem;
      font-weight: 500;
      color: rgba(255,255,255,0.7);
    }
    
    .subtitle {
      font-size: 1.5rem;
      opacity: 0.9;
      margin-bottom: 60px;
    }
    
    .date {
      font-size: 1.2rem;
      opacity: 0.7;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 30px;
      margin: 40px 0;
    }
    
    .metric-card {
      background: var(--cinza-medio);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      transition: transform 0.3s;
    }
    
    .metric-card:hover {
      transform: translateY(-5px);
    }
    
    .metric-value {
      font-size: 4rem;
      font-weight: 700;
      color: var(--verde-sicredi);
      line-height: 1;
    }
    
    .metric-value.warning { color: var(--laranja); }
    .metric-value.danger { color: var(--vermelho); }
    
    .metric-label {
      font-size: 1.1rem;
      margin-top: 15px;
      opacity: 0.8;
    }
    
    .progress-bar {
      background: var(--cinza-medio);
      border-radius: 20px;
      height: 40px;
      overflow: hidden;
      margin: 20px 0;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--verde-sicredi), var(--verde-escuro));
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 20px;
      font-weight: 600;
    }
    
    .two-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 40px;
    }
    
    .list-card {
      background: var(--cinza-medio);
      border-radius: 20px;
      padding: 30px;
    }
    
    .list-card h4 {
      font-size: 1.3rem;
      margin-bottom: 20px;
      color: var(--verde-sicredi);
    }
    
    .list-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    .list-item:last-child {
      border-bottom: none;
    }
    
    .list-item .name {
      opacity: 0.9;
      max-width: 70%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .list-item .value {
      font-weight: 600;
      color: var(--verde-sicredi);
    }
    
    .chart-bar {
      display: flex;
      align-items: center;
      margin: 15px 0;
    }
    
    .chart-bar .label {
      width: 100px;
      font-size: 0.9rem;
    }
    
    .chart-bar .bar {
      flex: 1;
      height: 30px;
      background: var(--cinza-escuro);
      border-radius: 15px;
      overflow: hidden;
      margin: 0 15px;
    }
    
    .chart-bar .fill {
      height: 100%;
      background: var(--verde-sicredi);
      border-radius: 15px;
    }
    
    .chart-bar .count {
      width: 50px;
      text-align: right;
      font-weight: 600;
    }
    
    .recommendations {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      margin-top: 40px;
    }
    
    .rec-card {
      background: var(--cinza-medio);
      border-radius: 20px;
      padding: 30px;
      border-left: 4px solid var(--verde-sicredi);
    }
    
    .rec-card.warning { border-left-color: var(--laranja); }
    .rec-card.danger { border-left-color: var(--vermelho); }
    
    .rec-card h4 {
      font-size: 1.2rem;
      margin-bottom: 15px;
    }
    
    .rec-card p {
      opacity: 0.8;
      line-height: 1.6;
    }
    
    .footer {
      text-align: center;
      padding: 40px;
      opacity: 0.5;
      font-size: 0.9rem;
    }
    
    @media print {
      .slide { page-break-after: always; }
    }
  </style>
</head>
<body>

  <!-- SLIDE 1: Capa -->
  <div class="slide slide-cover">
    <div class="logo-placeholder">SICREDI</div>
    <h1>Auditoria de Tracking GA4</h1>
    <p class="subtitle">Análise de Cobertura de Eventos em Elementos Clicáveis</p>
    <p class="date">${dataAtual}</p>
  </div>

  <!-- SLIDE 2: Resumo Executivo -->
  <div class="slide">
    <h2>📊 Resumo Executivo</h2>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">${dados.totalCenarios}</div>
        <div class="metric-label">Páginas Auditadas</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${dados.totalElementos.toLocaleString()}</div>
        <div class="metric-label">Elementos Analisados</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${dados.comGA}</div>
        <div class="metric-label">Com Tracking GA4</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${cobertura < 50 ? 'danger' : cobertura < 70 ? 'warning' : ''}">${cobertura}%</div>
        <div class="metric-label">Cobertura Total</div>
      </div>
    </div>
    
    <h3>Cobertura de Tracking</h3>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${cobertura}%">${cobertura}% coberto</div>
    </div>
  </div>

  <!-- SLIDE 3: Distribuição por Posição -->
  <div class="slide">
    <h2>📍 Distribuição por Posição na Página</h2>
    
    <div style="max-width: 800px; margin: 40px auto;">
      ${Object.entries(dados.porPosicao)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([pos, count]) => `
        <div class="chart-bar">
          <div class="label">${pos.charAt(0).toUpperCase() + pos.slice(1)}</div>
          <div class="bar">
            <div class="fill" style="width: ${(count / dados.totalElementos * 100)}%"></div>
          </div>
          <div class="count">${count}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- SLIDE 4: Top Ações e Rótulos -->
  <div class="slide">
    <h2>🏷️ Principais Eventos Capturados</h2>
    
    <div class="two-columns">
      <div class="list-card">
        <h4>Top 10 Ações (ep.acao)</h4>
        ${dados.topAcoesArray.map(([nome, count]) => `
          <div class="list-item">
            <span class="name">${nome}</span>
            <span class="value">${count}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="list-card">
        <h4>Top 10 Rótulos (ep.rotulo)</h4>
        ${dados.topRotulosArray.map(([nome, count]) => `
          <div class="list-item">
            <span class="name">${nome}</span>
            <span class="value">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- SLIDE 5: Cenários com Menor Cobertura -->
  <div class="slide">
    <h2>⚠️ Páginas que Precisam de Atenção</h2>
    <h3>Menor cobertura de tracking GA4</h3>
    
    <div class="two-columns">
      <div class="list-card">
        <h4>🔴 Menor Cobertura</h4>
        ${dados.cenariosMenorCobertura.map(c => `
          <div class="list-item">
            <span class="name">${c.nome}</span>
            <span class="value" style="color: ${c.cobertura < 30 ? 'var(--vermelho)' : c.cobertura < 50 ? 'var(--laranja)' : 'var(--verde-sicredi)'}">${c.cobertura}%</span>
          </div>
        `).join('')}
      </div>
      
      <div class="list-card">
        <h4>🟢 Maior Cobertura</h4>
        ${dados.cenariosMaiorCobertura.map(c => `
          <div class="list-item">
            <span class="name">${c.nome}</span>
            <span class="value">${c.cobertura}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- SLIDE 6: Recomendações -->
  <div class="slide">
    <h2>💡 Recomendações</h2>
    
    <div class="recommendations">
      <div class="rec-card ${cobertura < 50 ? 'danger' : 'warning'}">
        <h4>📈 Aumentar Cobertura</h4>
        <p>${dados.semGA} elementos (${100 - cobertura}%) não possuem tracking. Priorizar páginas com menor cobertura para implementação de eventos.</p>
      </div>
      
      <div class="rec-card">
        <h4>🎯 Padronizar Nomenclatura</h4>
        <p>Revisar consistência entre ep.acao e ep.rotulo para facilitar análise no GA4 e criação de relatórios.</p>
      </div>
      
      <div class="rec-card">
        <h4>🔄 Monitoramento Contínuo</h4>
        <p>Executar auditoria periodicamente para garantir que novos elementos recebam tracking adequado.</p>
      </div>
    </div>
  </div>

  <!-- SLIDE 7: Próximos Passos -->
  <div class="slide">
    <h2>🚀 Próximos Passos</h2>
    
    <div class="recommendations">
      <div class="rec-card">
        <h4>1️⃣ Análise Detalhada</h4>
        <p>Revisar arquivo CSV consolidado para identificar elementos críticos sem tracking.</p>
      </div>
      
      <div class="rec-card">
        <h4>2️⃣ Implementação</h4>
        <p>Priorizar implementação de tracking nas ${dados.cenariosMenorCobertura.slice(0, 5).map(c => c.nome).join(', ')}.</p>
      </div>
      
      <div class="rec-card">
        <h4>3️⃣ Validação</h4>
        <p>Re-executar auditoria após implementações para validar cobertura.</p>
      </div>
    </div>
  </div>

  <div class="footer">
    Auditoria GA4 - Sicredi | Gerado automaticamente em ${dataAtual}
  </div>

</body>
</html>`;
}

// Executa
console.log('📊 Analisando dados...');
const dados = analisarDados();

console.log('🎨 Gerando apresentação...');
const html = gerarHTML(dados);

fs.writeFileSync(ARQUIVO_HTML, html, 'utf8');
console.log('\n✅ Apresentação gerada!');
console.log('📁 Arquivo:', ARQUIVO_HTML);
console.log('\n💡 Abra no navegador para visualizar');

