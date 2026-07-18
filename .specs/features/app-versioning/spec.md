# Versionamento visível nos apps Specification

## Problem Statement

Quando um usuário reporta um problema ("não está calculando o saldo", "o botão sumiu"),
não há como saber **qual versão do app** ele está usando — os apps são web apps do Apps
Script atualizados por deploy contínuo, sem número de versão exposto. Isso torna o
troubleshooting às cegas: não dá para correlacionar o relato com o commit/deploy real.
Esta feature expõe, em cada superfície, uma **versão semver visível e discreta**,
calculada automaticamente a partir do histórico de commits (Conventional Commits) e
**gravada como tag no commit publicado**.

## Goals

- [ ] Cada app (portal, cash-flow, comp-time, book-registration) exibe um **badge de versão discreto** (canto fixo) com a versão semver do deploy corrente.
- [ ] As duas páginas estáticas (docs/scanner, docs/nota) também exibem a versão corrente.
- [ ] A versão é **semver calculada pela pipeline** a partir do histórico (tag anterior + Conventional Commits) e **cria a tag no commit publicado** — sem bump manual.
- [ ] A versão é **injetada no deploy** (mesmo padrão dos URLs do portal) para os apps do Apps Script; superfície local/não publicada mostra `dev`.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Página/tela "sobre" com changelog completo | O badge discreto atende o troubleshooting; changelog é evolução futura. |
| Exibir SHA do commit / data de build no badge | Usuário escolheu **semver**; semver já mapeia 1:1 para a tag/commit publicado. Mantém o badge limpo. |
| Versionar por-app (versões independentes por ferramenta) | Repositório monorepo com deploy conjunto; uma versão semver única do repositório é mais simples e suficiente para troubleshooting. |
| Publicar GitHub **Release** (notas/artefatos) | Só a **tag** é necessária para versionar; Release formal é evolução futura. |
| Escrever a versão em qualquer aba de planilha / storage | O badge de UI é o único requisito; nenhuma persistência de dados é necessária. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Formato da versão | **semver** (`vMAJOR.MINOR.PATCH`) | Usuário escolheu semver. | y |
| Origem da versão | Pipeline calcula pela **tag anterior + Conventional Commits** e cria a tag no commit publicado | Usuário confirmou; já existem GitHub Actions que fazem isso (ex.: `mathieudutour/github-tag-action`). | y |
| Onde aparece | **Badge fixo discreto no canto** de cada superfície | Usuário escolheu "Fixed tiny corner badge". | y |
| Escopo de superfícies | portal, cash-flow, comp-time, book-registration, docs/scanner, docs/nota | Usuário selecionou todas. | y |
| Como a versão é produzida (apps GAS) | **Injeção no deploy** (sed no CI, como os URLs do portal) | Usuário escolheu "Auto-injected at deploy (CI sed)". | y |
| Como a versão aparece nas **páginas estáticas** (docs/*) | **Fetch em runtime** da última tag via API pública do GitHub (`/repos/{owner}/{repo}/tags`), com **degradação graciosa** (badge oculto em falha) | As páginas em `docs/` são servidas **direto do repositório** pelo GitHub Pages (não passam pelo deploy `clasp`), então não há etapa de `sed` no deploy delas. Buscar a última tag em runtime é o caminho mais simples e sempre reflete o release corrente. **Exceção consciente e escopada** ao padrão "sed no deploy" (que vale para os 4 apps GAS). | y (default; confirmar) |
| Superfície local / não injetada | Badge mostra `dev` | O placeholder não substituído é detectado e vira `dev` — nunca mostra lixo ao usuário. | y |
| Versão única do repositório (monorepo) vs por-app | **Uma** versão semver do repositório em todos os apps | Deploy conjunto; simplicidade; suficiente para correlacionar relato ↔ deploy. | y |
| Primeira versão (sem tags hoje) | A action calcula a partir do zero (ex.: `1.0.0`/`0.1.0` conforme os commits) na primeira execução | Não há tags no repo hoje; a action define a base. | y (implícito) |
| Badge não deve vazar layout / cobrir conteúdo | Posição fixa, `z-index` alto, texto pequeno e mudo, `pointer-events:none` (não intercepta cliques) | Discreto e não intrusivo por design. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Badge de versão nos apps ⭐ MVP

**User Story**: Como pessoa que dá suporte, quero ver a versão do app na própria tela,
para correlacionar o relato do usuário com o commit/deploy exato e depurar com precisão.

**Why P1**: É o motivo da feature — sem a versão visível, o troubleshooting é às cegas.

**Acceptance Criteria**:

1. WHEN um app do Apps Script (portal/cash-flow/comp-time/book-registration) é aberto após um deploy THEN o sistema SHALL exibir um **badge fixo discreto no canto** com a versão semver no formato `vMAJOR.MINOR.PATCH` (ex.: `v1.2.0`).
2. WHEN o valor da versão **não** foi injetado (execução local / preview não publicado) THEN o badge SHALL exibir `dev` — **nunca** o texto do placeholder cru nem string vazia.
3. WHEN o badge é renderizado THEN ele SHALL ser **não intrusivo**: posição fixa no canto, texto pequeno/mudo, e **não** SHALL interceptar cliques nem sobrepor controles interativos (`pointer-events:none`).

**Independent Test**: Rodar a função pura `versionLabel_` com um valor injetado (`'1.2.0'` → `'v1.2.0'`) e com o placeholder/vazio (`'__APP_VERSION__'`/`''` → `'dev'`); abrir um app deployado e ver o badge no canto.

---

### P1: Versão semver automática pela pipeline ⭐ MVP

**User Story**: Como mantenedor, quero que a pipeline calcule a próxima versão semver a
partir dos commits e crie a tag no commit publicado, para que a versão exibida seja sempre
rastreável ao código real, sem bump manual.

**Why P1**: A automação garante que o badge nunca fique defasado nem dependa de disciplina manual.

**Acceptance Criteria**:

1. WHEN o deploy roda no `main` THEN a pipeline SHALL calcular a próxima versão semver a partir da **última tag** e dos **Conventional Commits** desde então (feat → minor, fix → patch, etc.).
2. WHEN a versão é calculada THEN a pipeline SHALL **criar a tag** correspondente (`vX.Y.Z`) no commit publicado.
3. WHEN os apps do Apps Script são deployados THEN a pipeline SHALL **injetar** a versão calculada no arquivo servido (mesmo padrão de `sed` dos URLs do portal) **antes** do `clasp push`.
4. WHEN não há mudança que gere nova versão (ex.: só commits `docs`/`chore` sem impacto) THEN a pipeline SHALL **não quebrar** o deploy (usa a versão vigente / não cria tag redundante).

**Independent Test**: Disparar o workflow e conferir que uma tag `vX.Y.Z` foi criada, que os apps deployados mostram `vX.Y.Z`, e que o job de versão expõe o valor calculado aos jobs de deploy.

---

### P2: Versão nas páginas estáticas (docs/scanner, docs/nota)

**User Story**: Como pessoa que dá suporte, quero ver a versão também nas páginas estáticas
do scanner e da nota, para depurar problemas de captura de código/QR com o mesmo contexto.

**Why P2**: As páginas estáticas são satélites (AD-008); úteis mas secundárias ao fluxo principal.

**Acceptance Criteria**:

1. WHEN a página estática (docs/scanner ou docs/nota) carrega THEN ela SHALL exibir o mesmo **badge fixo discreto** com a última versão (tag) do repositório.
2. WHEN a origem da versão (API do GitHub) **falha** ou está indisponível THEN o badge SHALL **degradar graciosamente** (permanecer oculto ou mostrar `dev`), **sem** erro visível nem quebra da página/scanner.

**Independent Test**: Abrir a página estática com rede → ver o badge com a versão; simular falha de rede/endpoint → confirmar que a página funciona normalmente e o badge não aparece quebrado.

---

## Edge Cases

- WHEN a versão injetada contém apenas dígitos/pontos (`1.2.0`) THEN `versionLabel_` SHALL prefixar `v` → `v1.2.0`.
- WHEN o placeholder não foi substituído (valor começa com `_`) ou é vazio/nulo THEN `versionLabel_` SHALL retornar `dev`.
- WHEN a API do GitHub retorna vazio/erro nas páginas estáticas THEN o badge SHALL ficar oculto (sem exceção não tratada).
- WHEN o badge sobrepõe um controle THEN `pointer-events:none` SHALL garantir que o clique atravesse para o controle abaixo.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ------ | ------ |
| VER-01 | P1: Badge nos apps | Design | Pending |
| VER-02 | P1: Fallback `dev` (placeholder/vazio) | Design | Pending |
| VER-03 | P1: Badge não intrusivo (fixed, pointer-events:none) | Design | Pending |
| VER-04 | P1: Semver calculada por Conventional Commits | Design | Pending |
| VER-05 | P1: Cria a tag `vX.Y.Z` no commit publicado | Design | Pending |
| VER-06 | P1: Injeção via sed antes do clasp push | Design | Pending |
| VER-07 | P1: Deploy não quebra sem nova versão | Design | Pending |
| VER-08 | P2: Badge nas páginas estáticas (última tag) | Design | Pending |
| VER-09 | P2: Degradação graciosa nas páginas estáticas | Design | Pending |

**ID format:** `VER-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 total, 0 mapped to tasks yet.

---

## Success Criteria

How we know the feature is successful:

- [ ] Ao reportar um problema, o usuário consegue ler `vX.Y.Z` no canto de qualquer superfície.
- [ ] A versão exibida corresponde à tag do commit deployado (rastreável 1:1).
- [ ] Nenhum bump manual de versão é necessário; a pipeline calcula e tageia sozinha.
- [ ] O badge nunca cobre/bloqueia controles nem mostra placeholder cru.
