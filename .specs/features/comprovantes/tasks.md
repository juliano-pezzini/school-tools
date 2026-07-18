# Comprovantes — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: [.specs/features/comprovantes/design.md](design.md)
**Spec**: [.specs/features/comprovantes/spec.md](spec.md)
**Context**: [.specs/features/comprovantes/context.md](context.md)
**Status**: Ready for Execute (Vitest; commit per task; 3 phases → executa inline, sem sub-agents)

> **Estrutura (herda de Lançamentos):** lógica decidível vai para `cash-flow/logic.js` (pura, testável em Node/Vitest); a cola Drive/Sheets fica em `cash-flow/Code.gs` (verificada por deploy smoke). Deploy junto via clasp.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lógica pura (`logic.js`: `validateComprovante_`, `extForMime_`, `comprovanteFileName_`) | unit (Vitest) | Todos os ramos; 1:1 com as ACs de COMP-05/06; cada edge case (tipo inválido, tamanho, MIME vazio→fallback por extensão, nome vazio) | `cash-flow/comprovante.test.js` | `npm test` |
| Cola Drive/Sheets (`Code.gs`: `setComprovante`/`removeComprovante`/`uploadComprovante_`/`trashComprovante_`/`getComprovanteFolder_`, `deleteLancamento`, `readLancamentoRows_`, `serializeRows_`, `buildSheets_`) | none | — (depende de `DriveApp`/`SpreadsheetApp`/`LockService`; verificado por build gate + smoke manual) | — | build gate + smoke |
| UI (`Index.html`) | none | — (verificação manual no deploy) | — | manual |

**Por que "none" na cola/UI:** `DriveApp`, `SpreadsheetApp`, `LockService`, `PropertiesService`, `Utilities` só existem no runtime do Apps Script — sem mock de baixo custo que agregue valor (AD-001). Toda decisão testável (whitelist de tipo, teto de tamanho, nome do arquivo) é empurrada para `logic.js`.

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (Vitest, lógica pura) | **Yes** | Funções puras, sem I/O; entradas em memória por teste | `validateComprovante_`/`comprovanteFileName_` não tocam Drive/Sheets |
| none (cola/UI) | n/a | — | — |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tarefa com testes unit (lógica pura) | `npm test` (de `cash-flow/`) |
| Build | Após tarefas de cola/UI | `node --check` sobre uma cópia do `Code.gs` (símbolos Apps Script não executam) + `npm test` (regressão) + **smoke manual** no deploy (checklist na T5) |

---

## Execution Plan

### Phase 1: Pure logic (Vitest)

```
T1
```

### Phase 2: Glue (Sequential — compartilham Code.gs)

```
T2 → T3 → T4
```

### Phase 3: UI & smoke

```
T5
```

> **3 fases → executa inline** (o gatilho de sub-agents é > 3 fases). Verifier roda automaticamente após a última task.

---

## Task Breakdown

### T1: Lógica pura de comprovante + testes

**What**: Em `logic.js`, adicionar `validateComprovante_(file, opts)` (whitelist de tipo, teto de tamanho, nome não vazio, fallback de MIME vazio por extensão), `extForMime_(mime)`, `comprovanteFileName_(id, mime, ts)` e as constantes `COMPROVANTE_TIPOS` / `COMPROVANTE_MAX_BYTES` (10 MB), exportadas no dual-env. Testes 1:1 com as ACs de COMP-05/06.
**Where**: `cash-flow/logic.js`, `cash-flow/comprovante.test.js`
**Depends on**: None
**Reuses**: padrão de sanitização de fronteira + guarda de export dual-env de `logic.js`
**Requirement**: COMP-05 (validação), COMP-06 (nome do arquivo)

**Tools**: MCP NONE (file + terminal); Skill: tlc-spec-driven

**Done when**:
- [ ] `validateComprovante_` aceita tipos da whitelist ≤ 10 MB; rejeita tipo fora, `size<=0`, `size>max`, nome vazio — mensagens pt-BR
- [ ] MIME vazio/impreciso → infere por extensão do nome dentro da whitelist (ou rejeita se extensão também não bate)
- [ ] `comprovanteFileName_('L1','image/jpeg',123)` → `'L1_123.jpg'`; `application/pdf`→`.pdf`; MIME desconhecido→`.bin`
- [ ] Constantes exportadas e consumidas pelos testes (fonte única)
- [ ] Testes cobrem todos os ramos + edge cases; `npm test` passa; contagem registrada (sem deleções)

**Tests**: unit — **Gate**: quick
**Commit**: `feat(cash-flow): comprovante validation + filename pure logic + tests`

---

### T2: Schema (2 colunas) + helpers de Drive

**What**: Estender `buildSheets_` (cabeçalho `Lancamentos` 14→16: `ComprovanteId`, `ComprovanteUrl`), `readLancamentoRows_` (ler cols 15/16, retrocompat `''`), `serializeRows_` (incluir `ComprovanteUrl` + `TemComprovante`); adicionar `getComprovanteFolder_` (id em `PropertiesService`, cria sob demanda, recria se apagada), `uploadComprovante_(id, file)` (base64→blob→`createFile`→`setSharing(ANYONE_WITH_LINK, VIEW)`) e `trashComprovante_(fileId)` (tolerante a ausência).
**Where**: `cash-flow/Code.gs`
**Depends on**: T1
**Reuses**: `getReportFolder_`/`createFile`/`setSharing` de [spikes/m0-reports/Code.gs](../../../spikes/m0-reports/Code.gs); `readLancamentoRows_`/`serializeRows_`/`buildSheets_` de `cash-flow/Code.gs`
**Requirement**: COMP-06 (storage/referência), suporte a COMP-02

**Tools**: MCP context7 (DriveApp/PropertiesService/Utilities.base64Decode), GitHub MCP (commit); Skill: tlc-spec-driven

**Done when**:
- [ ] `buildSheets_` cria `Lancamentos` com 16 colunas (2 novas ao final)
- [ ] `readLancamentoRows_` expõe `ComprovanteId`/`ComprovanteUrl` (linhas antigas → `''`)
- [ ] `serializeRows_` inclui `ComprovanteUrl` e `TemComprovante`
- [ ] `getComprovanteFolder_` persiste/reusa `COMPROVANTES_FOLDER_ID`; recria se a pasta sumiu
- [ ] `uploadComprovante_` grava com link público e devolve `{ id, url }`; `trashComprovante_` engole "arquivo ausente"
- [ ] `node --check` (cópia) passa; `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `feat(cash-flow): comprovante schema columns + Drive helpers`

---

### T3: Endpoints setComprovante / removeComprovante (+ auditoria)

**What**: `setComprovante(lancamentoId, file)` — `requireRole_` → `withLock_` → localizar linha viva → `assertPeriodOpen_` → `validateComprovante_` → `uploadComprovante_` → se havia `ComprovanteId`, `trashComprovante_(antigo)` → gravar cols 15/16 → `appendAudit_(antigo?'substituir':'anexar', …)`; retorna `{ ok, url, id }`. `removeComprovante(lancamentoId)` — `requireRole_` → `withLock_` → `assertPeriodOpen_` → se há arquivo, `trashComprovante_` → limpar cols 15/16 → `appendAudit_('remover_comprovante', …)`.
**Where**: `cash-flow/Code.gs`
**Depends on**: T2, T1
**Reuses**: `requireRole_`, `withLock_`, `findLancamentoById_`, `assertPeriodOpen_`/`closedPeriods_`, `appendAudit_`
**Requirement**: COMP-01, COMP-03, COMP-04, COMP-08, COMP-09

**Tools**: MCP context7 (LockService), GitHub MCP; Skill: tlc-spec-driven

**Done when**:
- [ ] Anexar a lançamento sem comprovante grava cols + auditoria `anexar`
- [ ] Anexar quando já existe → substitui: novo gravado, antigo à lixeira, auditoria `substituir`
- [ ] Mês fechado → bloqueia anexar/substituir/remover (pt-BR), nada muda
- [ ] `removeComprovante` manda à lixeira, limpa cols, auditoria `remover_comprovante`; no-op tolerante sem comprovante
- [ ] Tudo sob `withLock_` (sem órfão/dup em reenvio)
- [ ] `node --check` (cópia) passa; `npm test` (regressão) passa; smoke manual (checklist T5)

**Tests**: none — **Gate**: build
**Commit**: `feat(cash-flow): attach/replace/remove comprovante endpoints + audit`

---

### T4: Soft-delete do lançamento manda o comprovante à lixeira

**What**: Modificar `deleteLancamento(id)`: dentro do lock existente, se a linha tem `ComprovanteId`, `trashComprovante_` e limpar cols 15/16 antes/junto do soft-delete; o resumo de auditoria de exclusão pode sinalizar que havia comprovante.
**Where**: `cash-flow/Code.gs`
**Depends on**: T2
**Reuses**: `deleteLancamento` existente, `trashComprovante_`
**Requirement**: COMP-07

**Tools**: MCP context7, GitHub MCP; Skill: tlc-spec-driven

**Done when**:
- [ ] Excluir (soft) um lançamento com comprovante → arquivo vai para a lixeira e cols 15/16 são limpas
- [ ] Excluir sem comprovante → comportamento inalterado
- [ ] Regressão de soft-delete de Lançamentos preservada (`npm test` verde)
- [ ] `node --check` (cópia) passa; smoke manual (checklist T5)

**Tests**: none — **Gate**: build
**Commit**: `feat(cash-flow): soft-delete trashes attached comprovante`

---

### T5: UI (input file + capture, lista, ações) + smoke de deploy

**What**: Em `Index.html`: `<input type="file" accept="image/*,application/pdf" capture="environment">` no formulário + nome do arquivo + aviso discreto de privacidade (link público); em `submitLancamento`, após `addLancamento` retornar `id`, se há arquivo → `FileReader.readAsDataURL` → base64 → **espelho client** de `validateComprovante_` (tipo/tamanho, repo convention) → `setComprovante`. Na lista, indicador/link "ver" quando `TemComprovante` (senão "—") + ações "anexar/trocar" e "remover" quando o mês está aberto. Botão desabilitado durante o upload. Inclui checklist de smoke.
**Where**: `cash-flow/Index.html`, `cash-flow/Code.gs` (se precisar de ajuste no doGet/dashboard)
**Depends on**: T3, T4
**Reuses**: `<input>`+`google.script.run`+`validateClient` e o estado de períodos fechados já carregado em `Index.html`
**Requirement**: superfície de UI de COMP-01..04, COMP-02 (ver)

**Tools**: MCP context7 (HtmlService/google.script.run/FileReader), GitHub MCP; Skill: tlc-spec-driven

**Done when**:
- [ ] Anexar foto/PDF ao registrar funciona; sem arquivo grava normalmente (opcional)
- [ ] Espelho client de tipo/tamanho rejeita antes de enviar, com a **mesma** mensagem do servidor
- [ ] Lista mostra "ver" (abre o link) para quem tem comprovante e "—" para quem não tem
- [ ] Anexar/trocar/remover só aparecem/funcionam em mês aberto; bloqueio pt-BR em mês fechado
- [ ] Aviso de privacidade (link público) visível de forma discreta
- [ ] **Smoke manual no deploy:** anexar JPEG a uma saída, abrir pelo link (inclusive em aba anônima), trocar por PDF (antigo vai à lixeira), remover, excluir (soft) um lançamento com comprovante e confirmar arquivo na lixeira + linhas na `Auditoria`; confirmar cabeçalho de 16 colunas
- [ ] `node --check` (cópia) passa; `npm test` passa (regressão)

**Tests**: none (verificação manual/empírica) — **Gate**: build
**Commit**: `feat(cash-flow): comprovante UI (upload/view/replace/remove) + deploy smoke`

---

## Pre-Approval Validation

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | `Depends on` | Antecessor no diagrama | OK |
| ---- | ------------ | ---------------------- | -- |
| T1 | None | — (raiz) | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2, T1 | T2 → T3 | ✅ |
| T4 | T2 | T3 → T4 (cadeia seq. em Code.gs; dep real = T2) | ✅ |
| T5 | T3, T4 | T4 → T5 (Fase 3) | ✅ |

> A Fase 2 é sequencial (T2→T3→T4) por compartilharem `Code.gs`. T4 depende de conteúdo de T2 (`trashComprovante_` + colunas); vem depois de T3 na cadeia por serialização de edição no mesmo arquivo.

### Check 1 — Granularity

T1 = lógica pura + testes (uma preocupação); T2 = schema + helpers de Drive (uma camada de storage); T3 = endpoints de anexo (um serviço); T4 = uma alteração cirúrgica no soft-delete; T5 = a UI/entry. Nenhuma task mistura camadas. ✅

### Check 3 — Test Co-location Validation

| Task | Camada | Test type exigido | Campo `Tests` | OK |
| ---- | ------ | ----------------- | ------------- | -- |
| T1 | Lógica pura | unit | unit | ✅ |
| T2–T4 | Cola Drive/Sheets | none | none | ✅ |
| T5 | UI | none | none | ✅ |

---

## Decisões registradas

- **Vitest** (mesmo harness de Lançamentos; `npm test` → `vitest run`).
- **Sem sub-agents** (3 fases → inline). Verifier automático após a T5.
- **AD-011** (link público dos comprovantes) acrescentado a `.specs/STATE.md` no fechamento do Design.
