const URL_ALVO = 'https://www.sicredi.com.br/site/seja-associado';

// controla quantos elementos vão ser clicados por execução
// e de onde começa (pra você continuar de onde parou)
const START_INDEX = 0;   // mude para 60, 120, 180... nos próximos runs
const BATCH_SIZE  = 60;  // quantidade de elementos por execução

// helper pra descrever o elemento clicado
function descreverElemento($el) {
  const tag = ($el.prop('tagName') || '').toLowerCase();
  const id = $el.attr('id');
  const cls = ($el.attr('class') || '').trim().replace(/\s+/g, '.');
  const texto = ($el.text() || '').trim().replace(/\s+/g, ' ').substring(0, 80);

  let desc = tag;
  if (id) desc += `#${id}`;
  if (cls) desc += `.${cls}`;
  if (texto) desc += ` [text="${texto}"]`;
  return desc;
}

// parser robusto pro body do GA4
function parseBodyToParams(body) {
  if (!body) return {};

  let raw = '';

  if (typeof body === 'string') {
    raw = body;
  } else if (body instanceof ArrayBuffer) {
    raw = new TextDecoder('utf-8').decode(body);
  } else if (ArrayBuffer.isView(body)) {
    raw = new TextDecoder('utf-8').decode(body.buffer);
  } else if (typeof body === 'object') {
    const entries = Object.entries(body);
    if (entries.length === 1 && typeof entries[0][1] === 'string') {
      raw = entries[0][1];
    } else if (entries.length === 1 && typeof entries[0][0] === 'string') {
      raw = entries[0][0];
    } else {
      return body;
    }
  }

  if (!raw) return {};

  const out = {};
  try {
    const sp = new URLSearchParams(raw);
    sp.forEach((v, k) => {
      out[k] = v;
    });
  } catch {
    // ignora
  }
  return out;
}

// junta query + body
function extrairParametros(req) {
  const params = {};

  try {
    const u = new URL(req.url);
    u.searchParams.forEach((v, k) => {
      params[k] = v;
    });
  } catch {
    // ignora erro de URL
  }

  const bodyParams = parseBodyToParams(req.body);

  return { ...params, ...bodyParams };
}

// aceitar cookies se banner aparecer
function aceitarCookiesSeExistir() {
  const textosCookie = [
    'Permitir todos',
    'Permitir Todos',
    'Aceitar todos os cookies',
    'Aceitar Cookies',
    'Aceitar'
  ];

  cy.get('body').then(($body) => {
    let clicou = false;

    textosCookie.forEach((t) => {
      if (clicou) return;
      const btn = $body.find(`button:contains("${t}")`).first();
      if (btn.length) {
        const desc = descreverElemento(btn);
        // eslint-disable-next-line no-console
        console.log('Aceitando cookies em:', desc);

        cy.wrap(btn).click({ force: true });
        clicou = true;
      }
    });
  });
}

describe('captura hits GA4 ao carregar e ao clicar em elementos (batch + filtro fluxo)', () => {
  const hits = [];
  let ultimoElemento = 'page_load';

  it('mapeia page_view + cliques (apenas /site/seja-associado) e grava CSV', () => {
    cy.intercept(
      {
        url: /\/g\/collect/
      },
      (req) => {
        const params = extrairParametros(req);

        const dl = params.dl || '';
        const ehSejaAssociado = dl.includes('/site/seja-associado');

        if (!ehSejaAssociado) {
          // ignora hits de outras páginas
          return;
        }

        const linha = {
          url: dl || (req.headers.referer || URL_ALVO),
          elemento_clicado: ultimoElemento,
          tid: params.tid || '',
          en: params.en || '',
          'ep.acao': params['ep.acao'] || '',
          'ep.categoria': params['ep.categoria'] || '',
          'ep.rotulo': params['ep.rotulo'] || ''
        };

        // eslint-disable-next-line no-console
        console.log('HIT GA4 CAPTURADO:', linha);

        hits.push(linha);
      }
    ).as('ga4');

    // 1) visita a URL alvo
    cy.visit(URL_ALVO, { failOnStatusCode: false });

    cy.wait(4000);
    aceitarCookiesSeExistir();
    cy.wait(2000);

    const seletorClicaveis =
      'a:visible, button:visible, [role="button"]:visible, [onclick]:visible';

    // 2) pega a lista de elementos clicáveis
    cy.get(seletorClicaveis).then(($els) => {
      const total = $els.length;
      const start = Math.min(START_INDEX, total);
      const end = Math.min(start + BATCH_SIZE, total);

      const indices = Array.from({ length: end - start }, (_, i) => start + i);

      cy.log(
        `Total clicáveis: ${total} | Rodando índice ${start} até ${end - 1}`
      );

      // 3) clica por índice, reconsultando o elemento a cada iteração
      cy.wrap(indices).each((index) => {
        cy.get(seletorClicaveis)
          .eq(index)
          .then(($el) => {
            if (!$el || !$el.length) {
              return;
            }

            const descricao = descreverElemento($el);
            const href = $el.attr('href') || '';

            // filtro por href para NÃO sair do fluxo /seja-associado
            if (
              href &&                          // tem href
              !href.startsWith('#') &&         // ignora âncoras
              !href.startsWith('javascript:') &&
              !href.includes('/seja-associado') // fora do fluxo base
            ) {
              cy.log(
                `(${index + 1}) Pulando elemento FORA do fluxo /seja-associado: ${descricao} -> href=${href}`
              );
              return;
            }

            ultimoElemento = descricao;

            // scroll em comando separado
            cy.wrap($el).scrollIntoView({ offset: { top: -200, left: 0 } });
            cy.wait(300);

            // remove target para não abrir nova aba
            cy.wrap($el).invoke('removeAttr', 'target');

            cy.log(`(${index + 1}) Clicando em: ${descricao}`);

            cy.wrap($el).click({ force: true });

            cy.wait(2000).then(() => {
              // sanity check: se saiu do fluxo, volta
              cy.url().then((currentUrl) => {
                if (!currentUrl.includes('/seja-associado')) {
                  cy.log(
                    `Saiu do fluxo /seja-associado para ${currentUrl}. Voltando para ${URL_ALVO}`
                  );
                  cy.visit(URL_ALVO, { failOnStatusCode: false });
                  cy.wait(3000);
                  aceitarCookiesSeExistir();
                  cy.wait(1000);
                }
              });
            });
          });

        cy.wait(800);
      });
    });

    cy.wait(4000);

    cy.then(() => {
      cy.log(`Total de hits GA4 capturados neste batch: ${hits.length}`);

      const filename = `debug_ga4_click_${START_INDEX}_${START_INDEX + BATCH_SIZE - 1}.csv`;

      return cy.task('writeCsv', {
        hits,
        filename
      });
    });
  });
});
