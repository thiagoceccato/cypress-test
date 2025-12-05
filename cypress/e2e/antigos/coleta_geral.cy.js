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
    // casos tipo { data: 'v=2&tid=...' } ou { string: 'v=2&tid=...' }
    const entries = Object.entries(body);
    if (entries.length === 1 && typeof entries[0][1] === 'string') {
      raw = entries[0][1];
    } else if (entries.length === 1 && typeof entries[0][0] === 'string') {
      raw = entries[0][0];
    } else {
      // já veio como objeto chave/valor normal
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

describe('captura hits GA4 ao carregar e ao clicar em todos os elementos', () => {
  const hits = [];
  let ultimoElemento = 'page_load'; // page_view inicial usa isso

  it('mapeia page_view + todos os cliques e grava CSV', () => {
    // Intercepta hits GA4 (GET / POST, qualquer host, desde que tenha /g/collect)
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

        // debug explícito
        // eslint-disable-next-line no-console
        console.log('HIT GA4 CAPTURADO:', linha);

        hits.push(linha);
      }
    ).as('ga4');

    // 1) Visita a URL
    cy.visit(URL_ALVO, { failOnStatusCode: false });

    cy.wait(6000);

    // 2) tentar aceitar cookies (se existir)
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
          ultimoElemento = desc; // hits de consent vão com esse elemento

          cy.wrap(btn).click({ force: true });
          clicou = true;
        }
      });
    });

    cy.wait(4000);

    // 3) pegar TODOS os elementos clicáveis visíveis na página
    const seletorClicaveis =
      'a:visible, button:visible, [role="button"]:visible, [onclick]:visible';

    cy.get(seletorClicaveis).then(($els) => {
      cy.log(`Total de elementos clicáveis encontrados: ${$els.length}`);

      const total = $els.length;
      const indices = Array.from({ length: total }, (_, i) => i);

      // usamos um array de índices pra reconsultar o elemento a cada iteração
      cy.wrap(indices).each((idx) => {
        cy.get(seletorClicaveis)
          .eq(idx)
          .then(($btn) => {
            // se depois de um rerender não existir mais, pula
            if (!$btn || !$btn.length) {
              return;
            }

            const desc = descreverElemento($btn);
            ultimoElemento = desc;

            // se for link, neutraliza navegação
            if ($btn.is('a')) {
              const href = $btn.attr('href');
              if (href && !href.startsWith('#')) {
                $btn.attr('data-original-href', href);
                $btn.attr('href', '#');
              }
              $btn.removeAttr('target');
            }

            // scroll + clique em um chain só pra minimizar detach
            cy.wrap($btn).scrollIntoView().click({ force: true });
          });

        // pequena espera pra permitir o disparo do GA4
        cy.wait(1200);
      });
    });

    // 4) folga final pra qualquer hit atrasado
    cy.wait(6000);

    // 5) grava CSV com tudo
    cy.then(() => {
      cy.log(`Total de hits GA4 capturados: ${hits.length}`);
      return cy.task('writeCsv', {
        hits,
        filename: 'debug_ga4_click.csv'
      });
    });
  });
});
