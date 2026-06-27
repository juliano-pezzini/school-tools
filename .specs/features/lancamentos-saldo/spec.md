# Lançamentos & Saldo — Specification

**Feature:** M1 / Fluxo de Caixa da APP — Lançamentos & Saldo
**Status:** Spec (aguardando aprovação)
**Last Updated:** 2026-06-25

## Problem Statement

O caixa da APP (associação de pais e mestres) é controlado hoje de forma manual e propensa a erro (planilha/papel), sem saldo confiável em tempo real nem trilha de quem alterou o quê. Esta feature entrega o núcleo do Fluxo de Caixa: registrar entradas e saídas e ver o **saldo corrente automático**, com um mecanismo de **fechamento mensal** que protege períodos já conferidos.

## Goals

- [ ] Tesoureiro registra entrada/saída (data, valor, categoria, descrição) e vê o saldo atualizar automaticamente.
- [ ] Saldo corrente sempre correto = saldo de abertura + Σ entradas − Σ saídas.
- [ ] Períodos (meses) podem ser **fechados/conferidos** e ficam imutáveis até serem reabertos.
- [ ] Toda alteração de lançamento registra **quem** e **quando** fez a última alteração.

## Out of Scope

Explicitamente excluído desta feature (coberto por outras features do M1 ou fora do v1).

| Feature | Reason |
| ------- | ------ |
| Papéis/permissões (admin/tesoureiro/leitor) | Feature "Papéis" separada do M1; aqui assume-se um usuário autorizado a lançar. |
| Anexar comprovante (foto/scan) | Feature "Comprovantes" separada do M1. |
| Relatório mensal/anual, gráficos e leitura pública | Feature "Relatórios" separada do M1. |
| Captura por NFe/NFC-e (scanner) | Feature "Captura por NFe/NFC-e" separada do M1. |
| Múltiplos caixas/contas | Decisão: v1 tem **um único caixa**. |
| Conciliação bancária / extrato importado | Fora do v1. |

---

## Decisões de contexto

Detalhes e justificativas em [context.md](context.md). Resumo:

- **Um único caixa/saldo.**
- **Saldo de abertura** registrado **uma única vez** ao adotar a ferramenta.
- **Categoria = texto livre com autocomplete** das categorias já usadas (sugere anteriores, mas permite digitar nova).
- **Correção por edição/exclusão direta** do lançamento (não estorno append-only), rastreando **somente a última alteração** (usuário + data/hora).
- **Fechamento por mês inteiro**; período fechado fica **totalmente imutável** (sem novo lançamento, edição ou exclusão).
- **Reabertura** permitida, com registro de quem/quando reabriu.
- Fechar/reabrir: **admin ou tesoureiro**.
- **Data retroativa** permitida apenas em **meses abertos**; **data futura bloqueada**.

---

## User Stories

### P1: Registrar saldo de abertura ⭐ MVP

**User Story**: Como tesoureiro, quero registrar o saldo de abertura uma vez, para que o saldo corrente reflita o dinheiro que a APP já tem ao adotar a ferramenta.

**Why P1**: Sem o ponto de partida, o saldo corrente fica errado desde o primeiro dia.

**Acceptance Criteria**:

1. WHEN não existe saldo de abertura e o tesoureiro informa um valor e uma data de abertura THEN o sistema SHALL registrar o saldo de abertura e passar a usá-lo como base do saldo corrente.
2. WHEN o saldo de abertura já foi registrado THEN o sistema SHALL impedir um novo registro de abertura (a correção é feita editando o registro existente, se o período estiver aberto).
3. WHEN o valor de abertura informado é vazio ou não numérico THEN o sistema SHALL rejeitar com mensagem em pt-BR.

**Independent Test**: Em uma base nova, registrar abertura R$ 1.000,00 e ver o saldo corrente exibir R$ 1.000,00 sem nenhum lançamento.

---

### P1: Registrar lançamento (entrada/saída) ⭐ MVP

**User Story**: Como tesoureiro, quero registrar uma entrada ou saída com data, valor, categoria e descrição, para que o movimento do caixa fique documentado.

**Why P1**: É a ação central da ferramenta.

**Acceptance Criteria**:

1. WHEN o tesoureiro informa tipo (entrada/saída), data, valor (> 0), categoria e descrição THEN o sistema SHALL gravar o lançamento e atualizar o saldo corrente.
2. WHEN o lançamento é gravado THEN o sistema SHALL registrar automaticamente **quem criou** e **quando** (data/hora do servidor).
3. WHEN o valor é ≤ 0, vazio ou não numérico THEN o sistema SHALL rejeitar com mensagem em pt-BR e não gravar.
4. WHEN a data informada é futura THEN o sistema SHALL rejeitar (datas futuras não são permitidas).
5. WHEN dois lançamentos são gravados praticamente ao mesmo tempo THEN o sistema SHALL gravar ambos sem corromper a base nem perder linhas (gravação serializada/atômica).

**Independent Test**: Lançar uma entrada R$ 200,00 e uma saída R$ 50,00 e ver a lista com os dois e o saldo somando corretamente.

---

### P1: Ver saldo corrente ⭐ MVP

**User Story**: Como tesoureiro, quero ver o saldo corrente do caixa, para saber quanto a APP tem disponível a qualquer momento.

**Why P1**: É o principal valor entregue — confiança no número.

**Acceptance Criteria**:

1. WHEN há saldo de abertura e/ou lançamentos THEN o sistema SHALL exibir o saldo corrente = saldo de abertura + Σ entradas − Σ saídas, formatado em pt-BR (R$).
2. WHEN um lançamento é criado, editado ou excluído THEN o sistema SHALL recalcular e refletir o saldo corrente.
3. WHEN o saldo corrente resultante é negativo THEN o sistema SHALL exibir o valor negativo com alerta visível (não bloqueia, pois pode ser correção legítima em sequência).

**Independent Test**: Após abertura R$ 1.000 + entrada R$ 200 − saída R$ 50, o saldo exibido é R$ 1.150,00.

---

### P1: Listar lançamentos ⭐ MVP

**User Story**: Como tesoureiro, quero ver a lista dos lançamentos, para conferir o que já foi registrado.

**Why P1**: Sem ver o histórico, não há como conferir nem corrigir.

**Acceptance Criteria**:

1. WHEN existem lançamentos THEN o sistema SHALL listá-los com data, tipo, valor, categoria e descrição, em ordem por data (mais recente primeiro).
2. WHEN não existem lançamentos THEN o sistema SHALL exibir um estado vazio claro em pt-BR.

**Independent Test**: Lançar três movimentos e vê-los listados na ordem correta.

---

### P2: Editar e excluir lançamento (com rastro da última alteração)

**User Story**: Como tesoureiro, quero corrigir ou remover um lançamento errado, para manter o caixa fiel à realidade.

**Why P2**: Correção é importante, mas o MVP já entrega valor só com registro + saldo; pode vir logo em seguida.

**Acceptance Criteria**:

1. WHEN o tesoureiro edita um lançamento em um período **aberto** THEN o sistema SHALL salvar as mudanças, recalcular o saldo e gravar **quem** e **quando** fez a **última** alteração (sobrescrevendo o registro anterior de última alteração).
2. WHEN o tesoureiro exclui um lançamento em um período **aberto** THEN o sistema SHALL removê-lo e recalcular o saldo.
3. WHEN o lançamento pertence a um período **fechado** THEN o sistema SHALL impedir edição e exclusão (ver P2: Fechamento).
4. WHEN uma edição viola uma regra de criação (valor ≤ 0, data futura, mover para período fechado) THEN o sistema SHALL rejeitar com mensagem em pt-BR.

**Independent Test**: Editar o valor de um lançamento e confirmar que o saldo muda e que o usuário/data da última alteração aparece.

---

### P2: Categoria com autocomplete

**User Story**: Como tesoureiro, quero escolher uma categoria já usada ou digitar uma nova, para manter consistência sem ficar preso a uma lista fixa.

**Why P2**: Melhora consistência dos relatórios; o MVP funciona com texto livre puro.

**Acceptance Criteria**:

1. WHEN o tesoureiro começa a preencher a categoria THEN o sistema SHALL sugerir categorias já usadas que combinem com o texto.
2. WHEN o tesoureiro digita uma categoria nova THEN o sistema SHALL aceitá-la e passar a sugeri-la nos próximos lançamentos.

**Independent Test**: Após usar "Doação", começar a digitar "Do" em um novo lançamento e ver a sugestão.

---

### P2: Fechamento e conferência do caixa (mensal)

**User Story**: Como admin ou tesoureiro, quero fechar um mês após conferir o caixa, para que aquele período não possa mais ser alterado.

**Why P2**: Protege a prestação de contas; o MVP funciona com todos os meses abertos.

**Acceptance Criteria**:

1. WHEN o admin/tesoureiro fecha um mês THEN o sistema SHALL marcar aquele mês como **fechado** e registrar quem/quando fechou.
2. WHEN um mês está fechado THEN o sistema SHALL impedir **novos lançamentos** com data nesse mês, e impedir **edição/exclusão** de lançamentos desse mês.
3. WHEN se tenta lançar/editar/excluir em um mês fechado THEN o sistema SHALL rejeitar com mensagem clara em pt-BR indicando que o período está fechado.

**Independent Test**: Fechar Junho/2026, tentar lançar com data em junho e ver o bloqueio; lançar em julho funciona.

---

### P2: Reabrir período fechado

**User Story**: Como admin ou tesoureiro, quero reabrir um mês fechado, para corrigir um erro descoberto depois da conferência.

**Why P2**: Acompanha o fechamento.

**Acceptance Criteria**:

1. WHEN o admin/tesoureiro reabre um mês fechado THEN o sistema SHALL voltar o mês para **aberto** e registrar quem/quando reabriu.
2. WHEN o mês está reaberto THEN o sistema SHALL voltar a permitir lançamento/edição/exclusão naquele período.

**Independent Test**: Reabrir Junho/2026 e confirmar que lançar/editar volta a funcionar, com o registro de reabertura.

---

### P3: Filtrar lançamentos por período/tipo

**User Story**: Como tesoureiro, quero filtrar a lista por mês e por tipo (entrada/saída), para encontrar movimentos rapidamente.

**Why P3**: Conveniência; não bloqueia a operação central.

**Acceptance Criteria**:

1. WHEN o tesoureiro escolhe um mês e/ou tipo THEN o sistema SHALL exibir apenas os lançamentos correspondentes.

---

## Edge Cases

- WHEN o valor tem mais de 2 casas decimais ou usa vírgula/ponto THEN o sistema SHALL normalizar para moeda pt-BR (2 casas) ou rejeitar entradas inválidas com mensagem clara.
- WHEN a data é vazia ou inválida THEN o sistema SHALL rejeitar.
- WHEN a data é futura THEN o sistema SHALL rejeitar.
- WHEN o saldo de abertura ainda não foi definido e há lançamentos THEN o sistema SHALL tratar a abertura como 0 e sinalizar que a abertura não foi registrada.
- WHEN dois usuários gravam ao mesmo tempo THEN o sistema SHALL serializar a escrita (LockService) sem perder/duplicar linhas.
- WHEN um lançamento/edição/exclusão recai em mês fechado THEN o sistema SHALL bloquear (revalidar no servidor, não só na UI).
- WHEN o saldo corrente fica negativo THEN o sistema SHALL permitir mas alertar visualmente.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| LANC-01 | P1: Saldo de abertura | Design | In Design |
| LANC-02 | P1: Registrar lançamento | Design | In Design |
| LANC-03 | P1: Ver saldo corrente | Design | In Design |
| LANC-04 | P1: Listar lançamentos | Design | In Design |
| LANC-05 | P2: Editar/excluir com rastro da última alteração | Design | In Design |
| LANC-06 | P2: Categoria com autocomplete | Design | In Design |
| LANC-07 | P2: Fechamento mensal do caixa | Design | In Design |
| LANC-08 | P2: Reabrir período fechado | Design | In Design |
| LANC-09 | P3: Filtrar lançamentos | Design | In Design |

**ID format:** `LANC-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 9 total, 0 mapeados a tarefas, 9 não mapeados ⚠️ (mapeamento ocorre na fase Tasks)

---

## Success Criteria

- [ ] Um tesoureiro sem experiência técnica consegue registrar uma entrada e uma saída e entender o saldo, sem ajuda, em menos de 2 minutos.
- [ ] O saldo corrente exibido bate exatamente com saldo de abertura + Σ entradas − Σ saídas em todos os cenários testados.
- [ ] Nenhum lançamento é perdido ou duplicado sob gravações concorrentes.
- [ ] Um mês fechado não aceita nenhum lançamento, edição ou exclusão (validado no servidor).
- [ ] Toda edição mostra quem e quando fez a última alteração.
