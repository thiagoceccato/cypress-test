// cypress/e2e/cenarios/consorcio.cy.js
// Auditoria GA4 - Cenário: Consórcio
// Execute: npx cypress run --spec "cypress/e2e/cenarios/consorcio.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'consorcio';
const URLS = [
  'https://www.sicredi.com.br/site/consorcio/simulador',
  'https://www.sicredi.com.br/site/consorcios',
  'https://www.sicredi.com.br/site/consorcios/automoveis',
  'https://www.sicredi.com.br/site/consorcios/caminhoes-tratores-e-utilitarios',
  'https://www.sicredi.com.br/site/consorcios/drones',
  'https://www.sicredi.com.br/site/consorcios/imoveis',
  'https://www.sicredi.com.br/site/consorcios/maquinas-e-equipamentos',
  'https://www.sicredi.com.br/site/consorcios/motocicletas',
  'https://www.sicredi.com.br/site/consorcios/moveis-planejados',
  'https://www.sicredi.com.br/site/consorcios/nautico',
  'https://www.sicredi.com.br/site/consorcios/servicos',
  'https://www.sicredi.com.br/site/consorcios/sustentavel',
];

auditarPaginas(CENARIO, URLS);

