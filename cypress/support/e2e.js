// cypress/support/e2e.js

// Ignora apenas exceções de JS da página relacionadas a cross-origin / postMessage.
// Isso impede que o teste QUEBRE por causa de bug do site,
// mas deixa qualquer outra falha real estourar normalmente.

Cypress.on('uncaught:exception', (err) => {
  const msg = err && err.message ? err.message : String(err || '');

  const ignorar =
    msg.includes('Blocked a frame with origin') ||
    msg.includes('SecurityError') ||
    msg.includes("Failed to read a named property '$' from 'Window'") ||
    msg.includes('postMessage');

  if (ignorar) {
    Cypress.log({
      name: 'WARN',
      message: `Exceção JS ignorada (site): ${msg}`,
    });

    // returning false aqui diz pro Cypress:
    // "não falha o teste por causa disso"
    return false;
  }

  // Qualquer outra exceção: deixa quebrar, porque isso pode ser bug nosso mesmo
  // (não retorna nada -> Cypress trata como erro normal)
});
