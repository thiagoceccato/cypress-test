# 🚀 Como Fazer Commit e Push do README

## Passo a Passo Rápido

### 1. Abra o Git Bash ou Terminal com Git

**Opções:**
- Git Bash (se instalado)
- VS Code Terminal (Ctrl + `)
- PowerShell com Git no PATH
- GitHub Desktop (interface gráfica)

### 2. Navegue até a pasta do projeto

```bash
cd C:\Users\thiago.ceccato\Documents\cypress-test
```

### 3. Verifique o status

```bash
git status
```

Você deve ver o `README.md` listado como arquivo novo/modificado.

### 4. Adicione o arquivo

```bash
git add README.md
```

Ou para adicionar todos os arquivos novos:
```bash
git add .
```

### 5. Faça o commit

```bash
git commit -m "docs: Adiciona README executivo para diretor"
```

### 6. Faça o push

```bash
git push
```

Se for a primeira vez ou precisar configurar o remote:
```bash
git push -u origin main
```
(ou `master` se sua branch principal for master)

---

## ⚠️ Se Não Tiver Repositório Git Inicializado

Se o `git status` der erro dizendo que não é um repositório:

### 1. Inicialize o repositório

```bash
git init
```

### 2. Adicione o remote (se já tiver no GitHub/GitLab)

```bash
git remote add origin https://github.com/SEU_USUARIO/cypress-test.git
```

### 3. Adicione os arquivos

```bash
git add .
```

### 4. Primeiro commit

```bash
git commit -m "Initial commit: Projeto de auditoria GA4"
```

### 5. Push inicial

```bash
git push -u origin main
```

---

## 🎯 Comandos Rápidos (Copiar e Colar)

Se já tiver repositório configurado:

```bash
cd C:\Users\thiago.ceccato\Documents\cypress-test
git add README.md COMO_COMPARTILHAR.md
git commit -m "docs: Adiciona README executivo e guia de compartilhamento"
git push
```

---

## 📝 Alternativa: GitHub Desktop

Se preferir interface gráfica:

1. Abra o **GitHub Desktop**
2. Selecione o repositório `cypress-test`
3. Você verá `README.md` na lista de mudanças
4. Marque a checkbox ao lado
5. Digite a mensagem: "docs: Adiciona README executivo"
6. Clique em **Commit to main**
7. Clique em **Push origin**

---

## ✅ Verificação

Depois do push, acesse seu repositório no GitHub/GitLab e verifique se o README aparece na página principal!

---

**Dica**: Se tiver problemas com autenticação no push, pode precisar configurar credenciais ou usar um Personal Access Token.

