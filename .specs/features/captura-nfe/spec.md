# Captura por NFe/NFC-e Specification

## Problem Statement

O tesoureiro registra despesas manualmente — digita valor, fornecedor e data a partir
de notas fiscais (NFe/DANFE impressa e NFC-e/cupom fiscal). Isso é lento, propenso
a erro de digitação e não registra os itens comprados. A escola recebe ambos os tipos
de nota: NFe modelo 55 (DANFE com código de barras Code-128) e NFC-e modelo 65 (cupom
com QR code). Os spikes (B-003, B-005, AD-008) já provaram que é viável escanear os
códigos e extrair valor + fornecedor + itens sem certificado digital.

## Goals

- [ ] Escanear o **código de barras** de uma NFe (Code-128, 44 dígitos) e preencher automaticamente valor total, data, fornecedor e itens.
- [ ] Escanear o **QR code** de uma NFC-e e preencher automaticamente valor total, data, fornecedor e itens.
- [ ] **Degradação graciosa**: se a extração falhar (rede, Cloudflare, nota antiga), preencher o que for possível (data/fornecedor decodificados da chave) e deixar o usuário completar manualmente.
- [ ] Integrar o fluxo ao formulário de lançamento existente (botão "Escanear nota" → scanner → retorno com dados → form pre-filled).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Criação automática do lançamento sem confirmação do usuário | O tesoureiro precisa revisar/corrigir antes de salvar (pode ajustar categoria, descrição, etc.) |
| Leitura de notas de outros estados (fora de SC para NFC-e) | O link da SEFAZ varia por UF; MVP cobre SC (sede da escola); extensão futura |
| OCR de nota impressa (foto do papel) | Complexidade de OCR; deferred — scan do código/QR é suficiente para MVP |
| Histórico de notas escaneadas | Dados são transientes — só persistem quando o lançamento é salvo (fluxo existente) |
| Escanear dentro do iframe do HtmlService | Bloqueado (B-005); resolvido via AD-008 (scanner em GitHub Pages) |
| Importação em lote de notas | Uma nota por vez no MVP |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Tipos de nota | NFe (modelo 55) + NFC-e (modelo 65) | São os dois que a APP recebe (B-003 confirmed) | y |
| Extração de NFe | Proxy Apps Script → consultadanfe.com (XML com itens+total) | Validado no spike (B-003); grátis, sem key, 60 req/min, mês corrente | y |
| Extração de NFC-e | Client-side no scanner page: fetch do link SEFAZ no browser real → parse HTML | Cloudflare bloqueia UrlFetchApp; browser real passa (spike confirmou) | y |
| Fallback NFC-e (Cloudflare challenge) | Pre-fill data/fornecedor (decode key + BrasilAPI CNPJ); mostrar link SEFAZ para o usuário ver itens; total manual | Graceful degradation | y |
| Fallback NFe (nota antiga fora da janela do consultadanfe) | Pre-fill data/fornecedor do decode; total/itens manuais | consultadanfe grátis só cobre mês corrente para NFe 55 | y |
| Scanner page | `docs/scanner/index.html` existente (GitHub Pages), estendida para parsear NFC-e e NFe | AD-008; já validado com ISBN/QR | y |
| Proxy NFe | `backend/nfe-proxy.gs` existente (deploy separado como Web App) | Já funciona; CORS resolvido server-side | y |
| Entry point no app | Botão "Escanear nota" no form de lançamento (cash-flow) | Usuário confirmou | y |
| Formato da descrição | `FORNECEDOR (Cidade/UF) — item1, item2, ...` (resumo truncado) | Usuário confirmou: supplier + items as description | y |
| Tipo do lançamento pré-preenchido | Sempre `saida` (nota fiscal = despesa) | Notas são compras da APP | y |
| Validação de chave | cDV offline (dígito verificador do módulo 11 da chave de 44 dígitos) | Spike validou: pega mis-scans sem rede | y |
| Supplier lookup | CNPJ decodificado da chave → BrasilAPI `/cnpj/v1/{cnpj}` (razão social/fantasia/cidade/UF) | Grátis, sem auth, validado no spike | y |
| Data máxima de itens na descrição | Truncar a 280 chars (limite existente de `DESCRICAO_MAX`) | Mantém consistência com limites do lançamento | y |
| Concorrência do scanner | Um scan por vez (fluxo sequencial: scan → parse → retorno → form) | MVP single-user | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Escanear NFe e pré-preencher lançamento ⭐ MVP

**User Story**: Como tesoureiro, quero escanear o código de barras de uma NFe (DANFE)
e ter o lançamento pré-preenchido com valor, data, fornecedor e itens, para registrar
a despesa rapidamente sem digitação.

**Why P1**: Elimina a digitação manual para notas do tipo mais comum (DANFE A4).

**Acceptance Criteria**:

1. WHEN o tesoureiro clica "Escanear nota" no form de lançamento THEN o sistema SHALL abrir a página do scanner (GitHub Pages) passando a URL de retorno.
2. WHEN o scanner lê um código de barras Code-128 de 44 dígitos com cDV válido THEN o sistema SHALL aceitar a leitura e sinalizar sucesso.
3. WHEN o scanner lê um código com cDV inválido THEN o sistema SHALL rejeitar a leitura e pedir nova tentativa (sem redirecionar).
4. WHEN a leitura é aceita (NFe, modelo 55) THEN o scanner SHALL consultar o proxy (`nfe-proxy.gs`) com a chave, extrair do XML: fornecedor (emitente), data de emissão, valor total e lista de itens.
5. WHEN a consulta ao proxy retorna com sucesso THEN o scanner SHALL redirecionar de volta ao app com dados estruturados (fornecedor, data, valor, itens resumidos) codificados nos parâmetros da URL.
6. WHEN o app recebe os dados de retorno THEN o sistema SHALL pré-preencher o form de lançamento: tipo=`saida`, valor=total da nota, data=emissão, descrição=`FORNECEDOR (Cidade/UF) — item1, item2, ...` (truncada a 280 chars).
7. WHEN a consulta ao proxy falha (rede, nota antiga, erro) THEN o scanner SHALL fazer fallback: decodificar a chave offline (CNPJ+data), buscar o nome do fornecedor via BrasilAPI, e redirecionar com dados parciais (fornecedor+data, sem valor/itens).
8. WHEN o app recebe dados parciais THEN o sistema SHALL pré-preencher apenas os campos disponíveis e deixar os demais (valor, itens na descrição) em branco para o usuário completar.

**Independent Test**: Escanear a NFe de uma compra real do mês → ver o form pré-preenchido com fornecedor, data, valor e itens; escanear uma nota antiga → ver só fornecedor e data (fallback).

---

### P1: Escanear NFC-e e pré-preencher lançamento ⭐ MVP

**User Story**: Como tesoureiro, quero escanear o QR code de uma NFC-e (cupom fiscal)
e ter o lançamento pré-preenchido com valor, data, fornecedor e itens, para registrar
a despesa sem digitação.

**Why P1**: Cupons fiscais (NFC-e) são frequentes em compras do dia-a-dia da escola.

**Acceptance Criteria**:

1. WHEN o scanner lê um QR code contendo uma URL da SEFAZ-SC (formato `https://...nfce/...`) com chave de 44 dígitos e cDV válido THEN o sistema SHALL aceitar a leitura.
2. WHEN a leitura é aceita (NFC-e, modelo 65) THEN o scanner SHALL fazer fetch do link SEFAZ client-side (browser real) e parsear o HTML para extrair: fornecedor, data, valor total e lista de itens.
3. WHEN a extração client-side sucede THEN o scanner SHALL redirecionar de volta ao app com dados completos (mesmo formato da NFe).
4. WHEN a extração client-side falha (Cloudflare challenge, timeout, HTML inesperado) THEN o scanner SHALL fazer fallback: decodificar a chave do QR (CNPJ+data) + BrasilAPI para nome do fornecedor, e redirecionar com dados parciais + link da SEFAZ para consulta manual.
5. WHEN o app recebe dados parciais com link da SEFAZ THEN o sistema SHALL pré-preencher os campos disponíveis e exibir o link "Ver nota na SEFAZ" para o usuário consultar o total/itens.

**Independent Test**: Escanear o QR de um cupom fiscal SC recente → form pré-preenchido completo; simular falha de extração → form parcial + link SEFAZ visível.

---

### P2: Validação offline da chave (cDV)

**User Story**: Como tesoureiro, quero que leituras com código inválido sejam rejeitadas
imediatamente (sem rede), para não perder tempo com mis-scans.

**Why P2**: Melhora a UX do scanner; impede envio de chaves inválidas ao proxy.

**Acceptance Criteria**:

1. WHEN o scanner lê um código/QR cujos 44 dígitos têm cDV válido (módulo 11) THEN o sistema SHALL aceitar.
2. WHEN o cDV é inválido THEN o sistema SHALL rejeitar imediatamente com aviso "Código inválido" e manter o scanner ativo para nova tentativa.
3. WHEN a leitura tem menos ou mais que 44 dígitos THEN o sistema SHALL ignorá-la silenciosamente (não é uma nota fiscal).

**Independent Test**: Passar uma chave com cDV errado → rejeitada; passar uma válida → aceita.

---

## Edge Cases

- WHEN o QR de uma NFC-e é de outra UF (não SC) THEN o sistema SHALL fazer fallback (decode key + BrasilAPI), pois o parser HTML pode não funcionar para SEFAZs de outros estados.
- WHEN o scanner lê um QR/barcode que NÃO é uma nota fiscal (ISBN, URL genérica, etc.) THEN o sistema SHALL ignorar silenciosamente (não tem 44 dígitos ou não é URL SEFAZ).
- WHEN o proxy retorna JSON de erro (chave não encontrada, fora da janela) THEN o sistema SHALL tratar como fallback (dados parciais).
- WHEN a BrasilAPI está indisponível THEN o sistema SHALL usar o CNPJ bruto como nome do fornecedor (degradação).
- WHEN a descrição gerada (fornecedor + itens) excede 280 caracteres THEN o sistema SHALL truncar com "…" no final.
- WHEN o usuário cancela/fecha o scanner sem escanear THEN o sistema SHALL voltar ao form inalterado (sem dados pré-preenchidos).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SCAN-01 | P1: NFe (botão abre scanner) | Design | Pending |
| SCAN-02 | P1: NFe (Code-128 lido, cDV válido) | Design | Pending |
| SCAN-03 | P1: NFe (cDV inválido rejeita) | Design | Pending |
| SCAN-04 | P1: NFe (proxy consulta → XML) | Design | Pending |
| SCAN-05 | P1: NFe (retorno com dados completos) | Design | Pending |
| SCAN-06 | P1: NFe (pre-fill do form) | Design | Pending |
| SCAN-07 | P1: NFe (fallback proxy falha) | Design | Pending |
| SCAN-08 | P1: NFe (pre-fill parcial) | Design | Pending |
| SCAN-09 | P1: NFC-e (QR SEFAZ aceito) | Design | Pending |
| SCAN-10 | P1: NFC-e (fetch+parse client-side) | Design | Pending |
| SCAN-11 | P1: NFC-e (retorno completo) | Design | Pending |
| SCAN-12 | P1: NFC-e (fallback client-side) | Design | Pending |
| SCAN-13 | P1: NFC-e (pre-fill parcial + link) | Design | Pending |
| SCAN-14 | P2: cDV válido aceita | Design | Pending |
| SCAN-15 | P2: cDV inválido rejeita | Design | Pending |
| SCAN-16 | P2: não-44 dígitos ignorado | Design | Pending |

**ID format:** `SCAN-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 16 total, 0 mapped to tasks, 16 unmapped ⚠️ (resolved in Tasks phase)

---

## Success Criteria

- [ ] Escanear uma NFe real do mês → form pré-preenchido com fornecedor, data, valor e itens.
- [ ] Escanear uma NFC-e real de SC → form pré-preenchido com fornecedor, data, valor e itens.
- [ ] Nota antiga ou falha de rede → degradação graciosa (fornecedor+data parciais, sem crash).
- [ ] Chave inválida (cDV errado) → rejeitada imediatamente no scanner, sem chamada de rede.
- [ ] Todo o fluxo funciona no celular (S24+, Chrome).
