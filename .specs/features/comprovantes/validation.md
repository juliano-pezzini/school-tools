# Comprovantes — Validation Report

**Feature:** M1 / Fluxo de Caixa — Comprovantes
**Spec:** [.specs/features/comprovantes/spec.md](spec.md) · **Design:** [design.md](design.md) · **Tasks:** [tasks.md](tasks.md)
**Verdict:** ✅ PASS (implementação completa; deploy smoke pendente — não executável pelo agente)
**Verifier note:** verificação independente do autor, base evidência-ou-zero. Lógica pura coberta por Vitest; cola Apps Script e UI verificadas por `node --check` + revisão + checklist de smoke manual.

---

## Test evidence

- **Suite:** `npm test` (Vitest) → **123 passed / 123** (10 arquivos). Novos: `comprovante.test.js` (16 testes).
- **Syntax gate cola:** `node --check` sobre cópia `.js` de `Code.gs` → OK a cada task (T2–T4).
- **Discrimination sensor (mutação):** troquei `size > maxBytes` por `size > maxBytes * 1000` em `validateComprovante_` → **2 testes falharam** exatamente nos casos de teto (10 MB e maxBytes custom 1 MB), confirmando que os testes detectam regressão real. Mutação **revertida**; suite volta a 123/123 e `git diff` limpo.

---

## Spec-anchored coverage

| Req | Descrição | Evidência (implementação) | Verificação |
| --- | --------- | ------------------------- | ----------- |
| COMP-01 | Anexar ao registrar | UI cria lançamento → `setComprovante(id,file)` no handler de sucesso ([Index.html](../../../cash-flow/Index.html) `submitLancamento`/`attachComprovante_`); endpoint `setComprovante` ([Code.gs](../../../cash-flow/Code.gs)) | AC1/AC2/AC5: smoke passo 11 + auditoria `anexar`; AC3/AC4 abaixo |
| COMP-02 | Ver comprovante | `serializeRows_` expõe `ComprovanteUrl`+`TemComprovante`; coluna "Comprovante" com link "ver" / "—" (`renderRowHtml`) | AC1/AC2 smoke 11; AC3 link público (`ANYONE_WITH_LINK, VIEW`) smoke 11 |
| COMP-03 | Adicionar/substituir depois | `setComprovante` faz upload, `trashComprovante_(antigo)` se havia, regrava cols 15-16; UI botões "anexar"/"trocar" | AC1/AC2/AC4 smoke 12 + auditoria `substituir`; AC3 (mês fechado) via `assertPeriodOpen_` smoke 14 |
| COMP-04 | Remover comprovante | `removeComprovante` trash + limpa cols 15-16; UI botão "remover" + `onRemoveComprovante` | AC1/AC3 smoke 12; AC2 (mês fechado) `assertPeriodOpen_` smoke 14 |
| COMP-05 | Validação tipo/tamanho + falha de upload | `validateComprovante_` (logic.js, whitelist+teto+MIME fallback); espelho client `validateComprovanteClient_`; anexo separado de `addLancamento` (AC4) | **`comprovante.test.js`**: aceita 6 tipos, rejeita gif/exe/zip, teto 10 MB (boundary + custom), size 0, nome vazio, MIME vazio→extensão. AC4: lançamento salvo antes do upload (design) + msg `warn` na UI |
| COMP-06 | Storage no Drive | `getComprovanteFolder_` (pasta pin em `COMPROVANTES_FOLDER_ID`), `uploadComprovante_` (base64→blob→createFile→setSharing), nome `comprovanteFileName_` | `comprovanteFileName_`/`extForMime_` testados; upload/sharing smoke 11 |
| COMP-07 | Soft-delete → lixeira | `deleteLancamento` trash + limpa cols 15-16 dentro do lock | smoke 13 + auditoria `excluir \| comprovante removido` |
| COMP-08 | Auditoria append-only | `appendAudit_('anexar'/'substituir'/'remover_comprovante'/'excluir', ...)` | smoke 11/12/13 (aba Auditoria) |
| COMP-09 | Idempotência/concorrência | tudo sob `withLock_`; substituição troca referência e descarta antiga; UI desabilita botão durante o envio | smoke (duplo-clique), revisão de código |

**Cobertura:** 9/9 requisitos com evidência. Parte decidível (COMP-05/06) coberta por testes automatizados; cola/UI (COMP-01..04,07,08,09) por gate de build + checklist de smoke manual (deploy exigido).

---

## Edge cases (spec) → tratamento

| Edge | Evidência |
| ---- | --------- |
| Tipo `.exe`/`.zip` rejeitado na fronteira | teste "rejeita executável/zip" + whitelist server em `uploadComprovante_` |
| > 10 MB rejeitado antes do upload | teste de teto + mensagem pt-BR com MB derivado |
| Duplo-clique não deixa órfão | `withLock_` + substituição (revisão); UI `inp.click()` único por ação |
| Soft-delete manda à lixeira | COMP-07 acima |
| Pasta inexistente criada sob demanda | `getComprovanteFolder_` (`getFoldersByName`/`createFolder` + persiste id) |
| Drive indisponível não perde lançamento | anexo separado; UI mostra aviso `warn` |
| Linha antiga sem colunas novas | `readLancamentoRows_` trata `r[14]`/`r[15]` ausentes como `''` |

---

## Residual risk / follow-ups

- **Deploy smoke manual** (passos 11–14 no cabeçalho de [Index.html](../../../cash-flow/Index.html)) ainda **não executado** — requer `clasp push` + Web App. É o único gate remanescente para COMP-01..04/06/07/08 no ambiente real.
- **Retrocompat de schema:** planilhas de dados **já existentes** não ganham os cabeçalhos 15/16 automaticamente (`buildSheets_` só roda na criação) — documentado no PRÉ do checklist (adicionar `ComprovanteId`/`ComprovanteUrl` à mão).
- **Privacidade (AD-011):** comprovantes ficam por link público — aviso discreto exibido na UI; trade-off consciente do usuário (B-006).
