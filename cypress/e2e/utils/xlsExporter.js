// cypress/e2e/utils/xlsExporter.js
// Exportador de dados para formato Excel (.xlsx) com escrita incremental

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Colunas do relatório de auditoria GA4
 */
const COLUNAS = [
  { key: 'timestamp', header: 'Timestamp', width: 20 },
  { key: 'url', header: 'URL', width: 50 },
  { key: 'page_path', header: 'Page Path', width: 30 },
  { key: 'page_title', header: 'Título da Página', width: 40 },
  { key: 'page_referrer', header: 'Referrer', width: 30 },
  { key: 'fluxo', header: 'Fluxo', width: 20 },
  { key: 'posicao_pagina', header: 'Posição na Página', width: 18 },
  { key: 'elemento_clicado', header: 'Elemento Clicado', width: 60 },
  { key: 'tipo_elemento', header: 'Tipo Elemento', width: 15 },
  { key: 'href_destino', header: 'Href Destino', width: 50 },
  { key: 'destino_interno_externo', header: 'Interno/Externo', width: 18 },
  { key: 'abre_nova_aba', header: 'Nova Aba?', width: 12 },
  { key: 'possui_data_gtag', header: 'Data GTM/GTAG?', width: 15 },
  { key: 'tem_ga', header: 'Tem GA?', width: 10 },
  { key: 'tipo_disparo', header: 'Tipo Disparo', width: 15 },
  { key: 'tid', header: 'Tracking ID', width: 18 },
  { key: 'en', header: 'Event Name', width: 20 },
  { key: 'ep_acao', header: 'EP Ação', width: 25 },
  { key: 'ep_categoria', header: 'EP Categoria', width: 25 },
  { key: 'ep_rotulo', header: 'EP Rótulo', width: 25 },
  { key: 'ep_raw_json', header: 'EP Raw JSON', width: 50 },
];

/**
 * Header CSV para compatibilidade
 */
const CSV_HEADER = COLUNAS.map((c) => c.header).join(',') + '\n';

/**
 * Sanitiza valor para CSV
 */
function sanitize(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Converte dados para formato de objeto padronizado
 */
function formatRowData(ctx, gaEvent) {
  return {
    timestamp: new Date().toISOString(),
    url: ctx.url || '',
    page_path: ctx.page_path || '',
    page_title: ctx.page_title || '',
    page_referrer: ctx.page_referrer || '',
    fluxo: ctx.fluxo || '',
    posicao_pagina: ctx.posicao_pagina || '',
    elemento_clicado: ctx.elemento_clicado || '',
    tipo_elemento: ctx.tipo_elemento || '',
    href_destino: ctx.href_destino || '',
    destino_interno_externo: ctx.destino_interno_externo || '',
    abre_nova_aba: ctx.abre_nova_aba ? 'Sim' : 'Não',
    possui_data_gtag: ctx.possui_data_gtag ? 'Sim' : 'Não',
    tem_ga: gaEvent ? 'Sim' : 'Não',
    tipo_disparo: gaEvent ? gaEvent.tipo_disparo : '__no_ga__',
    tid: gaEvent ? gaEvent.tid : '',
    en: gaEvent ? gaEvent.en : '',
    ep_acao: gaEvent ? gaEvent.epAcao : '',
    ep_categoria: gaEvent ? gaEvent.epCategoria : '',
    ep_rotulo: gaEvent ? gaEvent.epRotulo : '',
    ep_raw_json: gaEvent ? gaEvent.epRawJson : '',
  };
}

/**
 * Converte objeto de dados para linha CSV
 */
function rowToCSV(rowData) {
  return COLUNAS.map((col) => sanitize(rowData[col.key])).join(',');
}

/**
 * Cria arquivo Excel inicial com headers
 */
function initExcelFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const wb = XLSX.utils.book_new();
  const headers = [COLUNAS.map((c) => c.header)];
  const ws = XLSX.utils.aoa_to_sheet(headers);
  ws['!cols'] = COLUNAS.map((col) => ({ wch: col.width }));
  XLSX.utils.book_append_sheet(wb, ws, 'Auditoria GA4');

  XLSX.writeFile(wb, filePath);
  return filePath;
}

/**
 * Adiciona linha ao arquivo Excel existente
 */
function appendToExcel(filePath, rowData) {
  try {
    if (!fs.existsSync(filePath)) {
      initExcelFile(filePath);
    }

    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Auditoria GA4'];

    // Pega range atual
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const newRow = range.e.r + 1;

    // Adiciona nova linha
    const rowArray = COLUNAS.map((col) => {
      const val = rowData[col.key];
      if (val === null || val === undefined) return '';
      return val;
    });

    XLSX.utils.sheet_add_aoa(ws, [rowArray], { origin: newRow });

    // Salva
    XLSX.writeFile(wb, filePath);
    return true;
  } catch (err) {
    console.error('Erro ao escrever Excel:', err.message);
    return false;
  }
}

/**
 * Adiciona múltiplas linhas ao arquivo Excel
 */
function appendMultipleToExcel(filePath, rowsData) {
  try {
    if (!fs.existsSync(filePath)) {
      initExcelFile(filePath);
    }

    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Auditoria GA4'];

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const newRow = range.e.r + 1;

    const rowsArray = rowsData.map((rowData) =>
      COLUNAS.map((col) => {
        const val = rowData[col.key];
        if (val === null || val === undefined) return '';
        return val;
      })
    );

    XLSX.utils.sheet_add_aoa(ws, rowsArray, { origin: newRow });
    XLSX.writeFile(wb, filePath);
    return true;
  } catch (err) {
    console.error('Erro ao escrever Excel:', err.message);
    return false;
  }
}

/**
 * Adiciona aba de resumo ao arquivo Excel
 */
function addSummaryToExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;

    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Auditoria GA4'];

    // Lê dados
    const data = XLSX.utils.sheet_to_json(ws);
    if (!data.length) return false;

    const totalElementos = data.length;
    const comGA = data.filter((d) => d['Tem GA?'] === 'Sim').length;
    const semGA = totalElementos - comGA;

    // Contagens
    const tiposDisparo = {};
    const posicoes = {};
    const tiposElemento = {};

    data.forEach((d) => {
      const tipo = d['Tipo Disparo'] || 'sem_disparo';
      tiposDisparo[tipo] = (tiposDisparo[tipo] || 0) + 1;

      const pos = d['Posição na Página'] || 'desconhecido';
      posicoes[pos] = (posicoes[pos] || 0) + 1;

      const tipoEl = d['Tipo Elemento'] || 'desconhecido';
      tiposElemento[tipoEl] = (tiposElemento[tipoEl] || 0) + 1;
    });

    const summaryData = [
      ['RESUMO DA AUDITORIA GA4'],
      ['Data/Hora', new Date().toISOString()],
      [''],
      ['Estatísticas Gerais'],
      ['Total de Elementos Clicáveis', totalElementos],
      ['Elementos COM evento GA4', comGA],
      ['Elementos SEM evento GA4', semGA],
      ['Taxa de Cobertura GA4', `${((comGA / totalElementos) * 100).toFixed(1)}%`],
      [''],
      ['Distribuição por Tipo de Disparo'],
      ...Object.entries(tiposDisparo).map(([tipo, qtd]) => [tipo, qtd]),
      [''],
      ['Distribuição por Posição na Página'],
      ...Object.entries(posicoes).map(([pos, qtd]) => [pos, qtd]),
      [''],
      ['Distribuição por Tipo de Elemento'],
      ...Object.entries(tiposElemento).map(([tipo, qtd]) => [tipo, qtd]),
    ];

    // Remove aba existente se houver
    if (wb.Sheets['Resumo']) {
      const idx = wb.SheetNames.indexOf('Resumo');
      wb.SheetNames.splice(idx, 1);
      delete wb.Sheets['Resumo'];
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

    XLSX.writeFile(wb, filePath);
    return true;
  } catch (err) {
    console.error('Erro ao adicionar resumo:', err.message);
    return false;
  }
}

module.exports = {
  COLUNAS,
  CSV_HEADER,
  sanitize,
  formatRowData,
  rowToCSV,
  initExcelFile,
  appendToExcel,
  appendMultipleToExcel,
  addSummaryToExcel,
};
