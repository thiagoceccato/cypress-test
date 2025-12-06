// cypress/e2e/teste_dois_botoes.cy.js
// Teste focado nos dois botões "Abrir conta":
// 1. Botão do HEADER (aparece depois de um tempo)
// 2. Botão CENTRAL (precisa preencher algo antes)

const CSV_FILE = 'cypress/downloads/debug_dois_botoes.csv';
const XLS_FILE = 'cypress/downloads/debug_dois_botoes.xlsx';

Cypress.on('uncaught:exception', () => false);

describe('DEBUG - Dois botões Abrir Conta', () => {
  let allHits = [];
  let allDataLayer = [];

  before(() => {
    cy.task('initExcel', { filePath: XLS_FILE });
    cy.writeFile(CSV_FILE, 'teste,timestamp,source,evento,gtm_triggers,classes,ep_acao,ep_categoria,ep_rotulo,raw\n');
  });

  after(() => {
    cy.log(`📊 Total hits: ${allHits.length}`);
    cy.log(`📊 Total dataLayer: ${allDataLayer.length}`);
    cy.task('addExcelSummary', { filePath: XLS_FILE });
  });

  it('1. Botão HEADER - espera aparecer e clica', () => {
    setupInterceptors('header');

    cy.visit('https://www.sicredi.com.br/site/seja-associado/', {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad: setupWindowMonitoring,
    });

    // Espera página carregar completamente
    cy.wait(8000);

    // Aceita cookies
    aceitarCookies();
    cy.wait(2000);

    // Procura especificamente o botão no HEADER
    cy.log('🔍 Procurando botão Abrir conta no HEADER...');
    
    // Tenta múltiplos seletores para o header
    cy.get('header, [class*="header"], [id*="header"], nav', { timeout: 15000 })
      .first()
      .within(() => {
        // Espera o botão aparecer no header
        cy.contains('a, button', /abrir conta/i, { timeout: 20000 })
          .should('be.visible')
          .then(($btn) => {
            clicarECapturar($btn, 'header', 'Botão Header');
          });
      });
  });

  it('2. Botão CENTRAL - preenche formulário e clica', () => {
    setupInterceptors('central');

    cy.visit('https://www.sicredi.com.br/site/seja-associado/', {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad: setupWindowMonitoring,
    });

    cy.wait(6000);
    aceitarCookies();
    cy.wait(2000);

    cy.log('🔍 Procurando formulário e botão central...');

    // Scroll para a área do formulário
    cy.get('body').then(($body) => {
      // Procura o formulário ou área central
      const formArea = $body.find('form, [class*="form"], [class*="hero"], main section').first();
      
      if (formArea.length) {
        cy.wrap(formArea).scrollIntoView();
        cy.wait(1000);
      }
    });

    // Tenta preencher campos do formulário se existirem
    cy.get('body').then(($body) => {
      // CPF/CNPJ
      const cpfInput = $body.find('input[name*="cpf"], input[name*="documento"], input[placeholder*="CPF"], input[type="tel"]').first();
      if (cpfInput.length) {
        cy.wrap(cpfInput).clear().type('12345678901', { force: true });
        cy.log('✏️ CPF preenchido');
        cy.wait(500);
      }

      // Nome
      const nomeInput = $body.find('input[name*="nome"], input[placeholder*="nome"]').first();
      if (nomeInput.length) {
        cy.wrap(nomeInput).clear().type('Teste Usuario', { force: true });
        cy.log('✏️ Nome preenchido');
        cy.wait(500);
      }

      // Telefone
      const telInput = $body.find('input[name*="telefone"], input[name*="celular"], input[placeholder*="telefone"]').first();
      if (telInput.length) {
        cy.wrap(telInput).clear().type('11999999999', { force: true });
        cy.log('✏️ Telefone preenchido');
        cy.wait(500);
      }

      // Email
      const emailInput = $body.find('input[type="email"], input[name*="email"]').first();
      if (emailInput.length) {
        cy.wrap(emailInput).clear().type('teste@teste.com', { force: true });
        cy.log('✏️ Email preenchido');
        cy.wait(500);
      }
    });

    cy.wait(1000);

    // Agora procura o botão central (não no header)
    cy.get('main, section, [class*="hero"], [class*="form"], form', { timeout: 10000 })
      .find('a, button')
      .filter(':contains("Abrir conta"), :contains("Continuar"), :contains("Enviar"), :contains("Próximo")')
      .filter(':visible')
      .first()
      .then(($btn) => {
        if ($btn.length) {
          clicarECapturar($btn, 'central', 'Botão Central');
        } else {
          cy.log('❌ Botão central não encontrado após preencher formulário');
          
          // Tenta qualquer botão com classe gtag
          cy.get('[class*="gtag"], .gtag-click-trigger')
            .filter(':visible')
            .not('header *')
            .first()
            .then(($gtagBtn) => {
              if ($gtagBtn.length) {
                clicarECapturar($gtagBtn, 'central-gtag', 'Botão com gtag');
              }
            });
        }
      });
  });

  // Funções auxiliares

  function setupInterceptors(testName) {
    cy.intercept({ url: /google-analytics\.com|googletagmanager\.com/i }, (req) => {
      const parsed = parseGaUrl(req.url + (req.body ? '&' + req.body : ''));
      if (parsed) {
        allHits.push({ ...parsed, test: testName, source: 'intercept' });
      }
      req.continue();
    }).as('ga');
  }

  function setupWindowMonitoring(win) {
    // Monitor sendBeacon
    const origBeacon = win.navigator.sendBeacon;
    win.navigator.sendBeacon = function(url, data) {
      if (url?.includes('google')) {
        const parsed = parseGaUrl(url + (data ? '&' + data : ''));
        if (parsed) allHits.push({ ...parsed, source: 'beacon' });
        console.log('[BEACON]', url?.slice(0, 100));
      }
      return origBeacon.apply(this, arguments);
    };

    // Monitor dataLayer
    win.dataLayer = win.dataLayer || [];
    const origPush = win.dataLayer.push;
    win.dataLayer.push = function(...args) {
      args.forEach(item => {
        if (item && typeof item === 'object') {
          allDataLayer.push({
            timestamp: new Date().toISOString(),
            event: item.event || '',
            triggers: item['gtm.triggers'] || '',
            classes: item['gtm.elementClasses'] || '',
            raw: JSON.stringify(item).slice(0, 300),
          });
          
          // Se tem ep.* params, extrai
          if (item['ep.acao'] || item['ep.categoria'] || item['ep.rotulo']) {
            allHits.push({
              source: 'dataLayer-ep',
              en: item.event,
              epAcao: item['ep.acao'] || '',
              epCategoria: item['ep.categoria'] || '',
              epRotulo: item['ep.rotulo'] || '',
            });
          }
          
          console.log('[DL]', item.event, item['gtm.elementClasses']?.slice(0, 50));
        }
      });
      return origPush.apply(this, args);
    };

    // Monitor gtag
    const origGtag = win.gtag || function(){};
    win.gtag = function(...args) {
      console.log('[GTAG]', args[0], args[1]);
      if (args[0] === 'event') {
        allHits.push({
          source: 'gtag-direct',
          en: args[1],
          epAcao: args[2]?.acao || args[2]?.['ep.acao'] || '',
          epCategoria: args[2]?.categoria || args[2]?.['ep.categoria'] || '',
          epRotulo: args[2]?.rotulo || args[2]?.['ep.rotulo'] || '',
          raw: JSON.stringify(args).slice(0, 200),
        });
      }
      return origGtag.apply(this, args);
    };

    // Monitor fetch
    const origFetch = win.fetch;
    win.fetch = function(url, opts) {
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      if (urlStr.includes('google-analytics') || urlStr.includes('collect')) {
        const parsed = parseGaUrl(urlStr);
        if (parsed) allHits.push({ ...parsed, source: 'fetch' });
        console.log('[FETCH]', urlStr.slice(0, 100));
      }
      return origFetch.apply(this, arguments);
    };
  }

  function clicarECapturar($btn, testName, descricao) {
    const elementoDesc = `${$btn.prop('tagName').toLowerCase()}[${$btn.text().trim().slice(0, 30)}]`;
    const classes = $btn.attr('class') || '';
    const href = $btn.attr('href') || '';

    cy.log(`🎯 ${descricao}: ${elementoDesc}`);
    cy.log(`   Classes: ${classes.slice(0, 80)}`);
    cy.log(`   Href: ${href}`);

    const hitsBefore = allHits.length;
    const dlBefore = allDataLayer.length;

    $btn.removeAttr('target');

    cy.wrap($btn)
      .scrollIntoView()
      .wait(500)
      .click({ force: true });

    // Espera mais tempo para capturar eventos assíncronos
    cy.wait(4000).then(() => {
      const newHits = allHits.slice(hitsBefore);
      const newDL = allDataLayer.slice(dlBefore);

      cy.log(`🔥 ${descricao} - Novos hits: ${newHits.length}`);
      cy.log(`🔥 ${descricao} - Novos dataLayer: ${newDL.length}`);

      // Mostra e salva hits
      if (newHits.length > 0) {
        newHits.forEach((hit, i) => {
          cy.log(`✅ Hit ${i+1}: ${hit.en || hit.event || 'N/A'} | acao=${hit.epAcao} | src=${hit.source}`);

          const csvLine = [
            testName,
            new Date().toISOString(),
            hit.source,
            hit.en || '',
            '',
            classes.slice(0, 50),
            hit.epAcao || '',
            hit.epCategoria || '',
            hit.epRotulo || '',
            `"${(hit.raw || '').replace(/"/g, '""').slice(0, 150)}"`,
          ].join(',') + '\n';
          cy.writeFile(CSV_FILE, csvLine, { flag: 'a+' });

          cy.task('appendExcelRow', {
            filePath: XLS_FILE,
            rowData: {
              timestamp: new Date().toISOString(),
              url: 'https://www.sicredi.com.br/site/seja-associado/',
              page_path: '/site/seja-associado/',
              page_title: '',
              page_referrer: '',
              fluxo: testName,
              posicao_pagina: testName,
              elemento_clicado: elementoDesc,
              tipo_elemento: $btn.prop('tagName').toLowerCase(),
              href_destino: href,
              destino_interno_externo: 'interno',
              abre_nova_aba: 'Não',
              possui_data_gtag: classes.includes('gtag') ? 'Sim' : 'Não',
              tem_ga: 'Sim',
              tipo_disparo: hit.en || 'dataLayer',
              tid: hit.tid || '',
              en: hit.en || '',
              ep_acao: hit.epAcao || '',
              ep_categoria: hit.epCategoria || '',
              ep_rotulo: hit.epRotulo || '',
              ep_raw_json: hit.raw || hit.epRawJson || '',
            },
          });
        });
      }

      // Mostra dataLayer
      if (newDL.length > 0) {
        cy.log('📋 DataLayer pushes:');
        newDL.forEach((dl, i) => {
          cy.log(`  ${i+1}. ${dl.event} | triggers=${dl.triggers} | classes=${dl.classes?.slice(0,30)}`);
          
          const csvLine = [
            testName,
            dl.timestamp,
            'dataLayer',
            dl.event,
            dl.triggers,
            dl.classes?.slice(0, 50),
            '', '', '',
            `"${dl.raw.replace(/"/g, '""').slice(0, 150)}"`,
          ].join(',') + '\n';
          cy.writeFile(CSV_FILE, csvLine, { flag: 'a+' });
        });
      }

      if (newHits.length === 0 && newDL.length === 0) {
        cy.log(`❌ ${descricao} - Nenhum evento capturado!`);
      }
    });
  }

  function aceitarCookies() {
    cy.get('body').then(($body) => {
      ['Permitir todos', 'Aceitar todos', 'Aceitar', 'OK'].forEach(txt => {
        const btn = $body.find(`button:contains("${txt}")`).first();
        if (btn.length) cy.wrap(btn).click({ force: true });
      });
    });
  }

  function parseGaUrl(url) {
    if (!url) return null;
    try {
      let params;
      try { params = new URL(url).searchParams; }
      catch { 
        const q = url.indexOf('?');
        if (q === -1) return null;
        params = new URLSearchParams(url.slice(q + 1));
      }

      const tid = params.get('tid') || '';
      if (!tid || tid.startsWith('AW-')) return null;

      return {
        tid,
        en: params.get('en') || '',
        epAcao: params.get('ep.acao') || '',
        epCategoria: params.get('ep.categoria') || '',
        epRotulo: params.get('ep.rotulo') || '',
        epRawJson: (() => {
          const ep = {};
          for (const [k, v] of params.entries()) {
            if (k.startsWith('ep.')) ep[k] = v;
          }
          return Object.keys(ep).length ? JSON.stringify(ep) : '';
        })(),
      };
    } catch { return null; }
  }
});

