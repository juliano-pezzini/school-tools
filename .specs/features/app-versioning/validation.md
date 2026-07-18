# Versionamento visível nos apps — Validation (Verifier)

**Verdict:** ✅ **PASS**
**Date:** 2026-07-18
**Diff range:** 3 commits (`versionLabel_` + tests → badge nas 6 superfícies → CI semver/injeção)
**Author ≠ Verifier:** cobertura re-derivada de forma independente (evidence-or-zero).

---

## Per-AC Evidence

| AC | Requisito | Evidência | Resultado |
| -- | --------- | --------- | --------- |
| P1-1 | VER-01 — badge `vX.Y.Z` nos apps GAS | `versionLabel_('1.2.0')==='v1.2.0'` (`version.test.js`); `#version-badge` + `versionLabel_(APP_VERSION)` nos 4 `Index.html` | ✅ |
| P1-2 | VER-02 — fallback `dev` | `versionLabel_('__APP_VERSION__'/''/null/'   ')==='dev'` (`version.test.js`) | ✅ (unit) |
| P1-3 | VER-03 — badge não intrusivo | CSS `position:fixed; pointer-events:none; -webkit-user-select/user-select:none` presente nas 6 superfícies | ✅ (glue) |
| P1-4 | VER-04 — semver por Conventional Commits | job `version` usa `mathieudutour/github-tag-action@v6.2` (API confirmada em docs: `new_version`/`previous_version`) | ✅ (glue) |
| P1-5 | VER-05 — cria tag `vX.Y.Z` no commit publicado | action cria tag (lightweight) no `GITHUB_SHA`; `permissions: contents: write` | ✅ (glue) |
| P1-6 | VER-06 — injeção `sed` antes do `clasp push` | passo "Inject app version" em cada deploy GAS; dry-run: `__APP_VERSION__ → 1.4.0` OK; placeholder único (1x) em cada app | ✅ (glue + dry-run) |
| P1-7 | VER-07 — deploy não quebra sem nova versão | `default_bump: false` + `outputs.version = new_version || previous_version`; `sed` guardado por `[ -n "$VERSION" ]` | ✅ (glue) |
| P2-1 | VER-08 — badge nas páginas estáticas | `fetch(.../tags?per_page=1)` + `versionLabel_(name)` em `docs/scanner` e `docs/nota` | ✅ (glue) |
| P2-2 | VER-09 — degradação graciosa | `r.ok ? r.json() : []` + `.catch(function(){})`; badge vazio em falha | ✅ (glue) |

---

## Discrimination Sensor

| Mutant | Comportamento injetado | Resultado |
| ------ | ---------------------- | --------- |
| M1 | fallback `dev` → `v0` (linha placeholder/vazio) | ❌ **morto** — 3 testes falharam (`__APP_VERSION__`, `''`, `'   '`) |
| M2 | remove prefixo `v` (`return s`) | ❌ **morto** — 3 testes falharam (`1.2.0`, `2.0`, `10.20.30`, `  1.4.2  `) |

Baseline restaurado após cada mutação → **10/10** testes passam. Sensor **PASS**: os testes discriminam regressões reais de `versionLabel_`.

---

## Spec-Anchored Outcome Check

Cada teste afirma o **valor definido no spec** (não espelha a implementação):
`v1.2.0`, `v10.20.30`, `dev` são outcomes literais dos ACs VER-01/VER-02. Sem lacuna de precisão.

## Gate

- `npm test` (de `cash-flow/`): **198/198 passam** (13 arquivos), incluindo `version.test.js` (10).
- Workflow YAML: parseia OK; jobs = `detect-changes, version, test-cash-flow, deploy-*`.
- Placeholder GAS: 1 ocorrência por app; `sed` dry-run confirma substituição.

## Notas / Pendências (glue verificada só no deploy real)

- **Smoke manual pendente**: abrir cada app após o próximo deploy e confirmar o badge `vX.Y.Z` no canto; abrir as páginas estáticas e confirmar o badge (com rede) e o comportamento gracioso (sem rede).
- **Exceção consciente**: as páginas estáticas usam **fetch runtime** da tag (não `sed` no deploy) porque são servidas direto do repo pelo GitHub Pages (sem etapa `clasp`). Registrado no spec (Assumptions) e em AD-012.
- `docs/nota` mantém o marcador manual legado `VERSAO` (nota de dev do proxy); o badge padronizado coexiste. Pode ser removido futuramente se redundante.
