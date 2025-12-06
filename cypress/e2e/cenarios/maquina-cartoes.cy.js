// cypress/e2e/cenarios/maquina-cartoes.cy.js
// Auditoria GA4 - Cenário: Máquina de Cartões
// Execute: npx cypress run --spec "cypress/e2e/cenarios/maquina-cartoes.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'maquina-cartoes';
const URLS = [
  'https://www.sicredi.com.br/site/maquina-de-cartoes',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/clover',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/clover-flex',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/clover-mini',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/e-commerce',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/link-pagamento',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/maquina-com-fio',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/maquina-sem-fio',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/tap-sicredi',
  'https://www.sicredi.com.br/site/maquina-de-cartoes/tef',
];

auditarPaginas(CENARIO, URLS);

