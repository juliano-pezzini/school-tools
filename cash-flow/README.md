# Fluxo de Caixa — APP

Controle de lançamentos e saldo da APP (Associação de Pais e Professores).

---

## Pré-requisitos

- Conta Google no domínio (ou pessoal para testes).
- Acesso ao [Apps Script](https://script.google.com).

---

## Deploy (passo a passo)

### Opção A — Editor do Apps Script (manual)

1. Acesse **https://script.google.com** → **Novo projeto**.
2. No editor, apague o conteúdo de `Código.gs` e cole o conteúdo de [`Code.gs`](Code.gs).
3. Clique em **`+`** (arquivo) → **Script**, nome **`logic`** → cole o conteúdo de [`logic.js`](logic.js).
4. Clique em **`+`** → **HTML**, nome exatamente **`Index`** → cole o conteúdo de [`Index.html`](Index.html).
5. **Configurações** ⚙️ → marque "Mostrar arquivo de manifesto `appsscript.json`" → cole o conteúdo de [`appsscript.json`](appsscript.json).
6. **Salvar** (Ctrl+S).
7. **Implantar** → **Nova implantação** → ⚙️ → **App da Web**:
   - **Executar como:** `Eu` (implantador)
   - **Quem pode acessar:** `Qualquer pessoa em <domínio>` (ou `Qualquer pessoa com Conta do Google` para testes pessoais)
8. **Implantar** → **Autorizar** (vai pedir acesso a Planilhas, Drive e e-mail — esperado).
9. Copie a **URL do Web App** (termina em `/exec`) e abra no navegador.

### Opção B — clasp (CLI)

1. Ative a **Apps Script API** em https://script.google.com/home/usersettings (toggle ON).

```bash
cd cash-flow
npm install -g @google/clasp   # se ainda não tem
clasp login                    # autentica
clasp create --type standalone --title "Fluxo de Caixa — APP"
clasp push                     # envia Code.gs + logic.js + Index.html + appsscript.json
clasp deploy --description "v1"
```

Depois abra o projeto em https://script.google.com → **Implantar** → **Nova implantação** (ou **Testar implantações** para a URL `/dev`).

> O `.claspignore` já exclui `node_modules/`, `*.test.js`, `package*.json` e `vitest*`.

---

## Primeira execução

Ao abrir o Web App pela primeira vez:

1. O script **cria automaticamente** a planilha `Fluxo de Caixa — APP (dados)` com 5 abas (Lancamentos, Config, Fechamentos, Usuarios, Auditoria) e persiste o ID em `PropertiesService`.
2. Você é **promovido a admin** (bootstrap anti-lockout): se a aba Usuarios está vazia, o primeiro usuário real ganha papel `admin`.

> Se aparecer `desconhecido` ou erro de papel, **recarregue a página** — na 1ª autorização o `getActiveUser()` pode vir vazio.

---

## Smoke test (checklist pós-deploy)

1. Painel "Saldo" mostra "abertura não definida" + R$ 0,00.
2. Registrar abertura R$ 1.000,00 (data não-futura) → saldo passa a R$ 1.000,00; formulário de abertura fica desabilitado.
3. Lançar ENTRADA R$ 200,00 + SAÍDA R$ 50,00 → saldo R$ 1.150,00. Duplo-clique não duplica (clientToken).
4. Editar a entrada (mudar valor) → saldo recalcula; conferir `AlteradoPor/Em` na aba e auditoria (`ação=editar`).
5. Excluir (soft-delete) a saída → some da lista; saldo ajusta; aba Lancamentos com `Excluido=true`; Auditoria (`excluir`).
6. Fechar o mês corrente → tentar lançar com data nesse mês é bloqueado ("período MM/AAAA está fechado").
7. Reabrir o mês → lançar/editar volta a funcionar; Fechamentos mostra `ReabertoPor/Em`.
8. Categoria autocomplete: digitar "do" e ver sugestão "Doação" (se já cadastrada).
9. Forçar saldo negativo (saída > saldo) → valor em vermelho, sem bloquear.
10. Conferir as 5 abas na planilha e linhas na aba Auditoria.

---

## Desenvolvimento local

```bash
cd cash-flow
npm install          # instala Vitest (dev)
npm test             # roda 74 testes (lógica pura em logic.js)
```

A lógica pura (`logic.js`) é testável em Node; a cola (`Code.gs`) e a UI (`Index.html`) são verificadas pelo smoke manual após deploy.

---

## Estrutura

| Arquivo | Papel |
| ------- | ----- |
| `logic.js` | Funções puras (saldo, guardas, sanitização, formatação) — roda em Node e Apps Script |
| `Code.gs` | Cola Apps Script (Sheets, Lock, Cache, Auth, doGet) — delega decisões a `logic.js` |
| `Index.html` | UI pt-BR (formulário, lista, saldo, abertura, fechamento) |
| `appsscript.json` | Manifesto (scopes, timezone, executeAs) |
| `.claspignore` | Exclui artefatos Node do push |
