# Roadmap

**Current Milestone:** M0 — Discovery & Platform Spikes
**Status:** Planning

---

## M0 — Discovery & Platform Spikes

**Goal:** Reduzir os riscos técnicos e **decidir a plataforma** antes de construir qualquer ferramenta. Cada spike é uma prova de conceito descartável com uma decisão registrada em STATE.md.
**Target:** Plataforma escolhida (AD) + viabilidade confirmada/descartada para cada integração arriscada.

### Spikes

**Decisão de Plataforma** - COMPLETE (provisória)

- Matriz de decisão em `.specs/spikes/M0-platform-decision.md` → stack provisória **Pure Google (Apps Script + Sheets/Drive) + Playwright** (AD-007).
- Sujeita à comprovação pelos spikes de capacidade abaixo.

**Spike de Capacidades da Stack** - PLANNED

- Comprovar que a stack provisória comporta cada desafio técnico (do contrário, escalar a ferramenta para Supabase/Cloudflare):
  - Integração NFe/NFC-e (parsing/consulta).
  - Leitura de QR/código de barras (incl. ISBN) pela câmera.
  - Geração de relatórios (mensal/anual).
  - Gráficos e insights.
  - Controle de autorização por papéis (admin/tesoureiro/leitor) integrado ao SSO Google.
  - (Catálogo detalhado de riscos em `.specs/spikes/M0-platform-decision.md` → "Desafios técnicos adicionais a comprovar".)

**Spike de Governança do Workspace (admin)** - PLANNED

- 🔴 Pode invalidar a stack A. Confirmar com o admin do Workspace municipal: deploy de web app Apps Script para o domínio, Apps Script API habilitada (para `clasp`/CI), escopos OAuth, Shared Drives e compartilhamento externo, cotas multiusuário.

**Spike de UI Mobile / Scanner no HtmlService** - PLANNED

- 🔴 Validar acesso à câmera (`getUserMedia`) dentro do iframe sandbox do HtmlService e carga de libs externas (ZXing/Chart.js) sob a CSP. Plano B: página de scanner hospedada à parte (GitHub Pages).
- Inclui: upload de foto de comprovante do celular, integridade de dados (LockService/concorrência, auditoria append-only, backup), isolamento server-side de privacidade (banco de horas) e localização pt-BR.

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

**Lançamentos & Saldo** - PLANNED

- Registrar entrada/saída com data, valor, categoria e descrição.
- Saldo corrente automático.

**Comprovantes** - PLANNED

- Anexar foto/scan do comprovante por lançamento.

**Papéis** - PLANNED

- Perfis admin / tesoureiro / leitor.

**Relatórios** - PLANNED

- Relatório mensal e relatório anual com gráficos e insights.

**Captura por NFe/NFC-e** - PLANNED

- Escanear QR/código de barras para preencher despesas automaticamente (depende do Spike NFe/NFC-e).

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
