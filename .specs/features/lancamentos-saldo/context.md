# Lançamentos & Saldo — Context (decisões do usuário)

Decisões capturadas na fase Specify (discuss) em 2026-06-25. Resolvem as áreas ambíguas antes do design/implementação.

## D-1: Caixa único

**Decisão:** v1 controla **um único caixa/saldo** (não múltiplas contas).
**Implicação:** Saldo corrente é um valor único; sem dimensão "conta".

## D-2: Saldo de abertura registrado uma vez

**Decisão:** Existe um **saldo de abertura** registrado **uma única vez** na adoção da ferramenta; depois só lançamentos.
**Implicação:** Saldo corrente = abertura + Σ entradas − Σ saídas. Registrar abertura é uma ação especial, não duplicável (corrige-se editando o registro existente, se o período estiver aberto).

## D-3: Categoria = texto livre com sugestão das anteriores

**Decisão:** Categoria é **texto livre**, mas com **autocomplete** das categorias já usadas (sugere anteriores; aceita nova).
**Implicação:** Não há tabela fixa de categorias; as sugestões derivam dos lançamentos existentes. Consistência é incentivada, não imposta.

## D-4: Correção por edição/exclusão direta (não append-only)

**Decisão:** Corrigir um lançamento errado é **editar ou excluir** o próprio lançamento. Rastrear **somente a última alteração**: atributos de **usuário** e **data/hora** da última modificação.
**Trade-off / atenção:** Diverge da lição "auditoria append-only" registrada no STATE.md (que sugeria estorno em vez de edição/exclusão). O usuário optou conscientemente por edição/exclusão direta pela simplicidade para o tesoureiro.
**Mitigação da auditoria:** (a) campos de última alteração (quem/quando); (b) o **fechamento mensal** (D-6) cria a fronteira de imutabilidade — uma vez conferido e fechado, o período não muda mais. A trilha de auditoria forte vive na barreira de fechamento, não no histórico de cada linha.

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
