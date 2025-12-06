// Debug simples - testar escrita de arquivo
const FLUXO = 'debug';
const CSV = 'cypress/downloads/debug_teste.csv';

Cypress.on('uncaught:exception', () => false);

describe('Debug Escrita CSV', () => {
  let linhas = ['ts,fluxo,teste'];

  it('Visita página e salva CSV', () => {
    cy.log('🔍 Iniciando debug...');
    
    // Visita
    cy.visit('https://www.sicredi.com.br/site/pix', { 
      failOnStatusCode: false, 
      timeout: 60000 
    });
    cy.wait(3000);
    
    // Adiciona linha de teste
    linhas.push(`${new Date().toISOString()},${FLUXO},visitou_pagina`);
    cy.log('📝 Linha adicionada: ' + linhas.length);
    
    // Conta elementos
    cy.document().then(doc => {
      const els = doc.querySelectorAll('a, button');
      linhas.push(`${new Date().toISOString()},${FLUXO},encontrou_${els.length}_elementos`);
      cy.log('🔢 Elementos: ' + els.length);
    });
  });

  after(() => {
    cy.log('💾 Tentando salvar CSV com ' + linhas.length + ' linhas...');
    cy.log('📄 Conteúdo: ' + linhas.join(' | '));
    
    // Método 1: cy.writeFile
    cy.writeFile(CSV, linhas.join('\n') + '\n').then(() => {
      cy.log('✅ cy.writeFile executado');
    });
    
    // Método 2: cy.task
    cy.task('salvarCsv', { 
      arquivo: 'cypress/downloads/debug_task.csv', 
      conteudo: linhas.join('\n') + '\n' 
    }).then(() => {
      cy.log('✅ cy.task executado');
    });
  });
});

