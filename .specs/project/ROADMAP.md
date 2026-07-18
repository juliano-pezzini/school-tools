# Roadmap

**Current Milestone:** M1 — Fluxo de Caixa da APP (MVP)
**Status:** ✅ COMPLETE (5/5 features done — pending deploy smoke)

---

## M0 — Discovery & Platform Spikes

**Goal:** Reduzir os riscos técnicos e **decidir a plataforma** antes de construir qualquer ferramenta. Cada spike é uma prova de conceito descartável com uma decisão registrada em STATE.md.
**Target:** Plataforma escolhida (AD) + viabilidade confirmada/descartada para cada integração arriscada.

### Spikes

**Decisão de Plataforma** - COMPLETE (provisória)

- Matriz de decisão em `.specs/spikes/M0-platform-decision.md` → stack provisória **Pure Google (Apps Script + Sheets/Drive) + Playwright** (AD-007).
- Sujeita à comprovação pelos spikes de capacidade abaixo.

**Spike de Capacidades da Stack** - COMPLETE

- Comprovado que a stack provisória comporta cada desafio técnico (nenhum precisou escalar para Supabase/Cloudflare):
  - ✅ Integração NFe/NFC-e (parsing/consulta) — validado 2026-06-21.
  - ✅ Leitura de QR/código de barras (incl. ISBN) pela câmera — validado 2026-06-20 (B-005).
  - 🛠️ Geração de relatórios (mensal/anual) + gráficos e insights — ✅ **VALIDADO (2026-06-22)**: `spikes/m0-reports/` implantado e testado (Chart.js sob CSP, PDF HTML→Blob com SVG server-side, link público do Drive, pt-BR).
  - ✅ Controle de autorização por papéis (admin/tesoureiro/leitor/funcionário) + isolamento server-side, integrado ao SSO Google — **VALIDADO (2026-06-22)**: `spikes/m0-roles/` implantado e testado (guard server-side, isolamento por linha, painel de "ataque" barrado, bootstrap anti-lockout; harness Node com 35 checks).
  - (Catálogo detalhado de riscos em `.specs/spikes/M0-platform-decision.md` → "Desafios técnicos adicionais a comprovar".)

**Spike de Governança do Workspace (admin)** - COMPLETE (B-004 resolvido)

- ✅ **VALIDADO (2026-06-24)** pela diretora na conta `@ensinablumenau` (roteiro `TESTE-DIRETORA.md`): **deploy de web app Apps Script "Qualquer pessoa"** concluiu e o endpoint responde `ok`; **compartilhamento externo** de arquivo do Drive **liberado**. Nenhum bloqueio do admin. Stack A (AD-007) confirmada quanto à governança.
- Não testado diretamente (verificar quando precisar, sem bloquear o M1): Apps Script API para `clasp`/CI, Shared Drives, escopos OAuth de Advanced Services. Mitigação: deploy manual pelo editor já basta para iniciar.

**Spike de UI Mobile / Scanner no HtmlService** - COMPLETE (B-005 resolvido)

- ✅ Comprovado empiricamente (conta pessoal, 2026-06-20): deploy de web app + identidade/SSO funcionam; `getUserMedia` ao vivo **bloqueado** no iframe do HtmlService; foto nativa via `<input capture>` funciona mas decodificação de still é não confiável; **ZXing carrega OK sob a CSP**.
- → **AD-008:** scanner de vídeo ao vivo numa **página hospedada à parte** (`docs/scanner/`, GitHub Pages), devolvendo o código ao Apps Script via `?return=`→`?code=`.
- Pendente: publicar no Pages e validar leitura ao vivo de ISBN/QR no celular.
- Demais itens do M0 seguem: upload de foto de comprovante, integridade de dados (LockService/concorrência, auditoria append-only, backup), isolamento server-side de privacidade (banco de horas), localização pt-BR.

**Spike NFe/NFC-e** - PLANNED

- Validar leitura do QR/código de barras da NFC-e e extração dos dados da despesa (chave de acesso / consulta SEFAZ-SC) sem barreiras de certificado/captcha.

**Spike Robô da Biblioteca (Playwright)** - PLANNED

- Identificar o sistema web de catálogo usado pela biblioteca e validar automação de cadastro via Playwright (login, formulário, estabilidade).

**Spike SSO (Google Workspace) + App Mobile** - PLANNED

- Validar o Google Workspace SSO como mecanismo de login comum às três ferramentas (incluindo PWA responsivo do banco de horas), e definir como páginas externas/públicas ficam isentas.

---

## M1 — Fluxo de Caixa da APP (MVP)

**Goal:** Tesoureiro registra entradas/saídas, vê saldo e gera relatório mensal com confiança.

### Features

**Lançamentos & Saldo** - COMPLETE

- ✅ Implementado e verificado (PASS). 74→107 testes. Spec: `.specs/features/lancamentos-saldo/`.
- Registrar entrada/saída, saldo corrente, abertura, edição/exclusão soft-delete, fechamento mensal, categoria autocomplete, idempotência, auditoria append-only.

**Comprovantes** - COMPLETE

- ✅ Implementado e verificado (PASS). +16 testes. Spec: `.specs/features/comprovantes/`.
- Anexo de foto/PDF por lançamento, link público (AD-011), substituir/remover, soft-delete cascata.

**Papéis** - COMPLETE (built-in)

- ✅ Guard `requireRole_` em todos os endpoints (admin/tesoureiro/leitor), aba `Usuarios`, bootstrap anti-lockout. Padrão do spike `m0-roles` aplicado desde a implementação base.

**Relatórios** - COMPLETE

- ✅ Implementado e verificado (PASS). +49 testes (172 total). Spec: `.specs/features/relatorios/`.
- Relatório mensal (totais + lista com comprovantes, provisório/oficial) e anual (KPIs, categorias, Chart.js, insights). PDF público no Drive (B-006), um por período (substitui ao regerar), auditado.

**Captura por NFe/NFC-e** - COMPLETE

- ✅ Implementado e verificado (PASS). +16 testes (188 total). Spec: `.specs/features/captura-nfe/`.
- Escanear Code-128 (NFe) ou QR (NFC-e) → extração automática via proxy consultadanfe (NFe) ou fetch client-side SEFAZ-SC (NFC-e) → pré-preenche lançamento (tipo=saída, valor, data, fornecedor+itens). Degradação graciosa (fallback key decode + BrasilAPI). Scanner em GitHub Pages (AD-008).

---

## M2 — Banco de Horas (MVP)

**Goal:** Gestor mantém o banco de horas e funcionário consulta o saldo no celular.

### Features

**Lançamento pelo Gestor** - PLANNED

- Gestor registra horas extras/compensadas por funcionário; saldo automático.

**Consulta Mobile (SSO)** - PLANNED

- Funcionário acessa o próprio saldo via app mobile com login Google (depende do Spike App Mobile + SSO).

---

## M3 — Robô da Biblioteca (MVP)

**Goal:** Catalogar um livro escaneando o ISBN, sem digitação manual.

### Features

**Scanner de ISBN** - PLANNED

- Ler ISBN/código de barras pela câmera do celular.

**Busca de Metadados** - PLANNED

- Buscar título/autor/editora a partir do ISBN.

**Cadastro Automatizado** - PLANNED

- Inserir no sistema web de catálogo via Playwright (depende do Spike Robô da Biblioteca).

---

## Future Considerations

- Integração/consolidação entre as três ferramentas (painel único).
- App mobile nativo, se o PWA não atender.
- Relatórios/exportações adicionais conforme demanda dos usuários.
