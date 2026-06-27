# Lançamentos & Saldo — Tasks (v2)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: [.specs/features/lancamentos-saldo/design.md](design.md)
**Spec**: [.specs/features/lancamentos-saldo/spec.md](spec.md)
**Status**: Draft (aguardando aprovação)

> **Decisão estrutural (refina o design):** a lógica pura vai para `cash-flow/logic.js` (funções puras, testáveis em Node) e a "cola" do Apps Script (Sheets, LockService, Session, CacheService) fica em `cash-flow/Code.gs`. No Apps Script os dois arquivos compartilham o escopo global (sem `import`); no Node, `logic.js` é importável via guarda `typeof module !== 'undefined' && (module.exports = {...})`. Isso concretiza a nota do design "testar a lógica pura fora do Apps Script". Tudo continua deployado junto (clasp converte `.js` → `.gs`).

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: **none** — strong defaults applied. No tests/harness exist in the repo (spikes são testados empiricamente por deploy). Framework escolhido pelo usuário: **Vitest** (decisão reconciliada — o usuário escolheu "um framework" e manteve o comando default; adotado `npm test` → `vitest run`, o mais leve para JS puro e alinhado ao AD-001). Confirme na aprovação se prefere Jest.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lógica pura (`cash-flow/logic.js`) | unit (Vitest) | Todos os ramos; 1:1 com as ACs da spec; toda edge case listada coberta | `cash-flow/*.test.js` | `npm test` |
| Cola Apps Script (`cash-flow/Code.gs`: Sheets/Lock/Session/Cache, funções expostas) | none | — (depende de serviços Apps Script; verificado empiricamente no deploy, como os spikes) | — | build gate + smoke manual |
| UI (`cash-flow/Index.html`) | none | — (verificação manual no deploy) | — | manual |
| Config (`cash-flow/appsscript.json`, `package.json`) | none | — (build gate) | — | build gate |

**Por que "none" na cola/UI:** `SpreadsheetApp`, `LockService`, `CacheService`, `Session`, `PropertiesService` e `HtmlService` só existem no runtime do Apps Script; não há mock de baixo custo que agregue valor real (AD-001). Toda a lógica decidível é empurrada para `logic.js` (unit), deixando a cola fina e verificável por deploy — mesmo padrão dos spikes `m0-roles`/`m0-reports`.

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (Vitest, lógica pura) | **Yes** | Funções puras, sem store/conexão compartilhada; entradas montadas em memória por teste; Vitest isola por arquivo em workers | `logic.js` não faz I/O (sem Sheets/Lock/Session); cada teste constrói arrays/objetos locais |
| none (cola/UI) | n/a | Sem testes automatizados | — |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Depois de tarefas com testes unit (lógica pura) | `npm test` (de `cash-flow/`) |
| Full | Igual ao Quick (não há integration/e2e automatizado; a cola é manual) | `npm test` |
| Build | Depois de tarefas de cola/UI/config | `node --check cash-flow/Code.gs` (sintaxe) + `npm test` + **smoke manual** no deploy (checklist na T16) |

> **Nota:** `node --check` valida sintaxe do `Code.gs` mesmo com símbolos Apps Script (não executa). O smoke manual (deploy + clique) cobre o que o Node não alcança.

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1
```

### Phase 2: Pure logic (Parallel OK — all [P])

```
        ┌→ T2 [P]
        ├→ T3 [P]
        ├→ T4 [P]
T1 ─────┼→ T5 [P]
        ├→ T6 [P]
        ├→ T7 [P]
        ├→ T8 [P]
        └→ T9 [P]
```

### Phase 3: Apps Script glue (Sequential)

```
T10 → T11 → T12 → T13 → T14 → T15
```

### Phase 4: UI & entry (Sequential)

```
T16
```

> **4 fases → o orquestrador deve OFERECER um worker por fase (sequencial) no início do Execute** (offer-then-confirm). Não auto-spawnar.

---

## Task Breakdown

### T1: Scaffold do projeto `cash-flow/` + tooling de teste

**What**: Criar a estrutura da ferramenta e o tooling de teste (Vitest), com `logic.js` vazio (guarda de export dual-env) e `appsscript.json` copiado do spike.
**Where**: `cash-flow/package.json`, `cash-flow/logic.js`, `cash-flow/appsscript.json`, `cash-flow/.claspignore`
**Depends on**: None
**Reuses**: [spikes/m0-roles/appsscript.json](../../../spikes/m0-roles/appsscript.json) (scopes, `executeAs USER_DEPLOYING`, `access DOMAIN`)
**Requirement**: infra (suporta LANC-01..12)

**Tools**:
- MCP: NONE (file + terminal)
- Skill: tlc-spec-driven

**Done when**:
- [ ] `package.json` com devDep `vitest` e script `"test": "vitest run"`
- [ ] `logic.js` exporta via `typeof module !== 'undefined' && (module.exports = {})` (sem ReferenceError no Apps Script)
- [ ] `appsscript.json` copiado (sheets + drive + userinfo.email, `access` = `DOMAIN`)
- [ ] `.claspignore` exclui `node_modules/`, `*.test.js`, `package*.json`, `vitest*`
- [ ] `npm install` ok e `npm test` roda (0 testes) sem erro

**Tests**: none
**Gate**: build
**Commit**: `chore(cash-flow): scaffold project + vitest test tooling`

---

### T2: Helpers pt-BR (formatação/parse de data e moeda) [P]

**What**: Implementar `formatBRL_`, `formatDate_`, `parseDateBR_`, `periodKey_` (→ `'YYYY-MM'`) e o helper de "mês corrente" no fuso `America/Sao_Paulo`.
**Where**: `cash-flow/logic.js`, `cash-flow/format.test.js`
**Depends on**: T1
**Reuses**: helpers pt-BR de [spikes/m0-reports/Code.gs](../../../spikes/m0-reports/Code.gs) (`formatBRL_`, `formatDate_`, `MONTH_NAMES`, `TZ`)
**Requirement**: LANC-03 (formatação), suporte a LANC-01/05/07

**Tools**:
- MCP: context7 (formatação de data/fuso, se necessário)
- Skill: tlc-spec-driven

**Done when**:
- [ ] `formatBRL_` formata R$ pt-BR (2 casas, separador correto), inclusive negativos
- [ ] `parseDateBR_`/`formatDate_` ida-e-volta de `dd/MM/yyyy`; rejeita data inválida/vazia
- [ ] `periodKey_(date)` retorna `'YYYY-MM'`
- [ ] Testes cobrem todos os ramos + edge cases (vazio, inválido, negativo, vírgula/ponto)
- [ ] `npm test` passa
- [ ] Contagem de testes registrada (sem deleções silenciosas)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): pt-BR date/currency helpers + tests`

---

### T3: Sanitização de valor e limites de campo [P]

**What**: Implementar `sanitizeLancamento_` (normaliza moeda, valida tipo/valor `>0`/≤2 casas) e `assertLimits_` (teto R$ 1.000.000,00, descrição ≤280, categoria ≤60).
**Where**: `cash-flow/logic.js`, `cash-flow/sanitize.test.js`
**Depends on**: T1
**Reuses**: `sanitizeLancamento_` de [spikes/m0-roles/Code.gs](../../../spikes/m0-roles/Code.gs) (estende)
**Requirement**: LANC-02 (validação + edge cases)

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] Rejeita valor ≤0, vazio, não numérico, >2 casas — mensagem pt-BR
- [ ] Normaliza vírgula/ponto para 2 casas
- [ ] Sinaliza valor > teto para confirmação (não bloqueia de vez); rejeita textos acima do limite
- [ ] Testes 1:1 com as ACs de LANC-02 + edge cases listadas
- [ ] `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): value sanitization + field limits + tests`

---

### T4: Guardas de data/período (puras) [P]

**What**: Implementar `assertNotFuture_(date, hoje)` e `assertPeriodOpen_(date, closedPeriods)` (decisão pura dado o conjunto de meses fechados).
**Where**: `cash-flow/logic.js`, `cash-flow/guards.test.js`
**Depends on**: T1
**Reuses**: padrão de guard server-side de [spikes/m0-roles/Code.gs](../../../spikes/m0-roles/Code.gs)
**Requirement**: LANC-02 (data futura), LANC-05/07 (período fechado)

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] `assertNotFuture_` rejeita data > hoje (TZ); aceita hoje e passado
- [ ] `assertPeriodOpen_` rejeita data em mês fechado com mensagem pt-BR `MM/AAAA`; aceita mês sem linha/aberto
- [ ] Testes cobrem fronteiras (último dia do mês, virada, mês fechado vs aberto)
- [ ] `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): pure date/period guards + tests`

---

### T5: Normalização e listagem de categorias [P]

**What**: Implementar `normalizeCategoryKey_(s)` (sem caixa/acento/espaço nas pontas) e `computeCategorias_(rows)` (distintas por chave, 1ª grafia, ordenadas, ignora `excluido`).
**Where**: `cash-flow/logic.js`, `cash-flow/categorias.test.js`
**Depends on**: T1
**Requirement**: LANC-06

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] "Doação"/"doação"/"Doaçao "/" DOACAO" colapsam numa única sugestão
- [ ] Mantém a grafia da 1ª ocorrência; lista ordenada
- [ ] Ignora lançamentos `excluido`
- [ ] Testes cobrem variações de caixa/acento/espaço + lista vazia
- [ ] `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): category normalization + autocomplete list + tests`

---

### T6: Cálculo de saldo (abertura + corrente) [P]

**What**: Implementar `computeCashState_(config, rows)` = abertura + Σ entradas − Σ saídas, ignorando `excluido`; abertura indefinida ⇒ 0 + flag; permite negativo.
**Where**: `cash-flow/logic.js`, `cash-flow/saldo.test.js`
**Depends on**: T1
**Reuses**: agregação de [spikes/m0-reports/Code.gs](../../../spikes/m0-reports/Code.gs)
**Requirement**: LANC-01 (abertura), LANC-03 (saldo), LANC-11 (ignora excluído)

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] `saldoAtual` = abertura + Σentradas − Σsaídas (cenário do Independent Test: 1000+200−50=1150; excluir entrada ⇒ 950)
- [ ] `aberturaDefinida=false` ⇒ trata abertura como 0 e sinaliza
- [ ] Saldo negativo é retornado (não bloqueia)
- [ ] Lançamentos `excluido` não entram na soma
- [ ] Testes 1:1 com ACs de LANC-03 + edge cases; `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): cash balance computation + tests`

---

### T7: Listagem — ordenação, ocultação de excluídos e filtros [P]

**What**: Implementar `listForView_(rows, filtro)`: oculta `excluido`, ordena por `Data` desc e empate por `CriadoEm` desc, filtra por mês/tipo/categoria.
**Where**: `cash-flow/logic.js`, `cash-flow/list.test.js`
**Depends on**: T1
**Requirement**: LANC-04 (listar/ordenar), LANC-09 (filtrar), LANC-11 (oculta excluído)

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] Ordena por data desc; empate de data ⇒ `CriadoEm` desc (determinístico)
- [ ] Oculta `excluido`
- [ ] Filtro por mês e/ou tipo e/ou categoria retorna o subconjunto correto
- [ ] Estado vazio quando filtro não casa
- [ ] Testes cobrem empate, exclusão, cada combinação de filtro; `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): listing order/filter/soft-delete view + tests`

---

### T8: Decisão de idempotência (clientToken) [P]

**What**: Implementar `dedupDecision_(existingTokens, clientToken)` → `{ isDup, existingId? }` (lógica pura usada dentro do lock).
**Where**: `cash-flow/logic.js`, `cash-flow/idempotency.test.js`
**Depends on**: T1
**Requirement**: LANC-10

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] Token novo ⇒ não-dup
- [ ] Token já visto ⇒ dup + retorna o `id` existente (sucesso idempotente)
- [ ] Token vazio/ausente ⇒ tratado por regra definida (rejeita ou gera) com teste
- [ ] Testes cobrem novo/repetido/ausente; `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): idempotency dedup decision + tests`

---

### T9: Transições de período (fechar/reabrir) [P]

**What**: Implementar `closeDecision_(periodo, status, mesCorrente)` e `reopenDecision_(periodo, status)`: bloqueia mês futuro; no-op idempotente (já fechado/aberto); senão muda estado.
**Where**: `cash-flow/logic.js`, `cash-flow/periods.test.js`
**Depends on**: T1
**Requirement**: LANC-07 (fechar), LANC-08 (reabrir)

**Tools**:
- MCP: NONE
- Skill: tlc-spec-driven

**Done when**:
- [ ] Fechar mês futuro ⇒ erro pt-BR
- [ ] Fechar mês `aberto` ≤ corrente ⇒ `fechado`; fechar já `fechado` ⇒ no-op (`jaFechado`)
- [ ] Reabrir `fechado` ⇒ `aberto`; reabrir já `aberto` ⇒ no-op (`jaAberto`)
- [ ] Testes cobrem cada transição (válida, inválida, idempotente); `npm test` passa; contagem registrada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cash-flow): period close/reopen transition logic + tests`

---

### T10: Camada de dados + auth seam + bootstrap (5 abas)

**What**: `getSpreadsheet_` (via `PropertiesService` `CASHFLOW_SHEET_ID`), `buildSheets_` criando `Lancamentos/Config/Fechamentos/Usuarios/Auditoria` com cabeçalhos; copiar o auth seam (`requireRole_`, bootstrap anti-lockout) do m0-roles.
**Where**: `cash-flow/Code.gs`
**Depends on**: T1
**Reuses**: data layer + seam de [spikes/m0-roles/Code.gs](../../../spikes/m0-roles/Code.gs)
**Requirement**: LANC-12 (aba Auditoria), infra de LANC-01..11

**Tools**:
- MCP: context7 (SpreadsheetApp/PropertiesService), GitHub MCP (commit)
- Skill: tlc-spec-driven

**Done when**:
- [ ] `buildSheets_` cria as 5 abas com as colunas do design (incl. `Excluido/ExcluidoPor/ExcluidoEm/ClientToken` em Lancamentos e a aba `Auditoria`)
- [ ] `requireRole_` + bootstrap anti-lockout portados (mitiga gotcha do e-mail vazio)
- [ ] `node --check cash-flow/Code.gs` passa
- [ ] Smoke: ao abrir a 1ª vez, a planilha é criada com as 5 abas (checklist T16)

**Tests**: none
**Gate**: build
**Commit**: `feat(cash-flow): data layer, auth seam, 5-sheet bootstrap`

---

### T11: Escrita de lançamento (addLancamento) com idempotência + auditoria

**What**: `addLancamento(item, clientToken)` ligando auth → idempotência (`CacheService` + coluna `ClientToken` dentro do lock) → guardas → sanitização → `LockService` → append linha → `appendAudit_('criar')`.
**Where**: `cash-flow/Code.gs`
**Depends on**: T10, T3, T4, T8
**Reuses**: padrão de append + LockService dos spikes
**Requirement**: LANC-02, LANC-10, LANC-12

**Tools**:
- MCP: context7 (LockService/CacheService), GitHub MCP
- Skill: tlc-spec-driven

**Done when**:
- [ ] Grava entrada/saída válida e preenche `CriadoPor/CriadoEm` (servidor)
- [ ] Reenvio com mesmo `clientToken` não cria duplicata (retorna `id` existente)
- [ ] Revalida data futura/mês fechado no servidor
- [ ] `appendAudit_('criar', id, …)` registrado
- [ ] `node --check` passa; smoke manual (checklist T16)

**Tests**: none
**Gate**: build
**Commit**: `feat(cash-flow): create entry with idempotency + audit`

---

### T12: Editar e soft-delete (com trilha)

**What**: `editLancamento(id, item)` (atualiza linha + `Alterado*` + `appendAudit_('editar', antes→depois)`) e `deleteLancamento(id)` (marca `Excluido*` + `appendAudit_('excluir')`); revalida período aberto.
**Where**: `cash-flow/Code.gs`
**Depends on**: T11, T4
**Requirement**: LANC-05, LANC-11, LANC-12

**Tools**:
- MCP: context7, GitHub MCP
- Skill: tlc-spec-driven

**Done when**:
- [ ] Editar em mês aberto salva + `AlteradoPor/AlteradoEm` + auditoria; recalcula saldo
- [ ] Excluir = soft-delete (`Excluido=true` + `Excluido*`) + auditoria; some de lista/saldo
- [ ] Edição/exclusão em mês fechado é bloqueada no servidor
- [ ] Edição que viola regra (valor≤0, data futura, mover p/ mês fechado) é rejeitada
- [ ] `node --check` passa; smoke manual (checklist T16)

**Tests**: none
**Gate**: build
**Commit**: `feat(cash-flow): edit + logical delete with audit trail`

---

### T13: Leituras (listLancamentos, getCashState, listCategorias)

**What**: Ligar as funções de leitura à lógica pura: `listLancamentos(filtro)` → `listForView_`; `getCashState()` → `computeCashState_`; `listCategorias()` → `computeCategorias_`.
**Where**: `cash-flow/Code.gs`
**Depends on**: T10, T6, T7, T5
**Requirement**: LANC-03, LANC-04, LANC-06, LANC-09, LANC-11

**Tools**:
- MCP: context7, GitHub MCP
- Skill: tlc-spec-driven

**Done when**:
- [ ] `listLancamentos` retorna a view ordenada/filtrada sem `excluido`
- [ ] `getCashState` retorna abertura/totais/saldo (flag de abertura indefinida)
- [ ] `listCategorias` retorna distintas normalizadas
- [ ] Papel de leitura inclui `leitor`
- [ ] `node --check` passa; smoke manual (checklist T16)

**Tests**: none
**Gate**: build
**Commit**: `feat(cash-flow): read endpoints wired to pure logic`

---

### T14: Saldo de abertura (setOpeningBalance)

**What**: `setOpeningBalance({ valor, data })` na aba `Config`: aceita `valor ≥ 0` e data não-futura; rejeita se já definido; grava auditoria de atualização.
**Where**: `cash-flow/Code.gs`
**Depends on**: T10, T2, T4
**Requirement**: LANC-01

**Tools**:
- MCP: context7, GitHub MCP
- Skill: tlc-spec-driven

**Done when**:
- [ ] 1ª definição grava `SALDO_ABERTURA_VALOR/DATA`; 2ª é rejeitada (orienta editar)
- [ ] Valor negativo e data futura/ inválida rejeitados (pt-BR)
- [ ] `getCashState` passa a usar a abertura
- [ ] `node --check` passa; smoke manual (checklist T16)

**Tests**: none
**Gate**: build
**Commit**: `feat(cash-flow): opening balance (Config singleton)`

---

### T15: Fechamento (listClosedPeriods, closeMonth, reopenMonth)

**What**: Ligar o serviço de fechamento à lógica de transições: `listClosedPeriods()`, `closeMonth(periodo)`, `reopenMonth(periodo)` com `LockService` e auditoria de fechar/reabrir.
**Where**: `cash-flow/Code.gs`
**Depends on**: T10, T9
**Requirement**: LANC-07, LANC-08

**Tools**:
- MCP: context7, GitHub MCP
- Skill: tlc-spec-driven

**Done when**:
- [ ] `closeMonth` fecha mês ≤ corrente; futuro rejeitado; já fechado = no-op
- [ ] `reopenMonth` reabre mantendo registro de fechamento; já aberto = no-op
- [ ] Estado consultável por `listClosedPeriods`
- [ ] `node --check` passa; smoke manual (checklist T16)

**Tests**: none
**Gate**: build
**Commit**: `feat(cash-flow): monthly close/reopen service`

---

### T16: doGet + UI pt-BR (Index.html) + smoke de deploy

**What**: `doGet()` + `cash-flow/Index.html`: formulário (tipo/data/valor/categoria com autocomplete/descrição) gerando `clientToken` e desabilitando o botão no envio; lista com filtros; saldo com alerta de negativo; abertura; controles fechar/reabrir. Inclui checklist de smoke de deploy.
**Where**: `cash-flow/Code.gs` (doGet), `cash-flow/Index.html`
**Depends on**: T13, T11, T12, T14, T15
**Reuses**: padrão `doGet`/HtmlService dos spikes; UI pt-BR de m0-roles/m0-reports
**Requirement**: superfície de UI de LANC-01..12

**Tools**:
- MCP: context7 (HtmlService/google.script.run), GitHub MCP
- Skill: tlc-spec-driven

**Done when**:
- [ ] Formulário gera `clientToken` (UUID) por abertura e desabilita o submit ao enviar (anti-duplo-clique no cliente, complementando o servidor)
- [ ] Lista, saldo (negativo em vermelho), autocomplete de categoria, abertura e fechar/reabrir funcionam na UI
- [ ] Mensagens em pt-BR
- [ ] **Smoke manual no deploy:** abrir o Web App, registrar abertura + 1 entrada + 1 saída, conferir saldo, editar, excluir (soft), fechar mês e ver bloqueio, reabrir; confirmar 5 abas e linhas na `Auditoria`
- [ ] `node --check` passa; `npm test` passa (regressão)

**Tests**: none (verificação manual/empírica)
**Gate**: build
**Commit**: `feat(cash-flow): web UI + doGet + deploy smoke`

---

## Pre-Approval Validation

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | `Depends on` (definição) | Antecessor no diagrama | OK |
| ---- | ------------------------ | ---------------------- | -- |
| T1 | None | — (raiz) | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T1 | T1 → T3 | ✅ |
| T4 | T1 | T1 → T4 | ✅ |
| T5 | T1 | T1 → T5 | ✅ |
| T6 | T1 | T1 → T6 | ✅ |
| T7 | T1 | T1 → T7 | ✅ |
| T8 | T1 | T1 → T8 | ✅ |
| T9 | T1 | T1 → T9 | ✅ |
| T10 | T1 | T1 → T10 (entra na Fase 3) | ✅ |
| T11 | T10, T3, T4, T8 | T10 → T11 (+ deps de lógica da Fase 2) | ✅ |
| T12 | T11, T4 | T11 → T12 | ✅ |
| T13 | T10, T6, T7, T5 | T12 → T13 (cadeia seq.) + deps de lógica | ✅ |
| T14 | T10, T2, T4 | T13 → T14 (cadeia seq.) + deps de lógica | ✅ |
| T15 | T10, T9 | T14 → T15 (cadeia seq.) + deps de lógica | ✅ |
| T16 | T13, T11, T12, T14, T15 | T15 → T16 (Fase 4) | ✅ |

> A Fase 3 é uma cadeia sequencial (T10→…→T15) por compartilharem `Code.gs` (estado mutável de arquivo); as dependências de lógica da Fase 2 são pré-requisitos de conteúdo, satisfeitos antes da Fase 3 começar.

### Check 1 — Granularity

Cada tarefa entrega **uma** unidade: T1 = scaffold; T2–T9 = uma família de funções puras + seus testes (um arquivo de lógica/uma preocupação); T10–T15 = um serviço/endpoint na cola; T16 = a UI/entry. Nenhuma tarefa mistura camadas. ✅

### Check 3 — Test Co-location Validation

| Task | Camada | Test type exigido (matriz) | Campo `Tests` | OK |
| ---- | ------ | -------------------------- | ------------- | -- |
| T1 | Config | none | none | ✅ |
| T2–T9 | Lógica pura | unit | unit | ✅ |
| T10–T15 | Cola Apps Script | none | none | ✅ |
| T16 | UI | none | none | ✅ |

> Tarefas de lógica pura (T2–T9) trazem os testes co-localizados satisfazendo a Coverage Expectation (1:1 com ACs + edge cases). A cola/UI é "none" por design (serviços Apps Script) — verificada por build gate + smoke manual.

---

## Decisões pendentes de confirmação (antes do Execute)

1. **Framework de teste:** adotado **Vitest** (`npm test` → `vitest run`). Confirmar ou trocar por Jest.
2. **Sub-agents:** 4 fases → no Execute eu **ofereço** um worker por fase (sequencial). Aceitar ou rodar inline.
3. **MCPs/Skills:** planejados conforme sua escolha — tlc-spec-driven (file+terminal), context7 (docs Apps Script) na cola, GitHub MCP para commits/PR.
