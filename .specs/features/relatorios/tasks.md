# Relatórios — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: [.specs/features/relatorios/design.md](design.md)
**Spec**: [.specs/features/relatorios/spec.md](spec.md)
**Status**: Ready for Execute (Vitest; commit per task; 3 phases → executa inline, sem sub-agents)

> **Estrutura (herda de Lançamentos/Comprovantes):** lógica decidível vai para `cash-flow/logic.js` (pura, testável em Node/Vitest); a cola Drive/Sheets fica em `cash-flow/Code.gs` (verificada por deploy smoke). Deploy junto via clasp.

---

## Test Coverage Matrix

> Generated from codebase sampling (`cash-flow/*.test.js`, `package.json`) and spec ACs. Guidelines found: `cash-flow/README.md` (testing section), existing `comprovante.test.js` / `format.test.js` / `guards.test.js` etc. pattern.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lógica pura (`logic.js`: `computeMonthReport_`, `computeAnnualReport_`, `buildInsights_`, helpers) | unit (Vitest) | Todos os ramos; 1:1 com ACs REL-01..09; edge cases (mês vazio, ano vazio, excluídos ignorados, abertura indefinida→0, provisório/oficial, consistência Σ) | `cash-flow/relatorio.test.js` | `npm test` |
| Lógica pura (`logic.js`: `buildMonthlyPdfHtml_`, `buildAnnualPdfHtml_`, `buildSvgBars_`, `reportPdfFileName_`, `escapeHtml_`, `pct_`, `toSortedPairs_`) | unit (Vitest) | Ramos relevantes; output contém marcadores esperados (título, KPI, SVG, privacy note, provisório); XSS sanitizado | `cash-flow/relatorio.test.js` | `npm test` |
| Cola Drive/Sheets (`Code.gs`: `getMonthlyReport`, `getAnnualReport`, `exportReportPdf`, `getReportFolder_`, `findExistingReportPdf_`) | none | — (depende de `DriveApp`/`SpreadsheetApp`/`Utilities`; verificado por build gate + smoke manual) | — | build gate + smoke |
| UI (`Index.html`: aba de relatórios) | none | — (verificação manual no deploy) | — | manual |

**Por que "none" na cola/UI:** `DriveApp`, `SpreadsheetApp`, `Utilities`, `HtmlService` só existem no runtime do Apps Script — sem mock de baixo custo que agregue valor (AD-001). Toda decisão testável é empurrada para `logic.js`.

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (Vitest, lógica pura) | **Yes** | Funções puras, sem I/O; entradas em memória por teste | `computeMonthReport_`/`computeAnnualReport_`/`buildInsights_` não tocam Drive/Sheets |
| none (cola/UI) | n/a | — | — |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tarefa com testes unit (lógica pura) | `npm test` (de `cash-flow/`) |
| Build | Após tarefas de cola/UI | `node --check` sobre uma cópia do `Code.gs` (símbolos Apps Script não executam) + `npm test` (regressão) + **smoke manual** no deploy |

---

## Execution Plan

### Phase 1: Pure logic + tests (Vitest)

```
T1 → T2
```

### Phase 2: Glue (Sequential — compartilham Code.gs)

```
T3 → T4
```

### Phase 3: UI & smoke

```
T5
```

> **3 fases → executa inline** (o gatilho de sub-agents é > 3 fases). Verifier roda automaticamente após a última task.

---

## Task Breakdown

### T1: Helpers puros (escapeHtml_, pct_, toSortedPairs_, reportPdfFileName_) + testes

**What**: Em `logic.js`, adicionar `escapeHtml_(s)`, `pct_(part, whole)`, `toSortedPairs_(obj)` e `reportPdfFileName_(tipo, periodo)`, exportadas no dual-env. Testes cobrem cada helper isoladamente.
**Where**: `cash-flow/logic.js`, `cash-flow/relatorio.test.js`
**Depends on**: None
**Reuses**: Spike `spikes/m0-reports/Code.gs` (adaptados); padrão dual-env de `logic.js`
**Requirement**: REL-06 (pré-req helpers), REL-11 (nome do PDF), REL-13 (escapeHtml para PDF)

**Tools**: MCP NONE (file + terminal); Skill: tlc-spec-driven

**Done when**:
- [ ] `escapeHtml_` sanitiza `& < > " '`
- [ ] `pct_(50, 200)` → `'25%'`; `pct_(0, 0)` → `'0%'`
- [ ] `toSortedPairs_({a:10, b:30})` → `[{key:'b',value:30},{key:'a',value:10}]` (desc)
- [ ] `reportPdfFileName_('mensal','2025-07')` → `'Relatorio_APP_mensal_2025-07.pdf'`; `('anual','2025')` → `'Relatorio_APP_anual_2025.pdf'`
- [ ] Constantes/funções exportadas e consumidas pelos testes (fonte única)
- [ ] `npm test` passa; contagem registrada (sem deleções)

**Tests**: unit — **Gate**: quick
**Commit**: `feat(cash-flow): report helpers (escapeHtml, pct, toSortedPairs, pdfFileName) + tests`

---

### T2: Funções de agregação + geração de HTML/SVG + testes

**What**: Em `logic.js`, adicionar `computeMonthReport_(config, allRows, mes, closedPeriods)`, `computeAnnualReport_(config, allRows, ano, closedPeriods)`, `buildInsights_(...)`, `buildSvgBars_(meses)`, `buildMonthlyPdfHtml_(monthReport, generatedStamp)` e `buildAnnualPdfHtml_(annualReport, generatedStamp)`, exportadas. Testes cobrem 1:1 cada AC dos requisitos REL-01..09 e REL-13, incluindo edge cases (mês vazio, excluídos ignorados, abertura indefinida, provisório/oficial, consistência Σ mensal==anual, SVG contém `<svg`, HTML contém comprovante links + privacy note).
**Where**: `cash-flow/logic.js`, `cash-flow/relatorio.test.js`
**Depends on**: T1
**Reuses**: Existentes `computeMonthState_`, `computeCashState_`, `listForView_`, `normalizeCategoryKey_`, `formatBRL_`, `formatDate_`, `periodKey_`, `round2_`, `pad2_`; helpers de T1; spike `buildInsights_`/`buildPdfHtml_`/`buildSvgBars_`
**Requirement**: REL-01, REL-02, REL-03, REL-04, REL-05, REL-06, REL-07, REL-08, REL-09, REL-13

**Tools**: MCP NONE (file + terminal); Skill: tlc-spec-driven

**Done when**:
- [ ] `computeMonthReport_` retorna totais corretos (entradas/saídas/saldoMes/saldoAcumulado), lista de lançamentos não-excluídos com ComprovanteUrl, e flag provisório (baseado em closedPeriods)
- [ ] `computeAnnualReport_` retorna KPIs, séries mensais, porCategoria (normalizada), insights, e flag provisório por mês; Σ dos 12 meses == totais anuais (REL-09)
- [ ] Mês/ano vazio → totais zerados, lista vazia (REL-04)
- [ ] Lançamentos com `Excluido=true` são ignorados em todos os cálculos
- [ ] Abertura indefinida (config nulo) → tratada como 0
- [ ] `buildInsights_` gera frases pt-BR (melhor mês, vermelho, maior despesa, etc.)
- [ ] `buildSvgBars_` retorna string começando com `<svg`
- [ ] `buildMonthlyPdfHtml_` contém links de comprovante e aviso de privacidade (REL-13)
- [ ] `buildAnnualPdfHtml_` contém KPIs, tabela mensal, categorias, insights e SVG
- [ ] `npm test` passa; contagem registrada (sem deleções)

**Tests**: unit — **Gate**: quick
**Commit**: `feat(cash-flow): report aggregation + PDF HTML/SVG builders + tests`

---

### T3: Endpoints getMonthlyReport / getAnnualReport + report folder

**What**: Em `Code.gs`, adicionar `getMonthlyReport(mes)` e `getAnnualReport(ano)` (ambos com `requireRole_(['admin','tesoureiro'])` → lê rows uma vez → chama funções puras de `logic.js`); adicionar `getReportFolder_()` (padrão PropertiesService pin + recreate-on-miss, `REPORT_FOLDER_ID`, pasta `Fluxo de Caixa — Relatórios`).
**Where**: `cash-flow/Code.gs`
**Depends on**: T2
**Reuses**: `readLancamentoRows_`, `aberturaConfig_`, `listClosedPeriodsData_`, `requireRole_`, `serializeRows_`, `getComprovanteFolder_` pattern
**Requirement**: REL-01, REL-02, REL-03, REL-04, REL-05, REL-06, REL-07, REL-08, REL-14

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] `getMonthlyReport(mes)` devolve JSON do relatório mensal (guarda `admin`/`tesoureiro`)
- [ ] `getAnnualReport(ano)` devolve JSON do relatório anual (guarda `admin`/`tesoureiro`)
- [ ] `getReportFolder_` persiste/reusa `REPORT_FOLDER_ID`; recria se a pasta sumiu
- [ ] `node --check` (cópia) passa; `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `feat(cash-flow): report endpoints + report folder helper`

---

### T4: Endpoint exportReportPdf (geração + substituição + auditoria)

**What**: Em `Code.gs`, adicionar `exportReportPdf(tipo, periodo)` — `requireRole_` → `withLock_` → compute report → build PDF HTML → `Utilities.newBlob(html).getAs('application/pdf')` → `findExistingReportPdf_` → se existente, `setTrashed(true)` → `createFile` → `setSharing(ANYONE_WITH_LINK, VIEW)` → `appendAudit_('gerar_relatorio', ...)` → return `{ok, url, name}`. Inclui `findExistingReportPdf_(folder, tipo, periodo)` que busca por nome determinístico. Se `setSharing` falha, `file.setTrashed(true)` → rethrow (REL-15).
**Where**: `cash-flow/Code.gs`
**Depends on**: T3
**Reuses**: `withLock_`, `appendAudit_`, `requireRole_`, `getReportFolder_` (T3), `DriveApp`/`Utilities`, padrão de `uploadComprovante_`/`trashComprovante_`
**Requirement**: REL-10, REL-11, REL-12, REL-13, REL-14, REL-15

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] `exportReportPdf('mensal', '2025-07')` gera PDF, grava no Drive com link público, retorna `{ok, url, name}`
- [ ] PDF para o mesmo período substitui o anterior (antigo à lixeira)
- [ ] Linha na `Auditoria` registra quem/quando/período/link
- [ ] Falha no `setSharing` → arquivo à lixeira antes de rethrow (sem órfão público)
- [ ] Apenas `admin`/`tesoureiro` pode chamar (guard server-side)
- [ ] `node --check` (cópia) passa; `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `feat(cash-flow): exportReportPdf endpoint (Drive + audit + replace)`

---

### T5: UI (aba de relatórios + Chart.js + "Gerar PDF") + smoke de deploy

**What**: Em `Index.html`, nova aba/seção "Relatórios" com: seletores mês/ano; KPI cards (totais, saldo, badge provisório/oficial); relatório mensal com tabela de lançamentos (links de comprovante, "ver"/"—") + aviso de privacidade; relatório anual com Chart.js (barras, linha, rosca) + degradação graciosa + insights; botão "Gerar PDF" (desabilitado durante chamada) → `google.script.run.exportReportPdf` → mostra link; mês/ano vazio → "Sem lançamentos". Checklist de smoke no deploy.
**Where**: `cash-flow/Index.html`
**Depends on**: T3, T4
**Reuses**: Padrão UI existente (tabs, spinner, toasts, `google.script.run` wrappers); dados de `closedPeriods` já carregados
**Requirement**: superfície de UI de REL-01..04 (mensal), REL-05..09 (anual), REL-10/13 (PDF), REL-03 (provisório/oficial)

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] Aba "Relatórios" aparece, seletores mês/ano funcionam
- [ ] Mensal: KPIs + tabela com "ver comprovante" / "—" + aviso privacidade + badge provisório/oficial
- [ ] Anual: KPIs + 3 gráficos Chart.js + insights; se Chart.js bloqueado → aviso, tabelas permanecem
- [ ] Mês/ano vazio → "Sem lançamentos neste período." + totais zerados
- [ ] "Gerar PDF" → link retornado abre sem login (aba anônima); botão desabilitado durante chamada
- [ ] **Smoke manual no deploy:** gerar PDF mensal → abrir link anônimo; regerar → link antigo morto, novo abre; gerar PDF anual → 3 gráficos SVG no PDF; conferir `Auditoria`; chamar sem papel → "Acesso negado"; mês vazio → relatório com zeros
- [ ] `node --check` (cópia) passa; `npm test` passa (regressão)

**Tests**: none (verificação manual/empírica) — **Gate**: build
**Commit**: `feat(cash-flow): reports UI (monthly/annual/PDF export) + deploy smoke`

---

## Pre-Approval Validation

### Check 1 — Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: helpers puros + testes | 4 funções puras + testes (uma preocupação: helpers) | ✅ Granular |
| T2: agregação + HTML/SVG + testes | Funções de agregação + builders (uma camada de lógica de relatório) | ⚠️ Coesivo — todas dependem das mesmas entradas/modelo e são testadas juntas; separar criaria dependência circular nos testes |
| T3: endpoints + report folder | Camada de cola (2 endpoints + 1 helper de pasta) | ✅ Granular |
| T4: exportReportPdf | 1 endpoint + 1 helper de busca | ✅ Granular |
| T5: UI + smoke | 1 seção de UI (uma superfície) | ✅ Granular |

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | `Depends on` | Antecessor no diagrama | OK |
| ---- | ------------ | ---------------------- | -- |
| T1 | None | — (raiz) | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 (Phase 1→2 boundary) | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T3, T4 | T4 → T5 (Phase 2→3 boundary; T3 implícito via T4) | ✅ |

### Check 3 — Test Co-location Validation

| Task | Camada | Test type exigido (matrix) | Campo `Tests` | Status |
| ---- | ------ | -------------------------- | ------------- | ------ |
| T1 | Lógica pura (`logic.js` helpers) | unit | unit | ✅ |
| T2 | Lógica pura (`logic.js` aggregation/builders) | unit | unit | ✅ |
| T3 | Cola Drive/Sheets (`Code.gs`) | none | none | ✅ |
| T4 | Cola Drive/Sheets (`Code.gs`) | none | none | ✅ |
| T5 | UI (`Index.html`) | none | none | ✅ |

---

## Decisões registradas

- **Vitest** (mesmo harness de Lançamentos/Comprovantes; `npm test` → `vitest run`).
- **Sem sub-agents** (3 fases → inline). Verifier automático após a T5.
- Helpers do spike portados para `logic.js`; cola do spike portada para `Code.gs`.
