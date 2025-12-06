// cypress/e2e/cenarios/investimentos.cy.js
// Auditoria GA4 - Cenário: Investimentos
// Execute: npx cypress run --spec "cypress/e2e/cenarios/investimentos.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'investimentos';
const URLS = [
  'https://www.sicredi.com.br/site/investimentos',
  'https://www.sicredi.com.br/site/investimentos/carteira-personalizada',
  'https://www.sicredi.com.br/site/investimentos/fundos-investimentos',
  'https://www.sicredi.com.br/site/investimentos/poupanca',
  'https://www.sicredi.com.br/site/investimentos/renda-fixa',
  'https://www.sicredi.com.br/site/investimentos/renda-variavel',
];

auditarPaginas(CENARIO, URLS);

