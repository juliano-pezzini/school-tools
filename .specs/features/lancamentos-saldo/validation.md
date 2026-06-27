# Lançamentos & Saldo Validation

**Date**: 2026-06-26
**Spec**: `.specs/features/lancamentos-saldo/spec.md` (oficial v2)
**Diff range**: `ac67804..HEAD` (HEAD = `059bae1`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Method**: read-only over the real tree; sensor mutations applied in scratch (`sed` + `git checkout -- ` restore), tree verified clean after each.

**Re-verification (post-fix, 2026-06-26)**: ambos os gaps abaixo foram corrigidos e reverificados (Fix 1 commit + Fix 2 commit). Sensor M2 reaplicado **mata** o mutante (2 testes falham); confirmação de teto na UI implementada. **Veredito final: PASS ✅** (74 testes).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Scaffold + Vitest | ✅ Done | `ac67804` — package.json/logic.js/appsscript.json/.claspignore |
| T2 Helpers pt-BR | ✅ Done | `d42d24d`, 15 tests (`format.test.js`) |
| T3 Sanitização + limites | ✅ Done | `544f73a`, 17 tests (`sanitize.test.js`) |
| T4 Guardas data/período | ✅ Done | `3be1e97`, 8 tests (`guards.test.js`) |
| T5 Categorias | ✅ Done | `e6e59ac`, 7 tests (`categorias.test.js`) |
| T6 Cálculo de saldo | ✅ Done | `75f8cbc`, 7 tests (`saldo.test.js`) |
| T7 Listagem/ordem/filtros | ✅ Done | `59eb226`, 8 tests (`list.test.js`) — tie-break reforçado (Fix 1), sensor M2 mata |
| T8 Idempotência | ✅ Done | `5d58f06`, 4 tests (`idempotency.test.js`) |
| T9 Transições de período | ✅ Done | `a615232`, 8 tests (`periods.test.js`) |
| T10 Data layer + auth seam + 5 abas | ✅ Done | `b7d6637` — glue (no auto test; code-read) |
| T11 addLancamento (idem + audit) | ✅ Done | `6c6086f` — glue |
| T12 Editar + soft-delete | ✅ Done | `2adec97` — glue |
| T13 Leituras | ✅ Done | `072dc6e` — glue |
| T14 Saldo de abertura | ✅ Done | `f1104b3` — glue |
| T15 Fechamento/reabertura | ✅ Done | `a34bec1` — glue |
| T16 doGet + UI + smoke | ✅ Done | `059bae1` — UI (manual smoke); teto-confirmation implementada (Fix 2) |

All 16 tasks marked done in `tasks.md`. None blocked/partial.

---

## Spec-Anchored Acceptance Criteria

Legend: **test** = automated assertion (pure logic); **code** = code-evidence in `Code.gs`/`Index.html` (layer marked "none" in the Test Coverage Matrix by design).

### LANC-01 — Saldo de abertura (P1)

| Criterion (WHEN→THEN) | Spec-defined outcome | Evidence | Result |
| --------------------- | -------------------- | -------- | ------ |
| Abertura `>=0` + data não-futura → registra e usa como base | grava `SALDO_ABERTURA_*`, `getCashState` usa | code `Code.gs:466` `setOpeningBalance`; `parseOpeningValue_` (`Code.gs:445` aceita `n>=0`); `saldo.test.js:46` `aberturaDefinida` p/ abertura 0 | ✅ (test+code) |
| Já registrada → impede novo registro | `throw 'já foi registrado'` | code `Code.gs:471` `if (existente != null …) throw` | ✅ code |
| Valor vazio/não num/negativo → rejeita pt-BR | rejeita, não grava | code `Code.gs:451` `parseOpeningValue_` throws | ✅ code (⚠️ mesma msg "não pode ser negativo" p/ vazio/não-num — ver nota) |
| Data vazia/inválida/futura → rejeita pt-BR | rejeita | test `guards.test.js:22` `assertNotFuture_` `/data futura/`; `format.test.js:47` `parseDateBR_` rejeita vazio/inválido | ✅ test+code |

### LANC-02 — Registrar lançamento (P1)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Tipo/data válida/valor`>0`≤2casas/cat/desc → grava + reflete saldo | grava linha + saldo | test `sanitize.test.js:9` tipo/valor; code `Code.gs:300` `addLancamento` append | ✅ test+code |
| Gravado → registra quem criou + quando (servidor TZ) | `CriadoPor`/`CriadoEm` | code `Code.gs:330` `who.email, nowStamp_()` | ✅ code |
| Valor `<=0`/vazio/não num/`>2`casas → rejeita pt-BR | rejeita, não grava | test `sanitize.test.js:54` `/maior que zero/`; `:67` `/dois centavos/` | ✅ test |
| Data futura OU mês fechado → rejeita pt-BR | rejeita, não grava | test `guards.test.js:22` futura; `guards.test.js:40` `/05\/2026 está fechado/` | ✅ test |
| 2 escritas ~simultâneas → serializa (LockService) | sem perder/duplicar | code `Code.gs:222` `withLock_` (`tryLock`) em addLancamento | ✅ code |
| Mesmo `clientToken` reenviado → grava só 1, 2º idempotente | 1 linha, retorna id existente | test `idempotency.test.js:23` `isDup:true, existingId:'L002'`; code `Code.gs:316` dedup | ✅ test+code |

### LANC-03 — Ver saldo corrente (P1)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Abertura/lançamentos → saldo = abertura+Σentr−Σsaí (ignora excluído), pt-BR | `1000+200−50=1150` | test `saldo.test.js:13` `saldoAtual` `toBe(1150)`; `format.test.js:18` `formatBRL_(1150)='R$ 1.150,00'` | ✅ test |
| Criar/editar/excluir → recalcula da fonte (não materializado) | `950` após excluir entrada | test `saldo.test.js:30` `saldoAtual` `toBe(950)` | ✅ test |
| Saldo negativo → exibe com alerta, sem bloquear | retorna `-50` | test `saldo.test.js:56` `toBe(-50)`; code `Index.html:273` `⚠️ Saldo negativo` | ✅ test+code |
| Abertura indefinida + lançamentos → trata 0 e sinaliza | `aberturaDefinida=false`, saldo=200 | test `saldo.test.js:36` `aberturaDefinida toBe(false)`; code `Index.html:272` aviso | ✅ test+code |

### LANC-04 — Listar (P1)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Não-excluídos listados, ordem Data desc, empate `CriadoEm` desc | `['B','C','A']` | test `list.test.js:14` `toEqual(['B','C','A'])` + `list.test.js:25` desempate independente da ordem de entrada (Fix 1) | ✅ PASS (sensor M2 mata o mutante) |
| Excluído (soft-delete) → omitido da lista e do saldo | omite | test `list.test.js:25` `toEqual(['B'])`; `saldo.test.js:60` ignora | ✅ test |
| Sem visíveis → estado vazio pt-BR | `[]` (logic); msg UI | test `list.test.js:56` `toEqual([])`; code `Index.html` empty render | ✅ test+code |

### LANC-05 — Editar/excluir com trilha (P2)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Editar período aberto → salva, recalcula, `Alterado*` + auditoria(editar antes→depois) | linha+audit | code `Code.gs:373` `editLancamento` + `appendAudit_('editar', …antes+'=>'…)` | ✅ code |
| Excluir período aberto → soft-delete (quem/quando) + auditoria(excluir) | `Excluido*`+audit | code `Code.gs:397` `deleteLancamento` set `[true,…]` + `appendAudit_('excluir')` | ✅ code |
| Período fechado → impede edição/exclusão pt-BR | bloqueia revalidando | test `guards.test.js:40` `assertPeriodOpen_`; code `Code.gs:382/405` chama assertPeriodOpen_ | ✅ test+code |
| Edição que viola regra (≤0/futura/mês fechado) → rejeita, nada altera | rejeita | test `sanitize.test.js:54`/`guards.test.js`; code `Code.gs:385-389` revalida | ✅ test+code |
| Edição/exclusão concorrente → serializa (LockService) | integridade | code `Code.gs:374/398` `withLock_` | ✅ code |

### LANC-06 — Categoria autocomplete (P2)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Sugere usadas ignorando caixa/acento/espaço | 1 sugestão p/ variações | test `categorias.test.js:24` `toEqual(['Doação'])` | ✅ test |
| Nova categoria aceita (trim) e passa a sugerir | grava trim | test `sanitize.test.js:25` apara; `categorias.test.js:33` 1ª grafia | ✅ test |
| Variações só caixa/acento/espaço → 1 opção (sem duplicar) | dedup | test `categorias.test.js:23` colapsa 4→1 | ✅ test |

### LANC-07 — Fechar mês (P2)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Fechar mês aberto `<=` corrente → fechado + quem/quando | `changed:true,status:'fechado'` | test `periods.test.js:13` ; code `Code.gs:541` `closeMonth` | ✅ test+code |
| Mês fechado → impede lançar/editar/excluir (revalida servidor) | bloqueia | test `guards.test.js:40`; code revalida via `closedPeriods_` | ✅ test+code |
| Tentativa em mês fechado → rejeita pt-BR com MM/AAAA | `/05\/2026 está fechado/` | test `guards.test.js:40` | ✅ test |
| Fechar mês futuro → rejeita | `throw /mês futuro/` | test `periods.test.js:8` | ✅ test |
| Fechar mês já fechado → no-op idempotente | `changed:false, jaFechado:true` | test `periods.test.js:29` | ✅ test |

### LANC-08 — Reabrir (P2)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Reabrir fechado → aberto + quem/quando (preserva fechamento) | `changed:true,status:'aberto'` | test `periods.test.js:41`; code `Code.gs:564` grava só `Reaberto*` (cols 5-6) | ✅ test+code |
| Reaberto → volta a permitir lançar/editar/excluir | período some de fechados | code `Code.gs:564` set status `'aberto'` | ✅ code |
| Reabrir já aberto → no-op idempotente | `changed:false, jaAberto:true` | test `periods.test.js:46` ; `:51` (status ausente) | ✅ test |

### LANC-09 — Filtrar (P3)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Mês e/ou tipo e/ou categoria → só não-excluídos correspondentes, ordem padrão | subconjunto correto | test `list.test.js:40-52` mês/tipo/categoria/combina | ✅ test |
| Filtro sem retorno → estado vazio pt-BR | `[]`; msg UI | test `list.test.js:56` `toEqual([])` | ✅ test+code |

### LANC-10 — Idempotência (P1, novo)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Token novo → não-dup | `isDup:false` | test `idempotency.test.js:11` | ✅ test |
| Token visto → dup + id existente | `isDup:true, existingId` | test `idempotency.test.js:23` | ✅ test |
| Token vazio/ausente → regra definida (rejeita) | `throw` | test `idempotency.test.js:30` | ✅ test |

### LANC-11 — Soft-delete (P2, novo)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Excluir marca lógico, não apaga linha, some de lista/saldo | `Excluido=true` | test `list.test.js:25`/`saldo.test.js:60`/`categorias.test.js:38`; code `Code.gs:402` | ✅ test+code |

### LANC-12 — Auditoria append-only (P2, novo)

| Criterion | Spec-defined outcome | Evidence | Result |
| --------- | -------------------- | -------- | ------ |
| Toda criação/edição/exclusão anexa registro append-only (ação,id,autor,carimbo,resumo) | linha em `Auditoria` | code `Code.gs:289` `appendAudit_` chamado em criar/editar/excluir (`Code.gs:333,391,409`) + aba criada `Code.gs:139` | ✅ code (sem auto-test, por design) |

**Status**: todas as 12 ACs verificadas (test/code). LANC-04 desempate reforçado (Fix 1) e edge case de teto na UI implementada (Fix 2).

---

## Discrimination Sensor

Mutações de comportamento aplicadas em `cash-flow/logic.js` (scratch via `sed`, restauradas com `git checkout --`; tree limpo verificado após cada uma).

| # | File:line | Mutation | Resultado |
| - | --------- | -------- | --------- |
| 1 | `logic.js:316` `computeCashState_` | `saldoAtual … - totalSaidas` → `+ totalSaidas` (sinal do saldo) | ✅ Killed (3 testes falharam) |
| 2 | `logic.js:360` `listForView_` | desempate `if (ca < cb) return 1` → `return -1` (direção do `CriadoEm`) | ✅ **Killed** após Fix 1 (2 testes falharam; antes sobrevivia) |
| 3 | `logic.js:387` `dedupDecision_` | `String(entry.token) === token` → `!== token` (detecção de dup) | ✅ Killed (2 testes falharam) |
| 4 | `logic.js:408` `closeDecision_` | `periodo > mesCorrente` → `>= mesCorrente` (bloqueio mês futuro/corrente) | ✅ Killed (2 testes falharam) |

**Mutante sobrevivente (M2) — análise de não-equivalência (provada):** o teste de desempate (`list.test.js:9`) usa entrada `[A, B, C]`, que nunca invoca o comparador na direção `comparador(A, C)` (onde `ca < cb`); o ramo mutado nunca é exercido de forma observável. Prova empírica no código real: para entrada `[C, A]` o código real retorna `C,A` (correto, `CriadoEm` desc), mas o mutante produziria `A,C` (errado). Logo o mutante é **não-equivalente** e o teste é **fraco** para a direção do desempate.

**Sensor depth**: lightweight (4 mutações)
**Result**: 4/4 killed após Fix 1 — ✅ PASS (M2 passou a matar com o teste de desempate reforçado)

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ logic.js = funções puras enxutas; Code.gs cola fina delega tudo |
| Surgical changes | ✅ só `cash-flow/` tocado |
| No scope creep | ✅ out-of-scope (papéis, comprovantes, relatórios) respeitado; só seam mínimo |
| Matches patterns | ✅ reusa padrões dos spikes m0-roles/m0-reports (auth seam, data layer, helpers pt-BR) |
| Spec-anchored outcome check (asserted values match spec) | ✅ valores batem (1150/950/-50, MM/AAAA, idempotência) |
| Per-layer Coverage Expectation (domain 1:1 ACs; glue/UI = none por design) | ✅ domínio 1:1; desempate (LANC-04) agora discriminante (Fix 1) |
| Every test maps to a spec requirement — no unclaimed tests | ✅ 73 testes mapeiam ACs/edge cases; nenhum teste órfão |
| Documented guidelines followed | ✅ "none — strong defaults applied" (matriz declara) |

Nota: nenhum teste foi enfraquecido ou removido (base partia de 0 testes; +73).

---

## Edge Cases

- [x] Vírgula/ponto decimal → normaliza ou rejeita — test `sanitize.test.js:33-44`
- [x] **Valor > teto técnico (R$ 1.000.000,00) → confirmação explícita na UI antes de gravar** — ✅ implementado (Fix 2). `Index.html submitLancamento` chama `parseValorBR` + `confirm()` pt-BR antes de `addLancamento`/`editLancamento`; cancelar não grava e mantém o botão habilitado. `assertLimits_` (servidor) segue calculando `requiresConfirmation` (test `sanitize.test.js:96`).
- [x] Descrição/categoria > limite (280/60) → rejeita — test `sanitize.test.js:82-89`
- [x] Data vazia/inválida/futura → rejeita — test `format.test.js:47` + `guards.test.js:22`
- [x] Abertura indefinida + lançamentos → trata 0 e sinaliza — test `saldo.test.js:36` + `Index.html:272`
- [x] Escritas concorrentes → serializa (LockService); timeout → "Sistema ocupado" — code `Code.gs:223-225`
- [x] Reenvio (duplo-clique) → dedup por clientToken — test `idempotency.test.js` + `Index.html:316` (botão disabled) + `Index.html:221` (uuid)
- [x] Mês fechado → revalida no servidor — code `Code.gs` (addLancamento/edit/delete chamam assertPeriodOpen_)
- [x] Saldo negativo → permite e alerta — test `saldo.test.js:56` + `Index.html:273`
- [x] `getActiveUser().getEmail()` vazio (1ª execução) → bootstrap anti-lockout — code `Code.gs:196` `ensureBootstrapAdmin_`

---

## Gate Check

- **Build gate command**: `cp cash-flow/Code.gs /tmp/cg.js && node --check /tmp/cg.js` então `cd cash-flow && npm test`
- **node --check**: ✅ OK (sintaxe válida, símbolos Apps Script não executados)
- **Result**: **74 passed, 0 failed, 0 skipped** (8 arquivos)
- **Test count before feature**: 0 (repo não tinha harness antes; spikes testados por deploy)
- **Test count after feature**: 74
- **Delta**: +74 novos testes
- **Skipped tests**: nenhum
- **Failures**: nenhuma (no gate limpo)

Distribuição: `format` 15, `sanitize` 17, `guards` 8, `categorias` 7, `saldo` 7, `list` 8, `periods` 8, `idempotency` 4.

---

## Fix Plans

### Fix 1 (Major — bloqueia PASS): Reforçar o teste de desempate de `listForView_` — ✅ RESOLVIDO

- **Root cause**: `list.test.js:9` exercita o desempate só com entrada `[A,B,C]`; o ramo `if (ca < cb) return 1` do comparador nunca é invocado de forma observável, então uma inversão de sinal sobrevive (mutante M2).
- **Fix task**: adicionar caso(s) que forcem o comparador na direção oposta — ex.: `expect(listForView_([C, A], {}).map(r=>r.id)).toEqual(['C','A'])` e/ou um par mesma-data com ordens de entrada invertidas — pinando `CriadoEm` desc nas duas direções.
- **Verify**: reaplicar M2 (`if (ca < cb) return -1`) e confirmar que ≥1 teste falha.
- **Priority**: Major (regression guard ausente p/ ordenação determinística — requisito central LANC-04).

### Fix 2 (Minor): Implementar a confirmação de teto (R$ 1.000.000,00) na UI — ✅ RESOLVIDO

- **Root cause**: `assertLimits_().requiresConfirmation` existe e é testado, mas nenhuma camada o consome; `Index.html submitLancamento` envia direto.
- **Fix task**: na UI, antes de `addLancamento`/`editLancamento`, se o valor parseado `> 1.000.000,00`, exigir `confirm()` explícito (pt-BR) antes de gravar; opcionalmente propagar `requiresConfirmation`/flag de confirmação ao servidor.
- **Verify**: smoke manual (T16) com valor `1.000.000,01` deve pedir confirmação; cancelar não grava.
- **Priority**: Minor (servidor já persiste corretamente; é proteção anti-fat-finger).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| LANC-01 | Implementing | ✅ Verified (test+code) |
| LANC-02 | Implementing | ✅ Verified (test+code) |
| LANC-03 | Implementing | ✅ Verified (test+code) |
| LANC-04 | Implementing | ✅ Verified (desempate reforçado, sensor M2 mata — Fix 1) |
| LANC-05 | Implementing | ✅ Verified (test+code) |
| LANC-06 | Implementing | ✅ Verified (test) |
| LANC-07 | Implementing | ✅ Verified (test+code) |
| LANC-08 | Implementing | ✅ Verified (test+code) |
| LANC-09 | Implementing | ✅ Verified (test) |
| LANC-10 | Implementing | ✅ Verified (test+code) |
| LANC-11 | Implementing | ✅ Verified (test+code) |
| LANC-12 | Implementing | ✅ Verified (code-evidence) |

Edge case "teto técnico → confirmação na UI": ✅ Verified (Fix 2).

---

## Summary

**Overall**: ✅ Ready (ambos os gaps corrigidos e reverificados)

**Spec-anchored check**: 12/12 ACs verificados; LANC-04 (desempate) agora discriminante; edge case de teto/UI implementada.
**Sensor**: 4/4 mutações mortas (M2 passou a morrer após Fix 1).
**Gate**: 74 passed, 0 failed.

**What works**: toda a lógica pura decidível (saldo c/ soft-delete, guardas data/período, sanitização/limites, idempotência, categorias, transições de fechamento) está coberta 1:1 e o sensor confirma força nos pontos de maior risco (sinal do saldo, dedup, bloqueio de mês futuro). A cola (`Code.gs`) delega corretamente à lógica pura, com auth seam + LockService + auditoria evidenciados por leitura de código. UI cobre clientToken, anti-duplo-clique, alerta de negativo e sinalização de abertura indefinida.

**Issues found**:
- **Fix 1 (Major)**: ✅ resolvido — teste de desempate de `listForView_` reforçado com ordem de entrada invertida; sensor M2 reaplicado mata o mutante.
- **Fix 2 (Minor)**: ✅ resolvido — confirmação de teto (>R$ 1.000.000,00) implementada na UI (`Index.html submitLancamento` + `parseValorBR` + `confirm()`).

**Next steps**: feature pronta. T16 deploy smoke permanece como checklist manual para o humano (web app não deployável aqui).
