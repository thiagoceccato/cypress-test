// cypress/e2e/teste_captura_completa.cy.js
// Teste com captura completa de GA4 incluindo ep.* params
// AJUSTES:
// 1. Faz SCROLL para botão do header aparecer
// 2. Aceita cookies de forma robusta ANTES de qualquer interação

const CSV_FILE = 'cypress/downloads/captura_completa_ga4.csv';
const XLS_FILE = 'cypress/downloads/captura_completa_ga4.xlsx';

Cypress.on('uncaught:exception', () => false);

describe('Captura Completa GA4 - Abrir Conta', () => {
  let networkRequests = [];
  let dataLayerEvents = [];

  before(() => {
    cy.task('initExcel', { filePath: XLS_FILE });
    cy.writeFile(CSV_FILE, 'timestamp,source,en,tid,ep_acao,ep_categoria,ep_rotulo,elemento,url_completa\n');
  });

  after(() => {
    cy.log(`📊 Network Requests: ${networkRequests.length}`);
    cy.log(`📊 DataLayer Events: ${dataLayerEvents.length}`);
    
    const unicos = {};
    networkRequests.forEach(r => {
      const key = `${r.en}|${r.epAcao}|${r.epRotulo}`;
      unicos[key] = r;
    });
    
    cy.log('Eventos únicos capturados:');
    Object.values(unicos).forEach((r, i) => {
      cy.log(`  ${i+1}. ${r.en} | acao=${r.epAcao} | rotulo=${r.epRotulo}`);
    });

    cy.task('addExcelSummary', { filePath: XLS_FILE });
  });

  it('Captura TODAS as requisições GA4 do botão Abrir Conta', () => {
    // INTERCEPT amplo
    cy.intercept('**/*google*/**', (req) => {
      if (req.url.includes('collect') || req.url.includes('analytics')) {
        processRequest(req.url, req.body, 'intercept-' + req.method);
      }
      req.continue();
    }).as('allGoogle');

    cy.intercept('**/g/collect**', (req) => {
      processRequest(req.url, req.body, 'ga4-collect');
      req.continue();
    }).as('ga4Collect');

    cy.visit('https://www.sicredi.com.br/site/seja-associado/', {
      failOnStatusCode: false,
      timeout: 120000,
      onBeforeLoad(win) {
        setupWindowMonitoring(win);
      },
    });

    // Espera página carregar
    cy.wait(5000);

    // =============================================
    // 1. ACEITAR COOKIES PRIMEIRO - MAIS ROBUSTO
    // =============================================
    cy.log('🍪 Procurando banner de cookies...');
    
    cy.get('body').then(($body) => {
      // Lista de seletores possíveis para o botão de aceitar cookies
      const seletoresCookies = [
        // Por texto
        'button:contains("Permitir todos")',
        'button:contains("Permitir Todos")',
        'button:contains("Aceitar todos")',
        'button:contains("Aceitar Todos")',
        'button:contains("Aceitar cookies")',
        'button:contains("Aceitar")',
        'button:contains("OK")',
        'button:contains("Concordo")',
        'button:contains("Entendi")',
        'a:contains("Permitir todos")',
        'a:contains("Aceitar")',
        // Por classe/id
        '[class*="cookie"] button',
        '[class*="Cookie"] button',
        '[id*="cookie"] button',
        '[id*="Cookie"] button',
        '[class*="consent"] button',
        '[class*="lgpd"] button',
        '[class*="LGPD"] button',
        '#onetrust-accept-btn-handler',
        '.onetrust-accept-btn-handler',
        '[id*="accept"]',
        '[class*="accept-all"]',
        '[class*="accept-cookies"]',
        // Sicredi específico (se houver)
        '.cookie-banner button',
        '.privacy-banner button',
        '[data-cookie-accept]',
      ];

      let encontrou = false;
      
      for (const seletor of seletoresCookies) {
        try {
          const btn = $body.find(seletor).filter(':visible').first();
          if (btn.length > 0) {
            cy.log(`🍪 Encontrado: ${seletor}`);
            cy.wrap(btn).click({ force: true });
            encontrou = true;
            break;
          }
        } catch (e) {
          // continua tentando
        }
      }

      if (!encontrou) {
        cy.log('⚠️ Banner de cookies não encontrado automaticamente');
      }
    });

    // Espera o banner fechar
    cy.wait(2000);

    // Log estado após cookies
    cy.then(() => {
      cy.log(`📄 Após aceitar cookies: ${networkRequests.length} requests`);
    });

    // =============================================
    // 2. FAZ SCROLL PARA O BOTÃO DO HEADER APARECER
    // =============================================
    cy.log('📜 Fazendo scroll para o botão do header aparecer...');
    
    // Scroll para baixo (para trigger do sticky header)
    cy.scrollTo(0, 500);
    cy.wait(1000);
    
    // Scroll mais
    cy.scrollTo(0, 800);
    cy.wait(1000);

    // Volta um pouco
    cy.scrollTo(0, 400);
    cy.wait(1500);

    // Verifica se o botão apareceu
    cy.log('🔍 Procurando botão Abrir conta após scroll...');

    // Encontra o botão "Abrir conta" (qualquer um visível)
    cy.contains('a, button', /abrir conta/i, { timeout: 15000 })
      .filter(':visible')
      .first()
      .then(($btn) => {
        const elementDesc = `${$btn.prop('tagName').toLowerCase()}#${$btn.attr('id') || ''}.${($btn.attr('class') || '').split(' ').slice(0, 2).join('.')}[${$btn.text().trim().slice(0, 20)}]`;
        
        cy.log(`🎯 Botão encontrado: ${elementDesc}`);
        cy.log(`   Href: ${$btn.attr('href') || 'N/A'}`);
        cy.log(`   Classes: ${$btn.attr('class')}`);

        const requestsBefore = networkRequests.length;
        const dlBefore = dataLayerEvents.length;

        // Scroll até o botão para garantir que está visível
        cy.wrap($btn).scrollIntoView({ offset: { top: -100, left: 0 } });
        cy.wait(500);

        // Remove target
        $btn.removeAttr('target');

        // CLICA
        cy.log('🖱️ Clicando no botão...');
        cy.wrap($btn).click({ force: true });

        // Espera para capturar eventos assíncronos
        cy.wait(5000).then(() => {
          const newRequests = networkRequests.slice(requestsBefore);
          const newDL = dataLayerEvents.slice(dlBefore);

          cy.log(`🔥 Novas requisições após clique: ${newRequests.length}`);
          cy.log(`🔥 Novos dataLayer após clique: ${newDL.length}`);

          // MOSTRA E SALVA REQUISIÇÕES
          if (newRequests.length > 0) {
            cy.log('=== REQUISIÇÕES CAPTURADAS ===');
            newRequests.forEach((req, i) => {
              cy.log(`✅ [${req.source}] ${req.en}`);
              cy.log(`   ep.acao: ${req.epAcao}`);
              cy.log(`   ep.categoria: ${req.epCategoria}`);
              cy.log(`   ep.rotulo: ${req.epRotulo}`);
              cy.log(`   tid: ${req.tid}`);

              // Salva CSV
              const csvLine = [
                req.timestamp,
                req.source,
                req.en,
                req.tid,
                req.epAcao,
                req.epCategoria,
                req.epRotulo,
                elementDesc.replace(/,/g, ';'),
                (req.raw || '').replace(/,/g, ';').slice(0, 100),
              ].join(',') + '\n';
              cy.writeFile(CSV_FILE, csvLine, { flag: 'a+' });

              // Salva Excel
              cy.task('appendExcelRow', {
                filePath: XLS_FILE,
                rowData: {
                  timestamp: req.timestamp,
                  url: 'https://www.sicredi.com.br/site/seja-associado/',
                  page_path: '/site/seja-associado/',
                  page_title: '',
                  page_referrer: '',
                  fluxo: 'abrir-conta',
                  posicao_pagina: 'header',
                  elemento_clicado: elementDesc,
                  tipo_elemento: $btn.prop('tagName').toLowerCase(),
                  href_destino: $btn.attr('href') || '',
                  destino_interno_externo: 'interno',
                  abre_nova_aba: 'Não',
                  possui_data_gtag: ($btn.attr('class') || '').includes('gtag') ? 'Sim' : 'Não',
                  tem_ga: 'Sim',
                  tipo_disparo: req.en,
                  tid: req.tid,
                  en: req.en,
                  ep_acao: req.epAcao,
                  ep_categoria: req.epCategoria,
                  ep_rotulo: req.epRotulo,
                  ep_raw_json: req.raw || '',
                },
              });
            });
          }

          // MOSTRA DATALAYER
          if (newDL.length > 0) {
            cy.log('=== DATALAYER EVENTS ===');
            newDL.forEach((dl, i) => {
              cy.log(`📋 ${dl.event} | classes: ${dl.classes?.slice(0, 40)}`);
            });
          }

          if (newRequests.length === 0) {
            cy.log('❌ Nenhuma requisição GA4 capturada após clique');
            
            const comAcao = networkRequests.filter(r => r.epAcao);
            if (comAcao.length > 0) {
              cy.log(`Encontradas ${comAcao.length} requisições com ep.acao no total:`);
              comAcao.forEach(r => cy.log(`  - ${r.en}: ${r.epAcao}`));
            }
          }
        });
      });

    // Resumo final
    cy.then(() => {
      cy.log('========== RESUMO FINAL ==========');
      cy.log(`Total requests: ${networkRequests.length}`);
      cy.log(`Total dataLayer: ${dataLayerEvents.length}`);

      const comAcao = networkRequests.filter(r => r.epAcao);
      cy.log(`Requests com ep.acao: ${comAcao.length}`);
      
      comAcao.forEach(r => {
        cy.log(`  ✅ ${r.source}: ${r.en} | acao=${r.epAcao} | rotulo=${r.epRotulo}`);
      });

      cy.writeFile(CSV_FILE, `\n# RESUMO\n`, { flag: 'a+' });
      cy.writeFile(CSV_FILE, `# Total requests: ${networkRequests.length}\n`, { flag: 'a+' });
      cy.writeFile(CSV_FILE, `# Requests com ep.acao: ${comAcao.length}\n`, { flag: 'a+' });
    });
  });

  function setupWindowMonitoring(win) {
    // === STUB sendBeacon ===
    const originalSendBeacon = win.navigator.sendBeacon.bind(win.navigator);
    win.navigator.sendBeacon = function(url, data) {
      console.log('[BEACON URL]', url);
      
      if (url && url.includes('google')) {
        let fullUrl = url;
        if (data) {
          const dataStr = typeof data === 'string' ? data : 
                          data instanceof Blob ? 'blob-data' :
                          data instanceof FormData ? 'formdata' :
                          String(data);
          if (dataStr && dataStr !== 'blob-data' && dataStr !== 'formdata') {
            fullUrl += (url.includes('?') ? '&' : '?') + dataStr;
          }
        }
        processRequest(fullUrl, data, 'sendBeacon');
      }
      return originalSendBeacon(url, data);
    };

    // === Monitor XMLHttpRequest ===
    const XHROpen = win.XMLHttpRequest.prototype.open;
    const XHRSend = win.XMLHttpRequest.prototype.send;
    
    win.XMLHttpRequest.prototype.open = function(method, url) {
      this._gaUrl = url;
      this._gaMethod = method;
      return XHROpen.apply(this, arguments);
    };
    
    win.XMLHttpRequest.prototype.send = function(body) {
      if (this._gaUrl && this._gaUrl.includes('google')) {
        console.log('[XHR]', this._gaMethod, this._gaUrl);
        processRequest(this._gaUrl, body, 'xhr');
      }
      return XHRSend.apply(this, arguments);
    };

    // === Monitor Fetch ===
    const originalFetch = win.fetch.bind(win);
    win.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('google')) {
        console.log('[FETCH]', url);
        processRequest(url, init?.body, 'fetch');
      }
      return originalFetch(input, init);
    };

    // === Monitor DataLayer ===
    win.dataLayer = win.dataLayer || [];
    const originalPush = Array.prototype.push;
    
    Object.defineProperty(win.dataLayer, 'push', {
      value: function(...items) {
        items.forEach(item => {
          if (item && typeof item === 'object' && item.event) {
            const eventData = {
              timestamp: new Date().toISOString(),
              event: item.event,
              classes: item['gtm.elementClasses'] || '',
              triggers: item['gtm.triggers'] || '',
              raw: JSON.stringify(item).slice(0, 500),
            };
            dataLayerEvents.push(eventData);
            console.log('[DATALAYER]', item.event, eventData.classes);
          }
        });
        return originalPush.apply(this, items);
      },
      writable: true,
      configurable: true,
    });

    // === Monitor gtag diretamente ===
    const checkGtag = setInterval(() => {
      if (win.gtag && !win._gtagMonitored) {
        win._gtagMonitored = true;
        const origGtag = win.gtag;
        win.gtag = function(...args) {
          console.log('[GTAG CALL]', args[0], args[1]);
          if (args[0] === 'event') {
            const eventParams = args[2] || {};
            networkRequests.push({
              timestamp: new Date().toISOString(),
              source: 'gtag-direct',
              en: args[1],
              tid: '',
              epAcao: eventParams.acao || eventParams['ep.acao'] || '',
              epCategoria: eventParams.categoria || eventParams['ep.categoria'] || '',
              epRotulo: eventParams.rotulo || eventParams['ep.rotulo'] || '',
              raw: JSON.stringify(args).slice(0, 300),
            });
          }
          return origGtag.apply(this, args);
        };
        clearInterval(checkGtag);
      }
    }, 100);
    
    setTimeout(() => clearInterval(checkGtag), 10000);
  }

  function processRequest(url, body, source) {
    if (!url) return;
    
    try {
      let fullUrl = url;
      if (body) {
        const bodyStr = typeof body === 'string' ? body : '';
        if (bodyStr) {
          fullUrl += (url.includes('?') ? '&' : '?') + bodyStr;
        }
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
      const en = params.get('en') || '';
      
      if (tid.startsWith('AW-')) return;
      if (!tid && !en) return;

      const request = {
        timestamp: new Date().toISOString(),
        source,
        tid,
        en,
        epAcao: params.get('ep.acao') || '',
        epCategoria: params.get('ep.categoria') || '',
        epRotulo: params.get('ep.rotulo') || '',
        raw: fullUrl.slice(0, 300),
      };

      const epParams = {};
      for (const [key, value] of params.entries()) {
        if (key.startsWith('ep.')) {
          epParams[key] = value;
        }
      }
      if (Object.keys(epParams).length > 0) {
        request.epRawJson = JSON.stringify(epParams);
      }

      networkRequests.push(request);
      
      console.log(`[CAPTURED ${source}]`, en, 'tid:', tid, 'acao:', request.epAcao);
    } catch (e) {
      console.error('[processRequest error]', e.message);
    }
  }
});
