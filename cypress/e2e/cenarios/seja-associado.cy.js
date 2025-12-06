// cypress/e2e/cenarios/seja-associado.cy.js
// Auditoria GA4 - Cenário: Seja Associado
// Execute: npx cypress run --spec "cypress/e2e/cenarios/seja-associado.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'seja-associado';
const URLS = [
  'https://www.sicredi.com.br/site/seja-associado',
];

auditarPaginas(CENARIO, URLS);

