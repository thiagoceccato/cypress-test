// cypress/e2e/cenarios/seguros.cy.js
// Auditoria GA4 - Cenário: Seguros
// Execute: npx cypress run --spec "cypress/e2e/cenarios/seguros.cy.js"

const { auditarPaginas } = require('../utils/auditoriaCore');

const CENARIO = 'seguros';
const URLS = [
  'https://www.sicredi.com.br/site/seguros',
  'https://www.sicredi.com.br/site/seguros/para-agronegocio',
  'https://www.sicredi.com.br/site/seguros/para-agronegocio/proagro',
  'https://www.sicredi.com.br/site/seguros/para-agronegocio/seguro-patrimonio-rural',
  'https://www.sicredi.com.br/site/seguros/para-empresa',
  'https://www.sicredi.com.br/site/seguros/para-empresa/acidentes-pessoais-coletivos',
  'https://www.sicredi.com.br/site/seguros/para-empresa/condominio',
  'https://www.sicredi.com.br/site/seguros/para-empresa/empresarial',
  'https://www.sicredi.com.br/site/seguros/para-empresa/vida-em-grupo',
  'https://www.sicredi.com.br/site/seguros/para-voce',
  'https://www.sicredi.com.br/site/seguros/para-voce/auto',
  'https://www.sicredi.com.br/site/seguros/para-voce/residencial',
  'https://www.sicredi.com.br/site/seguros/para-voce/seguro-vida',
  'https://www.sicredi.com.br/site/seguros/para-voce/viagem',
];

auditarPaginas(CENARIO, URLS);

