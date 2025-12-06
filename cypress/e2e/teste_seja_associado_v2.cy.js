// Teste específico para seja-associado - V2 com processamento sequencial
const FLUXO = 'seja-associado';
const URL_PAGE = 'https://www.sicredi.com.br/site/seja-associado';
const CSV = 'cypress/downloads/teste_seja_v2.csv';

Cypress.on('uncaught:exception', () => false);

describe('Auditoria: ' + FLUXO, () => {
  let reqs = [];
  let linhas = ['ts,fluxo,pos,elem,tipo,ga,en,tid,acao,rotulo'];
  let elementos = [];

  after(() => {
    cy.task('salvarCsv', { arquivo: CSV, conteudo: linhas.join('\n') + '\n' });
  });

  it('Audita elementos', () => {
    // Intercepta GA4
    cy.intercept('**/collect**', r => { 
      parseReq(r.url, r.body); 
      r.continue(); 
    });
    
    cy.visit(URL_PAGE, { 
      failOnStatusCode: false, 
      timeout: 90000, 
      onBeforeLoad: monitorar 
    });
    
    cy.wait(4000);
    
    // Aceita cookies
    cy.window().then(win => {
      const btn = win.document.querySelector('#onetrust-accept-btn-handler');
      if (btn) btn.click();
    });
    
    cy.wait(2000);
    
    // Scroll
    cy.scrollTo('bottom', { duration: 1000, ensureScrollable: false });
    cy.wait(2000);
    cy.scrollTo('top', { duration: 500, ensureScrollable: false });
    cy.wait(1000);
    
    // Coleta elementos uma única vez
    cy.window().then(win => {
      const doc = win.document;
      const allEls = Array.from(doc.querySelectorAll('a, button'));
      
      elementos = allEls.filter(el => {
        const rect = el.getBoundingClientRect();
        const style = win.getComputedStyle(el);
        if (rect.width < 5 || rect.height < 5) return false;
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (el.closest('footer, [class*="footer"], [class*="rodape"]')) return false;
        if (el.closest('.plyr')) return false;
        return true;
      });
      
      cy.log('📊 Elementos: ' + elementos.length);
    });
    
    // Processa cada elemento usando wrap().each()
    cy.then(() => {
      // Cria índices para iterar
      const indices = Array.from({ length: elementos.length }, (_, i) => i);
      
      cy.wrap(indices).each((idx) => {
        const el = elementos[idx];
        
        // Verifica se ainda existe
        cy.document().then(doc => {
          if (!doc.body.contains(el)) return;
          
          const ctx = {
            pos: getPos(el),
            el: getDesc(el),
            tipo: el.tagName.toLowerCase(),
            href: el.getAttribute('href') || ''
          };
          
          // Link externo - só registra
          if (ctx.href.startsWith('http') && !ctx.href.includes('sicredi.com.br')) {
            linhas.push(montarLinha(ctx, null, 'externo'));
            return;
          }
          
          // Previne navegação
          const hrefOriginal = el.getAttribute('href');
          el.removeAttribute('href');
          el.removeAttribute('target');
          
          const reqsBefore = reqs.length;
          
          // Scroll até elemento
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          
          // Clica
          cy.wrap(Cypress.$(el), { log: false }).click({ force: true });
          cy.wait(500);
          
          // Verifica GA
          cy.then(() => {
            if (hrefOriginal) el.setAttribute('href', hrefOriginal);
            
            const novos = reqs.slice(reqsBefore);
            const evento = novos.find(r => r.acao || r.en === 'clicks_gtag');
            linhas.push(montarLinha(ctx, evento, evento ? 'ga' : 'sem_ga'));
          });
          
          // Fecha modais
          cy.get('body').type('{esc}', { force: true });
          cy.wait(100);
        });
      });
    });
    
    // Log final
    cy.then(() => {
      cy.log('✅ Total: ' + linhas.length + ' linhas');
    });
  });

  function monitorar(w) {
    const origBeacon = w.navigator.sendBeacon.bind(w.navigator);
    w.navigator.sendBeacon = (u, d) => {
      if (u && u.includes('collect')) parseReq(u + (d ? '&' + d : ''), null);
      return origBeacon(u, d);
    };
    const origFetch = w.fetch.bind(w);
    w.fetch = (input, opts) => {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (u.includes('collect')) parseReq(u, opts && opts.body);
      return origFetch(input, opts);
    };
  }

  function parseReq(u, b) {
    if (!u) return;
    try {
      let full = u;
      if (b && typeof b === 'string') full += '&' + b;
      const p = new URL(full).searchParams;
      const tid = p.get('tid') || '';
      if (tid.startsWith('AW-')) return;
      reqs.push({
        en: p.get('en') || '',
        tid: tid,
        acao: p.get('ep.acao') || '',
        rotulo: p.get('ep.rotulo') || ''
      });
    } catch (e) {}
  }

  function getPos(el) {
    if (el.closest('header, [class*="header"]')) return 'header';
    return 'corpo';
  }

  function getDesc(el) {
    const tag = el.tagName.toLowerCase();
    const cls = (el.className || '').toString().split(' ').slice(0, 2).join('.');
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    return (tag + (cls ? '.' + cls : '') + (txt ? '[' + txt + ']' : '')).slice(0, 60);
  }

  function montarLinha(ctx, ev, status) {
    return [
      new Date().toISOString(),
      FLUXO,
      ctx.pos,
      '"' + ctx.el.replace(/"/g, '""') + '"',
      ctx.tipo,
      ev ? 'Sim' : 'Não',
      ev ? ev.en : status,
      ev ? ev.tid : '',
      ev ? ev.acao : '',
      ev ? ev.rotulo : ''
    ].join(',');
  }
});

