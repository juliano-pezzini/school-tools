# Comprovantes — Specification

**Feature:** M1 / Fluxo de Caixa da APP — Comprovantes (anexo de comprovante por lançamento)
**Status:** Spec — aguardando aprovação
**Last Updated:** 2026-07-16
**Depende de:** feature **Lançamentos & Saldo** (concluída) — reusa a aba `Lancamentos`, o seam de auth (`requireRole_`), o `LockService` e a aba `Auditoria` append-only. Respeita os marcos: AD-001 (custo/simplicidade), AD-002 (idioma), AD-004 (SSO), AD-005 (Drive como storage), AD-007 (stack Apps Script), B-005 (câmera no HtmlService) e B-006 (leitura pública para os pais).

## Problem Statement

Hoje o Fluxo de Caixa registra o movimento (data, valor, categoria, descrição), mas não guarda a **prova** da despesa/entrada. Para a prestação de contas da APP, cada lançamento — sobretudo saídas — precisa poder ser acompanhado do **comprovante** (cupom, nota, recibo) em foto ou PDF, acessível depois sem depender de papel guardado em gaveta. Esta feature permite anexar **um comprovante por lançamento**, guardá-lo no Google Drive e visualizá-lo depois.

## Goals

- [ ] Tesoureiro anexa **um** comprovante (foto do celular, imagem da galeria ou PDF) a um lançamento — no momento do registro ou depois, enquanto o mês estiver aberto.
- [ ] O comprovante fica guardado no Google Drive (AD-005) e referenciado na linha do lançamento, visível por um link de visualização.
- [ ] Toda ação de comprovante (anexar, substituir, remover) deixa **trilha de auditoria** append-only, consistente com o resto do caixa.
- [ ] O comprovante é **opcional** — nunca bloqueia o registro do lançamento (MVP).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Captura por NFe/NFC-e (scanner de QR/código de barras) | Feature "Captura por NFe/NFC-e" separada. Aqui o usuário anexa uma imagem/PDF manualmente, sem leitura de código nem extração de dados da nota. |
| Múltiplos comprovantes por lançamento | Decisão de escopo (ver Assumptions): **exatamente um** por lançamento no MVP. |
| OCR / extração de valor/itens do comprovante | Não há leitura do conteúdo; o comprovante é só um anexo visual. |
| Renderização do comprovante **dentro** do relatório público | A feature "Relatórios" consome a referência/link; aqui só **gravamos** o arquivo com permissão pública e o link. |
| Comprovante para saldo de abertura / fechamento de mês | Anexo é por **lançamento** (entrada/saída), não por evento de abertura ou fechamento. |
| Verificação de vírus/malware do arquivo enviado | Capacidade de plataforma — N/A nesta feature; mitigado por whitelist de tipo + limite de tamanho. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui. As seis primeiras linhas foram **decididas pelo usuário** na fase de discussão (2026-07-16); as demais são defaults derivados aplicados pelo agente.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| **Meios de captura e tipos de arquivo** | Foto pela câmera nativa (`<input type="file" accept="image/*,application/pdf" capture="environment">`), imagem da galeria **ou** PDF. | B-005: `getUserMedia` ao vivo é bloqueado no iframe do HtmlService, mas a câmera nativa via `<input capture>` funciona. Cupom fiscal é papel → foto; nota pode vir em PDF. | **y** (usuário) |
| **Quantidade por lançamento** | **Exatamente um** comprovante por lançamento; anexar um novo quando já existe = **substituir** (o anterior vai para a lixeira do Drive). | Mantém a UX simples e o schema enxuto (uma referência por linha). | **y** (usuário) |
| **Quando anexar/substituir** | No **registro** e **depois**, mas **só enquanto o mês do lançamento estiver aberto**. Mês fechado → anexo/substituição/remoção bloqueados (revalidado no servidor). | Coerente com a imutabilidade de mês fechado da feature Lançamentos (LANC-07). | **y** (usuário) |
| **Visibilidade / privacidade** | O arquivo é gravado com permissão **"qualquer pessoa com o link pode ver"** (link público), para poder aparecer nos relatórios públicos dos pais (B-006). ⚠️ **Trade-off:** comprovantes ficam acessíveis por link sem login — o tesoureiro deve evitar anexar documentos com dados pessoais sensíveis. | Escolha explícita do usuário: pais (sem conta do domínio) devem conseguir ver o comprovante na prestação de contas. Diverge de "evitar link público" (AD-005) de forma consciente. | **y** (usuário) |
| **Ciclo de vida ao excluir o lançamento** | Ao dar **soft-delete** no lançamento, o arquivo do comprovante é **movido para a lixeira** do Drive (`setTrashed(true)`), não apagado em definitivo (janela de recuperação de ~30 dias). A referência na linha é limpa. | Escolha do usuário: remover o arquivo quando o lançamento sai da vista, mas com recuperação possível (a linha do lançamento permanece por soft-delete). | **y** (usuário) |
| **Obrigatoriedade** | Comprovante **opcional** para todos os lançamentos (inclusive saídas) no MVP. | Não bloquear o registro; anexar é um reforço da prestação de contas, não um gargalo. | **y** (usuário) |
| **Tipos aceitos (whitelist server-side)** | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `application/pdf`. Qualquer outro tipo é rejeitado com mensagem pt-BR. | Cobre fotos de celular (Android/iOS) e PDFs; barra executáveis/tipos inesperados na fronteira. | y (default) |
| **Tamanho máximo** | 10 MB por arquivo. Acima disso, rejeita com mensagem pt-BR antes de gravar. | Foto de celular cabe folgado; evita estourar o payload do `google.script.run` (base64 infla ~33%) e o Drive. | y (default) |
| **Onde é guardado + nomeação** | Uma pasta dedicada no Drive (ex.: "Comprovantes - Caixa APP"), cujo id fica em `PropertiesService` (`COMPROVANTES_FOLDER_ID`), criada sob demanda. Arquivo nomeado `<lancamentoId>_<timestamp>.<ext>`. | Reusa o padrão de storage do spike `m0-reports` (Drive + link público); nome rastreável ao lançamento. | y (default) |
| **Referência na linha do lançamento** | Duas novas colunas na aba `Lancamentos`: `ComprovanteId` (fileId do Drive) e `ComprovanteUrl` (link de visualização). Vazias quando não há comprovante. | O `getCashState`/listagem já leem a linha; acrescentar colunas é aditivo e não quebra a leitura existente (índices novos ao final). | y (default) |
| **Falha de upload** | Se o upload ao Drive falhar, o **lançamento não é bloqueado nem perdido** (anexo é opcional): o sistema informa que o comprovante não foi salvo e permite tentar de novo. | Anexo opcional não pode derrubar a ação central (registrar o lançamento). | y (default) |
| **Idempotência / concorrência do anexo** | A gravação/substituição do comprovante ocorre sob `LockService`, atualizando a coluna de referência de forma atômica; um reenvio (duplo-clique) **substitui** em vez de criar arquivo órfão/duplicado (o `ComprovanteId` anterior é trocado e o antigo vai para a lixeira). | Mesmo risco de duplo-clique da feature Lançamentos; evita arquivos órfãos no Drive. | y (default) |
| **Quem pode o quê** | admin/tesoureiro: anexar/substituir/remover; admin/tesoureiro/leitor: **ver**; público (sem login): ver pelo link, quando exposto no relatório. Escrita revalida papel no servidor (`requireRole_`). | Coerente com o seam mínimo da feature Lançamentos e com B-006. | y (default) |

**Open questions:** nenhuma — todas resolvidas na discussão ou registradas como default acima.

---

## User Stories

### P1: Anexar comprovante ao registrar um lançamento ⭐ MVP

**User Story**: Como tesoureiro, quero anexar uma foto ou PDF do comprovante ao registrar um lançamento, para que a prova da despesa/entrada fique guardada junto do movimento.

**Why P1**: É o valor central da feature — sem o anexo no registro, o comprovante vira um passo esquecido.

**Acceptance Criteria**:

1. WHEN o tesoureiro seleciona um arquivo válido (tipo na whitelist, ≤ 10 MB) ao registrar um lançamento em mês aberto THEN o sistema SHALL guardar o arquivo no Drive, gravar `ComprovanteId`/`ComprovanteUrl` na linha do lançamento e concluir o registro.
2. WHEN o lançamento é registrado **sem** selecionar arquivo THEN o sistema SHALL gravar o lançamento normalmente com as colunas de comprovante vazias (anexo é opcional).
3. WHEN o arquivo selecionado tem tipo fora da whitelist OU tamanho > 10 MB THEN o sistema SHALL rejeitar o anexo com mensagem em pt-BR e não gravar o arquivo (o lançamento não é criado com anexo inválido).
4. WHEN o upload ao Drive falha por erro externo THEN o sistema SHALL **manter o lançamento** (sem comprovante) e informar em pt-BR que o comprovante não foi salvo, permitindo tentar anexar depois.
5. WHEN o comprovante é gravado THEN o sistema SHALL anexar um registro append-only na aba `Auditoria` (`anexar`, id do lançamento, autor, carimbo, resumo com nome/id do arquivo).

**Independent Test**: Registrar uma saída R$ 50,00 escolhendo uma foto JPEG; a linha passa a ter `ComprovanteId`/`ComprovanteUrl` e o arquivo abre pelo link; registrar outra saída sem foto grava sem comprovante.

---

### P1: Ver o comprovante de um lançamento ⭐ MVP

**User Story**: Como tesoureiro ou leitor, quero abrir o comprovante de um lançamento, para conferir a prova sem procurar papel.

**Why P1**: Guardar sem conseguir ver não presta contas.

**Acceptance Criteria**:

1. WHEN um lançamento tem comprovante THEN o sistema SHALL exibir na listagem um indicador/link que abre o arquivo (`ComprovanteUrl`) para visualização.
2. WHEN um lançamento não tem comprovante THEN o sistema SHALL indicar visivelmente a ausência (sem link).
3. WHEN o arquivo foi gravado com permissão de link público THEN o sistema SHALL permitir a visualização pelo link mesmo sem login (suporte ao relatório público dos pais, B-006).

**Independent Test**: Na lista, um lançamento com comprovante mostra o link e ele abre a imagem/PDF; um sem comprovante mostra "sem comprovante".

---

### P2: Adicionar ou substituir o comprovante depois

**User Story**: Como tesoureiro, quero anexar ou trocar o comprovante de um lançamento já existente, para corrigir uma foto ruim ou anexar algo que faltou.

**Why P2**: Correção é comum, mas não bloqueia o MVP de registrar+ver.

**Acceptance Criteria**:

1. WHEN o lançamento está em mês **aberto** e o tesoureiro anexa um comprovante a um lançamento **sem** comprovante THEN o sistema SHALL guardar o arquivo e gravar as referências.
2. WHEN o lançamento **já tem** comprovante e o tesoureiro anexa um novo (mês aberto) THEN o sistema SHALL **substituir**: guardar o novo, atualizar as referências e mover o arquivo anterior para a lixeira do Drive.
3. WHEN o lançamento está em mês **fechado** THEN o sistema SHALL bloquear anexar/substituir com mensagem em pt-BR e não alterar nada.
4. WHEN uma substituição ocorre THEN o sistema SHALL anexar registro `substituir` na aba `Auditoria` (referenciando o arquivo antigo e o novo).

**Independent Test**: Anexar foto A a um lançamento, depois trocar por foto B em mês aberto; a linha aponta para B, A está na lixeira e a auditoria registra a troca; repetir em mês fechado é bloqueado.

---

### P2: Remover o comprovante

**User Story**: Como tesoureiro, quero remover um comprovante anexado por engano, para manter a prestação de contas correta.

**Why P2**: Menos frequente que anexar/ver; ainda importante para correção.

**Acceptance Criteria**:

1. WHEN o lançamento está em mês **aberto** e tem comprovante THEN o sistema SHALL permitir remover: mover o arquivo para a lixeira do Drive e limpar `ComprovanteId`/`ComprovanteUrl` na linha.
2. WHEN o lançamento está em mês **fechado** THEN o sistema SHALL bloquear a remoção com mensagem em pt-BR.
3. WHEN uma remoção ocorre THEN o sistema SHALL anexar registro `remover_comprovante` na aba `Auditoria`.

**Independent Test**: Remover o comprovante de um lançamento em mês aberto; a linha fica sem referência, o arquivo vai para a lixeira e a auditoria registra; remover em mês fechado é bloqueado.

---

## Edge Cases

- WHEN o arquivo tem tipo não permitido (ex.: `.exe`, `.zip`) THEN o sistema SHALL rejeitar na fronteira (whitelist server-side), independentemente da extensão exibida.
- WHEN o arquivo excede 10 MB THEN o sistema SHALL rejeitar antes de subir ao Drive, com mensagem pt-BR indicando o limite.
- WHEN o mesmo anexo é enviado duas vezes (duplo-clique) THEN o sistema SHALL, sob `LockService`, gravar/atualizar **uma** referência e não deixar arquivo órfão/duplicado (substituição idempotente).
- WHEN o lançamento é **soft-deleted** enquanto tem comprovante THEN o sistema SHALL mover o arquivo para a lixeira e limpar a referência (o registro do lançamento permanece por soft-delete).
- WHEN a pasta do Drive de comprovantes ainda não existe THEN o sistema SHALL criá-la sob demanda e guardar seu id em `PropertiesService`.
- WHEN o Drive está indisponível/erro de cota no upload THEN o sistema SHALL falhar graciosamente sem perder o lançamento e informar o usuário.
- WHEN um lançamento antigo (linha sem as novas colunas) é lido THEN o sistema SHALL tratar as colunas ausentes como "sem comprovante" (compatibilidade retroativa).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| COMP-01 | P1: Anexar ao registrar | Design | Verified |
| COMP-02 | P1: Ver comprovante | Design | Verified |
| COMP-03 | P2: Adicionar/substituir depois | Design | Verified |
| COMP-04 | P2: Remover comprovante | Design | Verified |
| COMP-05 | P1: Validação de tipo/tamanho + falha de upload | Design | Verified |
| COMP-06 | P1: Storage no Drive (pasta, link público, referência na linha) | Design | Verified |
| COMP-07 | P2: Ciclo de vida — soft-delete do lançamento manda o arquivo à lixeira | Design | Verified |
| COMP-08 | P2: Auditoria append-only (anexar/substituir/remover) | Design | Verified |
| COMP-09 | Edge: idempotência/concorrência do anexo (lock, sem órfão/dup) | Design | Verified |

**ID format:** `COMP-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 total, 9 verificados ✅ (deploy smoke manual pendente)

---

## Success Criteria

- [ ] Tesoureiro anexa foto/PDF a um lançamento em ≤ 2 toques (escolher arquivo → salvar), com feedback claro de sucesso/erro.
- [ ] Comprovante abre pelo link tanto para o tesoureiro (logado) quanto por link público (suporte ao relatório dos pais).
- [ ] Zero arquivos órfãos/duplicados no Drive após reenvios/duplo-clique.
- [ ] Toda ação de comprovante aparece na aba `Auditoria`.
- [ ] Nenhum lançamento é perdido por falha de anexo (anexo é sempre opcional e isolado).
