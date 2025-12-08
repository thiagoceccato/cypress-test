// GRUPO 1: cartoes + maquininha (26 URLs)
const { parseGaUrl } = require('./utils/gaHelpers');
const { CENARIOS } = require('./config/cenarios');

const GRUPO = 1;
const FILTROS = ['cartoes', 'maquinha-de-cartoes'];
const CENARIOS_GRUPO = CENARIOS.filter(c => FILTROS.includes(c.nome));

const CSV_PATH = `cypress/results_novo/grupo${GRUPO}_coleta.csv`;
const JSON_PATH = `cypress/results_novo/grupo${GRUPO}_requests.json`;
const ESPERA_CLIQUE = 5000;
const IGNORAR_RODAPE = true;
const IGNORAR_HEADER = true;

const CSV_HEADER = 'ts,cenario,url,page_path,page_title,posicao_pagina,elemento_clicado,tipo_elemento,href_destino,possui_data_gtag,tem_ga,tipo_disparo,tid,en,ep.acao,ep.categoria,ep.rotulo';
const SELETOR_CLICAVEIS = 'a:visible, button:visible, [role="button"]:visible, [data-gtag]:visible, [data-gtm]:visible, .gtag-click-trigger:visible';

Cypress.on('uncaught:exception', () => false);

let ga4Requests = [];
let totalComGa = 0;
let totalSemGa = 0;
let cenarioAtual = '';

describe(`GRUPO ${GRUPO} - ${FILTROS.join(', ')} (${CENARIOS_GRUPO.length} URLs)`, () => {
  before(() => {
    cy.writeFile(CSV_PATH, CSV_HEADER + '\n', 'utf8');
    ga4Requests = [];
  });

  after(() => {
    cy.writeFile(JSON_PATH, JSON.stringify(ga4Requests, null, 2));
    cy.log(`GRUPO ${GRUPO} FINALIZADO: ${totalComGa} com GA4, ${totalSemGa} sem GA4`);
  });

  CENARIOS_GRUPO.forEach((cenario, idx) => {
    it(`[${idx + 1}/${CENARIOS_GRUPO.length}] ${cenario.url.split('/').pop()}`, () => {
      processarUrl(cenario);
    });
  });
});

function processarUrl(cenario) {
  cenarioAtual = cenario.nome;
  let pageMeta = { cenario: cenario.nome, url: cenario.url, page_path: '', page_title: '' };

  cy.visit(cenario.url, {
    failOnStatusCode: false,
    timeout: 120000,
    onBeforeLoad(win) { setupGa4Spy(win); },
  });

  cy.wait(4000);
  cy.location().then(loc => { pageMeta.url = loc.href; pageMeta.page_path = loc.pathname; });
  cy.title().then(t => { pageMeta.page_title = t; });

  // Page views
  cy.then(() => {
    ga4Requests.filter(r => r.parsed?.en === 'page_view').slice(-3).forEach(pv => {
      const row = buildCsvRow({ ts: pv.ts, ...pageMeta, posicao_pagina: 'page_load', elemento_clicado: 'page_load', tipo_elemento: 'page_load', href_destino: '', possui_data_gtag: false, tem_ga: true, ...pv.parsed });
      cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
      totalComGa++;
    });
  });

  // Aceitar cookies
  cy.get('body').then($body => {
    const btn = $body.find('button:contains("Permitir")').first();
    if (btn.length) { cy.wrap(btn).click({ force: true }); cy.wait(1500); }
  });

  // Bloquear navegação
  cy.window().then(win => {
    win.document.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (link && link.href) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  });

  // Clicar elementos
  cy.get(SELETOR_CLICAVEIS).then($els => {
    const elementos = [];
    $els.each((i, el) => {
      const $el = Cypress.$(el);
      const posicao = getPosicao($el);
      if (IGNORAR_RODAPE && posicao === 'rodape') return;
      if (IGNORAR_HEADER && posicao === 'header') return;
      const href = $el.attr('href') || '';
      if (href && href.startsWith('http') && !href.includes('sicredi.com.br')) return;

      elementos.push({
        index: i,
        tag: ($el.prop('tagName') || '').toLowerCase(),
        texto: ($el.text() || '').replace(/\s+/g, ' ').trim().slice(0, 50),
        classes: ($el.attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
        href, posicao,
        possuiGtag: !!$el.attr('data-gtag') || !!$el.attr('data-gtm') || ($el.attr('class') || '').includes('gtag-click-trigger'),
      });
    });

    cy.log(`${cenario.nome}: ${elementos.length} elementos`);

    cy.wrap(elementos).each((elem, idx) => {
      cy.get(SELETOR_CLICAVEIS).eq(elem.index).then($el => {
        if (!Cypress.dom.isAttached($el)) return;
        const tsClique = new Date().toISOString();
        const hitsAntes = ga4Requests.length;
        
        cy.wrap($el).scrollIntoView({ offset: { top: -150, left: 0 } });
        cy.wait(150);
        const hrefOriginal = $el.attr('href');
        cy.wrap($el).invoke('removeAttr', 'target').invoke('removeAttr', 'href');
        cy.wrap($el).click({ force: true });
        cy.wait(ESPERA_CLIQUE);
        if (hrefOriginal) cy.wrap($el).invoke('attr', 'href', hrefOriginal);

        cy.then(() => {
          const novosHits = ga4Requests.slice(hitsAntes).filter(r => r.parsed?.en === 'clicks_gtag' || r.parsed?.epAcao || r.parsed?.epRotulo);
          const descricao = `${elem.tag}${elem.classes ? '.' + elem.classes : ''}[${elem.texto}]`;
          
          if (novosHits.length > 0) {
            novosHits.forEach(hit => {
              const row = buildCsvRow({ ts: tsClique, ...pageMeta, posicao_pagina: elem.posicao, elemento_clicado: descricao, tipo_elemento: elem.tag, href_destino: elem.href, possui_data_gtag: elem.possuiGtag, tem_ga: true, ...hit.parsed });
              cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
              totalComGa++;
            });
          } else {
            const row = buildCsvRow({ ts: tsClique, ...pageMeta, posicao_pagina: elem.posicao, elemento_clicado: descricao, tipo_elemento: elem.tag, href_destino: elem.href, possui_data_gtag: elem.possuiGtag, tem_ga: false, tipo_disparo: 'sem_ga', tid: '', en: '', epAcao: '', epCategoria: '', epRotulo: '' });
            cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
            totalSemGa++;
          }
        });
      });
    });
  });
}

function setupGa4Spy(win) {
  const process = (url, method) => {
    if (!url || (!url.includes('google-analytics') && !url.includes('/g/collect') && !url.includes('/ccm/collect'))) return;
    const parsed = parseGaUrl(url);
    if (!parsed || !parsed.tid || parsed.tid.startsWith('AW-')) return;
    ga4Requests.push({ ts: new Date().toISOString(), method, parsed, cenario: cenarioAtual });
  };
  const origFetch = win.fetch.bind(win);
  win.fetch = (url, opt) => { process(typeof url === 'string' ? url : url?.url || '', 'fetch'); return origFetch(url, opt); };
  const origBeacon = win.navigator.sendBeacon.bind(win.navigator);
  win.navigator.sendBeacon = (url, data) => { process(url, 'sendBeacon'); return origBeacon(url, data); };
  const origXHR = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function(m, url) { process(url, `XHR-${m}`); return origXHR.apply(this, arguments); };
}

function getPosicao($el) {
  if ($el.closest('header').length) return 'header';
  if ($el.closest('footer, .rodape, #rodape').length) return 'rodape';
  if ($el.closest('.hero, .banner, [class*="hero"], [class*="banner"]').length) return 'hero';
  return 'corpo';
}

function sanitize(val) {
  if (val == null) return '';
  const str = String(val);
  return str.includes(',') || str.includes('"') || str.includes('\n') ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function buildCsvRow(d) {
  return [d.ts||'',d.cenario||'',d.url||'',d.page_path||'',d.page_title||'',d.posicao_pagina||'',d.elemento_clicado||'',d.tipo_elemento||'',d.href_destino||'',d.possui_data_gtag,d.tem_ga,d.tipo_disparo||'',d.tid||'',d.en||'',d.epAcao||'',d.epCategoria||'',d.epRotulo||''].map(sanitize).join(',');
}




