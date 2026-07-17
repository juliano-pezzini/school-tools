# Relatórios (Fluxo de Caixa) Specification

## Problem Statement

O tesoureiro precisa prestar contas da APP com números confiáveis, e os pais/membros
(sem conta `@ensinablumenau`) precisam **consultar** essa prestação de contas. Hoje o
app de Fluxo de Caixa registra lançamentos e saldo, mas não gera relatórios mensais/anuais
nem um artefato público de transparência. O spike `spikes/m0-reports/` já provou a
capacidade técnica (agregação em Sheets, gráficos sob a CSP do HtmlService, PDF com link
público no Drive, pt-BR) — esta feature **produtiza** isso dentro do app real `cash-flow/`.

## Goals

- [ ] Relatório **mensal** na tela: totais (entradas/saídas/saldo do mês/saldo acumulado) + lista de lançamentos com link do comprovante.
- [ ] Relatório **anual** na tela: KPIs, quebra por categoria, gráficos (barras/linha/rosca) e insights automáticos.
- [ ] **Exportar PDF** com **link público** no Drive (ANYONE_WITH_LINK) para transparência aos pais (B-006), mantendo **um PDF por período** (o mais recente).
- [ ] Agregação **consistente** (Σ dos meses == anual; acumulado == saldo ao fim do período), ignorando lançamentos excluídos (soft-delete), em **pt-BR**.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Relatório por **intervalo de datas customizado** (trimestral, semanal, faixa livre) | Usuário escolheu mensal + anual no MVP; intervalo livre agrega complexidade sem demanda imediata. |
| Papel **`leitor`** consultando relatórios na tela (dentro do app SSO) | MVP restringe geração/visualização na tela a `admin`/`tesoureiro`; a leitura pública dos pais é atendida pelo **PDF de link público**, não pela tela. Adiável. |
| **Página web de leitura pública** (HTML anônimo separado do app) | Usuário escolheu o **PDF público no Drive** como canal de transparência; página anônima fica adiada. |
| Histórico/versionamento de PDFs por período | Usuário escolheu manter **apenas o mais recente** por período (substitui ao regerar). |
| Exportação em outros formatos (CSV/XLSX) | Fora do pedido; o PDF cobre a prestação de contas. |
| Envio automático por e-mail dos relatórios | Não solicitado. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Períodos do MVP | Mensal + anual | Usuário confirmou; espelha o spike `m0-reports`. | y |
| Canal de transparência (B-006) | PDF no Drive com `ANYONE_WITH_LINK`+`VIEW` | Usuário confirmou; reusa precedente do spike e AD-011. | y |
| Quem gera relatórios/PDF | `admin` + `tesoureiro` (guard `requireRole_`) | Usuário confirmou; escrita/geração é privilegiada, leitura pública é o PDF. | y |
| Mês aberto vs. fechado | Aberto → marcar **"provisório"**; fechado → **"oficial"** | Usuário confirmou; o fechamento mensal já é a fronteira de imutabilidade (AD-009/010). | y |
| Conteúdo do **mensal** | Totais + lista de lançamentos **com** links de comprovante | Usuário confirmou; o mensal é a prestação de contas detalhada. | y |
| Conteúdo do **anual** | KPIs + quebra por categoria + gráficos + insights | Usuário confirmou; o anual é a visão de tendência/consolidada. | y |
| Ciclo de vida do PDF | **Um PDF por período**; regerar **substitui** (manda o anterior à lixeira) | Usuário confirmou ("replace latest per period"). | y |
| Período sem lançamentos | Renderiza relatório **vazio** (zeros + "sem lançamentos") | Usuário confirmou; nunca erro. | y |
| Auditoria da geração pública | Anexa linha na aba `Auditoria` (quem/quando/período/link) | Usuário confirmou; rastreabilidade da publicação. | y |
| Links de comprovante no mensal | Incluídos (públicos, AD-011) + **aviso discreto de privacidade** | Usuário confirmou; consciente da exposição do link público. | y |
| Substituir o PDF **invalida o link anterior** | O arquivo antigo vai à lixeira → o link já compartilhado deixa de abrir | Consequência de "um por período"; aceito como trade-off de simplicidade. | y (implícito) |
| Gráficos na tela via Chart.js (CDN) — **degradação graciosa** | Se a CSP bloquear o Chart.js, a tela mostra aviso; **tabelas e PDF não dependem** de JS (PDF usa SVG server-side) | Validado no spike (2026-06-22): conversor de PDF não executa JS → SVG no servidor. | y |
| Concorrência na geração do PDF | Serializada via `withLock_` (evita arquivos duplicados no mesmo período) | Reusa o padrão de lock já existente no `cash-flow`. | y |
| Semântica de agregação | Ignora `Excluido=true`; parte do `SALDO_ABERTURA_VALOR`; "acumulado" = saldo até o fim do período | Reusa `computeMonthState_`/`computeCashState_` já existentes. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Relatório mensal na tela ⭐ MVP

**User Story**: Como tesoureiro, quero ver o relatório de um mês (totais + lista de
lançamentos com comprovantes), para conferir e prestar contas do período.

**Why P1**: É a prestação de contas detalhada — o núcleo do valor mensal.

**Acceptance Criteria**:

1. WHEN um usuário `admin`/`tesoureiro` seleciona mês/ano THEN o sistema SHALL exibir os totais do mês em **R$ pt-BR**: **entradas do mês**, **saídas do mês**, **saldo do mês** (entradas − saídas) e **saldo acumulado** até o fim do mês, ignorando lançamentos com `Excluido=true` e partindo do saldo de abertura.
2. WHEN o relatório mensal é exibido THEN o sistema SHALL listar todos os lançamentos **não excluídos** do mês (data `dd/mm/aaaa`, tipo, categoria, descrição, valor em R$), com um link **"ver comprovante"** para quem tem `ComprovanteUrl` e **"—"** para quem não tem.
3. WHEN o mês selecionado **não** está fechado THEN o sistema SHALL marcar o relatório como **"provisório"**; WHEN está fechado THEN SHALL marcá-lo como **"oficial (fechado)"**.
4. WHEN o mês selecionado não possui lançamentos THEN o sistema SHALL renderizar um relatório **vazio** (totais zerados + aviso "sem lançamentos"), **sem** erro.

**Independent Test**: Abrir o app como admin, escolher um mês com dados → ver totais corretos e a lista com "ver comprovante"; escolher um mês vazio → ver o relatório zerado; comparar aberto vs. fechado → ver o selo provisório/oficial.

---

### P1: Relatório anual na tela ⭐ MVP

**User Story**: Como tesoureiro, quero um relatório anual com KPIs, quebra por categoria,
gráficos e insights, para enxergar a saúde financeira do ano.

**Why P1**: É a visão consolidada/tendência que dá confiança na prestação de contas anual.

**Acceptance Criteria**:

1. WHEN um usuário `admin`/`tesoureiro` seleciona um ano THEN o sistema SHALL exibir os **KPIs anuais** em R$ pt-BR: total de entradas, total de saídas, resultado do ano (superávit/déficit) e saldo acumulado ao fim do ano.
2. WHEN o relatório anual é exibido THEN o sistema SHALL mostrar a **quebra por categoria** (total por categoria, normalizada).
3. WHEN o relatório anual é exibido THEN o sistema SHALL renderizar **gráficos** na tela: entradas × saídas por mês (barras), saldo acumulado (linha) e despesas por categoria (rosca).
4. WHEN o relatório anual é exibido THEN o sistema SHALL computar **insights** automáticos (ex.: melhor mês, meses no vermelho, maior despesa, maior receita, média mensal, superávit/déficit).
5. WHEN os relatórios são calculados THEN a agregação SHALL ser **consistente**: a soma dos 12 meses SHALL igualar os totais anuais e o saldo acumulado ao fim do período SHALL igualar o saldo corrente correspondente (mesma fonte, ignorando excluídos).

**Independent Test**: Escolher um ano com ~12 meses de dados → conferir que Σ mensal == anual, que os 3 gráficos aparecem e que os insights batem com os dados.

---

### P1: Exportar PDF público (transparência B-006) ⭐ MVP

**User Story**: Como tesoureiro, quero gerar um PDF do relatório com link público no
Drive, para que os pais (sem conta do domínio) consultem a prestação de contas sem login.

**Why P1**: É o canal de transparência exigido por B-006 — o motivo de a feature existir para os pais.

**Acceptance Criteria**:

1. WHEN um usuário `admin`/`tesoureiro` gera o PDF de um período (mensal ou anual) THEN o sistema SHALL produzir o PDF e gravá-lo no Drive com **`ANYONE_WITH_LINK` + `VIEW`**, retornando um link que **abre sem login**.
2. WHEN já existe um PDF para **o mesmo período** THEN o sistema SHALL **substituí-lo** (novo conteúdo), mandando o anterior à lixeira, de modo que só o **mais recente por período** permaneça.
3. WHEN o PDF público é gerado THEN o sistema SHALL anexar uma linha na aba **`Auditoria`** (quem, quando, período, link).
4. WHEN o **PDF mensal** é gerado THEN ele SHALL incluir a lista de lançamentos com **links públicos de comprovante** e um **aviso discreto de privacidade**; os gráficos do PDF SHALL ser **SVG gerado no servidor** (não dependem de JS).
5. WHEN um chamador **não** privilegiado ou anônimo invoca a função de relatório/geração de PDF THEN o sistema SHALL **recusar** (guard `requireRole_`), independentemente da UI.
6. WHEN a geração do PDF falha THEN o sistema SHALL surfacar um **erro claro** e **não** SHALL deixar um arquivo público **parcial/órfão**.

**Independent Test**: Gerar o PDF de um mês → abrir o link em aba anônima (sem login) e ver o relatório; regerar o mesmo período → confirmar que o link antigo deixou de abrir e o novo abre; conferir a linha na `Auditoria`; chamar a função direto sem papel → "Acesso negado".

---

## Edge Cases

- WHEN o seletor de período recebe mês/ano inválido ou fora de faixa THEN o sistema SHALL rejeitar/normalizar e não quebrar (relatório vazio ou mensagem pt-BR).
- WHEN um mês futuro (sem dados) é selecionado THEN o sistema SHALL renderizar o relatório vazio.
- WHEN o Chart.js (CDN) é bloqueado pela CSP THEN a tela SHALL exibir um aviso e as **tabelas** SHALL continuar visíveis; o **PDF** (SVG server-side) SHALL permanecer correto.
- WHEN duas gerações do PDF do mesmo período ocorrem quase simultaneamente THEN o `withLock_` SHALL serializá-las, evitando arquivos duplicados.
- WHEN um lançamento excluído (soft-delete) existe no período THEN ele SHALL ser **ignorado** em todos os totais, listas, gráficos e insights.
- WHEN o saldo de abertura é indefinido THEN o acumulado SHALL tratá-lo como 0 (consistente com `aberturaConfig_`).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| REL-01 | P1: Relatório mensal (totais) | Design | Pending |
| REL-02 | P1: Relatório mensal (lista + comprovantes) | Design | Pending |
| REL-03 | P1: Relatório mensal (provisório/oficial) | Design | Pending |
| REL-04 | P1: Relatório mensal (vazio) | Design | Pending |
| REL-05 | P1: Relatório anual (KPIs) | Design | Pending |
| REL-06 | P1: Relatório anual (por categoria) | Design | Pending |
| REL-07 | P1: Relatório anual (gráficos) | Design | Pending |
| REL-08 | P1: Relatório anual (insights) | Design | Pending |
| REL-09 | P1: Consistência de agregação | Design | Pending |
| REL-10 | P1: PDF público no Drive | Design | Pending |
| REL-11 | P1: Um PDF por período (substitui) | Design | Pending |
| REL-12 | P1: Auditoria da geração pública | Design | Pending |
| REL-13 | P1: PDF mensal (comprovantes + aviso + SVG) | Design | Pending |
| REL-14 | P1: Guard de autorização (server-side) | Design | Pending |
| REL-15 | P1: Falha de geração sem órfão | Design | Pending |

**ID format:** `REL-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 0 mapped to tasks, 15 unmapped ⚠️ (resolved in Tasks phase)

---

## Success Criteria

- [ ] Um relatório mensal mostra totais corretos e a lista com links de comprovante; o selo provisório/oficial reflete o fechamento.
- [ ] Um relatório anual mostra KPIs, quebra por categoria, os 3 gráficos e insights; Σ mensal == anual.
- [ ] O PDF público abre **sem login**; regerar o período substitui o anterior; a geração fica registrada na `Auditoria`.
- [ ] Chamar as funções de relatório sem papel `admin`/`tesoureiro` é barrado server-side.
- [ ] Tudo em pt-BR (R$ 1.234,56, dd/mm/aaaa, timezone America/Sao_Paulo), ignorando lançamentos excluídos.
