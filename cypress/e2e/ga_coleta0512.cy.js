// cypress/e2e/coleta.cy.js

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

// =========================
// Contexto global
// =========================

let GLOBAL_LAST_CLICK_CONTEXT = null;

// =========================
// Handlers globais de erro
// =========================

Cypress.on('uncaught:exception', (err) => {
  const msg = err && err.message ? err.message : String(err || '');

  const isCrossOrigin =
    msg.includes('Blocked a frame with origin') ||
    msg.includes("Failed to read a named property '$' from 'Window'") ||
    msg.includes('SecurityError') ||
    msg.includes('postMessage');

  const isDuplicateInstance =
    msg.includes("Identifier 'instance' has already been declared");

  if (GLOBAL_LAST_CLICK_CONTEXT && GLOBAL_LAST_CLICK_CONTEXT.type === 'click') {
    console.warn(
      '[GA4-COLETA][UNCAUGHT]',
      msg,
      '\nElemento no momento do erro:',
      GLOBAL_LAST_CLICK_CONTEXT.elemento_clicado
    );
  } else {
    console.warn('[GA4-COLETA][UNCAUGHT]', msg);
  }

  // Para esse tipo de teste, ignoramos *qualquer* erro de JS da página
  // apenas mantendo o log para análise posterior.
  return false;
});

Cypress.on('fail', (error) => {
  const msg = error && error.message ? error.message : String(error || '');

  const ignorable =
    msg.includes('did not fire its load event') ||
    msg.includes('Blocked a frame with origin') ||
    msg.includes("Failed to read a named property '$' from 'Window'") ||
    msg.includes('SecurityError') ||
    msg.includes('postMessage') ||
    msg.includes("Identifier 'instance' has already been declared");

  if (ignorable) {
    if (GLOBAL_LAST_CLICK_CONTEXT && GLOBAL_LAST_CLICK_CONTEXT.type === 'click') {
      console.warn(
        '[GA4-COLETA][FAIL IGNORADO]',
        msg,
        '\nElemento no momento do erro:',
        GLOBAL_LAST_CLICK_CONTEXT.elemento_clicado
      );
    } else {
      console.warn('[GA4-COLETA][FAIL IGNORADO]', msg);
    }
    return false;
  }

  throw error;
});

// =========================
// Teste principal
// =========================

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
      let lastContext;
      let pageMeta;
      let clickResults = {};

      beforeEach(() => {
        lastContext = createPageLoadContext(cenario.nome);
        pageMeta = {
          url: '',
          page_path: '',
          page_title: '',
          page_referrer: '',
          fluxo: cenario.nome,
        };
        clickResults = {};
        GLOBAL_LAST_CLICK_CONTEXT = null;

        cy.intercept({ url: /\/g\/collect/ }, (req) => {
          let hostname;
          try {
            hostname = new URL(req.url).hostname;
          } catch (e) {
            return;
          }
          if (!hostname.includes('google')) return;

          let urlToParse = req.url;
          if (req.method === 'POST' && req.body) {
            const bodyString =
              typeof req.body === 'string'
                ? req.body
                : req.body.toString
                ? req.body.toString()
                : '';
            if (bodyString) {
              const sep = urlToParse.includes('?') ? '&' : '?';
              urlToParse = `${urlToParse}${sep}${bodyString}`;
            }
          }

          const parsed = parseGaUrl(urlToParse);
          if (!parsed || !parsed.tid) return;
          if (parsed.tid.startsWith('AW-')) return; // ignora Google Ads

          const ctx = lastContext || createPageLoadContext(cenario.nome);

          console.log(
            '[GA HIT]',
            parsed.en,
            parsed.tid,
            'ctx.type=',
            ctx.type,
            'ctx.elemento=',
            ctx.elemento_clicado
          );

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
        }).as('gaCollect');
      });

      it('clica em todos elementos clicáveis e coleta hits GA4', () => {
        cy.visit(baseUrl, {
          failOnStatusCode: false,
          timeout: 120000,
        });
        cy.wait(5000);

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

        const textosCookie = [
          'Permitir todos',
          'Permitir Todos',
          'Aceitar todos os cookies',
          'Aceitar Cookies',
          'Aceitar',
        ];

        cy.get('body').then(($body) => {
          textosCookie.forEach((t) => {
            const btn = $body.find(`button:contains("${t}")`).first();
            if (btn.length) {
              cy.wrap(btn).click({ force: true });
            }
          });
        });

        cy.wait(2000);

        cy.get('body').then(($body) => {
          const total = $body.find(SELETOR_CLICAVEIS).length;
          const indices = Array.from({ length: total }, (_, i) => i);

          cy.log(
            `Fluxo ${cenario.nome}: encontrados ${total} elementos clicáveis`
          );

          cy.wrap(indices).each((index) => {
            cy.get(SELETOR_CLICAVEIS)
              .eq(index)
              .then(($el) => {
                if (!Cypress.dom.isAttached($el)) return;

                const clickContext = buildClickContext(
                  $el,
                  cenario.nome,
                  pageMeta
                );
                lastContext = clickContext;
                GLOBAL_LAST_CLICK_CONTEXT = clickContext;

                const clickId = clickContext.id;
                clickResults[clickId] = { hasHit: false };

                const href = $el.attr('href') || '';
                const hrefLower = href.toLowerCase();

                if (
                  hrefLower.startsWith('mailto:') ||
                  hrefLower.startsWith('tel:') ||
                  hrefLower.startsWith('javascript:')
                ) {
                  cy.log(`(${index + 1}) Pulando link especial: ${href}`);
                  return;
                }

                if (
                  hrefLower.startsWith('http') &&
                  !hrefLower.includes('sicredi.com.br')
                ) {
                  cy.log(`(${index + 1}) Pulando link externo: ${href}`);
                  return;
                }

                cy.wrap($el).scrollIntoView({
                  offset: { top: -200, left: 0 },
                });
                cy.wait(300);

                cy.wrap($el).invoke('removeAttr', 'target');

                cy.log(
                  `(${index + 1}) Clicando em: ${clickContext.elemento_clicado}`
                );

                cy.wrap($el)
                  .click({ force: true })
                  .then(() => {
                    cy.wait(2000).then(() => {
                      const state = clickResults[clickId];
                      if (!state || !state.hasHit) {
                        const rowNoGa = buildCsvRowFromClick(
                          clickContext,
                          null
                        );
                        appendCsvRow(rowNoGa);
                      }
                    });
                  })
                  .then(() => {
                    cy.url().then((currentUrl) => {
                      let pathname;
                      try {
                        pathname = new URL(currentUrl).pathname;
                      } catch (e) {
                        return;
                      }

                      if (!pathname.includes(basePathFragment)) {
                        cy.log(
                          `Saí do fluxo (${pathname}), voltando para ${baseUrl}`
                        );
                        lastContext = createPageLoadContext(cenario.nome);
                        GLOBAL_LAST_CLICK_CONTEXT = lastContext;

                        cy.visit(baseUrl, {
                          failOnStatusCode: false,
                          timeout: 120000,
                        });
                        cy.wait(3000);

                        cy.location().then((loc) => {
                          pageMeta.url = loc.href;
                          pageMeta.page_path = loc.pathname + loc.search;
                        });
                        cy.title().then((title) => {
                          pageMeta.page_title = title;
                        });
                        cy.window().then((win) => {
                          pageMeta.page_referrer =
                            win.document.referrer || '';
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

// =========================
// Helpers locais
// =========================

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
  return 'corpo';
}

function buildElementDescription($el) {
  const tag = ($el.prop('tagName') || '').toLowerCase();
  const id = $el.attr('id');
  const classes = ($el.attr('class') || '')
    .split(/\s+/)
    .filter(Boolean)
    .join('.');
  const text = ($el.text() || '').replace(/\s+/g, ' ').trim();
  const textSnippet = text ? text.slice(0, 120) : '';

  let desc = tag || 'elemento';
  if (id) desc += `#${id}`;
  if (classes) desc += `.${classes}`;
  if (textSnippet) desc += ` [text="${textSnippet}"]`;

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
