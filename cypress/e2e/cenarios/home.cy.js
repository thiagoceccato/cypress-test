// cypress/e2e/cenarios/home.cy.js
// Auditoria GA4 - Cenário: Homepage
// Execute: npx cypress run --spec "cypress/e2e/cenarios/home.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'home';
const URLS = [
  'https://www.sicredi.com.br',
  'https://www.sicredi.com.br/home',
];

auditarPaginas(CENARIO, URLS);

