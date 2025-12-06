// cypress/e2e/cenarios/previdencia.cy.js
// Auditoria GA4 - Cenário: Previdência
// Execute: npx cypress run --spec "cypress/e2e/cenarios/previdencia.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'previdencia';
const URLS = [
  'https://www.sicredi.com.br/site/previdencia',
  'https://www.sicredi.com.br/site/previdencia/empresarial',
  'https://www.sicredi.com.br/site/previdencia/individual',
];

auditarPaginas(CENARIO, URLS);

