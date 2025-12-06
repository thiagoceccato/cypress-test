// cypress/e2e/teste_debug_ga4.cy.js
// Teste de DEBUG para validar captura de eventos GA4
// Usa múltiplas estratégias: intercept, dataLayer, stub do sendBeacon

const XLS_FILE = 'cypress/downloads/debug_ga4_teste.xlsx';
const CSV_FILE = 'cypress/downloads/debug_ga4_teste.csv';

Cypress.on('uncaught:exception', () => false);

describe('DEBUG - Captura GA4 no botão Abrir Conta', () => {
  let ga4Hits = [];
  let dataLayerPushes = [];

  before(() => {
    cy.task('initExcel', { filePath: XLS_FILE });
    const header = 'timestamp,source,elemento,en,tid,ep_acao,ep_categoria,ep_rotulo,raw_data\n';
    cy.writeFile(CSV_FILE, header);
  });

  after(() => {
    cy.log(`📊 Hits GA4 interceptados: ${ga4Hits.length}`);
    cy.log(`📊 DataLayer pushes: ${dataLayerPushes.length}`);
    cy.task('addExcelSummary', { filePath: XLS_FILE });
  });

  it('Captura evento GA4 ao clicar em "Abrir conta"', () => {
    // Estratégia 1: Intercepta requests HTTP (GET e POST)
    cy.intercept({ url: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/i }, (req) => {
      const parsed = parseGa4Url(req.url + (req.body ? '&' + req.body : ''));
      if (parsed && parsed.tid) {
        ga4Hits.push({ ...parsed, source: 'intercept', method: req.method });
        console.log('[INTERCEPT]', req.method, parsed.en, parsed.epAcao);
      }
      req.continue();
    }).as('ga');

    // Visita com onBeforeLoad para monitorar dataLayer e sendBeacon
    cy.visit('https://www.sicredi.com.br/site/seja-associado/', {
      failOnStatusCode: false,
      timeout: 60000,
      onBeforeLoad(win) {
        // Estratégia 2: Stub navigator.sendBeacon
        const originalSendBeacon = win.navigator.sendBeacon;
        win.navigator.sendBeacon = function (url, data) {
          console.log('[SENDBEACON]', url);
          if (url && (url.includes('google-analytics') || url.includes('analytics.google'))) {
            const parsed = parseGa4Url(url + (data ? '&' + data : ''));
            if (parsed && parsed.tid) {
              ga4Hits.push({ ...parsed, source: 'sendBeacon' });
              console.log('[BEACON HIT]', parsed.en, parsed.epAcao);
            }
          }
          return originalSendBeacon.apply(this, arguments);
        };

        // Estratégia 3: Monitora dataLayer
        win.dataLayer = win.dataLayer || [];
        const originalPush = win.dataLayer.push;
        win.dataLayer.push = function (...args) {
          args.forEach((item) => {
            if (item && typeof item === 'object') {
              dataLayerPushes.push({
                timestamp: new Date().toISOString(),
                data: JSON.stringify(item).slice(0, 500),
              });
              console.log('[DATALAYER]', JSON.stringify(item).slice(0, 200));

              // Se for um evento gtag
              if (item.event || item[0] === 'event') {
                const eventData = {
                  source: 'dataLayer',
                  en: item.event || item[1] || '',
                  epAcao: item.acao || item.ep?.acao || '',
                  epCategoria: item.categoria || item.ep?.categoria || '',
                  epRotulo: item.rotulo || item.ep?.rotulo || '',
                  tid: '',
                  epRawJson: JSON.stringify(item),
                };
                ga4Hits.push(eventData);
              }
            }
          });
          return originalPush.apply(this, args);
        };

        // Estratégia 4: Intercepta XMLHttpRequest
        const originalXHR = win.XMLHttpRequest.prototype.open;
        win.XMLHttpRequest.prototype.open = function (method, url) {
          if (url && (url.includes('google-analytics') || url.includes('analytics.google'))) {
            console.log('[XHR]', method, url);
            const parsed = parseGa4Url(url);
            if (parsed && parsed.tid) {
              ga4Hits.push({ ...parsed, source: 'xhr', method });
            }
          }
          return originalXHR.apply(this, arguments);
        };

        // Estratégia 5: Intercepta fetch
        const originalFetch = win.fetch;
        win.fetch = function (url, options) {
          const urlStr = typeof url === 'string' ? url : url?.url || '';
          if (urlStr.includes('google-analytics') || urlStr.includes('analytics.google')) {
            console.log('[FETCH]', urlStr);
            const parsed = parseGa4Url(urlStr);
            if (parsed && parsed.tid) {
              ga4Hits.push({ ...parsed, source: 'fetch' });
            }
          }
          return originalFetch.apply(this, arguments);
        };

        // Estratégia 6: Monitora gtag direto
        win.gtag = win.gtag || function () {};
        const originalGtag = win.gtag;
        win.gtag = function (...args) {
          console.log('[GTAG]', JSON.stringify(args).slice(0, 200));
          if (args[0] === 'event') {
            ga4Hits.push({
              source: 'gtag',
              en: args[1] || '',
              epAcao: args[2]?.acao || args[2]?.ep?.acao || '',
              epCategoria: args[2]?.categoria || args[2]?.ep?.categoria || '',
              epRotulo: args[2]?.rotulo || args[2]?.ep?.rotulo || '',
              tid: '',
              epRawJson: JSON.stringify(args),
            });
          }
          return originalGtag.apply(this, args);
        };
      },
    });

    cy.wait(5000);

    // Log do estado atual
    cy.then(() => {
      cy.log(`📄 Após page load: ${ga4Hits.length} hits, ${dataLayerPushes.length} dataLayer`);
    });

    // Aceita cookies
    cy.get('body').then(($body) => {
      ['Aceitar', 'Permitir', 'OK', 'Concordo'].forEach((txt) => {
        const btn = $body.find(`button:contains("${txt}")`).first();
        if (btn.length) {
          cy.wrap(btn).click({ force: true });
        }
      });
    });

    cy.wait(1500);

    // Encontra e clica no botão "Abrir conta"
    cy.contains('a, button', 'Abrir conta', { timeout: 10000 })
      .first()
      .scrollIntoView()
      .then(($btn) => {
        const elementoDesc = `${$btn.prop('tagName').toLowerCase()}[${$btn.text().trim()}]`;
        cy.log(`🎯 Elemento: ${elementoDesc}`);
        cy.log(`🔗 Href: ${$btn.attr('href') || 'N/A'}`);
        cy.log(`📍 Classes: ${$btn.attr('class')}`);

        const hitsBefore = ga4Hits.length;
        const dlBefore = dataLayerPushes.length;

        $btn.removeAttr('target');
        cy.wrap($btn).click({ force: true });

        cy.wait(3000).then(() => {
          const newHits = ga4Hits.slice(hitsBefore);
          const newDL = dataLayerPushes.slice(dlBefore);

          cy.log(`🔥 Novos hits após clique: ${newHits.length}`);
          cy.log(`🔥 Novos dataLayer após clique: ${newDL.length}`);

          // Mostra novos hits
          if (newHits.length > 0) {
            newHits.forEach((hit, i) => {
              cy.log(`✅ Hit ${i + 1} (${hit.source}):`);
              cy.log(`   en: ${hit.en}`);
              cy.log(`   ep.acao: ${hit.epAcao}`);
              cy.log(`   ep.rotulo: ${hit.epRotulo}`);

              // Salva no CSV
              const csvLine = [
                new Date().toISOString(),
                hit.source,
                elementoDesc,
                hit.en,
                hit.tid,
                hit.epAcao,
                hit.epCategoria,
                hit.epRotulo,
                `"${(hit.epRawJson || '').replace(/"/g, '""').slice(0, 200)}"`,
              ].join(',') + '\n';
              cy.writeFile(CSV_FILE, csvLine, { flag: 'a+' });

              // Salva no Excel
              cy.task('appendExcelRow', {
                filePath: XLS_FILE,
                rowData: {
                  timestamp: new Date().toISOString(),
                  url: 'https://www.sicredi.com.br/site/seja-associado/',
                  page_path: '/site/seja-associado/',
                  page_title: '',
                  page_referrer: '',
                  fluxo: 'debug',
                  posicao_pagina: 'header',
                  elemento_clicado: elementoDesc,
                  tipo_elemento: $btn.prop('tagName').toLowerCase(),
                  href_destino: $btn.attr('href') || '',
                  destino_interno_externo: 'interno',
                  abre_nova_aba: 'Não',
                  possui_data_gtag: 'N/A',
                  tem_ga: 'Sim',
                  tipo_disparo: hit.en,
                  tid: hit.tid,
                  en: hit.en,
                  ep_acao: hit.epAcao,
                  ep_categoria: hit.epCategoria,
                  ep_rotulo: hit.epRotulo,
                  ep_raw_json: hit.epRawJson || '',
                },
              });
            });
          } else {
            cy.log('❌ Nenhum novo hit após clique');
          }

          // Mostra dataLayer pushes
          if (newDL.length > 0) {
            cy.log('📋 DataLayer pushes:');
            newDL.forEach((dl, i) => {
              cy.log(`  ${i + 1}. ${dl.data.slice(0, 100)}`);
              cy.writeFile(CSV_FILE, `dataLayer,${dl.data.slice(0, 200)}\n`, { flag: 'a+' });
            });
          }
        });
      });

    // Resumo final
    cy.then(() => {
      cy.log('========== RESUMO FINAL ==========');
      cy.log(`Total hits: ${ga4Hits.length}`);
      cy.log(`Total dataLayer: ${dataLayerPushes.length}`);

      // Por fonte
      const bySource = {};
      ga4Hits.forEach((h) => {
        bySource[h.source] = (bySource[h.source] || 0) + 1;
      });
      cy.log('Por fonte:');
      Object.entries(bySource).forEach(([src, count]) => {
        cy.log(`  ${src}: ${count}`);
      });

      // Escreve resumo
      cy.writeFile(CSV_FILE, `\n# Total: ${ga4Hits.length} hits\n`, { flag: 'a+' });
      cy.writeFile(CSV_FILE, `# Por fonte: ${JSON.stringify(bySource)}\n`, { flag: 'a+' });
    });
  });
});

function parseGa4Url(url) {
  if (!url) return null;
  try {
    let params;
    try {
      params = new URL(url).searchParams;
    } catch (e) {
      const q = url.indexOf('?');
      if (q === -1) return null;
      params = new URLSearchParams(url.slice(q + 1));
    }

    const tid = params.get('tid') || '';
    if (!tid || tid.startsWith('AW-')) return null;

    return {
      tid,
      en: params.get('en') || '',
      page_title: params.get('dt') || '',
      epAcao: params.get('ep.acao') || '',
      epCategoria: params.get('ep.categoria') || '',
      epRotulo: params.get('ep.rotulo') || '',
      epRawJson: (() => {
        const ep = {};
        for (const [k, v] of params.entries()) {
          if (k.startsWith('ep.')) ep[k] = v;
        }
        return Object.keys(ep).length ? JSON.stringify(ep) : '';
      })(),
    };
  } catch (e) {
    return null;
  }
}
