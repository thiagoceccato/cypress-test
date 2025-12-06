const { defineConfig } = require('cypress');
const fs = require('fs');
const path = require('path');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        log(msg) {
          console.log(msg);
          return null;
        },
        // Task robusta para salvar CSV
        salvarCsv({ arquivo, conteudo }) {
          const dir = path.dirname(arquivo);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(arquivo, conteudo, 'utf8');
          console.log(`✅ CSV salvo: ${arquivo} (${conteudo.split('\\n').length} linhas)`);
          return null;
        },
        // Cria CSV só se não existir (evita sobrescrever dados)
        criarCsvSeNaoExiste({ arquivo, header }) {
          const dir = path.dirname(arquivo);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          if (!fs.existsSync(arquivo)) {
            fs.writeFileSync(arquivo, header + '\n', 'utf8');
            console.log(`📄 CSV criado: ${arquivo}`);
          } else {
            console.log(`📄 CSV já existe: ${arquivo}`);
          }
          return null;
        },
      });
      return config;
    },

    // Timeouts otimizados
    pageLoadTimeout: 60000,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 30000,

    // Performance
    video: false,
    screenshotOnRunFailure: false,
    chromeWebSecurity: false,

    // Viewport
    viewportWidth: 1920,
    viewportHeight: 1080,

    // Sem retries (mais rápido)
    retries: 0,

    specPattern: 'cypress/e2e/**/*.cy.js',
  },
});
