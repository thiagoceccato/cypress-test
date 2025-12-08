// cypress/e2e/calibracao_tempo.cy.js
// CALIBRAÇÃO: descobre quanto tempo leva para requisições GA4 chegarem após clique

const { parseGaUrl } = require('./utils/gaHelpers');

const TESTE_URL = 'https://www.sicredi.com.br/site/cartoes';
const TEMPO_ESPERA_MAX = 8000; // 8 segundos de espera máxima

// Apenas elementos com gtag para teste mais rápido
const SELETOR_GTAG = '.gtag-click-trigger:visible';

Cypress.on('uncaught:exception', () => false);

describe('CALIBRAÇÃO - Tempo de resposta GA4', () => {
  let ga4Requests = [];
  let medicoes = []; // { elemento, tsClique, tsRequisicao, delta }

  after(() => {
    // Salva dados brutos
    cy.writeFile('cypress/results_novo/calibracao_dados.json', JSON.stringify({
      medicoes,
      ga4Requests: ga4Requests.map(r => ({
        ts: r.ts,
        en: r.parsed?.en,
        epRotulo: r.parsed?.epRotulo,
      }))
    }, null, 2));

    // Calcula estatísticas
    cy.then(() => {
      const deltasValidos = medicoes.filter(m => m.delta !== null).map(m => m.delta);
      
      if (deltasValidos.length === 0) {
        cy.log('❌ Nenhuma medição válida!');
        return;
      }

      const media = deltasValidos.reduce((a, b) => a + b, 0) / deltasValidos.length;
      const maximo = Math.max(...deltasValidos);
      const minimo = Math.min(...deltasValidos);
      const p90 = deltasValidos.sort((a, b) => a - b)[Math.floor(deltasValidos.length * 0.9)] || maximo;

      cy.log('═══════════════════════════════════════════════════════');
      cy.log('📊 RESULTADO DA CALIBRAÇÃO');
      cy.log('═══════════════════════════════════════════════════════');
      cy.log(`   Total de cliques: ${medicoes.length}`);
      cy.log(`   Cliques com GA4: ${deltasValidos.length}`);
      cy.log(`   Cliques sem GA4: ${medicoes.length - deltasValidos.length}`);
      cy.log('───────────────────────────────────────────────────────');
      cy.log(`   ⏱️  TEMPO MÍNIMO: ${minimo.toFixed(0)} ms`);
      cy.log(`   ⏱️  TEMPO MÉDIO:  ${media.toFixed(0)} ms`);
      cy.log(`   ⏱️  TEMPO P90:    ${p90.toFixed(0)} ms`);
      cy.log(`   ⏱️  TEMPO MÁXIMO: ${maximo.toFixed(0)} ms`);
      cy.log('───────────────────────────────────────────────────────');
      cy.log(`   💡 RECOMENDAÇÃO: Usar ${Math.ceil((maximo + 500) / 1000)} segundos de espera`);
      cy.log('═══════════════════════════════════════════════════════');

      // Salva resumo
      cy.writeFile('cypress/results_novo/calibracao_resumo.json', {
        totalCliques: medicoes.length,
        cliquesComGa4: deltasValidos.length,
        cliquesSemGa4: medicoes.length - deltasValidos.length,
        tempoMinimo: minimo,
        tempoMedio: media,
        tempoP90: p90,
        tempoMaximo: maximo,
        recomendacao: Math.ceil((maximo + 500) / 1000),
      });
    });
  });

  it('Mede tempo de resposta de cada clique', () => {
    cy.visit(TESTE_URL, {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad(win) {
        setupGa4Spy(win);
      },
    });

    cy.wait(6000);

    // Aceita cookies
    cy.get('body').then(($body) => {
      const btn = $body.find('button:contains("Permitir")').first();
      if (btn.length) {
        cy.wrap(btn).click({ force: true });
        cy.wait(2000);
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

    // Pega elementos gtag (limitado a 15 para teste rápido)
    cy.get(SELETOR_GTAG).then(($els) => {
      const total = Math.min($els.length, 15);
      cy.log(`🔍 Testando ${total} elementos com gtag-click-trigger`);

      const indices = Array.from({ length: total }, (_, i) => i);

      cy.wrap(indices).each((idx) => {
        cy.get(SELETOR_GTAG).eq(idx).then(($el) => {
          if (!Cypress.dom.isAttached($el)) return;

          const texto = ($el.text() || '').trim().slice(0, 40);
          const hrefOriginal = $el.attr('href');
          
          // Remove href para não navegar
          cy.wrap($el).invoke('removeAttr', 'href');
          cy.wrap($el).invoke('removeAttr', 'target');

          cy.wrap($el).scrollIntoView({ offset: { top: -150, left: 0 } });
          cy.wait(300);

          // MARCA TIMESTAMP DO CLIQUE
          const tsClique = Date.now();
          const hitsAntes = ga4Requests.length;

          cy.log(`👆 (${idx + 1}/${total}) Clicando: ${texto}`);
          cy.wrap($el).click({ force: true });

          // ESPERA TEMPO MÁXIMO
          cy.wait(TEMPO_ESPERA_MAX);

          // Restaura href
          if (hrefOriginal) {
            cy.wrap($el).invoke('attr', 'href', hrefOriginal);
          }

          // Analisa hits
          cy.then(() => {
            const novosHits = ga4Requests.slice(hitsAntes);
            const hitRelevante = novosHits.find(r => 
              r.parsed?.en === 'clicks_gtag' || 
              r.parsed?.epRotulo
            );

            if (hitRelevante) {
              const tsRequisicao = new Date(hitRelevante.ts).getTime();
              const delta = tsRequisicao - tsClique;
              
              medicoes.push({
                elemento: texto,
                tsClique,
                tsRequisicao,
                delta,
                rotulo: hitRelevante.parsed?.epRotulo || hitRelevante.parsed?.en,
              });
              
              cy.log(`   ✅ GA4 em ${delta}ms → ${hitRelevante.parsed?.epRotulo || ''}`);
            } else {
              medicoes.push({
                elemento: texto,
                tsClique,
                tsRequisicao: null,
                delta: null,
                rotulo: null,
              });
              cy.log(`   ⚠️ Sem GA4 após ${TEMPO_ESPERA_MAX}ms`);
            }
          });
        });
      });
    });
  });

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
  }
});




