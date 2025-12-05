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
    // alguns formatos bizarros que aparecem em intercept:
    // { data: 'v=2&tid=...' } ou { string: 'v=2&tid=...' }
    const entries = Object.entries(body);
    if (entries.length === 1 && typeof entries[0][1] === 'string') {
      raw = entries[0][1];
    } else if (entries.length === 1 && typeof entries[0][0] === 'string') {
      // às vezes a própria chave é a string inteira
      raw = entries[0][0];
    } else {
      // se já for objeto "normal" chave/valor
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
    // se não for form-url-encoded, ignora
  }
  return out;
}

// helper pra juntar query + body
function extrairParametros(req) {
  const params = {};

  // 1) Query string
  try {
    const u = new URL(req.url);
    u.searchParams.forEach((v, k) => {
      params[k] = v;
    });
  } catch {
    // ignora erro de URL
  }

  // 2) Body (GA4 costuma mandar ep.* aqui)
  const bodyParams = parseBodyToParams(req.body);

  return { ...params, ...bodyParams };
}

describe('captura hits GA4 ao carregar e ao clicar', () => {
  const hits = [];
  let ultimoElemento = 'page_load'; // o page_view inicial vai com isso

  it('captura page_view + hits de clique e grava CSV', () => {
    // Intercepta hits GA4 (qualquer método, qualquer host com /g/collect)
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

        // debug explícito pra ver se o ep.* veio
        // eslint-disable-next-line no-console
        console.log('HIT GA4 CAPTURADO:', {
          url: req.url,
          en: linha.en,
          'ep.acao': linha['ep.acao'],
          'ep.categoria': linha['ep.categoria'],
          'ep.rotulo': linha['ep.rotulo']
        });

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

    // pequena folga pra todos os hits irem pro GA (incluindo o "cheio" de ep.*)
    cy.wait(6000);

    cy.then(() => {
      cy.log(`Total de hits GA4 capturados: ${hits.length}`);
      return cy.task('writeCsv', {
        hits,
        filename: 'debug_ga4_click.csv'
      });
    });
  });
});
