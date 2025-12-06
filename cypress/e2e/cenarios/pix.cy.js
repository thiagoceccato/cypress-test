// cypress/e2e/cenarios/pix.cy.js
// Auditoria GA4 - Cenário: Pix
// Execute: npx cypress run --spec "cypress/e2e/cenarios/pix.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'pix';
const URLS = [
  'https://www.sicredi.com.br/site/pix',
  'https://www.sicredi.com.br/site/pix/pix-automatico',
  'https://www.sicredi.com.br/site/pixpj',
  'https://www.sicredi.com.br/site/pixpj/pix-automatico',
];

auditarPaginas(CENARIO, URLS);

