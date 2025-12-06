// cypress/e2e/cenarios/cartoes.cy.js
// Auditoria GA4 - Cenário: Cartões
// Execute com: npx cypress run --spec "cypress/e2e/cenarios/cartoes.cy.js"

const { parseGaUrl } = require('../utils/gaHelpers');
const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'cartoes';
const URLS = [
  'https://www.sicredi.com.br/site/cartoes',
  'https://www.sicredi.com.br/site/cartoes/cartao-empresarial',
  'https://www.sicredi.com.br/site/cartoes/cartao-para-voce',
  'https://www.sicredi.com.br/site/cartoes/cartao-sicredi-debito',
  'https://www.sicredi.com.br/site/cartoes/cartao-sicredi-gold',
  'https://www.sicredi.com.br/site/cartoes/cartao-sicredi-internacional',
  'https://www.sicredi.com.br/site/cartoes/cartao-sicredi-mastercard-black',
  'https://www.sicredi.com.br/site/cartoes/cartao-sicredi-platinum',
  'https://www.sicredi.com.br/site/cartoes/programa-de-recompensa',
];

auditarPaginas(CENARIO, URLS);

