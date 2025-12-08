# 🖥️ Setup do Projeto - Coleta GA4 Sicredi

## Passo a Passo para Configurar em Novo PC

### 1. Pré-requisitos

#### 1.1 Instalar Node.js (v18+)
```powershell
# Baixe e instale de: https://nodejs.org/
# Ou via winget:
winget install OpenJS.NodeJS.LTS
```

Verifique a instalação:
```powershell
node --version   # deve mostrar v18+ ou v20+
npm --version    # deve mostrar 9+
```

#### 1.2 Instalar Git (opcional, mas recomendado)
```powershell
winget install Git.Git
```

---

### 2. Obter o Projeto

#### Opção A: Clonar do GitHub
```powershell
cd C:\Users\SEU_USUARIO\Documents
git clone https://github.com/SEU_REPO/cypress-test.git
cd cypress-test
```

#### Opção B: Copiar pasta do OneDrive/Pendrive
- Copie a pasta `cypress-test` para o novo PC
- Abra PowerShell e navegue até ela:
```powershell
cd C:\caminho\para\cypress-test
```

---

### 3. Instalar Dependências

```powershell
npm install
```

Isso instalará:
- Cypress
- Todas as dependências do projeto

---

### 4. Criar Pasta de Resultados

```powershell
mkdir cypress\results_novo -Force
```

---

### 5. Verificar Instalação

```powershell
npx cypress --version
```

Deve mostrar algo como: `Cypress 15.7.1`

---

### 6. Executar os Testes

#### 6.1 Teste Rápido (validação - 1 página)
```powershell
npx cypress run --spec "cypress/e2e/coleta_cartoes.cy.js" --browser chrome --headed
```

#### 6.2 Lote de Cartões (16 páginas) - ~2-3 horas
```powershell
npx cypress run --spec "cypress/e2e/coleta_lote.cy.js" --browser chrome --headed
```

#### 6.3 TODOS os cenários (107 páginas) - ~15-20 horas
Edite `cypress/e2e/coleta_lote.cy.js` e mude:
```javascript
const FILTRO_NOME = null; // null = TODOS os cenários
```

Depois execute:
```powershell
npx cypress run --spec "cypress/e2e/coleta_lote.cy.js" --browser chrome --headed
```

---

### 7. Configurações Importantes

#### No arquivo `coleta_lote.cy.js`:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `FILTRO_NOME` | `'cartoes'` | Filtra só cartões (16 URLs) |
| `FILTRO_NOME` | `null` | Roda TODOS (107 URLs) |
| `ESPERA_CLIQUE` | `5000` | Tempo de espera em ms |
| `IGNORAR_RODAPE` | `true` | Ignora links do rodapé |

---

### 8. Onde Ficam os Resultados

```
cypress/results_novo/
├── cartoes_coleta.csv       # CSV com todos os cliques
├── cartoes_ga4_requests.json # JSON com requisições brutas
```

---

### 9. Monitorar Progresso

Enquanto o teste roda, você pode verificar o progresso:

```powershell
# Ver quantas linhas já foram coletadas
(Get-Content "cypress/results_novo/cartoes_coleta.csv").Count

# Ver últimas 5 linhas
Get-Content "cypress/results_novo/cartoes_coleta.csv" | Select-Object -Last 5
```

---

### 10. Dicas para Execução Longa

1. **Mantenha o PC ligado** - Não deixe entrar em modo de espera
2. **Use modo headed** - Necessário pois o site bloqueia headless
3. **Feche outros programas** - Libera memória para o Chrome
4. **Não mexa no navegador** - Deixe o Cypress controlar

#### Desabilitar modo de espera (PowerShell como Admin):
```powershell
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
```

---

### 11. Erros Comuns

| Erro | Solução |
|------|---------|
| `node: command not found` | Reinstale Node.js e reinicie o terminal |
| `Chrome não encontrado` | Instale Chrome ou use `--browser edge` |
| `Timeout waiting for page` | Conexão lenta, aumente o timeout |
| `Access Denied` | Use `--headed`, não `--headless` |

---

### 12. Estrutura de Arquivos

```
cypress-test/
├── cypress/
│   ├── e2e/
│   │   ├── coleta_cartoes.cy.js    # Coleta só cartões principal
│   │   ├── coleta_lote.cy.js       # Coleta em lote (configurável)
│   │   ├── calibracao_tempo.cy.js  # Teste de calibração
│   │   ├── config/
│   │   │   └── cenarios.js         # Lista de URLs
│   │   └── utils/
│   │       └── gaHelpers.js        # Funções auxiliares
│   └── results_novo/               # Resultados gerados
├── cypress.config.js               # Config do Cypress
├── package.json                    # Dependências
└── SETUP_NOVO_PC.md               # Este arquivo
```

---

## Resumo de Comandos

```powershell
# 1. Instalar dependências
npm install

# 2. Criar pasta de resultados
mkdir cypress\results_novo -Force

# 3. Rodar lote de cartões
npx cypress run --spec "cypress/e2e/coleta_lote.cy.js" --browser chrome --headed

# 4. Ver progresso
(Get-Content "cypress/results_novo/cartoes_coleta.csv").Count
```

---

**Dúvidas?** O script foi feito para funcionar de forma autônoma. Deixe rodando e volte quando terminar! 🚀




