// cypress/e2e/auditoria_seja_associado.cy.js
// Auditoria completa - USANDO LÓGICA QUE FUNCIONOU

const CSV_FILE = 'cypress/downloads/auditoria_seja_associado.csv';
const XLS_FILE = 'cypress/downloads/auditoria_seja_associado.xlsx';

const SELETOR_CLICAVEIS =
  'a:visible, button:visible, [role="button"]:visible, ' +
  '.gtag-click-trigger:visible, [data-gtm]:visible';

Cypress.on('uncaught:exception', () => false);

describe('Auditoria GA4 - /seja-associado', () => {
  const elementosProcessados = new Set();
  let networkRequests = [];

  before(() => {
    cy.task('initExcelSimples', { filePath: XLS_FILE });
    cy.writeFile(CSV_FILE, 'timestamp,fluxo,posicao,elemento,tipo,tem_ga,en,tid,ep_acao,ep_categoria,ep_rotulo\n');
  });

  after(() => {
    cy.task('addExcelSummary', { filePath: XLS_FILE });
  });

  it('Audita elementos clicáveis', () => {
    // INTERCEPT - Igual ao teste que funcionou
    cy.intercept('**/*google*/**', (req) => {
      if (req.url.includes('collect') || req.url.includes('analytics')) {
        parseRequest(req.url, req.body);
      }
      req.continue();
    }).as('ga');

    cy.intercept('**/g/collect**', (req) => {
      parseRequest(req.url, req.body);
      req.continue();
    }).as('ga4');

    cy.visit('https://www.sicredi.com.br/site/seja-associado/', {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad: setupWindowMonitoring,
    });

    cy.wait(5000);

    // Aceitar cookies
    aceitarCookies();
    cy.wait(2000);

    // Scroll completo
    cy.scrollTo(0, 500);
    cy.wait(800);
    cy.scrollTo(0, 1000);
    cy.wait(800);
    cy.scrollTo('bottom', { duration: 1500 });
    cy.wait(1000);
    cy.scrollTo('top', { duration: 1000 });
    cy.wait(1000);

    // Processa elementos
    processarElementos(0, 60);
  });

  function processarElementos(index, max) {
    if (index >= max) {
      cy.log(`✅ Concluído: ${elementosProcessados.size} elementos`);
      return;
    }

    cy.get(SELETOR_CLICAVEIS).then(($els) => {
      if (index >= $els.length) {
        cy.log(`✅ Fim: ${elementosProcessados.size} elementos`);
        return;
      }

      const $el = $els.eq(index);
      
      if (!Cypress.dom.isAttached($el[0])) {
        processarElementos(index + 1, max);
        return;
      }

      // Pula pequenos
      const rect = $el[0].getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        processarElementos(index + 1, max);
        return;
      }

      // ID único
      const id = criarId($el);
      if (elementosProcessados.has(id)) {
        processarElementos(index + 1, max);
        return;
      }

      // Pula player
      if ($el.closest('.plyr, [class*="player"]').length) {
        processarElementos(index + 1, max);
        return;
      }

      elementosProcessados.add(id);

      const ctx = {
        fluxo: 'seja-associado',
        posicao: getPosicao($el),
        elemento: getDescricao($el),
        tipo: ($el.prop('tagName') || '').toLowerCase(),
        href: $el.attr('href') || '',
      };

      // Link externo
      if (ctx.href.startsWith('http') && !ctx.href.includes('sicredi.com.br')) {
        salvarResultado(ctx, null, 'link_externo');
        processarElementos(index + 1, max);
        return;
      }

      // ESC para fechar modais
      cy.get('body').type('{esc}', { force: true });

      // Scroll
      cy.wrap($el).scrollIntoView({ offset: { top: -100, left: 0 } });
      cy.wait(300);

      // Guarda requests antes
      const reqsBefore = networkRequests.length;

      // Remove target
      $el.removeAttr('target');

      cy.log(`🖱️ [${index}] ${ctx.posicao}: ${ctx.elemento.slice(0, 40)}`);

      // CLICA
      cy.wrap($el).click({ force: true });

      // Espera mais tempo para GA4 disparar
      cy.wait(2500).then(() => {
        const newReqs = networkRequests.slice(reqsBefore);
        
        // Procura evento com ep.acao OU clicks_gtag
        const clickEvent = newReqs.find(r => r.epAcao || r.en === 'clicks_gtag');

        if (clickEvent) {
          salvarResultado(ctx, clickEvent, 'com_ga');
          cy.log(`  ✅ ${clickEvent.epAcao || clickEvent.en}`);
        } else if (newReqs.length > 0) {
          // Tem request mas sem ep.acao
          salvarResultado(ctx, newReqs[0], 'ga_sem_acao');
          cy.log(`  ⚠️ GA sem ep.acao: ${newReqs[0].en}`);
        } else {
          salvarResultado(ctx, null, 'sem_ga');
          cy.log(`  ❌ Sem GA`);
        }
      });

      // Verifica navegação
      cy.url().then((url) => {
        if (!url.includes('seja-associado')) {
          cy.go('back');
          cy.wait(2000);
          aceitarCookies();
          cy.wait(500);
        }
        processarElementos(index + 1, max);
      });
    });
  }

  function setupWindowMonitoring(win) {
    // sendBeacon
    const origBeacon = win.navigator.sendBeacon.bind(win.navigator);
    win.navigator.sendBeacon = function(url, data) {
      if (url?.includes('google')) {
        let fullUrl = url;
        if (data && typeof data === 'string') {
          fullUrl += (url.includes('?') ? '&' : '?') + data;
        }
        parseRequest(fullUrl, null);
        console.log('[BEACON]', url.slice(0, 80));
      }
      return origBeacon(url, data);
    };

    // fetch
    const origFetch = win.fetch.bind(win);
    win.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('google')) {
        parseRequest(url, init?.body);
        console.log('[FETCH]', url.slice(0, 80));
      }
      return origFetch(input, init);
    };

    // dataLayer
    win.dataLayer = win.dataLayer || [];
    const origPush = Array.prototype.push;
    Object.defineProperty(win.dataLayer, 'push', {
      value: function(...items) {
        items.forEach(item => {
          if (item?.event) {
            console.log('[DL]', item.event);
          }
        });
        return origPush.apply(this, items);
      },
      writable: true,
      configurable: true,
    });
  }

  function parseRequest(url, body) {
    if (!url) return;
    
    try {
      let fullUrl = url;
      if (body && typeof body === 'string') {
        fullUrl += (url.includes('?') ? '&' : '?') + body;
      }

      let params;
      try {
        params = new URL(fullUrl).searchParams;
      } catch {
        const q = fullUrl.indexOf('?');
        if (q === -1) return;
        params = new URLSearchParams(fullUrl.slice(q + 1));
      }

      const tid = params.get('tid') || '';
      if (tid.startsWith('AW-')) return;

      const en = params.get('en') || '';
      const epAcao = params.get('ep.acao') || '';

      // Só adiciona se tiver algo útil
      if (!tid && !en && !epAcao) return;

      networkRequests.push({
        tid,
        en,
        epAcao,
        epCategoria: params.get('ep.categoria') || '',
        epRotulo: params.get('ep.rotulo') || '',
      });

      console.log('[GA4]', en, 'acao:', epAcao);
    } catch (e) {
      console.error('[parseRequest]', e.message);
    }
  }

  function aceitarCookies() {
    cy.get('body').then(($body) => {
      const seletores = [
        'button:contains("Permitir todos")',
        'button:contains("Aceitar todos")',
        'button:contains("Aceitar")',
        '[class*="cookie"] button',
        '#onetrust-accept-btn-handler',
      ];
      for (const sel of seletores) {
        const btn = $body.find(sel).filter(':visible').first();
        if (btn.length) {
          cy.wrap(btn).click({ force: true });
          cy.log('🍪 Cookies aceitos');
          break;
        }
      }
    });
  }

  function criarId($el) {
    const tag = $el.prop('tagName') || '';
    const text = ($el.text() || '').trim().slice(0, 30);
    const href = $el.attr('href') || '';
    return `${tag}|${text}|${href}`;
  }

  function getPosicao($el) {
    if ($el.closest('header, [class*="header"]').length) return 'header';
    if ($el.closest('footer, [class*="footer"], [class*="rodape"]').length) return 'rodape';
    if ($el.closest('[class*="hero"], [class*="banner"]').length) return 'hero';
    if ($el.closest('[class*="modal"]').length) return 'modal';
    return 'corpo';
  }

  function getDescricao($el) {
    const tag = ($el.prop('tagName') || '').toLowerCase();
    const classes = ($el.attr('class') || '').split(' ').slice(0, 2).join('.');
    const text = ($el.text() || '').replace(/\s+/g, ' ').trim().slice(0, 35);
    let desc = tag;
    if (classes) desc += `.${classes}`;
    if (text) desc += `[${text}]`;
    return desc.slice(0, 80);
  }

  function salvarResultado(ctx, gaEvent, status) {
    const row = {
      timestamp: new Date().toISOString(),
      url: 'https://www.sicredi.com.br/site/seja-associado/',
      fluxo: ctx.fluxo,
      posicao_pagina: ctx.posicao,
      elemento_clicado: ctx.elemento,
      tipo_elemento: ctx.tipo,
      tem_ga: gaEvent ? 'Sim' : 'Não',
      en: gaEvent?.en || status,
      tid: gaEvent?.tid || '',
      ep_acao: gaEvent?.epAcao || '',
      ep_categoria: gaEvent?.epCategoria || '',
      ep_rotulo: gaEvent?.epRotulo || '',
    };

    const csvLine = [
      row.timestamp,
      row.fluxo,
      row.posicao_pagina,
      `"${row.elemento_clicado.replace(/"/g, '""')}"`,
      row.tipo_elemento,
      row.tem_ga,
      row.en,
      row.tid,
      row.ep_acao,
      row.ep_categoria,
      row.ep_rotulo,
    ].join(',') + '\n';

    cy.writeFile(CSV_FILE, csvLine, { flag: 'a+' });
    cy.task('appendExcelRowSimples', { filePath: XLS_FILE, rowData: row });
  }
});
