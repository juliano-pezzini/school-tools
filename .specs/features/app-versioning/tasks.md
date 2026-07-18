# Versionamento visível nos apps — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: [.specs/features/app-versioning/design.md](design.md)
**Spec**: [.specs/features/app-versioning/spec.md](spec.md)
**Status**: Ready for Execute (Vitest; commit per task; 3 phases → executa inline, sem sub-agents)

> **Estrutura:** a única lógica decidível (`versionLabel_`) vai para `cash-flow/logic.js` (pura, testável em Node/Vitest) e é espelhada inline em cada `Index.html`. Badge (HTML/CSS), páginas estáticas e CI são **cola**, verificados por build gate + smoke manual.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lógica pura (`logic.js`: `versionLabel_`) | unit (Vitest) | Todos os ramos; 1:1 com ACs VER-01/VER-02; edge cases (dígitos→`v`, já com `v`, placeholder `__`, vazio, `null`, espaços) | `cash-flow/version.test.js` | `npm test` |
| Badge (`Index.html` dos 4 apps + 2 páginas estáticas): HTML/CSS + mirror `versionLabel_` | none | — (verificação por build gate + smoke manual; CSS/DOM não têm mock de baixo custo que agregue valor) | — | build gate + smoke |
| CI (`deploy.yml`: job `version` + passo `sed`) | none | — (depende do runtime do GitHub Actions/clasp; verificado por smoke no deploy real) | — | smoke no deploy |

**Por que "none" no badge/CI:** DOM/CSS e o runtime do Actions/clasp só existem fora do Node; sem mock de baixo custo (AD-001). Toda decisão testável é empurrada para `versionLabel_`.

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (Vitest, `versionLabel_`) | **Yes** | Função pura, sem I/O; entradas em memória | Não toca DOM/rede/Apps Script |
| none (badge/CI) | n/a | — | — |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após T1 (lógica pura) | `npm test` (de `cash-flow/`) |
| Build | Após T2/T3 (badge/CI) | `node --check` sobre `logic.js` + `npm test` (regressão) + **smoke manual** no deploy |

---

## Execution Plan

### Phase 1: Pure logic + tests (Vitest)

```
T1
```

### Phase 2: Badge nas superfícies (glue)

```
T2  (depende de T1 — usa versionLabel_)
```

### Phase 3: CI — versão + injeção (glue)

```
T3  (depende de T2 — injeta no placeholder criado em T2)
```

3 fases → executa inline (sem sub-agents).

---

## Tasks

### T1 — `versionLabel_` puro + testes  ⟶ VER-01, VER-02

**Files**: `cash-flow/logic.js`, `cash-flow/version.test.js`
**Tests (derivados do spec)**:
- `'1.2.0'` → `'v1.2.0'`  (VER-01, edge: dígitos ganham `v`)
- `'v1.2.0'` → `'v1.2.0'`  (idempotente ao prefixo `v`)
- `'2.0'`/`'10.20.30'` → `'v...'`
- `'__APP_VERSION__'` → `'dev'`  (VER-02, placeholder não substituído)
- `''` → `'dev'`, `null` → `'dev'`, `'   '` → `'dev'`
**Gate**: `npm test`
**Commit**: `feat(versioning): versionLabel_ pure helper + tests`

### T2 — Badge de versão nas 6 superfícies  ⟶ VER-01, VER-03, VER-08, VER-09

**Files**: `portal/Index.html`, `cash-flow/Index.html`, `comp-time/Index.html`,
`book-registration/Index.html`, `docs/scanner/index.html`, `docs/nota/index.html`
**Approach**:
- 4 apps GAS: `#version-badge` + CSS + `var APP_VERSION = '__APP_VERSION__'` + mirror `versionLabel_` (VER-01, VER-03).
- 2 páginas estáticas: mesmo badge/CSS + `fetch` de tags do GitHub + `versionLabel_` + degradação graciosa (VER-08, VER-09).
**Gate**: build gate (`node --check logic.js`) + `npm test` (regressão) + smoke manual.
**Commit**: `feat(versioning): version badge in all app surfaces`

### T3 — CI: job `version` (semver+tag) + injeção `sed`  ⟶ VER-04, VER-05, VER-06, VER-07

**Files**: `.github/workflows/deploy.yml`
**Approach**:
- Novo job `version`: `mathieudutour/github-tag-action` calcula semver (Conventional Commits) e cria a tag `vX.Y.Z`; expõe `outputs.version` (VER-04, VER-05).
- Cada deploy job GAS: `needs: version` + passo `sed` injetando a versão no `Index.html` antes do `clasp push` (VER-06).
- Sem nova versão → usa a última tag / não quebra o deploy (VER-07).
- **Verificar** a API exata da action nos docs antes de escrever (Knowledge Verification Chain).
**Gate**: revisão de estrutura YAML + smoke no próximo deploy real.
**Commit**: `feat(versioning): CI semver tag + version injection on deploy`

---

## Coverage

| Req | Task |
| --- | ---- |
| VER-01 | T1, T2 |
| VER-02 | T1 |
| VER-03 | T2 |
| VER-04 | T3 |
| VER-05 | T3 |
| VER-06 | T3 |
| VER-07 | T3 |
| VER-08 | T2 |
| VER-09 | T2 |

9/9 requisitos mapeados.
