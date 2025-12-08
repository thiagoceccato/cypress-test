// cypress/e2e/debug_ga4.cy.js
// Debug - captura GA4 via spy no sendBeacon e fetch

// Ignora erros de JS do site
Cypress.on('uncaught:exception', () => false);

describe('DEBUG - Capturar GA4 via Spy', () => {
  it('Espia sendBeacon e fetch para pegar requisições GA4', () => {
    const ga4Requests = [];

    cy.visit('https://www.sicredi.com.br/site/cartoes', {
      failOnStatusCode: false,
      timeout: 60000,
      onBeforeLoad(win) {
        // Espia navigator.sendBeacon (usado pelo GA4)
        const originalSendBeacon = win.navigator.sendBeacon.bind(win.navigator);
        win.navigator.sendBeacon = (url, data) => {
          if (url && (url.includes('google') || url.includes('analytics') || url.includes('collect'))) {
            console.log('🎯 SENDBEACON:', url);
            ga4Requests.push({ method: 'sendBeacon', url, data: data ? data.toString() : '' });
          }
          return originalSendBeacon(url, data);
        };

        // Espia fetch
        const originalFetch = win.fetch.bind(win);
        win.fetch = (url, options) => {
          const urlStr = typeof url === 'string' ? url : url.url || '';
          if (urlStr.includes('google') || urlStr.includes('analytics') || urlStr.includes('collect')) {
            console.log('🎯 FETCH:', urlStr);
            ga4Requests.push({ method: 'fetch', url: urlStr });
          }
          return originalFetch(url, options);
        };

        // Espia XMLHttpRequest
        const originalXHROpen = win.XMLHttpRequest.prototype.open;
        win.XMLHttpRequest.prototype.open = function(method, url) {
          if (url && (url.includes('google') || url.includes('analytics') || url.includes('collect'))) {
            console.log('🎯 XHR:', method, url);
            ga4Requests.push({ method: `XHR-${method}`, url });
          }
          return originalXHROpen.apply(this, arguments);
        };
      },
    });

    cy.wait(6000);

    // Aceita cookies
    cy.get('body').then(($body) => {
      const btn = $body.find('button:contains("Permitir")').first();
      if (btn.length) {
        cy.wrap(btn).click({ force: true });
        cy.wait(2000);
      }
    });

    // Mostra requisições capturadas no page load
    cy.then(() => {
      cy.log('════════════════════════════════════════════════════════');
      cy.log(`APÓS PAGE LOAD - Requisições GA: ${ga4Requests.length}`);
      ga4Requests.forEach((r, i) => {
        cy.log(`[${i}] ${r.method}: ${r.url.substring(0, 100)}...`);
      });
    });

    // Clica em algum elemento clicável
    cy.get('a:visible').eq(5).then(($el) => {
      if ($el.length && Cypress.dom.isAttached($el)) {
        const texto = ($el.text() || '').trim().substring(0, 30);
        cy.log(`👆 Clicando em: ${texto}`);
        
        const countAntes = ga4Requests.length;
        
        cy.wrap($el).scrollIntoView();
        cy.wrap($el).invoke('removeAttr', 'target');
        cy.wrap($el).click({ force: true });
        
        cy.wait(3000);
        
        cy.then(() => {
          const novos = ga4Requests.slice(countAntes);
          cy.log('════════════════════════════════════════════════════════');
          cy.log(`APÓS CLIQUE - Novas requisições: ${novos.length}`);
          novos.forEach((r, i) => {
            cy.log(`[${i}] ${r.method}: ${r.url.substring(0, 100)}...`);
          });
        });
      }
    });

    // Resultado final
    cy.then(() => {
      cy.log('════════════════════════════════════════════════════════');
      cy.log(`📊 TOTAL DE REQUISIÇÕES GA: ${ga4Requests.length}`);
      cy.log('════════════════════════════════════════════════════════');

      // Filtra só /g/collect ou /ccm/collect (GA4)
      const ga4Only = ga4Requests.filter(r => 
        r.url.includes('/g/collect') || 
        r.url.includes('/ccm/collect') ||
        r.url.includes('google-analytics')
      );
      cy.log(`🎯 REQUISIÇÕES GA4 específicas: ${ga4Only.length}`);
      
      // Salva
      cy.writeFile('cypress/results/debug_ga4_spy.json', JSON.stringify(ga4Requests, null, 2));

      expect(ga4Requests.length, 'Deve capturar requisições GA').to.be.at.least(1);
    });
  });
});
