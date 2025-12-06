// cypress/e2e/utils/auditoriaCore.js
// Módulo core para auditoria GA4 - Reutilizável por todos os cenários

const { parseGaUrl } = require('./gaHelpers');

// Seletor para elementos clicáveis
const SELETOR_CLICAVEIS =
  'a:visible, button:visible, [role="button"]:visible, [onclick]:visible, ' +
  '[data-gtag]:visible, [data-gtm]:visible, .gtag-click-trigger:visible, ' +
  'input[type="button"]:visible, input[type="submit"]:visible, area[href]:visible';

// Configuração de handlers de erro - CRÍTICO para auditoria não parar
function setupErrorHandlers() {
  Cypress.on('uncaught:exception', () => false);
  Cypress.on('fail', (error) => {
    const msg = error?.message || '';
    // Ignora praticamente todos os erros para continuar a auditoria
    if (
      msg.includes('did not fire its load event') ||
      msg.includes('cy.visit() failed') ||
      msg.includes('Timed out') ||
      msg.includes('timeout') ||
      msg.includes('net::ERR') ||
      msg.includes('cross-origin') ||
      msg.includes('detached') ||
      msg.includes('not a function')
    ) {
      console.warn('[WARN] Erro ignorado:', msg.slice(0, 100));
      return false;
    }
    throw error;
  });
}

/**
 * Função principal para auditar páginas de um cenário
 * @param {string} cenario - Nome do cenário (usado no nome do arquivo)
 * @param {string[]} urls - Array de URLs para auditar
 */
function auditarPaginas(cenario, urls) {
  setupErrorHandlers();

  describe(`Auditoria GA4 - ${cenario}`, () => {
    const timestamp = Date.now();
    const xlsFile = `cypress/downloads/auditoria_${cenario}_${timestamp}.xlsx`;
    let CLICK_ID_COUNTER = 0;

    before(() => {
      Cypress.config('pageLoadTimeout', 120000);
      Cypress.config('defaultCommandTimeout', 30000);

      cy.task('initExcel', { filePath: xlsFile }).then(() => {
        cy.log(`📁 Arquivo criado: ${xlsFile}`);
      });
    });

    after(() => {
      cy.task('addExcelSummary', { filePath: xlsFile }).then(() => {
        cy.log(`✅ Auditoria ${cenario} concluída: ${xlsFile}`);
      });
    });

    urls.forEach((url, urlIndex) => {
      it(`[${urlIndex + 1}/${urls.length}] ${url}`, { retries: 2 }, function () {
        const pageMeta = {
          url: url,
          page_path: '',
          page_title: '',
          page_referrer: '',
          fluxo: cenario,
        };

        let lastContext = createPageLoadContext(cenario);
        let clickResults = {};

        // Intercepta GA4
        cy.intercept({ url: /google-analytics\.com.*collect/i }, (req) => {
          try {
            handleGaRequest(req, pageMeta, lastContext, clickResults);
          } catch (e) {
            console.warn('[GA Intercept]', e.message);
          }
          req.continue();
        }).as('ga4');

        // Visita com tratamento de erro
        cy.visit(url, {
          failOnStatusCode: false,
          timeout: 120000,
          onBeforeLoad(win) {
            cy.stub(win, 'open').as('windowOpen');
          },
        });

        cy.wait(4000);

        // Captura metadados - sem usar .catch()
        cy.location({ timeout: 10000 }).then((loc) => {
          if (loc) {
            pageMeta.url = loc.href || url;
            pageMeta.page_path = (loc.pathname || '') + (loc.search || '');
          }
        });

        cy.title({ timeout: 5000 }).then((t) => {
          pageMeta.page_title = t || '';
        });

        // Aceita cookies
        aceitarCookies();
        cy.wait(1500);

        // Audita elementos
        cy.get('body', { timeout: 10000 }).then(($body) => {
          const elementos = $body.find(SELETOR_CLICAVEIS);
          const total = elementos.length;

          cy.log(`🔍 ${total} elementos encontrados em ${url}`);

          if (total === 0) {
            const row = formatRowData(
              { ...pageMeta, posicao_pagina: 'none', elemento_clicado: 'SEM_ELEMENTOS', tipo_elemento: 'none' },
              null
            );
            cy.task('appendExcelRow', { filePath: xlsFile, rowData: row });
            return;
          }

          // Limita a 150 elementos por página para performance
          const limite = Math.min(total, 150);
          const indices = Array.from({ length: limite }, (_, i) => i);

          cy.wrap(indices, { timeout: 300000 }).each((index) => {
            // Usa should exist para verificar se elemento existe
            cy.get('body').then(($bodyNow) => {
              const $elementos = $bodyNow.find(SELETOR_CLICAVEIS);
              if (index >= $elementos.length) return;

              const $el = $elementos.eq(index);
              if (!$el || !$el.length || !Cypress.dom.isAttached($el[0])) return;

              CLICK_ID_COUNTER++;
              const clickContext = buildClickContext($el, cenario, pageMeta, CLICK_ID_COUNTER);
              lastContext = clickContext;
              const clickId = clickContext.id;
              clickResults[clickId] = { hasHit: false, gaEvent: null };

              const href = $el.attr('href') || '';
              const isExternal = href && href.startsWith('http') && !href.includes('sicredi.com.br');

              if (isExternal) {
                const row = formatRowData(clickContext, null);
                row.tipo_disparo = '__link_externo__';
                cy.task('appendExcelRow', { filePath: xlsFile, rowData: row });
                return;
              }

              // Remove target antes de clicar
              $el.removeAttr('target');

              // Scroll e clique usando jQuery direto
              cy.wrap($el, { timeout: 5000 })
                .scrollIntoView({ offset: { top: -150, left: 0 } })
                .wait(100)
                .click({ force: true, timeout: 5000 })
                .then(() => {
                  cy.wait(800).then(() => {
                    const state = clickResults[clickId];
                    const row = formatRowData(clickContext, state?.gaEvent);
                    cy.task('appendExcelRow', { filePath: xlsFile, rowData: row });
                  });
                });

              // Verifica navegação e volta se necessário
              cy.url({ timeout: 5000 }).then((currentUrl) => {
                try {
                  const basePath = new URL(url).pathname.split('/').filter(Boolean).pop();
                  const currentPath = new URL(currentUrl).pathname;
                  if (basePath && !currentPath.includes(basePath)) {
                    lastContext = createPageLoadContext(cenario);
                    cy.visit(url, { failOnStatusCode: false, timeout: 60000 });
                    cy.wait(2000);
                  }
                } catch (e) {
                  // Ignora erro de parsing
                }
              });
            });
          });
        });
      });
    });

    // Funções internas
    function handleGaRequest(req, meta, ctx, results) {
      let urlToParse = req.url;
      if (req.method === 'POST' && req.body) {
        const bodyStr = typeof req.body === 'string' ? req.body : '';
        if (bodyStr) urlToParse = `${urlToParse}${urlToParse.includes('?') ? '&' : '?'}${bodyStr}`;
      }
      const parsed = parseGaUrl(urlToParse);
      if (!parsed?.tid || parsed.tid.startsWith('AW-')) return;
      if (ctx?.type === 'click' && typeof ctx.id === 'number') {
        if (!results[ctx.id]) results[ctx.id] = { hasHit: false, gaEvent: null };
        results[ctx.id].hasHit = true;
        results[ctx.id].gaEvent = parsed;
      }
    }
  });
}

/* Funções auxiliares */

function createPageLoadContext(fluxo) {
  return {
    id: 0,
    type: 'page_load',
    fluxo,
    url: '',
    page_path: '',
    page_title: '',
    page_referrer: '',
    posicao_pagina: 'page_load',
    elemento_clicado: 'page_load',
    tipo_elemento: 'page_load',
    href_destino: '',
    destino_interno_externo: '',
    abre_nova_aba: false,
    possui_data_gtag: false,
  };
}

function buildClickContext($el, fluxo, pageMeta, clickId) {
  return {
    id: clickId,
    type: 'click',
    fluxo,
    url: pageMeta.url,
    page_path: pageMeta.page_path,
    page_title: pageMeta.page_title,
    page_referrer: pageMeta.page_referrer,
    posicao_pagina: getPosicaoPagina($el),
    elemento_clicado: buildElementDescription($el),
    tipo_elemento: ($el.prop('tagName') || '').toLowerCase(),
    href_destino: $el.attr('href') || '',
    destino_interno_externo: classificarDestino($el.attr('href') || ''),
    abre_nova_aba: $el.attr('target') === '_blank',
    possui_data_gtag: !!$el.attr('data-gtag') || !!$el.attr('data-gtm') || !!$el.attr('data-ga'),
  };
}

function getPosicaoPagina($el) {
  try {
    if ($el.closest('header, [class*="header"], [id*="header"]').length) return 'header';
    if ($el.closest('nav, [class*="nav"], [class*="menu"]').length) return 'navegacao';
    if ($el.closest('footer, [class*="footer"], .rodape').length) return 'rodape';
    if ($el.closest('[class*="hero"], [class*="banner"]').length) return 'hero';
    if ($el.closest('[class*="modal"], [role="dialog"]').length) return 'modal';
  } catch (e) {}
  return 'corpo';
}

function buildElementDescription($el) {
  try {
    const tag = ($el.prop('tagName') || '').toLowerCase();
    const id = $el.attr('id') || '';
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const text = ($el.text() || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    let desc = tag;
    if (id) desc += `#${id}`;
    if (classes) desc += `.${classes}`;
    if (text) desc += ` [${text}]`;
    return desc.slice(0, 180);
  } catch (e) {
    return 'elemento';
  }
}

function classificarDestino(href) {
  if (!href) return '';
  if (href.startsWith('mailto:')) return 'email';
  if (href.startsWith('tel:')) return 'telefone';
  if (href.startsWith('javascript:')) return 'javascript';
  if (href.startsWith('http')) return href.includes('sicredi.com.br') ? 'interno_absoluto' : 'externo';
  if (href.startsWith('/')) return 'interno_relativo';
  if (href.startsWith('#')) return 'ancora';
  return 'outro';
}

function aceitarCookies() {
  const textos = ['Permitir todos', 'Aceitar todos', 'Aceitar', 'OK', 'Concordo', 'Entendi'];
  cy.get('body', { timeout: 3000 }).then(($body) => {
    try {
      textos.forEach((t) => {
        const btn = $body.find(`button:contains("${t}")`).first();
        if (btn.length && Cypress.dom.isAttached(btn[0])) {
          btn.trigger('click');
        }
      });
      ['[class*="cookie"] button', '[class*="consent"] button', '[class*="lgpd"] button'].forEach((sel) => {
        try {
          const el = $body.find(sel).first();
          if (el.length && Cypress.dom.isAttached(el[0])) {
            el.trigger('click');
          }
        } catch (e) {}
      });
    } catch (e) {}
  });
}

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
    tipo_disparo: gaEvent?.tipo_disparo || '__no_ga__',
    tid: gaEvent?.tid || '',
    en: gaEvent?.en || '',
    ep_acao: gaEvent?.epAcao || '',
    ep_categoria: gaEvent?.epCategoria || '',
    ep_rotulo: gaEvent?.epRotulo || '',
    ep_raw_json: gaEvent?.epRawJson || '',
  };
}

module.exports = { auditarPaginas, SELETOR_CLICAVEIS };
