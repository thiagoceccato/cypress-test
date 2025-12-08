// cypress/e2e/coleta.cy.js
// Coleta GA4 via spy em fetch/sendBeacon (método que funciona!)

const { CENARIOS } = require('./config/cenarios');
const {
  CSV_PATH,
  CSV_HEADER,
  parseGaUrl,
  buildCsvRowFromPageLoad,
  buildCsvRowFromClick,
  appendCsvRow,
  flushCsvBuffer,
} = require('./utils/gaHelpers');

const SELETOR_CLICAVEIS =
  'a:visible, button:visible, [role="button"]:visible, [onclick]:visible, ' +
  '[data-gtag]:visible, [data-gtm]:visible, .gtag-click-trigger:visible, ' +
  'input[type="button"]:visible, input[type="submit"]:visible, area[href]:visible';

// Ignora erros de JS do site
Cypress.on('uncaught:exception', () => false);

Cypress.on('fail', (error) => {
  if (error?.message?.includes('did not fire its load event')) {
    return false;
  }
  throw error;
});

describe('Coleta GA4 - Sicredi', () => {
  before(() => {
    Cypress.config('pageLoadTimeout', 120000);
    cy.writeFile(CSV_PATH, CSV_HEADER, 'utf8');
  });

  afterEach(() => {
    flushCsvBuffer();
  });

  CENARIOS.forEach((cenario) => {
    const baseUrl = cenario.url;
    const basePathFragment = new URL(baseUrl).pathname.replace(/\/$/, '');

    describe(`Fluxo: ${cenario.nome} - ${baseUrl}`, () => {
      let ga4Requests = [];
      let lastContext;
      let pageMeta;
      let clickResults = {};

      beforeEach(() => {
        ga4Requests = [];
        lastContext = createPageLoadContext(cenario.nome);
        pageMeta = {
          url: '',
          page_path: '',
          page_title: '',
          page_referrer: '',
          fluxo: cenario.nome,
        };
        clickResults = {};
      });

      it('clica em todos elementos clicáveis e coleta hits GA4', () => {
        // 1) Visita a página com spy no fetch/sendBeacon
        cy.visit(baseUrl, {
          failOnStatusCode: false,
          timeout: 120000,
          onBeforeLoad(win) {
            setupGa4Spy(win, ga4Requests, () => lastContext, clickResults, pageMeta, appendCsvRow);
          },
        });

        cy.wait(5000);

        // 2) Metadados
        cy.location().then((loc) => {
          pageMeta.url = loc.href;
          pageMeta.page_path = loc.pathname + loc.search;
        });

        cy.title().then((title) => {
          pageMeta.page_title = title;
        });

        cy.window().then((win) => {
          pageMeta.page_referrer = win.document.referrer || '';
        });

        // 3) Aceitar cookies
        cy.get('body').then(($body) => {
          const textosCookie = ['Permitir todos', 'Permitir Todos', 'Aceitar todos os cookies', 'Aceitar Cookies', 'Aceitar'];
          textosCookie.forEach((t) => {
            const btn = $body.find(`button:contains("${t}")`).first();
            if (btn.length) {
              cy.wrap(btn).click({ force: true });
            }
          });
        });

        cy.wait(2000);

        // 4) Loop de cliques
        cy.get('body').then(($body) => {
          const total = $body.find(SELETOR_CLICAVEIS).length;
          const indices = Array.from({ length: total }, (_, i) => i);

          cy.log(`Fluxo ${cenario.nome}: encontrados ${total} elementos clicáveis`);

          cy.wrap(indices).each((index) => {
            cy.get(SELETOR_CLICAVEIS)
              .eq(index)
              .then(($el) => {
                if (!Cypress.dom.isAttached($el)) return;

                const clickContext = buildClickContext($el, cenario.nome, pageMeta);
                lastContext = clickContext;

                const clickId = clickContext.id;
                clickResults[clickId] = { hasHit: false };

                const href = $el.attr('href') || '';

                // Evita links externos
                if (href && href.startsWith('http') && !href.includes('sicredi.com.br')) {
                  cy.log(`(${index + 1}) Pulando link externo: ${href}`);
                  return;
                }

                cy.wrap($el).scrollIntoView({ offset: { top: -200, left: 0 } });
                cy.wait(300);
                cy.wrap($el).invoke('removeAttr', 'target');

                cy.log(`(${index + 1}) Clicando em: ${clickContext.elemento_clicado.substring(0, 60)}`);

                const hitsAntes = ga4Requests.length;

                cy.wrap($el)
                  .click({ force: true })
                  .then(() => {
                    cy.wait(1500).then(() => {
                      const hitsDepois = ga4Requests.length;
                      const state = clickResults[clickId];
                      
                      // Se não capturou hit GA4, registra como sem GA
                      if (!state || !state.hasHit) {
                        const rowNoGa = buildCsvRowFromClick(clickContext, null);
                        appendCsvRow(rowNoGa);
                      }
                    });
                  })
                  .then(() => {
                    // Volta se saiu do fluxo
                    cy.url().then((currentUrl) => {
                      let pathname;
                      try {
                        pathname = new URL(currentUrl).pathname;
                      } catch (e) {
                        return;
                      }

                      if (!pathname.includes(basePathFragment)) {
                        cy.log(`Saí do fluxo (${pathname}), voltando para ${baseUrl}`);
                        lastContext = createPageLoadContext(cenario.nome);
                        
                        cy.visit(baseUrl, {
                          failOnStatusCode: false,
                          timeout: 120000,
                          onBeforeLoad(win) {
                            setupGa4Spy(win, ga4Requests, () => lastContext, clickResults, pageMeta, appendCsvRow);
                          },
                        });
                        cy.wait(3000);

                        cy.location().then((loc) => {
                          pageMeta.url = loc.href;
                          pageMeta.page_path = loc.pathname + loc.search;
                        });
                        cy.title().then((title) => {
                          pageMeta.page_title = title;
                        });
                      }
                    });
                  });
              });
          });
        });
      });
    });
  });
});

/* =========================
 * Spy GA4 - Captura fetch/sendBeacon
 * ========================= */

function setupGa4Spy(win, ga4Requests, getContext, clickResults, pageMeta, appendCsvRow) {
  // Função para processar requisição GA4
  const processGaRequest = (url, method) => {
    if (!url) return;
    
    // Filtra só requisições GA4
    if (!url.includes('google-analytics') && 
        !url.includes('analytics.google.com') && 
        !url.includes('/g/collect') &&
        !url.includes('/ccm/collect')) {
      return;
    }

    const parsed = parseGaUrl(url);
    if (!parsed || !parsed.tid) return;
    if (parsed.tid.startsWith('AW-')) return; // Ignora Google Ads

    ga4Requests.push({ url, method, parsed });

    const ctx = getContext();

    console.log('[GA4 HIT]', parsed.en, parsed.tid, 'ctx=', ctx.type, ctx.elemento_clicado?.substring(0, 40));

    // Hit em contexto de clique
    if (ctx.type === 'click' && typeof ctx.id === 'number') {
      if (!clickResults[ctx.id]) {
        clickResults[ctx.id] = { hasHit: false };
      }
      clickResults[ctx.id].hasHit = true;

      const rowClick = buildCsvRowFromClick(ctx, parsed);
      appendCsvRow(rowClick);
    } else if (parsed.en === 'page_view' || parsed.en === 'pageview') {
      const rowPage = buildCsvRowFromPageLoad(parsed, pageMeta);
      appendCsvRow(rowPage);
    } else {
      // Outros hits (user_engagement, etc)
      const info = {
        url: pageMeta.url,
        page_path: pageMeta.page_path,
        page_title: pageMeta.page_title,
        page_referrer: pageMeta.page_referrer,
        fluxo: pageMeta.fluxo,
        posicao_pagina: ctx.posicao_pagina || 'page_load',
        elemento_clicado: ctx.elemento_clicado || 'page_load',
        tipo_elemento: ctx.tipo_elemento || 'page_load',
        href_destino: ctx.href_destino || '',
        destino_interno_externo: ctx.destino_interno_externo || '',
        abre_nova_aba: ctx.abre_nova_aba ? 'true' : 'false',
        possui_data_gtag: ctx.possui_data_gtag ? 'true' : 'false',
      };
      const rowGeneric = buildCsvRowFromClick(info, parsed);
      appendCsvRow(rowGeneric);
    }
  };

  // Espia fetch
  const originalFetch = win.fetch.bind(win);
  win.fetch = (url, options) => {
    const urlStr = typeof url === 'string' ? url : url?.url || '';
    processGaRequest(urlStr, 'fetch');
    return originalFetch(url, options);
  };

  // Espia sendBeacon
  const originalSendBeacon = win.navigator.sendBeacon.bind(win.navigator);
  win.navigator.sendBeacon = (url, data) => {
    processGaRequest(url, 'sendBeacon');
    return originalSendBeacon(url, data);
  };

  // Espia XMLHttpRequest
  const originalXHROpen = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function(method, url) {
    processGaRequest(url, `XHR-${method}`);
    return originalXHROpen.apply(this, arguments);
  };
}

/* =========================
 * Helpers locais
 * ========================= */

let CLICK_ID_COUNTER = 0;

function nextClickId() {
  CLICK_ID_COUNTER += 1;
  return CLICK_ID_COUNTER;
}

function createPageLoadContext(fluxo) {
  return {
    id: 0,
    type: 'page_load',
    fluxo,
    posicao_pagina: 'page_load',
    elemento_clicado: 'page_load',
    tipo_elemento: 'page_load',
    href_destino: '',
    destino_interno_externo: '',
    abre_nova_aba: false,
    possui_data_gtag: false,
  };
}

function buildClickContext($el, fluxo, pageMeta) {
  const posicao_pagina = getPosicaoPagina($el);
  const elemento_clicado = buildElementDescription($el);
  const tipo_elemento = ($el.prop('tagName') || '').toLowerCase();
  const href_destino = $el.attr('href') || '';
  const destino_interno_externo = classificarDestino(href_destino);
  const abre_nova_aba = $el.attr('target') === '_blank';
  const possui_data_gtag =
    !!$el.attr('data-gtag') ||
    !!$el.attr('data-gtm') ||
    ($el.attr('class') || '').includes('gtag-click-trigger');

  return {
    id: nextClickId(),
    type: 'click',
    fluxo,
    url: pageMeta.url,
    page_path: pageMeta.page_path,
    page_title: pageMeta.page_title,
    page_referrer: pageMeta.page_referrer,
    posicao_pagina,
    elemento_clicado,
    tipo_elemento,
    href_destino,
    destino_interno_externo,
    abre_nova_aba,
    possui_data_gtag,
  };
}

function getPosicaoPagina($el) {
  if ($el.closest('header').length) return 'header';
  if ($el.closest('footer, .rodape, #rodape').length) return 'rodape';
  if ($el.closest('.hero, .banner, [class*="hero"], [class*="banner"]').length) return 'hero';
  return 'corpo';
}

function buildElementDescription($el) {
  const tag = ($el.prop('tagName') || '').toLowerCase();
  const id = $el.attr('id');
  const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean).join('.');
  const text = ($el.text() || '').replace(/\s+/g, ' ').trim();
  const textSnippet = text ? text.slice(0, 40) : '';

  let desc = tag || 'elemento';
  if (id) desc += `#${id}`;
  if (classes) desc += `.${classes}`;
  if (textSnippet) desc += `[${textSnippet}]`;

  return desc;
}

function classificarDestino(href) {
  if (!href) return '';
  if (href.startsWith('http')) {
    const isInterno = href.includes('sicredi.com.br');
    return isInterno ? 'interno_absoluto' : 'externo';
  }
  if (href.startsWith('/')) return 'interno_relativo';
  if (href.startsWith('#')) return 'ancora';
  return 'externo';
}
