const URL_ALVO = 'https://www.sicredi.com.br/site/seja-associado';

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

// helper pra juntar query + body (cobrindo string, ArrayBuffer, etc.)
function extrairParametros(req) {
  const params = {};

  // 1) Query string da URL
  try {
    const u = new URL(req.url);
    u.searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } catch (e) {
    // ignora erro de URL
  }

  // 2) Body (pode vir como string, ArrayBuffer, view ou objeto)
  const body = req.body;
  let rawBody = '';

  if (!body) {
    return params;
  }

  if (typeof body === 'string') {
    rawBody = body;
  } else if (body instanceof ArrayBuffer) {
    rawBody = new TextDecoder('utf-8').decode(body);
  } else if (ArrayBuffer.isView(body)) {
    // Uint8Array e afins
    rawBody = new TextDecoder('utf-8').decode(body.buffer);
  } else if (typeof body === 'object') {
    // se já vier como objeto chave/valor, só mescla e acabou
    Object.assign(params, body);
  }

  if (rawBody) {
    try {
      const sp = new URLSearchParams(rawBody);
      sp.forEach((value, key) => {
        params[key] = value;
      });
    } catch (e) {
      // se não for formulário, segue a vida
    }
  }

  return params;
}

describe('captura hits GA4 ao carregar e ao clicar', () => {
  const hits = [];
  let ultimoElemento = 'page_load'; // o page_view inicial vai com isso

  it('captura page_view + hits de clique e grava CSV', () => {
    // Intercepta hits GA4 (GET ou POST, qualquer domínio com /g/collect)
    cy.intercept(
      {
        url: /\/g\/collect/
      },
      (req) => {
        const params = extrairParametros(req);

        const linha = {
          url: req.headers.referer || URL_ALVO,
          elemento_clicado: ultimoElemento,
          tid: params.tid || '',
          en: params.en || '',
          'ep.acao': params['ep.acao'] || '',
          'ep.categoria': params['ep.categoria'] || '',
          'ep.rotulo': params['ep.rotulo'] || ''
        };

        // conferência no terminal
        // eslint-disable-next-line no-console
        console.log('HIT GA4 CAPTURADO:', linha);

        hits.push(linha);
      }
    ).as('ga4');

    cy.visit(URL_ALVO, { failOnStatusCode: false });

    cy.wait(6000);

    // tentar aceitar cookies
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
          ultimoElemento = desc; // GA de consent, se tiver, vai com esse elemento

          cy.wrap(btn).click({ force: true });
          clicou = true;
        }
      });
    });

    cy.wait(4000);

    // clicar no botão "Abrir conta" e registrar o elemento real
    cy.contains('button, a', 'Abrir conta', { matchCase: false })
      .first()
      .then(($el) => {
        const desc = descreverElemento($el);
        ultimoElemento = desc; // a partir daqui, hits vêm com esse elemento

        cy.wrap($el).click({ force: true });
      });

    cy.wait(5000);

    cy.then(() => {
      cy.log(`Total de hits GA4 capturados: ${hits.length}`);
      return cy.task('writeCsv', {
        hits,
        filename: 'debug_ga4_click.csv'
      });
    });
  });
});
