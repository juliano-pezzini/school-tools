# Lançamentos & Saldo — Context (decisões do usuário)

Decisões capturadas na fase Specify (discuss) em 2026-06-25. Resolvem as áreas ambíguas antes do design/implementação.

> **Atualização 2026-06-26 (oficialização da spec v2 — AD-010):** uma segunda leitura "olhos novos" reabriu e endureceu decisões. A **D-4 foi superada** pela D-7/D-8 (soft-delete + trilha de auditoria append-only) e foi adicionada a D-9 (idempotência). Veja abaixo. A spec oficial é a [spec.md](spec.md) (v2).

## D-1: Caixa único

**Decisão:** v1 controla **um único caixa/saldo** (não múltiplas contas).
**Implicação:** Saldo corrente é um valor único; sem dimensão "conta".

## D-2: Saldo de abertura registrado uma vez

**Decisão:** Existe um **saldo de abertura** registrado **uma única vez** na adoção da ferramenta; depois só lançamentos.
**Implicação:** Saldo corrente = abertura + Σ entradas − Σ saídas. Registrar abertura é uma ação especial, não duplicável (corrige-se editando o registro existente, se o período estiver aberto).

## D-3: Categoria = texto livre com sugestão das anteriores

**Decisão:** Categoria é **texto livre**, mas com **autocomplete** das categorias já usadas (sugere anteriores; aceita nova).
**Implicação:** Não há tabela fixa de categorias; as sugestões derivam dos lançamentos existentes. Consistência é incentivada, não imposta.

## D-4: Correção por edição/exclusão direta (não append-only) — ⚠️ SUPERADA pela D-7/D-8 (2026-06-26)

**Decisão (v1):** Corrigir um lançamento errado era **editar ou excluir fisicamente** o próprio lançamento, rastreando **somente a última alteração** (usuário + data/hora).
**Trade-off / atenção:** Divergia da lição "auditoria append-only" do STATE.
**Status:** **Superada na oficialização da spec v2 (AD-010).** A segunda leitura concluiu que perder o histórico e apagar linhas fisicamente é fraco para a prestação de contas. Mantida a UX simples (o tesoureiro só vê "editar"/"excluir"), mas a mecânica passou a soft-delete (D-7) + trilha de auditoria append-only (D-8).

## D-7: Exclusão lógica (soft-delete) — nova (2026-06-26)

**Decisão:** Excluir um lançamento o marca como `excluido` (não apaga a linha), gravando quem/quando excluiu. Ele some das listas e do saldo, mas permanece auditável.
**Implicação:** Listagem e saldo ignoram lançamentos `excluido`. A linha original e seus dados ficam preservados na base.

## D-8: Trilha de auditoria append-only — nova (2026-06-26)

**Decisão:** Além de `AlteradoPor/AlteradoEm` na própria linha (última alteração), toda edição/exclusão anexa um registro **append-only** em uma aba `Auditoria` (ação, id do lançamento, autor, timestamp, resumo antes→depois).
**Implicação:** O histórico de correções deixa de se perder; a auditoria forte vive tanto na barreira de fechamento (D-6) quanto nesta trilha.

## D-9: Idempotência de gravação — nova (2026-06-26)

**Decisão:** `addLancamento` recebe um `clientToken` (UUID por formulário); um segundo envio com o mesmo token (duplo-clique/reenvio/conexão lenta) é tratado como sucesso idempotente, sem criar duplicata.
**Implicação:** Protege o número final contra lançamentos duplicados silenciosos próprios do `google.script.run`.

## D-5: Datas — retroativa só em período aberto; futura bloqueada

**Decisão:** Lançamento pode ter **data retroativa** apenas se o mês estiver **aberto**. **Datas futuras são bloqueadas.**
**Implicação:** Validação de data no servidor cruza com o estado de fechamento do mês (D-6).

## D-6: Fechamento e conferência do caixa

**Decisão:**
- **Granularidade:** por **mês inteiro** (ex.: fechar "Junho/2026").
- **Efeito:** período fechado fica **totalmente imutável** — nenhum lançamento novo, edição ou exclusão.
- **Reabertura:** permitida, com **registro de quem/quando** reabriu.
- **Quem fecha/reabre:** **admin ou tesoureiro** (papéis na feature "Papéis").
**Implicação:** Precisa de um registro de estado por mês (aberto/fechado) + auditoria de fechar/reabrir. Toda escrita revalida o estado do mês no **servidor** (a UI é só cosmética).

## Pendências para o Design

- Modelo de dados no Sheets: aba de lançamentos (append-only de linhas físicas, mesmo permitindo edição lógica), registro de abertura, registro de meses fechados.
- Estratégia de concorrência (LockService) e de recálculo de saldo (recalcular vs. saldo materializado).
- Onde validar fechamento/data (server-side guard) reaproveitando o padrão `requireRole_` do spike `m0-roles`.
