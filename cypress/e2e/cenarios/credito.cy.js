// cypress/e2e/cenarios/credito.cy.js
// Auditoria GA4 - Cenário: Crédito
// Execute: npx cypress run --spec "cypress/e2e/cenarios/credito.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'credito';
const URLS = [
  'https://www.sicredi.com.br/site/credito/para-agronegocio',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/comercializacao',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/cpr',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/cpr/cpr-facil',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/cpr/cpr-tradicional',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/custeio',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/custeio/custeio-agropecuario',
  'https://www.sicredi.com.br/site/credito/para-agronegocio/custeio/pronaf',
];

auditarPaginas(CENARIO, URLS);

