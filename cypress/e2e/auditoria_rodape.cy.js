// cypress/e2e/auditoria_rodape.cy.js
// Auditoria APENAS do rodapé (uma vez só, igual em todas as páginas)

const CSV = 'cypress/downloads/rodape.csv';
const SEL = 'footer a:visible, footer button:visible, [class*="footer"] a:visible, [class*="rodape"] a:visible';

Cypress.on('uncaught:exception', () => false);

describe('Auditoria: Rodapé', () => {
  const done = new Set();
  let reqs = [];
  let buf = [];

  before(() => cy.writeFile(CSV, 'ts,fluxo,elem,tipo,ga,en,tid,acao,rotulo\n'));
  after(() => { if (buf.length) cy.writeFile(CSV, buf.join(''), { flag: 'a+' }); });

  it('Audita rodapé', () => {
    cy.intercept('**/collect**', r => { parse(r.url, r.body); r.continue(); });
    
    cy.visit('https://www.sicredi.com.br/site/seja-associado/', {
      failOnStatusCode: false,
      timeout: 60000,
      onBeforeLoad: mon,
    });

    cy.wait(3000);
    
    // Aceita cookies
    cy.get('body').then($b => {
      const btn = $b.find('button:contains("Permitir"), button:contains("Aceitar")').filter(':visible').first();
      if (btn.length) cy.wrap(btn).click({ force: true });
    });
    
    cy.wait(1000);

    // Scroll até o rodapé
    cy.scrollTo('bottom');
    cy.wait(1500);

    // Processa elementos do rodapé
    run(0);
  });

  function run(i) {
    if (i >= 50) { flush(); return; }
    
    cy.get(SEL).then($e => {
      if (i >= $e.length) { flush(); cy.log(`✅ Rodapé: ${done.size} elementos`); return; }
      
      const $el = $e.eq(i);
      if (!Cypress.dom.isAttached($el[0])) return run(i+1);
      
      const r = $el[0].getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return run(i+1);
      
      const id = `${$el.prop('tagName')}|${($el.text()||'').slice(0,20)}|${$el.attr('href')||''}`;
      if (done.has(id)) return run(i+1);
      
      done.add(id);
      
      const ctx = {
        el: desc($el),
        tipo: ($el.prop('tagName')||'').toLowerCase(),
        href: $el.attr('href') || '',
      };

      // Link externo
      if (ctx.href.startsWith('http') && !ctx.href.includes('sicredi.com.br')) {
        add(ctx, null, 'externo');
        return run(i+1);
      }

      const before = reqs.length;
      $el.removeAttr('target');

      cy.wrap($el).scrollIntoView().wait(100);
      cy.wrap($el).click({ force: true });

      cy.wait(800).then(() => {
        const ev = reqs.slice(before).find(r => r.acao || r.en === 'clicks_gtag');
        add(ctx, ev, ev ? 'ga' : 'sem');
      });

      cy.url().then(u => {
        if (!u.includes('sicredi.com.br')) {
          cy.go('back');
          cy.wait(1000);
        }
        run(i+1);
      });
    });
  }

  function mon(w) {
    const ob = w.navigator.sendBeacon.bind(w.navigator);
    w.navigator.sendBeacon = (u, d) => { if (u?.includes('collect')) parse(u + (d ? '&' + d : ''), null); return ob(u, d); };
    const of = w.fetch.bind(w);
    w.fetch = (i, o) => { const u = typeof i === 'string' ? i : i?.url || ''; if (u.includes('collect')) parse(u, o?.body); return of(i, o); };
  }

  function parse(u, b) {
    if (!u) return;
    try {
      let x = u; if (b && typeof b === 'string') x += '&' + b;
      const p = new URL(x).searchParams;
      const t = p.get('tid') || ''; if (t.startsWith('AW-')) return;
      reqs.push({ en: p.get('en') || '', tid: t, acao: p.get('ep.acao') || '', rotulo: p.get('ep.rotulo') || '' });
    } catch {}
  }

  function desc($el) {
    const t = ($el.prop('tagName')||'').toLowerCase();
    const c = ($el.attr('class')||'').split(' ').slice(0,2).join('.');
    const x = ($el.text()||'').replace(/\s+/g,' ').trim().slice(0,30);
    return `${t}${c?'.'+c:''}${x?'['+x+']':''}`.slice(0,60);
  }

  function add(ctx, ev, st) {
    buf.push([
      new Date().toISOString(),
      'rodape',
      `"${ctx.el.replace(/"/g,'""')}"`,
      ctx.tipo,
      ev ? 'Sim' : 'Não',
      ev?.en || st,
      ev?.tid || '',
      ev?.acao || '',
      ev?.rotulo || '',
    ].join(',') + '\n');
    if (buf.length >= 10) flush();
  }

  function flush() {
    if (buf.length) {
      cy.writeFile(CSV, buf.join(''), { flag: 'a+' });
      buf = [];
    }
  }
});

