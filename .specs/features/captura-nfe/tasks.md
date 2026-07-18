# Captura por NFe/NFC-e — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: [.specs/features/captura-nfe/design.md](design.md)
**Spec**: [.specs/features/captura-nfe/spec.md](spec.md)
**Status**: Ready for Execute (Vitest; commit per task; 4 phases → offer sub-agents)

> **Estrutura**: lógica decidível vai para `cash-flow/logic.js` (pura, testável em Node/Vitest); a página do scanner (`docs/scanner/index.html`) faz a orquestração client-side (câmera + extração + redirect); a UI do cash-flow (`cash-flow/Index.html`) recebe e pré-preenche.

---

## Test Coverage Matrix

> Generated from codebase sampling and spec ACs. Guidelines found: `cash-flow/README.md`, existing `*.test.js` patterns.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Lógica pura (`logic.js`: `parseChaveNFe_`, `chaveValida_`, `buildScanDescription_`) | unit (Vitest) | Todos os ramos; 1:1 com ACs SCAN-02/03/06/14/15/16; edge cases (CNPJ bruto, truncamento 280 chars, cDV inválido, <44 dígitos) | `cash-flow/scan-nfe.test.js` | `npm test` |
| Scanner page (`docs/scanner/index.html`: extração NFe/NFC-e, fallback, redirect) | none | — (browser APIs, cross-origin fetch; verificação manual no celular) | — | manual smoke |
| Cash-flow UI (`cash-flow/Index.html`: botão + receiver + pre-fill) | none | — (HtmlService; verificação manual no deploy) | — | manual smoke |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (Vitest, lógica pura) | **Yes** | Funções puras, sem I/O | `parseChaveNFe_`/`chaveValida_`/`buildScanDescription_` não tocam rede |
| none (scanner/UI) | n/a | — | — |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tarefa com testes unit (lógica pura) | `npm test` (de `cash-flow/`) |
| Build | Após tarefas de scanner/UI | `npm test` (regressão) + **smoke manual** no celular |

---

## Execution Plan

### Phase 1: Pure logic (Vitest)

```
T1
```

### Phase 2: Scanner page rewrite (sequential — single file)

```
T2 → T3
```

### Phase 3: Cash-flow UI integration

```
T4
```

### Phase 4: Smoke & docs

```
T5
```

> **4 fases → offer sub-agents** (trigger is > 3 phases). Each worker executes its phase sequentially. Verifier runs after T5.

---

## Task Breakdown

### T1: Pure logic — parseChaveNFe_, chaveValida_, buildScanDescription_ + testes

**What**: Em `logic.js`, adicionar: (1) `parseChaveNFe_(chave)` — decodifica os 44 dígitos em `{ cUF, uf, ano, mes, cnpj, modelo, serie, numero, cDV }`; (2) `chaveValida_(chave)` — retorna `true` se 44 dígitos e cDV mod-11 confere; (3) `buildScanDescription_(data)` — monta string `FORNECEDOR (Cidade/UF) — item1, item2, ...` truncada a 280 chars; todas exportadas no dual-env. Testes 1:1 com ACs.
**Where**: `cash-flow/logic.js`, `cash-flow/scan-nfe.test.js`
**Depends on**: None
**Reuses**: `dvChave`/`parseChave`/`chaveValida` de `docs/nota/index.html` (portados); `DESCRICAO_MAX` existente
**Requirement**: SCAN-02, SCAN-03, SCAN-06, SCAN-14, SCAN-15, SCAN-16

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] `parseChaveNFe_` decodifica chave real (ex.: `35250747968...`) em campos corretos
- [ ] `chaveValida_` retorna `true` para chave com cDV correto, `false` para cDV errado
- [ ] `chaveValida_` retorna `false` para input < ou > 44 dígitos
- [ ] `buildScanDescription_({fornecedor:'ANTARES',cidade:'Itu',uf:'SP',itens:'3x Arroz, 2x Feijão'})` → `'ANTARES (Itu/SP) — 3x Arroz, 2x Feijão'`
- [ ] `buildScanDescription_` trunca a 280 chars com `…` quando excede
- [ ] `buildScanDescription_` omite `(Cidade/UF)` quando ausentes; omite `— itens` quando vazio
- [ ] Constantes UF (mapa cUF→sigla) exportadas
- [ ] `npm test` passa; contagem registrada

**Tests**: unit — **Gate**: quick
**Commit**: `feat(cash-flow): NFe key parsing + cDV validation + scan description builder + tests`

---

### T2: Scanner page — rewrite com extração NFe (proxy)

**What**: Reescrever `docs/scanner/index.html` para suportar o modo `?mode=nfe`: (1) manter o scan de câmera existente (BarcodeDetector + ZXing fallback, double-read); (2) após leitura, extrair chave de 44 dígitos, validar cDV (porta `chaveValida_` inline ou duplica a lógica simples); (3) se NFe (modelo 55): chamar proxy `?chave=...` via fetch, parsear XML (emitente, data, valor, itens); (4) montar `scanData` JSON e redirecionar para `returnUrl?scanData=base64url(json)`; (5) fallback se proxy falha: decode key + BrasilAPI para nome do fornecedor → redirect com `parcial:true`.
**Where**: `docs/scanner/index.html`
**Depends on**: T1 (conceitos de parsing/cDV — implementação inline na page)
**Reuses**: Câmera/scan do `docs/scanner/index.html` atual; extração NFe de `docs/nota/index.html` (`consultarNFe`/`renderNFe`/`decodeBase64Utf8`); proxy URL `backend/nfe-proxy.gs`
**Requirement**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-07, SCAN-14, SCAN-15, SCAN-16

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] `?mode=nfe&return=<url>` ativa o fluxo de nota (não o fluxo genérico de ISBN)
- [ ] Scan de Code-128 de 44 dígitos com cDV válido → aceita; cDV inválido → rejeita com aviso "Código inválido"
- [ ] Código com ≠44 dígitos é ignorado silenciosamente
- [ ] NFe detectada (modelo 55) → chama proxy, parseia XML, extrai fornecedor/data/valor/itens
- [ ] Redirect com `?scanData=<base64url>` contendo JSON completo (`parcial:false`)
- [ ] Proxy falha → fallback BrasilAPI → redirect com JSON parcial (`parcial:true`, sem valor/itens)
- [ ] BrasilAPI falha → usa CNPJ bruto como fornecedor
- [ ] `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `feat(scanner): NFe extraction flow (proxy + fallback + redirect)`

---

### T3: Scanner page — extração NFC-e (client-side SEFAZ)

**What**: Estender o scanner (mesmo arquivo) para NFC-e (modelo 65): (1) QR lido contém URL SEFAZ-SC → extrair chave, validar cDV; (2) fetch client-side do link SEFAZ no browser real → parsear HTML para itens+valor+fornecedor; (3) montar JSON e redirect; (4) fallback se fetch falha (Cloudflare/timeout): decode key + BrasilAPI + link SEFAZ no JSON.
**Where**: `docs/scanner/index.html`
**Depends on**: T2
**Reuses**: `extrairChave` / parsing de `docs/nota/index.html`; BrasilAPI fetch de T2
**Requirement**: SCAN-09, SCAN-10, SCAN-11, SCAN-12, SCAN-13

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] QR com URL SEFAZ-SC e chave de 44 dígitos cDV válido → aceita
- [ ] Fetch client-side da página SEFAZ-SC → parseia HTML (itens/valor/fornecedor)
- [ ] Redirect com JSON completo (como NFe)
- [ ] Fetch falha (Cloudflare/timeout) → fallback decode+BrasilAPI → redirect parcial + campo `link` com URL SEFAZ
- [ ] QR de outra UF → fallback (não tenta parsear HTML de SEFAZ desconhecida)
- [ ] `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `feat(scanner): NFC-e client-side SEFAZ extraction + fallback`

---

### T4: Cash-flow UI — botão "Escanear nota" + receiver + pre-fill

**What**: Em `cash-flow/Index.html`: (1) botão "Escanear nota" (📷) ao lado do form de lançamento; (2) ao clicar, abre a URL do scanner com `?mode=nfe&return=<url_do_exec>`; (3) no `doGet` do `Code.gs`, detectar `?scanData=...` e passar ao HTML (ou o client JS lê do `location.search`); (4) decodificar base64url JSON → chamar `prefillFromScan(data)` → preencher tipo=`saida`, valor, data (formato date input), descrição (`buildScanDescription_` inline mirror ou reconstruída do JSON); (5) se `parcial:true` → banner "Dados parciais" + link SEFAZ se disponível; (6) sem `scanData` (cancelou) → nada muda.
**Where**: `cash-flow/Index.html`, possivelmente `cash-flow/Code.gs` (minor: pass scanData to template)
**Depends on**: T2, T3
**Reuses**: Form de lançamento existente, padrões de UI (cards, buttons, `google.script.run`)
**Requirement**: SCAN-01, SCAN-05, SCAN-06, SCAN-08, SCAN-11, SCAN-13

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] Botão "Escanear nota" visível ao lado do form de lançamento (admin/tesoureiro)
- [ ] Clicar abre o scanner em nova aba/mesma aba com return URL correta
- [ ] Retorno com `scanData` completo → form pre-filled (tipo=saida, valor, data, descrição com fornecedor+itens)
- [ ] Retorno com `scanData` parcial → campos disponíveis preenchidos + banner "Dados parciais — complete manualmente" + link SEFAZ se disponível
- [ ] Retorno sem `scanData` (cancelou) → form inalterado
- [ ] Descrição ≤ 280 chars (truncada se necessário)
- [ ] `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `feat(cash-flow): scan invoice button + scanData receiver + form pre-fill`

---

### T5: Smoke checklist + documentação de deploy

**What**: Adicionar ao cabeçalho de smoke de `Index.html` os passos de teste da captura NFe/NFC-e (passos 20–24). Confirmar que tudo funciona end-to-end no celular com uma nota real. Atualizar `docs/scanner/README.md` com a nova funcionalidade.
**Where**: `cash-flow/Index.html` (comentário de smoke), `docs/scanner/README.md`
**Depends on**: T4
**Reuses**: Padrão de smoke existente
**Requirement**: Cobertura de SCAN-01..16 via smoke manual

**Tools**: MCP NONE; Skill: tlc-spec-driven

**Done when**:
- [ ] Smoke checklist inclui: escanear NFe real → form preenchido; escanear NFC-e real → form preenchido; nota antiga → fallback parcial; código inválido → rejeitado; cancelar → form inalterado
- [ ] README do scanner atualizado com o modo `?mode=nfe`
- [ ] `npm test` (regressão) passa

**Tests**: none — **Gate**: build
**Commit**: `docs(cash-flow): NFe/NFC-e scan smoke checklist + scanner README update`

---

## Pre-Approval Validation

### Check 1 — Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Pure logic + testes | 3 funções puras + testes (uma camada) | ✅ Granular |
| T2: Scanner NFe extraction | 1 arquivo, um fluxo (NFe) | ✅ Granular |
| T3: Scanner NFC-e extraction | Mesmo arquivo, segundo fluxo (NFC-e) | ✅ Granular |
| T4: Cash-flow UI integration | 1 botão + receiver em 1 arquivo | ✅ Granular |
| T5: Smoke + docs | Comentários + README | ✅ Granular |

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | `Depends on` | Antecessor no diagrama | OK |
| ---- | ------------ | ---------------------- | -- |
| T1 | None | — (raiz) | ✅ |
| T2 | T1 | T1 → T2 (Phase 1→2) | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T2, T3 | T3 → T4 (Phase 2→3) | ✅ |
| T5 | T4 | T4 → T5 (Phase 3→4) | ✅ |

### Check 3 — Test Co-location Validation

| Task | Camada | Matrix Requires | Task Says | Status |
| ---- | ------ | --------------- | --------- | ------ |
| T1 | Lógica pura (`logic.js`) | unit | unit | ✅ |
| T2 | Scanner page | none | none | ✅ |
| T3 | Scanner page | none | none | ✅ |
| T4 | Cash-flow UI | none | none | ✅ |
| T5 | Docs | none | none | ✅ |

---

## Decisões registradas

- **Vitest** (mesmo harness de todas as outras features; `npm test` → `vitest run`).
- **4 fases → offer sub-agents** (trigger > 3). Verifier automático após T5.
- Scanner page reescrita (merge da nota test page logic); `docs/nota/` se torna legacy/referência.
- cDV logic duplicada inline na scanner page (não importa `logic.js` — a page é standalone no Pages). A fonte de verdade testável fica em `logic.js`.
