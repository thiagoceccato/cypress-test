// cypress/e2e/coleta_ga4.cy.js

// Lista de fluxos/URLs
const FLUXOS = [
  {
    fluxo: 'seja_associado',
    url: 'https://www.sicredi.com.br/site/seja-associado'
  },
  // depois você vai enchendo isso aqui...
];

// ---- AGREGADORES GLOBAIS (todos os fluxos) ----
let allValidacaoCompleta = [];
let allElementosSemGa = [];
let allAtributosComGa = [];

function extrairGAFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const p = u.searchParams;

    return {
      tid: p.get('tid') || '',
      en: p.get('en') || '',
      ep_acao: p.get('ep.acao') || '',
      ep_categoria: p.get('ep.categoria') || '',
      ep_rotulo: p.get('ep.rotulo') || ''
    };
  } catch {
    return null;
  }
}

function descreverElemento($el) {
  const tag = ($el.prop('tagName') || '').toLowerCase();
  const id = $el.attr('id');
  const cls = ($el.attr('class') || '').trim().replace(/\s+/g, '.');
  const textoRaw = ($el.text() || '').trim().replace(/\s+/g, ' ');
  const texto = textoRaw.substring(0, 80);

  let sel = tag;
  if (id) sel += `#${id}`;
  if (cls) sel += `.${cls}`;
  if (texto) sel += ` [text="${texto}"]`;
  return sel;
}

function temAtributosGA($el) {
  const cls = $el.attr('class') || '';
  if (cls.includes('gtag-click-trigger')) return true;

  const attrs = $el[0].attributes;
  for (let i = 0; i < attrs.length; i++) {
    const name = attrs[i].name.toLowerCase();
    if (
      name.startsWith('data-gtag-') ||
      name.startsWith('data-gtm') ||
      name.includes('analytics')
    ) {
      return true;
    }
  }
  return false;
}

FLUXOS.forEach(({ fluxo, url }) => {
  describe(`Coleta GA4 - ${fluxo}`, () => {
    // arrays LOCAIS por fluxo
    let validacaoCompleta = [];
    let elementosSemGa = [];
    let atributosComGa = [];
    let ultimoElemento = 'page_load';

    beforeEach(() => {
      validacaoCompleta = [];
      elementosSemGa = [];
      atributosComGa = [];
      ultimoElemento = 'page_load';

      cy.intercept('GET', '**/collect*', (req) => {
        try {
          const host = new URL(req.url).hostname;
          if (!host.includes('google')) return;
        } catch {
          return;
        }

        const dados = extrairGAFromUrl(req.url);
        if (!dados || !dados.tid) return;
        if (dados.tid.startsWith('AW-')) return;

        const linha = {
          fluxo,
          url,
          elemento_clicado: ultimoElemento,
          tid: dados.tid,
          en: dados.en,
          'ep.acao': dados.ep_acao,
          'ep.categoria': dados.ep_categoria,
          'ep.rotulo': dados.ep_rotulo
        };

        validacaoCompleta.push(linha);
      }).as('gaCollect');
    });

    it('clica em todos elementos clicáveis e coleta hits GA4', () => {
      cy.visit(url, { failOnStatusCode: false });
      cy.wait(5000);

      const textosCookie = [
        'Permitir todos',
        'Permitir Todos',
        'Aceitar todos os cookies',
        'Aceitar Cookies',
        'Aceitar'
      ];

      // ajusta pro botão deles, se já sabe o seletor:
      cy.get('body').then(($body) => {
        textosCookie.forEach((t) => {
          const btn = $body.find(`button:contains("${t}")`).first();
          if (btn.length) {
            cy.wrap(btn).click({ force: true });
          }
        });
      });

      cy.wait(2000);

      const seletorClicaveis =
  'a:visible, button:visible, [role="button"]:visible, [onclick]:visible';

cy.get('body').then(($body) => {
  const total = $body.find(seletorClicaveis).length;
  cy.log(`Total de elementos clicáveis encontrados: ${total}`);

  const indices = Array.from({ length: total }, (_, i) => i);

  cy.wrap(indices).each((index) => {
    // reconsulta o elemento a cada iteração
    cy.get(seletorClicaveis).eq(index).then(($el) => {
      const descricao = descreverElemento($el);
      const ehComAtributosGA = temAtributosGA($el);

      // 1) filtro por href para NÃO sair do fluxo /seja-associado
      const href = $el.attr('href') || '';

      if (
        href &&                          // tem href
        !href.startsWith('#') &&         // ignora âncoras
        !href.startsWith('javascript:') &&
        !href.includes('/seja-associado') // fora do fluxo base
      ) {
        cy.log(
          `(${index + 1}) Pulando elemento FORA do fluxo /seja-associado: ${descricao} -> href=${href}`
        );
        return; // não clica nesse
      }

      // 2) scroll em comando separado
      cy.wrap($el).scrollIntoView({ offset: { top: -200, left: 0 } });
      cy.wait(300);

      // 3) impede nova aba
      cy.wrap($el).invoke('removeAttr', 'target');

      cy.then(() => {
        const eventosAntes = validacaoCompleta.length;
        ultimoElemento = descricao;

        cy.log(`(${index + 1}) Clicando em: ${descricao}`);

        cy.wrap($el).click({ force: true });

        cy.wait(2000).then(() => {
          const eventosDepois = validacaoCompleta.length;
          const disparouGA = eventosDepois > eventosAntes;

          if (!disparouGA) {
            // Elemento SEM GA
            elementosSemGa.push({
              fluxo,
              url,
              elemento_clicado: descricao,
              tid: '',
              en: '',
              'ep.acao': '',
              'ep.categoria': '',
              'ep.rotulo': ''
            });
          } else if (ehComAtributosGA) {
            // Elemento com atributo GA que DISPAROU GA
            const novos = validacaoCompleta.slice(eventosAntes);
            novos.forEach((linha) => {
              atributosComGa.push(linha);
            });
          }
        }).then(() => {
          // 4) sanity check: se saiu do fluxo, volta
          cy.url().then((currentUrl) => {
            if (!currentUrl.includes('/seja-associado')) {
              cy.log(
                `Saiu do fluxo /seja-associado para ${currentUrl}. Voltando para ${url}`
              );
              cy.visit(url, { failOnStatusCode: false });
              cy.wait(2000);
            }
          });
        });
      });
    });
  });
});



      // no final desse fluxo, agrega nos arrays globais
      cy.then(() => {
        allValidacaoCompleta = allValidacaoCompleta.concat(validacaoCompleta);
        allElementosSemGa = allElementosSemGa.concat(elementosSemGa);
        allAtributosComGa = allAtributosComGa.concat(atributosComGa);
      });
    });
  });
});

// Depois de todos os fluxos, gera o Excel
after(() => {
  cy.task('writeExcel', {
    validacaoCompleta: allValidacaoCompleta,
    atributosComGa: allAtributosComGa,
    elementosSemGa: allElementosSemGa,
    fileName: 'sicredi_ga_mapeamento.xlsx'
  });
});
