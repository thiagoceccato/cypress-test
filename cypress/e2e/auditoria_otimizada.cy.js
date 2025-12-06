// cypress/e2e/auditoria_otimizada.cy.js
// VERSÃO OTIMIZADA - Só CSV, sem rodapé, tempos reduzidos

// Configuração - altere conforme necessário
const CONFIG = {
  url: 'https://www.sicredi.com.br/site/seja-associado/',
  fluxo: 'seja-associado',
  maxElementos: 50,        // Limite de elementos por página
  tempoEsperaGA: 800,      // ms para esperar GA4 (reduzido de 2500)
  tempoEsperaClique: 150,  // ms entre ações
  ignorarRodape: true,     // Não audita elementos do rodapé
  ignorarHeader: false,    // Auditar header
};

const CSV_FILE = `cypress/downloads/auditoria_${CONFIG.fluxo}.csv`;

const SELETOR = 'a:visible, button:visible, .gtag-click-trigger:visible';

Cypress.on('uncaught:exception', () => false);

describe(`Auditoria: ${CONFIG.fluxo}`, () => {
  const processados = new Set();
  let requests = [];
  let csvBuffer = [];

  before(() => {
    cy.writeFile(CSV_FILE, 'timestamp,fluxo,posicao,elemento,tipo,tem_ga,en,tid,ep_acao,ep_rotulo\n');
  });

  after(() => {
    // Flush buffer final
    if (csvBuffer.length > 0) {
      cy.writeFile(CSV_FILE, csvBuffer.join(''), { flag: 'a+' });
    }
    cy.log(`✅ Total: ${processados.size} elementos`);
  });

  it('Audita elementos', () => {
    cy.intercept('**/collect**', (req) => {
      parseReq(req.url, req.body);
      req.continue();
    });

    cy.visit(CONFIG.url, {
      failOnStatusCode: false,
      timeout: 60000,
      onBeforeLoad: monitorar,
    });

    cy.wait(3000);
    aceitarCookies();
    cy.wait(1000);

    // Scroll rápido
    cy.scrollTo('bottom', { duration: 800 });
    cy.scrollTo('top', { duration: 500 });
    cy.wait(500);

    // Processa
    processar(0);
  });

  function processar(i) {
    if (i >= CONFIG.maxElementos) {
      flushBuffer();
      return;
    }

    cy.get(SELETOR).then($els => {
      if (i >= $els.length) {
        flushBuffer();
        return;
      }

      const $el = $els.eq(i);
      if (!Cypress.dom.isAttached($el[0])) return processar(i + 1);

      // Pula pequenos
      const r = $el[0].getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return processar(i + 1);

      const pos = getPosicao($el);
      
      // Ignora rodapé se configurado
      if (CONFIG.ignorarRodape && pos === 'rodape') return processar(i + 1);

      // ID único
      const id = `${$el.prop('tagName')}|${($el.text()||'').slice(0,20)}|${$el.attr('href')||''}`;
      if (processados.has(id)) return processar(i + 1);
      
      // Pula player
      if ($el.closest('.plyr').length) return processar(i + 1);

      processados.add(id);

      const ctx = {
        pos,
        el: getDesc($el),
        tipo: ($el.prop('tagName')||'').toLowerCase(),
        href: $el.attr('href') || '',
      };

      // Externo
      if (ctx.href.startsWith('http') && !ctx.href.includes('sicredi.com.br')) {
        addCSV(ctx, null, 'externo');
        return processar(i + 1);
      }

      cy.get('body').type('{esc}', { force: true });

      const reqsBefore = requests.length;
      $el.removeAttr('target');

      cy.wrap($el).scrollIntoView().wait(CONFIG.tempoEsperaClique);
      cy.wrap($el).click({ force: true });

      cy.wait(CONFIG.tempoEsperaGA).then(() => {
        const news = requests.slice(reqsBefore);
        const ev = news.find(r => r.acao || r.en === 'clicks_gtag');
        
        if (ev) {
          addCSV(ctx, ev, 'ga');
        } else {
          addCSV(ctx, null, 'sem_ga');
        }
      });

      cy.url().then(url => {
        if (!url.includes(CONFIG.fluxo.split('-')[0])) {
          cy.go('back');
          cy.wait(1000);
        }
        processar(i + 1);
      });
    });
  }

  function monitorar(win) {
    const ob = win.navigator.sendBeacon.bind(win.navigator);
    win.navigator.sendBeacon = (url, data) => {
      if (url?.includes('collect')) parseReq(url + (data ? '&' + data : ''), null);
      return ob(url, data);
    };
    
    const of = win.fetch.bind(win);
    win.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('collect')) parseReq(url, init?.body);
      return of(input, init);
    };
  }

  function parseReq(url, body) {
    if (!url) return;
    try {
      let u = url;
      if (body && typeof body === 'string') u += '&' + body;
      const p = new URL(u).searchParams;
      const tid = p.get('tid') || '';
      if (tid.startsWith('AW-')) return;
      requests.push({
        en: p.get('en') || '',
        tid,
        acao: p.get('ep.acao') || '',
        rotulo: p.get('ep.rotulo') || '',
      });
    } catch {}
  }

  function aceitarCookies() {
    cy.get('body').then($b => {
      const btn = $b.find('button:contains("Permitir"), button:contains("Aceitar")').filter(':visible').first();
      if (btn.length) cy.wrap(btn).click({ force: true });
    });
  }

  function getPosicao($el) {
    if ($el.closest('header, [class*="header"]').length) return 'header';
    if ($el.closest('footer, [class*="footer"], [class*="rodape"]').length) return 'rodape';
    if ($el.closest('[class*="hero"]').length) return 'hero';
    return 'corpo';
  }

  function getDesc($el) {
    const t = ($el.prop('tagName')||'').toLowerCase();
    const c = ($el.attr('class')||'').split(' ').slice(0,2).join('.');
    const x = ($el.text()||'').replace(/\s+/g,' ').trim().slice(0,30);
    return `${t}${c?'.'+c:''}${x?'['+x+']':''}`.slice(0,60);
  }

  function addCSV(ctx, ev, status) {
    const line = [
      new Date().toISOString(),
      CONFIG.fluxo,
      ctx.pos,
      `"${ctx.el.replace(/"/g,'""')}"`,
      ctx.tipo,
      ev ? 'Sim' : 'Não',
      ev?.en || status,
      ev?.tid || '',
      ev?.acao || '',
      ev?.rotulo || '',
    ].join(',') + '\n';
    
    csvBuffer.push(line);
    
    // Flush a cada 10 linhas
    if (csvBuffer.length >= 10) flushBuffer();
  }

  function flushBuffer() {
    if (csvBuffer.length === 0) return;
    cy.writeFile(CSV_FILE, csvBuffer.join(''), { flag: 'a+' });
    csvBuffer = [];
  }
});

