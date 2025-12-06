// Debug - comparar seletores
Cypress.on('uncaught:exception', () => false);

describe('Debug Seletores', () => {
  it('Compara seletores', () => {
    cy.visit('https://www.sicredi.com.br/site/seja-associado', { 
      failOnStatusCode: false, 
      timeout: 60000 
    });
    cy.wait(5000);
    cy.scrollTo('bottom', { duration: 500, ensureScrollable: false });
    cy.wait(2000);
    cy.scrollTo('top', { duration: 500, ensureScrollable: false });
    cy.wait(1000);
    
    // Método 1: cy.get com :visible
    cy.get('a:visible').then($els => {
      cy.log('cy.get(a:visible): ' + $els.length);
    });
    
    // Método 2: cy.get sem :visible + filter
    cy.get('a').then($els => {
      cy.log('cy.get(a) total: ' + $els.length);
      const vis = $els.toArray().filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      cy.log('cy.get(a) filtrado: ' + vis.length);
    });
    
    // Método 3: document.querySelectorAll
    cy.document().then(doc => {
      const all = doc.querySelectorAll('a');
      cy.log('querySelectorAll(a): ' + all.length);
      const vis = Array.from(all).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      cy.log('querySelectorAll(a) filtrado: ' + vis.length);
    });
  });
});

