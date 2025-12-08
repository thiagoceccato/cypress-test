// cypress/e2e/coleta_cartoes.cy.js
// Coleta GA4 GARANTIDA - escreve CSV INCREMENTALMENTE a cada clique

const { parseGaUrl } = require('./utils/gaHelpers');

const TESTE_URL = 'https://www.sicredi.com.br/site/cartoes';
const TESTE_FLUXO = 'cartoes';
const CSV_PATH = 'cypress/results_novo/cartoes_coleta.csv';

const CSV_HEADER = 'ts,url,page_path,page_title,fluxo,posicao_pagina,elemento_clicado,tipo_elemento,href_destino,possui_data_gtag,tem_ga,tipo_disparo,tid,en,ep.acao,ep.categoria,ep.rotulo';

const SELETOR_CLICAVEIS =
  'a:visible, button:visible, [role="button"]:visible, ' +
  '[data-gtag]:visible, [data-gtm]:visible, .gtag-click-trigger:visible';

Cypress.on('uncaught:exception', () => false);

// Variáveis globais para coleta
let ga4Requests = [];
let totalComGa = 0;
let totalSemGa = 0;

describe('COLETA CARTÕES - GARANTIDA', () => {
  let pageMeta;

  before(() => {
    // Inicializa CSV com header
    cy.writeFile(CSV_PATH, CSV_HEADER + '\n', 'utf8');
    ga4Requests = [];
    totalComGa = 0;
    totalSemGa = 0;
  });

  it('Coleta TODOS os disparos GA4', () => {
    pageMeta = { url: '', page_path: '', page_title: '', fluxo: TESTE_FLUXO };

    // Visita com spy
    cy.visit(TESTE_URL, {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad(win) {
        setupGa4Spy(win);
      },
    });
    
    cy.wait(6000);

    // Metadados
    cy.location().then((loc) => {
      pageMeta.url = loc.href;
      pageMeta.page_path = loc.pathname;
    });
    cy.title().then((t) => { pageMeta.page_title = t; });

    // Registra page_views do load - ESCREVE IMEDIATAMENTE
    cy.then(() => {
      const pageViews = ga4Requests.filter(r => r.parsed?.en === 'page_view');
      cy.log(`✅ Page views no load: ${pageViews.length}`);
      
      pageViews.forEach(pv => {
        const row = buildCsvRow({
          ts: pv.ts,
          ...pageMeta,
          posicao_pagina: 'page_load',
          elemento_clicado: 'page_load',
          tipo_elemento: 'page_load',
          href_destino: '',
          possui_data_gtag: false,
          tem_ga: true,
          ...pv.parsed,
        });
        // ESCREVE IMEDIATAMENTE NO CSV
        cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
        totalComGa++;
      });
    });

    // Aceita cookies
    cy.get('body').then(($body) => {
      const btn = $body.find('button:contains("Permitir")').first();
      if (btn.length) {
        cy.wrap(btn).click({ force: true });
        cy.wait(2000);
      }
    });

    // BLOQUEIA TODAS AS NAVEGAÇÕES na página
    cy.window().then((win) => {
      win.document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    });

    // Pega lista de elementos UMA VEZ
    cy.get(SELETOR_CLICAVEIS).then(($els) => {
      const elementos = [];
      $els.each((i, el) => {
        const $el = Cypress.$(el);
        const tag = ($el.prop('tagName') || '').toLowerCase();
        const texto = ($el.text() || '').replace(/\s+/g, ' ').trim().slice(0, 50);
        const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
        const href = $el.attr('href') || '';
        const posicao = getPosicao($el);
        const possuiGtag = !!$el.attr('data-gtag') || !!$el.attr('data-gtm') || ($el.attr('class') || '').includes('gtag-click-trigger');

        // Pula externos
        if (href && href.startsWith('http') && !href.includes('sicredi.com.br')) {
          return;
        }

        elementos.push({
          index: i,
          tag,
          texto,
          classes,
          href,
          posicao,
          possuiGtag,
          descricao: `${tag}${classes ? '.' + classes : ''}[${texto}]`,
        });
      });

      cy.log(`🔍 Total de elementos a clicar: ${elementos.length}`);

      // Processa cada elemento
      cy.wrap(elementos).each((elem, idx) => {
        cy.get(SELETOR_CLICAVEIS).eq(elem.index).then(($el) => {
          if (!Cypress.dom.isAttached($el)) {
            cy.log(`⏭️ (${idx + 1}) Elemento não anexado, pulando`);
            return;
          }

          const tsClique = new Date().toISOString();
          const hitsAntes = ga4Requests.length;

          // Scroll
          cy.wrap($el).scrollIntoView({ offset: { top: -150, left: 0 } });
          cy.wait(200);

          // Remove target e href temporariamente para não navegar
          const hrefOriginal = $el.attr('href');
          cy.wrap($el).invoke('removeAttr', 'target');
          cy.wrap($el).invoke('removeAttr', 'href');

          // CLICA
          cy.wrap($el).click({ force: true });

          // ESPERA 6 SEGUNDOS (baseado na calibração: máximo foi 5.4s)
          cy.wait(6000);

          // Restaura href
          if (hrefOriginal) {
            cy.wrap($el).invoke('attr', 'href', hrefOriginal);
          }

          // Verifica hits e ESCREVE IMEDIATAMENTE
          cy.then(() => {
            const novosHits = ga4Requests.slice(hitsAntes);
            
            // Procura por clicks_gtag OU qualquer hit com epAcao/epRotulo
            const hitsRelevantes = novosHits.filter(r => 
              r.parsed?.en === 'clicks_gtag' || 
              r.parsed?.epAcao || 
              r.parsed?.epRotulo
            );

            if (hitsRelevantes.length > 0) {
              // TEM GA4!
              hitsRelevantes.forEach(hit => {
                const row = buildCsvRow({
                  ts: tsClique,
                  ...pageMeta,
                  posicao_pagina: elem.posicao,
                  elemento_clicado: elem.descricao,
                  tipo_elemento: elem.tag,
                  href_destino: elem.href,
                  possui_data_gtag: elem.possuiGtag,
                  tem_ga: true,
                  ...hit.parsed,
                });
                // ESCREVE IMEDIATAMENTE NO CSV
                cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
                totalComGa++;
              });
              cy.log(`✅ (${idx + 1}/${elementos.length}) ${elem.texto.substring(0, 25)} → ${hitsRelevantes[0].parsed.epRotulo || hitsRelevantes[0].parsed.en}`);
            } else {
              // SEM GA4
              const row = buildCsvRow({
                ts: tsClique,
                ...pageMeta,
                posicao_pagina: elem.posicao,
                elemento_clicado: elem.descricao,
                tipo_elemento: elem.tag,
                href_destino: elem.href,
                possui_data_gtag: elem.possuiGtag,
                tem_ga: false,
                tipo_disparo: 'sem_ga',
                tid: '',
                en: '',
                epAcao: '',
                epCategoria: '',
                epRotulo: '',
              });
              // ESCREVE IMEDIATAMENTE NO CSV
              cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
              totalSemGa++;
              cy.log(`⚠️ (${idx + 1}/${elementos.length}) ${elem.texto.substring(0, 25)} → sem GA4`);
            }
          });
        });
      });
    });

    // Resumo final
    cy.then(() => {
      cy.log('═══════════════════════════════════════════════════════');
      cy.log(`📊 RESULTADO FINAL`);
      cy.log(`   Com GA4: ${totalComGa}`);
      cy.log(`   Sem GA4: ${totalSemGa}`);
      cy.log(`   Requisições capturadas: ${ga4Requests.length}`);
      cy.log('═══════════════════════════════════════════════════════');
      
      // Salva também JSON com todas as requests para análise
      cy.writeFile('cypress/results_novo/cartoes_ga4_requests.json', JSON.stringify(ga4Requests, null, 2));
    });
  });
});

// ========== FUNÇÕES ==========

function setupGa4Spy(win) {
  const processGaRequest = (url, method) => {
    if (!url) return;
    if (!url.includes('google-analytics') && 
        !url.includes('analytics.google.com') && 
        !url.includes('/g/collect') &&
        !url.includes('/ccm/collect')) {
      return;
    }

    const parsed = parseGaUrl(url);
    if (!parsed || !parsed.tid || parsed.tid.startsWith('AW-')) return;

    ga4Requests.push({ 
      ts: new Date().toISOString(),
      method, 
      parsed,
    });
    
    console.log('🎯 GA4:', parsed.en, parsed.epAcao || '', parsed.epRotulo || '');
  };

  // Espia fetch
  const originalFetch = win.fetch.bind(win);
  win.fetch = (url, options) => {
    processGaRequest(typeof url === 'string' ? url : url?.url || '', 'fetch');
    return originalFetch(url, options);
  };

  // Espia sendBeacon
  const originalSendBeacon = win.navigator.sendBeacon.bind(win.navigator);
  win.navigator.sendBeacon = (url, data) => {
    processGaRequest(url, 'sendBeacon');
    return originalSendBeacon(url, data);
  };

  // Espia XHR
  const originalXHROpen = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function(method, url) {
    processGaRequest(url, `XHR-${method}`);
    return originalXHROpen.apply(this, arguments);
  };
}

function getPosicao($el) {
  if ($el.closest('header').length) return 'header';
  if ($el.closest('footer, .rodape, #rodape').length) return 'rodape';
  if ($el.closest('.hero, .banner, [class*="hero"], [class*="banner"]').length) return 'hero';
  return 'corpo';
}

function sanitize(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvRow(data) {
  return [
    sanitize(data.ts || ''),
    sanitize(data.url || ''),
    sanitize(data.page_path || ''),
    sanitize(data.page_title || ''),
    sanitize(data.fluxo || ''),
    sanitize(data.posicao_pagina || ''),
    sanitize(data.elemento_clicado || ''),
    sanitize(data.tipo_elemento || ''),
    sanitize(data.href_destino || ''),
    sanitize(data.possui_data_gtag),
    sanitize(data.tem_ga),
    sanitize(data.tipo_disparo || ''),
    sanitize(data.tid || ''),
    sanitize(data.en || ''),
    sanitize(data.epAcao || ''),
    sanitize(data.epCategoria || ''),
    sanitize(data.epRotulo || ''),
  ].join(',');
}
