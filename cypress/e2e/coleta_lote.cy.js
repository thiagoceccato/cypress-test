// cypress/e2e/coleta_lote.cy.js
// Coleta GA4 para MÚLTIPLOS cenários - escrita incremental

const { parseGaUrl } = require('./utils/gaHelpers');
const { CENARIOS } = require('./config/cenarios');

// ============ CONFIGURAÇÃO ============
// Filtre aqui os cenários desejados:
const FILTRO_NOME = 'cartoes'; // 'cartoes', 'consorcio', 'seguros', etc. Use null para TODOS
const ESPERA_CLIQUE = 5000; // ms - tempo de espera após cada clique (P90=3.5s + margem)
const IGNORAR_RODAPE = true; // ignora links do rodapé (repetitivos)
const IGNORAR_HEADER = true; // ignora links do header (repetitivos)
// ======================================

const CENARIOS_FILTRADOS = FILTRO_NOME 
  ? CENARIOS.filter(c => c.nome === FILTRO_NOME)
  : CENARIOS;

const CSV_PATH = `cypress/results_novo/${FILTRO_NOME || 'todos'}_coleta.csv`;
const JSON_PATH = `cypress/results_novo/${FILTRO_NOME || 'todos'}_ga4_requests.json`;

const CSV_HEADER = 'ts,cenario,url,page_path,page_title,posicao_pagina,elemento_clicado,tipo_elemento,href_destino,possui_data_gtag,tem_ga,tipo_disparo,tid,en,ep.acao,ep.categoria,ep.rotulo';

const SELETOR_CLICAVEIS =
  'a:visible, button:visible, [role="button"]:visible, ' +
  '[data-gtag]:visible, [data-gtm]:visible, .gtag-click-trigger:visible';

Cypress.on('uncaught:exception', () => false);

// Variáveis globais
let ga4Requests = [];
let totalComGa = 0;
let totalSemGa = 0;
let cenarioAtual = '';

describe(`COLETA GA4 - ${FILTRO_NOME || 'TODOS'} (${CENARIOS_FILTRADOS.length} URLs)`, () => {

  before(() => {
    cy.writeFile(CSV_PATH, CSV_HEADER + '\n', 'utf8');
    ga4Requests = [];
    totalComGa = 0;
    totalSemGa = 0;
  });

  after(() => {
    cy.writeFile(JSON_PATH, JSON.stringify(ga4Requests, null, 2));
    cy.log('═══════════════════════════════════════════════════════');
    cy.log(`📊 RESULTADO FINAL - ${FILTRO_NOME || 'TODOS'}`);
    cy.log(`   URLs processadas: ${CENARIOS_FILTRADOS.length}`);
    cy.log(`   Com GA4: ${totalComGa}`);
    cy.log(`   Sem GA4: ${totalSemGa}`);
    cy.log(`   Total requisições: ${ga4Requests.length}`);
    cy.log('═══════════════════════════════════════════════════════');
  });

  CENARIOS_FILTRADOS.forEach((cenario, cenarioIdx) => {
    it(`[${cenarioIdx + 1}/${CENARIOS_FILTRADOS.length}] ${cenario.nome}: ${cenario.url}`, () => {
      cenarioAtual = cenario.nome;
      const urlAtual = cenario.url;
      let pageMeta = { cenario: cenario.nome, url: urlAtual, page_path: '', page_title: '' };

      // Visita com spy
      cy.visit(urlAtual, {
        failOnStatusCode: false,
        timeout: 120000,
        onBeforeLoad(win) {
          setupGa4Spy(win);
        },
      });

      cy.wait(4000);

      // Metadados
      cy.location().then((loc) => {
        pageMeta.url = loc.href;
        pageMeta.page_path = loc.pathname;
      });
      cy.title().then((t) => { pageMeta.page_title = t; });

      // Page views
      cy.then(() => {
        const reqsAntes = ga4Requests.length;
        const pageViews = ga4Requests.slice(reqsAntes - 10).filter(r => r.parsed?.en === 'page_view');
        pageViews.forEach(pv => {
          const row = buildCsvRow({
            ts: pv.ts,
            ...pageMeta,
            posicao_pagina: 'page_load',
            elemento_clicado: 'page_load',
            tipo_elemento: 'page_load',
            href_destino: '',
            possui_data_gtag: false,
            tem_ga: true,
            ...pv.parsed,
          });
          cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
          totalComGa++;
        });
      });

      // Aceita cookies
      cy.get('body').then(($body) => {
        const btn = $body.find('button:contains("Permitir")').first();
        if (btn.length) {
          cy.wrap(btn).click({ force: true });
          cy.wait(1500);
        }
      });

      // Bloqueia navegação
      cy.window().then((win) => {
        win.document.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (link && link.href) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      });

      // Coleta elementos
      cy.get(SELETOR_CLICAVEIS).then(($els) => {
        const elementos = [];
        $els.each((i, el) => {
          const $el = Cypress.$(el);
          const tag = ($el.prop('tagName') || '').toLowerCase();
          const texto = ($el.text() || '').replace(/\s+/g, ' ').trim().slice(0, 50);
          const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
          const href = $el.attr('href') || '';
          const posicao = getPosicao($el);
          const possuiGtag = !!$el.attr('data-gtag') || !!$el.attr('data-gtm') || ($el.attr('class') || '').includes('gtag-click-trigger');

          // Pula externos
          if (href && href.startsWith('http') && !href.includes('sicredi.com.br')) return;
          
          // Ignora header/rodapé se configurado (são repetidos em todas as páginas)
          if (IGNORAR_RODAPE && posicao === 'rodape') return;
          if (IGNORAR_HEADER && posicao === 'header') return;

          elementos.push({
            index: i, tag, texto, classes, href, posicao, possuiGtag,
            descricao: `${tag}${classes ? '.' + classes : ''}[${texto}]`,
          });
        });

        cy.log(`🔍 ${cenario.nome}: ${elementos.length} elementos a clicar`);

        cy.wrap(elementos).each((elem, idx) => {
          cy.get(SELETOR_CLICAVEIS).eq(elem.index).then(($el) => {
            if (!Cypress.dom.isAttached($el)) return;

            const tsClique = new Date().toISOString();
            const hitsAntes = ga4Requests.length;

            cy.wrap($el).scrollIntoView({ offset: { top: -150, left: 0 } });
            cy.wait(150);

            const hrefOriginal = $el.attr('href');
            cy.wrap($el).invoke('removeAttr', 'target');
            cy.wrap($el).invoke('removeAttr', 'href');

            cy.wrap($el).click({ force: true });
            cy.wait(ESPERA_CLIQUE);

            if (hrefOriginal) {
              cy.wrap($el).invoke('attr', 'href', hrefOriginal);
            }

            cy.then(() => {
              const novosHits = ga4Requests.slice(hitsAntes);
              const hitsRelevantes = novosHits.filter(r =>
                r.parsed?.en === 'clicks_gtag' ||
                r.parsed?.epAcao ||
                r.parsed?.epRotulo
              );

              if (hitsRelevantes.length > 0) {
                hitsRelevantes.forEach(hit => {
                  const row = buildCsvRow({
                    ts: tsClique,
                    ...pageMeta,
                    posicao_pagina: elem.posicao,
                    elemento_clicado: elem.descricao,
                    tipo_elemento: elem.tag,
                    href_destino: elem.href,
                    possui_data_gtag: elem.possuiGtag,
                    tem_ga: true,
                    ...hit.parsed,
                  });
                  cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
                  totalComGa++;
                });
                cy.log(`✅ (${idx + 1}) ${elem.texto.substring(0, 20)}`);
              } else {
                const row = buildCsvRow({
                  ts: tsClique,
                  ...pageMeta,
                  posicao_pagina: elem.posicao,
                  elemento_clicado: elem.descricao,
                  tipo_elemento: elem.tag,
                  href_destino: elem.href,
                  possui_data_gtag: elem.possuiGtag,
                  tem_ga: false,
                  tipo_disparo: 'sem_ga',
                  tid: '', en: '', epAcao: '', epCategoria: '', epRotulo: '',
                });
                cy.writeFile(CSV_PATH, row + '\n', { flag: 'a' });
                totalSemGa++;
              }
            });
          });
        });
      });
    });
  });
});

// ========== FUNÇÕES ==========

function setupGa4Spy(win) {
  const processGaRequest = (url, method) => {
    if (!url) return;
    if (!url.includes('google-analytics') &&
        !url.includes('analytics.google.com') &&
        !url.includes('/g/collect') &&
        !url.includes('/ccm/collect')) {
      return;
    }

    const parsed = parseGaUrl(url);
    if (!parsed || !parsed.tid || parsed.tid.startsWith('AW-')) return;

    ga4Requests.push({
      ts: new Date().toISOString(),
      method,
      parsed,
      cenario: cenarioAtual,
    });
  };

  const originalFetch = win.fetch.bind(win);
  win.fetch = (url, options) => {
    processGaRequest(typeof url === 'string' ? url : url?.url || '', 'fetch');
    return originalFetch(url, options);
  };

  const originalSendBeacon = win.navigator.sendBeacon.bind(win.navigator);
  win.navigator.sendBeacon = (url, data) => {
    processGaRequest(url, 'sendBeacon');
    return originalSendBeacon(url, data);
  };

  const originalXHROpen = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function(method, url) {
    processGaRequest(url, `XHR-${method}`);
    return originalXHROpen.apply(this, arguments);
  };
}

function getPosicao($el) {
  if ($el.closest('header').length) return 'header';
  if ($el.closest('footer, .rodape, #rodape').length) return 'rodape';
  if ($el.closest('.hero, .banner, [class*="hero"], [class*="banner"]').length) return 'hero';
  return 'corpo';
}

function sanitize(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvRow(data) {
  return [
    sanitize(data.ts || ''),
    sanitize(data.cenario || ''),
    sanitize(data.url || ''),
    sanitize(data.page_path || ''),
    sanitize(data.page_title || ''),
    sanitize(data.posicao_pagina || ''),
    sanitize(data.elemento_clicado || ''),
    sanitize(data.tipo_elemento || ''),
    sanitize(data.href_destino || ''),
    sanitize(data.possui_data_gtag),
    sanitize(data.tem_ga),
    sanitize(data.tipo_disparo || ''),
    sanitize(data.tid || ''),
    sanitize(data.en || ''),
    sanitize(data.epAcao || ''),
    sanitize(data.epCategoria || ''),
    sanitize(data.epRotulo || ''),
  ].join(',');
}

