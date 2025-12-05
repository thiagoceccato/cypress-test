// cypress/e2e/utils/gaHelpers.js

// Caminho do CSV único da coleta
const CSV_PATH = 'cypress/e2e/ga_coleta.csv';

const CSV_HEADER =
  'url,page_path,page_title,page_referrer,fluxo,posicao_pagina,elemento_clicado,tipo_elemento,href_destino,destino_interno_externo,abre_nova_aba,possui_data_gtag,tem_ga,tipo_disparo,tid,en,ep.acao,ep.categoria,ep.rotulo,ep_raw_json\n';

// Buffer em memória. Intercept só empilha aqui.
// Escrita em disco é feita no teste (afterEach), com flushCsvBuffer().
let CSV_BUFFER = [];

function parseGaUrl(url) {
  if (!url) return null;

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return null;
  }

  const params = urlObj.searchParams;

  const dl = params.get('dl') || '';
  let page_path = '';
  try {
    page_path = dl ? new URL(dl).pathname : '';
  } catch (e) {
    page_path = '';
  }

  const page_title = params.get('dt') || '';
  const page_referrer = params.get('dr') || '';
  const tid = params.get('tid') || '';
  const en = params.get('en') || '';

  let epAcao = '';
  let epCategoria = '';
  let epRotulo = '';
  let epRawJson = '';

  // GA4 com ep JSON (ep={"acao":"...","categoria":"...","rotulo":"..."})
  const epJson = params.get('ep');
  if (epJson) {
    try {
      const decoded = decodeURIComponent(epJson);
      const obj = JSON.parse(decoded);
      epAcao = obj.acao || '';
      epCategoria = obj.categoria || '';
      epRotulo = obj.rotulo || '';
      epRawJson = decoded;
    } catch (e) {
      // ignora erro e tenta formato ep.*
    }
  }

  // Fallback: GA/GA4 com ep.acao / ep.categoria / ep.rotulo
  if (!epAcao && params.get('ep.acao')) epAcao = params.get('ep.acao');
  if (!epCategoria && params.get('ep.categoria'))
    epCategoria = params.get('ep.categoria');
  if (!epRotulo && params.get('ep.rotulo'))
    epRotulo = params.get('ep.rotulo');

  // Se ainda não temos epRawJson, monta JSON com todos ep.*
  if (!epRawJson) {
    const epRaw = {};
    for (const [key, value] of params.entries()) {
      if (key.startsWith('ep.')) {
        epRaw[key] = value;
      }
    }
    if (Object.keys(epRaw).length) {
      epRawJson = JSON.stringify(epRaw);
    }
  }

  let tipo_disparo = '';
  if (en === 'page_view' || en === 'pageview') tipo_disparo = 'pageview';
  else if (en === 'user_engagement' || en === 'engagement')
    tipo_disparo = 'engagement';
  else if (en === 'scroll') tipo_disparo = 'scroll';
  else if (en) tipo_disparo = 'evento_custom';

  return {
    rawUrl: url,
    page_path,
    page_title,
    page_referrer,
    tid,
    en,
    epAcao,
    epCategoria,
    epRotulo,
    epRawJson,
    tipo_disparo,
  };
}

function sanitize(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvRowFromPageLoad(gaEvent, contextoPagina) {
  const url = contextoPagina.url || '';
  const fluxo = contextoPagina.fluxo || '';
  const page_path = gaEvent.page_path || contextoPagina.page_path || '';
  const page_title = gaEvent.page_title || contextoPagina.page_title || '';
  const page_referrer =
    gaEvent.page_referrer || contextoPagina.page_referrer || '';

  return [
    sanitize(url),
    sanitize(page_path),
    sanitize(page_title),
    sanitize(page_referrer),
    sanitize(fluxo),
    'page_load',
    'page_load',
    'page_load',
    '',
    '',
    '',
    'false',
    'true',
    sanitize(gaEvent.tipo_disparo),
    sanitize(gaEvent.tid),
    sanitize(gaEvent.en),
    sanitize(gaEvent.epAcao),
    sanitize(gaEvent.epCategoria),
    sanitize(gaEvent.epRotulo),
    sanitize(gaEvent.epRawJson),
  ].join(',');
}

function buildCsvRowFromClick(info, gaEvent) {
  const tem_ga = !!gaEvent;
  const tipo_disparo = gaEvent ? gaEvent.tipo_disparo : '__no_ga__';
  const tid = gaEvent ? gaEvent.tid : '';
  const en = gaEvent ? gaEvent.en : '';
  const epAcao = gaEvent ? gaEvent.epAcao : '';
  const epCategoria = gaEvent ? gaEvent.epCategoria : '';
  const epRotulo = gaEvent ? gaEvent.epRotulo : '';
  const epRawJson = gaEvent ? gaEvent.epRawJson : '';

  return [
    sanitize(info.url),
    sanitize(info.page_path),
    sanitize(info.page_title),
    sanitize(info.page_referrer),
    sanitize(info.fluxo),
    sanitize(info.posicao_pagina),
    sanitize(info.elemento_clicado),
    sanitize(info.tipo_elemento),
    sanitize(info.href_destino),
    sanitize(info.destino_interno_externo),
    sanitize(info.abre_nova_aba),
    sanitize(info.possui_data_gtag),
    tem_ga ? 'true' : 'false',
    sanitize(tipo_disparo),
    sanitize(tid),
    sanitize(en),
    sanitize(epAcao),
    sanitize(epCategoria),
    sanitize(epRotulo),
    sanitize(epRawJson),
  ].join(',');
}

// Intercept só empilha no buffer
function appendCsvRow(row) {
  CSV_BUFFER.push(row);
}

// Flush chamado no afterEach, em contexto de teste.
function flushCsvBuffer() {
  if (!CSV_BUFFER.length) return;

  const content = CSV_BUFFER.join('\n') + '\n';
  CSV_BUFFER = [];

  cy.writeFile(CSV_PATH, content, {
    flag: 'a+',
    encoding: 'utf8',
    log: false,
  });
}

module.exports = {
  CSV_PATH,
  CSV_HEADER,
  parseGaUrl,
  buildCsvRowFromPageLoad,
  buildCsvRowFromClick,
  appendCsvRow,
  flushCsvBuffer,
};
