// cypress/e2e/teste_rapido.cy.js
// Teste rápido para validar coleta GA4 (apenas 1 URL)

const {
  CSV_PATH,
  CSV_HEADER,
  parseGaUrl,
  buildCsvRowFromPageLoad,
  buildCsvRowFromClick,
  appendCsvRow,
  flushCsvBuffer,
} = require('./utils/gaHelpers');

const TESTE_URL = 'https://www.sicredi.com.br/site/cartoes';
const TESTE_FLUXO = 'cartoes-teste';

// Ignora erros de JS do site
Cypress.on('uncaught:exception', () => false);

describe('TESTE RÁPIDO - Coleta GA4', () => {
  let ga4Requests = [];
  let lastContext;
  let pageMeta;
  let clickResults = {};

  before(() => {
    cy.writeFile('cypress/results/teste_rapido.csv', CSV_HEADER, 'utf8');
  });

  beforeEach(() => {
    ga4Requests = [];
    lastContext = { type: 'page_load', fluxo: TESTE_FLUXO, id: 0 };
    pageMeta = { url: '', page_path: '', page_title: '', page_referrer: '', fluxo: TESTE_FLUXO };
    clickResults = {};
  });

  afterEach(() => {
    flushCsvBuffer();
  });

  it('Carrega página e clica em 5 elementos gtag', () => {
    cy.visit(TESTE_URL, {
      failOnStatusCode: false,
      timeout: 60000,
      onBeforeLoad(win) {
        setupGa4Spy(win);
      },
    });

    cy.wait(5000);

    // Metadados
    cy.location().then((loc) => {
      pageMeta.url = loc.href;
      pageMeta.page_path = loc.pathname;
    });
    cy.title().then((t) => { pageMeta.page_title = t; });

    // Mostra page_views capturados
    cy.then(() => {
      const pageViews = ga4Requests.filter(r => r.parsed?.en === 'page_view');
      cy.log(`✅ Page views capturados: ${pageViews.length}`);
      pageViews.forEach(pv => {
        cy.log(`   TID: ${pv.parsed.tid}`);
      });
    });

    // Aceita cookies
    cy.get('body').then(($body) => {
      const btn = $body.find('button:contains("Permitir")').first();
      if (btn.length) {
        cy.wrap(btn).click({ force: true });
        cy.wait(1000);
      }
    });

    // Clica em até 5 elementos com gtag-click-trigger
    cy.get('body').then(($body) => {
      const gtagElements = $body.find('.gtag-click-trigger:visible').slice(0, 5);
      const total = gtagElements.length;

      cy.log(`🔍 Encontrados ${total} elementos gtag-click-trigger`);

      if (total === 0) {
        cy.log('⚠️ Nenhum elemento encontrado');
        return;
      }

      cy.wrap(Array.from({ length: total }, (_, i) => i)).each((index) => {
        cy.get('.gtag-click-trigger:visible').eq(index).then(($el) => {
          if (!Cypress.dom.isAttached($el)) return;

          const texto = ($el.text() || '').trim().slice(0, 40);
          const tag = ($el.prop('tagName') || '').toLowerCase();
          
          lastContext = {
            id: index + 1,
            type: 'click',
            fluxo: TESTE_FLUXO,
            url: pageMeta.url,
            page_path: pageMeta.page_path,
            page_title: pageMeta.page_title,
            page_referrer: '',
            posicao_pagina: 'corpo',
            elemento_clicado: `${tag}.gtag-click-trigger[${texto}]`,
            tipo_elemento: tag,
            href_destino: $el.attr('href') || '',
            destino_interno_externo: '',
            abre_nova_aba: false,
            possui_data_gtag: true,
          };
          clickResults[index + 1] = { hasHit: false };

          cy.log(`👆 (${index + 1}/${total}) Clicando: ${texto || tag}`);
          
          cy.wrap($el).scrollIntoView({ offset: { top: -150, left: 0 } });
          cy.wait(200);
          cy.wrap($el).invoke('removeAttr', 'target');
          
          const hitsAntes = ga4Requests.length;
          
          cy.wrap($el).click({ force: true });
          cy.wait(1500);

          cy.then(() => {
            const novosHits = ga4Requests.slice(hitsAntes).filter(r => 
              r.parsed?.en === 'clicks_gtag' || r.parsed?.en?.includes('click')
            );
            
            if (novosHits.length > 0) {
              clickResults[index + 1].hasHit = true;
              cy.log(`✅ Hit GA4 capturado: ${novosHits[0].parsed.epRotulo || novosHits[0].parsed.en}`);
              appendCsvRow(buildCsvRowFromClick(lastContext, novosHits[0].parsed));
            } else {
              cy.log(`⚠️ Nenhum hit GA4 para: ${texto}`);
              appendCsvRow(buildCsvRowFromClick(lastContext, null));
            }
          });

          // Volta se navegou
          cy.url().then((currentUrl) => {
            if (!currentUrl.includes('/site/cartoes')) {
              cy.visit(TESTE_URL, {
                failOnStatusCode: false,
                onBeforeLoad(win) { setupGa4Spy(win); }
              });
              cy.wait(2000);
            }
          });
        });
      });
    });

    // Resumo final
    cy.then(() => {
      cy.log('═══════════════════════════════════════');
      cy.log(`📊 TOTAL: ${ga4Requests.length} requisições GA4`);
      
      const porTipo = {};
      ga4Requests.forEach(r => {
        const en = r.parsed?.en || 'unknown';
        porTipo[en] = (porTipo[en] || 0) + 1;
      });
      
      Object.entries(porTipo).forEach(([tipo, qtd]) => {
        cy.log(`   - ${tipo}: ${qtd}`);
      });
      cy.log('═══════════════════════════════════════');

      // Salva JSON de debug
      cy.writeFile('cypress/results/teste_rapido_debug.json', JSON.stringify(ga4Requests.map(r => ({
        method: r.method,
        en: r.parsed?.en,
        tid: r.parsed?.tid,
        acao: r.parsed?.epAcao,
        rotulo: r.parsed?.epRotulo,
      })), null, 2));
    });
  });

  // Função de spy
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

      ga4Requests.push({ url, method, parsed });
      console.log('🎯 GA4:', parsed.en, parsed.tid, parsed.epAcao || '', parsed.epRotulo || '');
    };

    const originalFetch = win.fetch.bind(win);
    win.fetch = (url, options) => {
      processGaRequest(typeof url === 'string' ? url : url?.url || '', 'fetch');
      return originalFetch(url, options);
    };

    const originalSendBeacon = win.navigator.sendBeacon.bind(win.navigator);
    win.navigator.sendBeacon = (url, data) => {
      processGaRequest(url, 'sendBeacon');
      return originalSendBeacon(url, data);
    };
  }
});
