// Auto-generated - credito-custeio-pronaf
const FLUXO = 'credito-custeio-pronaf';
const URL_PAGE = 'https://www.sicredi.com.br/site/credito/para-agronegocio/custeio/pronaf';
const CSV = 'C:/temp/sicredi-audit/credito-custeio-pronaf.csv';

const SELETOR_CLICAVEIS = 'a:visible, button:visible, [role="button"]:visible, .gtag-click-trigger:visible, [data-gtm]:visible';

Cypress.on('uncaught:exception', () => false);

describe('Auditoria: ' + FLUXO, () => {
  const elementosProcessados = new Set();
  let networkRequests = [];

  before(() => {
    // Cria header usando task que verifica existência
    cy.task('criarCsvSeNaoExiste', { 
      arquivo: CSV, 
      header: 'ts,fluxo,pos,elem,tipo,ga,en,tid,acao,rotulo' 
    });
  });

  it('Audita elementos', () => {
    // INTERCEPT - Igual ao que funcionou
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

    cy.visit(URL_PAGE, {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad: setupWindowMonitoring,
    });

    cy.wait(3000);

    // Aceitar cookies
    aceitarCookies();
    cy.wait(1000);

    // Scroll rápido
    cy.scrollTo('bottom', { duration: 800 });
    cy.wait(500);
    cy.scrollTo('top', { duration: 500 });
    cy.wait(500);

    // Processa elementos - LIMITADO para 30 (mais rápido)
    processarElementos(0, 30);
  });

  function processarElementos(index, max) {
    if (index >= max) {
      cy.log('✅ Concluído: ' + elementosProcessados.size + ' elementos');
      return;
    }

    cy.get(SELETOR_CLICAVEIS).then(($els) => {
      if (index >= $els.length) {
        cy.log('✅ Fim: ' + elementosProcessados.size + ' elementos');
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

      // Pula rodapé
      if ($el.closest('footer, [class*="footer"], [class*="rodape"]').length) {
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
        pos: getPosicao($el),
        el: getDescricao($el),
        tipo: ($el.prop('tagName') || '').toLowerCase(),
        href: $el.attr('href') || '',
      };

      // Link externo
      if (ctx.href.startsWith('http') && !ctx.href.includes('sicredi.com.br')) {
        salvarLinha(ctx, null, 'externo');
        processarElementos(index + 1, max);
        return;
      }

      // ESC para fechar modais
      cy.get('body').type('{esc}', { force: true });

      // Scroll
      cy.wrap($el).scrollIntoView({ offset: { top: -100, left: 0 } });
      cy.wait(150);

      // Guarda requests antes
      const reqsBefore = networkRequests.length;

      // Remove target
      $el.removeAttr('target');

      // CLICA
      cy.wrap($el).click({ force: true });

      // ESPERA 1200ms (otimizado)
      cy.wait(1200).then(() => {
        const newReqs = networkRequests.slice(reqsBefore);
        
        // Procura evento com ep.acao OU clicks_gtag
        const clickEvent = newReqs.find(r => r.epAcao || r.en === 'clicks_gtag');

        if (clickEvent) {
          salvarLinha(ctx, clickEvent, 'ga');
        } else if (newReqs.length > 0) {
          // Tem request mas sem ep.acao
          salvarLinha(ctx, newReqs[0], 'ga_sem_acao');
        } else {
          salvarLinha(ctx, null, 'sem_ga');
        }
      });

      // Verifica navegação
      cy.url().then((url) => {
        if (!url.includes(URL_PAGE.split('/').pop())) {
          cy.go('back');
          cy.wait(1000);
          aceitarCookies();
          cy.wait(300);
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
      }
      return origBeacon(url, data);
    };

    // fetch
    const origFetch = win.fetch.bind(win);
    win.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('google')) {
        parseRequest(url, init?.body);
      }
      return origFetch(input, init);
    };
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
      
      // FILTRA eventos não relevantes
      const eventosIgnorar = ['scroll', 'user_engagement', 'page_view', 'first_visit', 'session_start'];
      if (eventosIgnorar.includes(en)) return;

      const epAcao = params.get('ep.acao') || '';

      // Só adiciona se tiver algo útil (clicks_gtag ou ep.acao)
      if (!epAcao && en !== 'clicks_gtag') return;

      networkRequests.push({
        tid,
        en,
        epAcao,
        epCategoria: params.get('ep.categoria') || '',
        epRotulo: params.get('ep.rotulo') || '',
      });
    } catch (e) {}
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
          break;
        }
      }
    });
  }

  function criarId($el) {
    const tag = $el.prop('tagName') || '';
    const text = ($el.text() || '').trim().slice(0, 30);
    const href = $el.attr('href') || '';
    return tag + '|' + text + '|' + href;
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
    if (classes) desc += '.' + classes;
    if (text) desc += '[' + text + ']';
    return desc.slice(0, 80);
  }

  function salvarLinha(ctx, ev, status) {
    const linha = [
      new Date().toISOString(),
      FLUXO,
      ctx.pos,
      '"' + ctx.el.replace(/"/g, '""') + '"',
      ctx.tipo,
      ev ? 'Sim' : 'Não',
      ev ? ev.en : status,
      ev ? ev.tid : '',
      ev ? ev.epAcao : '',
      ev ? ev.epRotulo : ''
    ].join(',') + '\n';
    
    // ESCREVE IMEDIATAMENTE
    cy.writeFile(CSV, linha, { flag: 'a+' });
  }
});
