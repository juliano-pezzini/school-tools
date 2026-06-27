# Lançamentos & Saldo — Specification

**Feature:** M1 / Fluxo de Caixa da APP — Lançamentos & Saldo
**Status:** Spec **oficial** (v2) — aprovada 2026-06-26
**Last Updated:** 2026-06-26
**Histórico:** Esta é a especificação oficial da feature. Resulta de uma segunda leitura "olhos novos" que **substituiu** o primeiro rascunho (v1), reabrindo e endurecendo decisões. Respeita os marcos de projeto já fechados (AD-001 custo/simplicidade, AD-002 idioma, AD-004 SSO, AD-007 stack, AD-010 que oficializa esta v2, e as lições do STATE). As três decisões reabertas (soft-delete, trilha de auditoria, idempotência) foram **confirmadas** na oficialização.

## Problem Statement

O caixa da APP (Associação de Pais e Mestres) é controlado de forma manual e propensa a erro (planilha/papel), sem saldo confiável em tempo real e sem trilha de quem alterou o quê. A APP presta contas a pais e à escola, então o número precisa ser **confiável** e **defensável**. Esta feature entrega o núcleo do Fluxo de Caixa: registrar entradas e saídas, ver o **saldo corrente automático**, e **fechar meses já conferidos** para protegê-los — com auditoria suficiente para a prestação de contas.

## Goals

- [ ] Tesoureiro registra entrada/saída (data, valor, categoria, descrição) e vê o saldo atualizar automaticamente, sem risco de gravação duplicada por clique repetido ou conexão lenta.
- [ ] Saldo corrente sempre correto e reproduzível = saldo de abertura + Σ entradas − Σ saídas, em todos os cenários (criação, correção, remoção, concorrência).
- [ ] Meses podem ser **fechados/conferidos** e ficam imutáveis até serem reabertos, com transições de estado bem definidas.
- [ ] Toda alteração e remoção deixa **trilha de auditoria** suficiente para a prestação de contas (quem, quando, o quê) — sem depender da memória do tesoureiro.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Papéis/permissões (admin/tesoureiro/leitor) | Feature "Papéis" separada; aqui só o seam mínimo `requireRole_(['admin','tesoureiro'])`. |
| Anexar comprovante (foto/scan) | Feature "Comprovantes" separada. |
| Relatórios, gráficos e leitura pública (B-006) | Feature "Relatórios"; esta feature só **define e grava** o schema que Relatórios consome. |
| Captura por NFe/NFC-e (scanner) | Feature "Captura por NFe/NFC-e" separada. |
| Múltiplos caixas/contas, conciliação bancária, extrato importado | Decisão de escopo: v1/v2 têm **um único caixa**. |
| Backup/restore e snapshot da base | Trilha de integridade de dados do M0 (todo "integridade de dados em Sheets") — N/A nesta feature porque é capacidade de plataforma, não de produto. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui — nada fica silenciosamente indefinido. Os três primeiros itens são os pontos que esta segunda leitura **reabriu** e que foram **confirmados** na oficialização (AD-010).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| **Remoção de lançamento: lógica (soft-delete) + trilha, em vez de exclusão física** | Marcar como `excluido` (não apaga a linha), gravando quem/quando excluiu; some das listas e do saldo, mas permanece auditável. | **Reabre a D-4 da v1.** A v1 optou por exclusão física, divergindo da lição "auditoria append-only" do STATE. Soft-delete preserva a prestação de contas **e** mantém a UX simples (o tesoureiro só vê "excluir"). Custo baixo na stack Sheets. | **y** |
| **Edição de lançamento: registrar trilha além da "última alteração"** | Manter `AlteradoPor/AlteradoEm` (última alteração na própria linha) **e** anexar um registro append-only em uma aba `Auditoria` (ação, id, autor, timestamp, antes→depois resumido). | Segunda leitura: rastrear "só a última alteração" (D-4) perde o histórico de correções, fraco para prestação de contas. Uma aba `Auditoria` append-only honra a lição do STATE sem complicar a UI. | **y** |
| **Idempotência de gravação (anti-duplo-clique / reenvio)** | `addLancamento` recebe um `clientToken` (UUID gerado no cliente por formulário); o servidor ignora um segundo envio com o mesmo token dentro da sessão. | `google.script.run` + conexão lenta + duplo-clique geram lançamentos duplicados silenciosos — risco real e invisível no número final. Não estava na v1. | **y** |
| **Saldo de abertura: zero permitido, negativo bloqueado** | Aceitar abertura `>= 0` (inclui R$ 0,00); rejeitar negativo. | A APP pode adotar a ferramenta começando do zero; um saldo de abertura negativo quase certamente é erro de digitação. A v1 não fixou o sinal da abertura. | y |
| **Ordenação com empate de data** | Mesma `Data` → desempata por `CriadoEm` decrescente (mais recente primeiro). | A v1 ordena "mais recente primeiro" por data, sem definir empate — saída não determinística. | y |
| **Transições de estado de período (fechar/reabrir)** | Só é possível **fechar** mês `aberto` e **reabrir** mês `fechado`; ações repetidas (fechar fechado / reabrir aberto) são no-op idempotente com aviso, não erro. Não há ordem obrigatória entre meses (pode fechar Junho com Maio aberto). | A v1 descreve fechar/reabrir mas não define as transições inválidas nem a idempotência. | y |
| **Fechar mês corrente / mês sem lançamentos** | Permitido fechar qualquer mês `<=` mês corrente, mesmo sem lançamentos (fecha um período vazio conferido). Fechar mês **futuro** é bloqueado (consistente com "data futura bloqueada"). | Conferência pode terminar antes do fim do mês; período vazio conferido é válido. | y |
| **Categoria: normalização para o autocomplete** | Sugerir categorias já usadas comparando sem diferenciar maiúsculas/acentos/espaços nas pontas; gravar o texto como o usuário digitou (trim). | Evita "Doação" vs "doação" vs "Doaçao " virarem categorias distintas nos relatórios, sem impor lista fixa (mantém D-3). | y |
| **Limites de campo** | Valor `> 0`, máx. 2 casas decimais, teto técnico de R$ 1.000.000,00 por lançamento (acima disso, exige confirmação na UI, não bloqueia). Descrição ≤ 280 chars; categoria ≤ 60 chars. | Pega fat-finger sem engessar; limites de texto evitam linhas degeneradas no Sheets. | y |
| **Quem pode listar/ver saldo** | admin, tesoureiro e leitor podem **ler** (listar + saldo); só admin/tesoureiro **escrevem** (lançar/editar/excluir/fechar/reabrir). | Coerente com o seam mínimo e com Relatórios futuros; leitor não muda dados. | y |
| **Fuso e "hoje"** | "Data futura" e o carimbo de data/hora usam o relógio do servidor no fuso `America/Sao_Paulo`. | Evita divergência de fuso do navegador do usuário; reusa helper dos spikes. | y |

**Open questions:** nenhuma — todas resolvidas e confirmadas na oficialização (AD-010).

---

## User Stories

### P1: Registrar saldo de abertura ⭐ MVP

**User Story**: Como tesoureiro, quero registrar o saldo de abertura uma única vez, para que o saldo corrente reflita o dinheiro que a APP já tem ao adotar a ferramenta.

**Why P1**: Sem o ponto de partida, o saldo corrente nasce errado.

**Acceptance Criteria**:

1. WHEN não existe saldo de abertura e o tesoureiro informa um valor `>= 0` e uma data de abertura válida (não futura) THEN o sistema SHALL registrar a abertura e passar a usá-la como base do saldo corrente.
2. WHEN o saldo de abertura já foi registrado THEN o sistema SHALL impedir um novo registro de abertura, orientando a corrigir editando o registro existente (se o período da abertura estiver aberto).
3. WHEN o valor de abertura é vazio, não numérico ou negativo THEN o sistema SHALL rejeitar com mensagem em pt-BR e não gravar.
4. WHEN a data de abertura é vazia, inválida ou futura THEN o sistema SHALL rejeitar com mensagem em pt-BR.

**Independent Test**: Em base nova, registrar abertura R$ 1.000,00 e ver o saldo corrente exibir R$ 1.000,00 sem nenhum lançamento; tentar registrar de novo é bloqueado.

---

### P1: Registrar lançamento (entrada/saída) ⭐ MVP

**User Story**: Como tesoureiro, quero registrar uma entrada ou saída com data, valor, categoria e descrição, para que o movimento do caixa fique documentado e contado no saldo.

**Why P1**: É a ação central da ferramenta.

**Acceptance Criteria**:

1. WHEN o tesoureiro informa tipo (`entrada`/`saida`), data válida (não futura, mês aberto), valor `> 0` com até 2 casas, categoria e descrição THEN o sistema SHALL gravar o lançamento e refletir o novo saldo corrente.
2. WHEN o lançamento é gravado THEN o sistema SHALL registrar automaticamente **quem criou** e **quando** (e-mail do SSO + data/hora do servidor em `America/Sao_Paulo`).
3. WHEN o valor é `<= 0`, vazio, não numérico ou com mais de 2 casas decimais THEN o sistema SHALL rejeitar com mensagem em pt-BR e não gravar.
4. WHEN a data informada é futura OU recai em um mês fechado THEN o sistema SHALL rejeitar com mensagem em pt-BR e não gravar.
5. WHEN dois lançamentos são gravados praticamente ao mesmo tempo THEN o sistema SHALL serializar a escrita (LockService) e gravar ambos sem perder, duplicar ou corromper linhas.
6. WHEN o mesmo formulário é enviado duas vezes (duplo-clique/reenvio) com o mesmo `clientToken` THEN o sistema SHALL gravar **apenas um** lançamento e tratar o segundo envio como sucesso idempotente (sem criar duplicata).

**Independent Test**: Lançar entrada R$ 200,00 e saída R$ 50,00; a lista mostra os dois e o saldo soma certo. Reenviar o mesmo formulário (duplo-clique) não cria um terceiro lançamento.

---

### P1: Ver saldo corrente ⭐ MVP

**User Story**: Como tesoureiro (ou leitor), quero ver o saldo corrente do caixa, para saber quanto a APP tem disponível a qualquer momento.

**Why P1**: É o principal valor entregue — confiança no número.

**Acceptance Criteria**:

1. WHEN há saldo de abertura e/ou lançamentos THEN o sistema SHALL exibir o saldo corrente = abertura + Σ entradas − Σ saídas (ignorando lançamentos excluídos), formatado em pt-BR (R$).
2. WHEN um lançamento é criado, editado ou excluído THEN o sistema SHALL recalcular o saldo a partir da fonte (não materializado) e refletir o novo valor.
3. WHEN o saldo corrente resultante é negativo THEN o sistema SHALL exibir o valor negativo com alerta visível, sem bloquear (pode ser correção legítima em sequência).
4. WHEN a abertura ainda não foi registrada e já existem lançamentos THEN o sistema SHALL tratar a abertura como R$ 0,00 e sinalizar visivelmente que a abertura não foi definida.

**Independent Test**: Após abertura R$ 1.000 + entrada R$ 200 − saída R$ 50, o saldo é R$ 1.150,00; excluir a entrada leva o saldo a R$ 950,00.

---

### P1: Listar lançamentos ⭐ MVP

**User Story**: Como tesoureiro (ou leitor), quero ver a lista dos lançamentos, para conferir o que já foi registrado.

**Why P1**: Sem ver o histórico, não há como conferir nem corrigir.

**Acceptance Criteria**:

1. WHEN existem lançamentos não excluídos THEN o sistema SHALL listá-los com data, tipo, valor, categoria e descrição, ordenados por data decrescente e, em empate, por data/hora de criação decrescente.
2. WHEN um lançamento foi excluído (soft-delete) THEN o sistema SHALL omiti-lo da lista padrão e não contá-lo no saldo.
3. WHEN não existem lançamentos visíveis THEN o sistema SHALL exibir um estado vazio claro em pt-BR.

**Independent Test**: Lançar três movimentos (dois na mesma data) e vê-los na ordem correta; excluir um e confirmar que sai da lista.

---

### P2: Corrigir lançamento — editar e excluir com trilha de auditoria

**User Story**: Como tesoureiro, quero corrigir ou remover um lançamento errado, para manter o caixa fiel à realidade, sem perder o rastro do que mudou.

**Why P2**: Correção é importante, mas o MVP já entrega valor só com registro + saldo.

**Acceptance Criteria**:

1. WHEN o tesoureiro edita um lançamento de um período **aberto** THEN o sistema SHALL salvar as mudanças, recalcular o saldo, atualizar `AlteradoPor/AlteradoEm` na linha e **anexar um registro append-only** na trilha de auditoria (ação=`editar`, id, autor, timestamp, resumo antes→depois).
2. WHEN o tesoureiro exclui um lançamento de um período **aberto** THEN o sistema SHALL marcá-lo como excluído (soft-delete) gravando quem/quando, recalcular o saldo e **anexar registro de auditoria** (ação=`excluir`).
3. WHEN o lançamento pertence a um período **fechado** THEN o sistema SHALL impedir edição e exclusão, com mensagem em pt-BR indicando o período fechado.
4. WHEN uma edição violaria uma regra de criação (valor `<= 0`, data futura, mover para mês fechado) THEN o sistema SHALL rejeitar com mensagem em pt-BR e não alterar nada.
5. WHEN a edição/exclusão concorre com outra escrita THEN o sistema SHALL serializar (LockService) preservando integridade.

**Independent Test**: Editar o valor de um lançamento; o saldo muda, `AlteradoPor/AlteradoEm` aparece e há um registro novo na trilha de auditoria. Excluir e confirmar que o saldo ajusta e a auditoria registra a exclusão.

---

### P2: Categoria com autocomplete

**User Story**: Como tesoureiro, quero escolher uma categoria já usada ou digitar uma nova, para manter consistência sem ficar preso a uma lista fixa.

**Why P2**: Melhora a consistência dos relatórios; o MVP funciona com texto livre.

**Acceptance Criteria**:

1. WHEN o tesoureiro começa a preencher a categoria THEN o sistema SHALL sugerir categorias já usadas que combinem com o texto, ignorando maiúsculas/acentos/espaços nas pontas.
2. WHEN o tesoureiro digita uma categoria nova THEN o sistema SHALL aceitá-la (gravando o texto com trim) e passar a sugeri-la nos próximos lançamentos.
3. WHEN existem variações que só diferem em caixa/acento/espaços THEN o sistema SHALL sugeri-las como uma única opção (não duplicar a sugestão).

**Independent Test**: Após usar "Doação", digitar "do" em um novo lançamento e ver uma única sugestão "Doação".

---

### P2: Fechamento e conferência do caixa (mensal)

**User Story**: Como admin ou tesoureiro, quero fechar um mês depois de conferir o caixa, para que aquele período não possa mais ser alterado.

**Why P2**: Protege a prestação de contas; o MVP funciona com todos os meses abertos.

**Acceptance Criteria**:

1. WHEN o admin/tesoureiro fecha um mês `aberto` com competência `<=` mês corrente THEN o sistema SHALL marcá-lo como **fechado** e registrar quem/quando fechou.
2. WHEN um mês está fechado THEN o sistema SHALL impedir, **revalidando no servidor**, novos lançamentos com data nesse mês e edição/exclusão de lançamentos desse mês.
3. WHEN se tenta lançar/editar/excluir em um mês fechado THEN o sistema SHALL rejeitar com mensagem clara em pt-BR identificando o período (MM/AAAA).
4. WHEN se tenta fechar um mês **futuro** THEN o sistema SHALL rejeitar.
5. WHEN se tenta fechar um mês já **fechado** THEN o sistema SHALL tratar como no-op idempotente, informando que já está fechado (sem erro).

**Independent Test**: Fechar Junho/2026; lançar com data em junho é bloqueado; lançar em julho funciona; fechar junho de novo só avisa "já fechado".

---

### P2: Reabrir período fechado

**User Story**: Como admin ou tesoureiro, quero reabrir um mês fechado, para corrigir um erro descoberto depois da conferência.

**Why P2**: Acompanha o fechamento.

**Acceptance Criteria**:

1. WHEN o admin/tesoureiro reabre um mês **fechado** THEN o sistema SHALL voltá-lo para **aberto** e registrar quem/quando reabriu (sem apagar o registro de quem havia fechado).
2. WHEN o mês está reaberto THEN o sistema SHALL voltar a permitir lançamento/edição/exclusão naquele período.
3. WHEN se tenta reabrir um mês já **aberto** THEN o sistema SHALL tratar como no-op idempotente (sem erro).

**Independent Test**: Reabrir Junho/2026 e confirmar que lançar/editar volta a funcionar e que há registro de reabertura preservando o de fechamento.

---

### P3: Filtrar lançamentos por período/tipo/categoria

**User Story**: Como tesoureiro, quero filtrar a lista por mês, tipo (entrada/saída) e categoria, para encontrar movimentos rapidamente.

**Why P3**: Conveniência; não bloqueia a operação central.

**Acceptance Criteria**:

1. WHEN o tesoureiro escolhe mês e/ou tipo e/ou categoria THEN o sistema SHALL exibir apenas os lançamentos não excluídos correspondentes, mantendo a ordenação padrão.
2. WHEN o filtro não retorna nada THEN o sistema SHALL exibir estado vazio claro em pt-BR.

**Independent Test**: Com lançamentos em junho e julho, filtrar "Junho/2026" + "saída" e ver só as saídas de junho.

---

## Edge Cases

- WHEN o valor usa vírgula ou ponto como separador decimal THEN o sistema SHALL normalizar para moeda pt-BR (2 casas) ou rejeitar entradas inválidas com mensagem clara.
- WHEN o valor excede o teto técnico (R$ 1.000.000,00) THEN o sistema SHALL exigir confirmação explícita na UI antes de gravar (proteção contra fat-finger), sem bloquear definitivamente.
- WHEN a descrição ou categoria excede o limite (280 / 60 chars) THEN o sistema SHALL rejeitar com mensagem clara.
- WHEN a data é vazia, inválida ou futura THEN o sistema SHALL rejeitar.
- WHEN a abertura ainda não foi definida e há lançamentos THEN o sistema SHALL tratar a abertura como R$ 0,00 e sinalizar que não foi registrada.
- WHEN duas escritas (lançar/editar/excluir/fechar) ocorrem ao mesmo tempo THEN o sistema SHALL serializar (LockService) sem perder/duplicar linhas; timeout de lock vira mensagem "Sistema ocupado, tente novamente."
- WHEN o mesmo formulário é reenviado (duplo-clique, retomada de conexão) THEN o sistema SHALL deduplicar por `clientToken` e não criar duplicata.
- WHEN um lançamento/edição/exclusão recai em mês fechado THEN o sistema SHALL bloquear revalidando no servidor (a UI é só cosmética).
- WHEN o saldo corrente fica negativo THEN o sistema SHALL permitir e alertar visualmente.
- WHEN `Session.getActiveUser().getEmail()` vem vazio (gotcha conhecido da 1ª execução) THEN o sistema SHALL recorrer ao bootstrap anti-lockout e não gravar autor `desconhecido` silenciosamente.

---

## Requirement Traceability

IDs `LANC-01..09` mantêm correspondência com a v1 (mesmo conceito) para facilitar comparação; `LANC-10..12` são requisitos **novos** introduzidos por esta segunda leitura.

| Requirement ID | Story | Origem | Phase | Status |
| -------------- | ----- | ------ | ----- | ------ |
| LANC-01 | P1: Saldo de abertura | v1 (refinado: sinal/zero) | Design | In Design |
| LANC-02 | P1: Registrar lançamento | v1 | Design | In Design |
| LANC-03 | P1: Ver saldo corrente | v1 (refinado: abertura indefinida) | Design | In Design |
| LANC-04 | P1: Listar lançamentos | v1 (refinado: desempate, oculta excluídos) | Design | In Design |
| LANC-05 | P2: Editar/excluir com trilha | v1 + auditoria append-only | Design | In Design |
| LANC-06 | P2: Categoria com autocomplete | v1 (refinado: normalização) | Design | In Design |
| LANC-07 | P2: Fechamento mensal | v1 (refinado: transições/idempotência) | Design | In Design |
| LANC-08 | P2: Reabrir período | v1 (refinado: idempotência) | Design | In Design |
| LANC-09 | P3: Filtrar lançamentos | v1 (refinado: + categoria) | Design | In Design |
| LANC-10 | P1: Idempotência de gravação (clientToken) | **novo (v2)** | Design | In Design |
| LANC-11 | P2: Soft-delete de lançamento | **novo (v2)** | Design | In Design |
| LANC-12 | P2: Trilha de auditoria append-only | **novo (v2)** | Design | In Design |

**ID format:** `LANC-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 12 total, 0 mapeados a tarefas, 12 não mapeados ⚠️ (mapeamento ocorre na fase Tasks)

---

## Success Criteria

- [ ] Um tesoureiro sem experiência técnica registra uma entrada e uma saída e entende o saldo, sem ajuda, em menos de 2 minutos.
- [ ] O saldo corrente exibido bate exatamente com abertura + Σ entradas − Σ saídas em todos os cenários testados, inclusive após edição e soft-delete.
- [ ] Nenhum lançamento é perdido, duplicado (inclusive por duplo-clique) ou corrompido sob gravações concorrentes.
- [ ] Um mês fechado não aceita nenhum lançamento, edição ou exclusão (validado no servidor), e as transições fechar/reabrir são idempotentes.
- [ ] Toda edição e exclusão deixa trilha auditável (quem, quando, o quê) suficiente para a prestação de contas.

---

## Apêndice: o que mudou vs. o primeiro rascunho (v1)

Resumo das divergências que esta especificação oficial introduziu sobre o rascunho v1 (detalhe e justificativa em **Assumptions & Open Questions**, todas confirmadas em AD-010):

1. **Remoção lógica (soft-delete) em vez de exclusão física** — honra a lição "auditoria append-only" do STATE, mantendo a UX simples. (LANC-11)
2. **Trilha de auditoria append-only** (aba `Auditoria`) além do "quem/quando da última alteração" — o histórico de correções deixa de se perder. (LANC-12)
3. **Idempotência por `clientToken`** contra lançamento duplicado por duplo-clique/reenvio — risco real que a v1 não cobria. (LANC-10)
4. **Precisões que a v1 deixou em aberto** (endurecimentos): sinal/zero do saldo de abertura, desempate de ordenação, transições e idempotência de fechar/reabrir, normalização de categoria, limites de campo e teto técnico de valor, comportamento quando a abertura não foi definida, e o gotcha do e-mail vazio na 1ª execução.

> **Nota de modelo (uma vez):** esta é uma tarefa de especificação/raciocínio — vale rodar com um modelo de maior capacidade. Já a validação leve e checagens pontuais funcionam bem com modelos mais rápidos/baratos.
