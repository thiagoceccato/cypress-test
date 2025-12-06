// Debug - verificar quantos elementos são encontrados
Cypress.on('uncaught:exception', () => false);

describe('Debug Elementos', () => {
  let resultado = [];
  
  after(() => {
    cy.writeFile('cypress/downloads/debug_resultado.txt', resultado.join('\n'));
  });
  
  it('Conta elementos', () => {
    cy.visit('https://www.sicredi.com.br/site/seja-associado', { 
      failOnStatusCode: false, 
      timeout: 60000 
    });
    
    cy.wait(3000);
    resultado.push('Visitou página');
    
    // Aceita cookies
    cy.document().then(doc => {
      const btn = doc.querySelector('#onetrust-accept-btn-handler');
      if (btn) {
        btn.click();
        resultado.push('Clicou cookies');
      } else {
        resultado.push('Cookie btn não encontrado');
      }
    });
    
    cy.wait(2000);
    
    // Scroll
    cy.scrollTo('bottom', { duration: 1000, ensureScrollable: false });
    cy.wait(2000);
    cy.scrollTo('top', { duration: 500, ensureScrollable: false });
    cy.wait(1000);
    resultado.push('Fez scroll');
    
    // Conta elementos
    cy.document().then(doc => {
      const all = doc.querySelectorAll('a, button, [class*="gtag-click"]');
      resultado.push('TOTAL bruto: ' + all.length);
      
      const visible = Array.from(all).filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 5 && rect.height > 5 && 
               style.display !== 'none' && style.visibility !== 'hidden';
      });
      resultado.push('TOTAL visíveis: ' + visible.length);
      
      const semRodape = visible.filter(el => !el.closest('footer, [class*="footer"], [class*="rodape"]'));
      resultado.push('SEM RODAPÉ: ' + semRodape.length);
      
      // Mostra primeiros 10
      semRodape.slice(0, 10).forEach((el, i) => {
        const tag = el.tagName;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const href = el.getAttribute('href') || '';
        resultado.push(`[${i}] ${tag}: "${txt}" href=${href.slice(0, 50)}`);
      });
    });
  });
});
