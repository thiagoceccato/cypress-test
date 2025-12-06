// cypress/e2e/cenarios/outros.cy.js
// Auditoria GA4 - Cenário: Outros (MEI, Conta Corrente, etc.)
// Execute: npx cypress run --spec "cypress/e2e/cenarios/outros.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'outros';
const URLS = [
  'https://www.sicredi.com.br/site/mei',
  'https://www.sicredi.com.br/site/conta-corrente',
  'https://www.sicredi.com.br/site/conta-corrente/portabilidade-salario',
  'https://www.sicredi.com.br/site/pagamentos/para-empresa',
  'https://www.sicredi.com.br/site/pagamentos/para-voce',
  'https://www.sicredi.com.br/site/pagamentos/para-voce/tag-passagem',
  'https://www.sicredi.com.br/site/solucoes-para-condominios',
  'https://www.sicredi.com.br/site/solucoes-pj',
  'https://www.sicredi.com.br/site/solucoes-rh',
  'https://www.sicredi.com.br/site/recebimentos-para-empresa/cobranca',
  'https://www.sicredi.com.br/site/indicacao',
  'https://www.sicredi.com.br/site/energia-solar',
  'https://www.sicredi.com.br/site/open-finance',
  'https://www.sicredi.com.br/site/sobre-nos',
  'https://www.sicredi.com.br/site/sobre-nos/cooperativismo',
  'https://www.sicredi.com.br/site/todos-produtos',
  'https://www.sicredi.com.br/site/cambio-e-comercio-exterior',
];

auditarPaginas(CENARIO, URLS);

