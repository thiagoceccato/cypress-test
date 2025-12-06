// Teste específico para seja-associado com debug
const FLUXO = 'seja-associado';
const URL_PAGE = 'https://www.sicredi.com.br/site/seja-associado';
const CSV = 'cypress/downloads/teste_seja_associado.csv';

Cypress.on('uncaught:exception', () => false);

describe('Auditoria: ' + FLUXO, () => {
  let reqs = [];
  let linhas = ['ts,fluxo,pos,elem,tipo,ga,en,tid,acao,rotulo'];

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
    
    // Aceita cookies via DOM direto
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
    
    // Usa window.document diretamente
    cy.window().then(win => {
      const doc = win.document;
      const allEls = Array.from(doc.querySelectorAll('a, button'));
      
      // Filtra elementos visíveis e válidos
      const els = allEls.filter(el => {
        const rect = el.getBoundingClientRect();
        const style = win.getComputedStyle(el);
        if (rect.width < 5 || rect.height < 5) return false;
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (el.closest('footer, [class*="footer"], [class*="rodape"]')) return false;
        if (el.closest('.plyr')) return false;
        return true;
      });
      
      cy.log('📊 Elementos encontrados: ' + els.length);
      linhas.push('DEBUG,encontrados,' + els.length + ' elementos,,,,,,');
      
      // Processa cada elemento
      processarRecursivo(els, 0, win);
    });
  });
  
  function processarRecursivo(els, idx, win) {
    if (idx >= els.length) {
      cy.log('✅ Processamento completo: ' + (linhas.length - 1) + ' itens');
      return;
    }
    
    const el = els[idx];
    
    // Verifica se ainda está no DOM
    if (!win.document.body.contains(el)) {
      processarRecursivo(els, idx + 1, win);
      return;
    }
    
    const ctx = {
      pos: getPos(el),
      el: getDesc(el),
      tipo: el.tagName.toLowerCase(),
      href: el.getAttribute('href') || ''
    };
    
    // Link externo - só registra
    if (ctx.href.startsWith('http') && !ctx.href.includes('sicredi.com.br')) {
      linhas.push(montarLinha(ctx, null, 'externo'));
      processarRecursivo(els, idx + 1, win);
      return;
    }
    
    // Previne navegação
    const hrefOriginal = el.getAttribute('href');
    el.removeAttribute('href');
    el.removeAttribute('target');
    
    const reqsBefore = reqs.length;
    
    // Scroll até elemento
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    
    // Clica usando Cypress
    cy.wrap(Cypress.$(el), { log: false }).click({ force: true }).then(() => {
      cy.wait(500).then(() => {
        // Restaura href
        if (hrefOriginal) el.setAttribute('href', hrefOriginal);
        
        // Verifica GA
        const novos = reqs.slice(reqsBefore);
        const evento = novos.find(r => r.acao || r.en === 'clicks_gtag');
        linhas.push(montarLinha(ctx, evento, evento ? 'ga' : 'sem_ga'));
        
        // Fecha modais
        cy.get('body').type('{esc}', { force: true }).then(() => {
          cy.wait(100).then(() => {
            processarRecursivo(els, idx + 1, win);
          });
        });
      });
    });
  }

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

