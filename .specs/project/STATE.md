# State

**Last Updated:** 2026-06-20
**Current Work:** M0 — Spike de Capacidades da Stack (validar stack provisória AD-007 contra os desafios técnicos)

---

## Recent Decisions (Last 60 days)

### AD-001: Arquitetura guiada por custo e baixa manutenção (2026-06-20)

**Decision:** Toda solução deve priorizar custo recorrente próximo de zero, operação autônoma pelo usuário final e reaproveitamento de plataformas já licenciadas (Google Workspace Education).
**Reason:** Orçamento muito limitado e o desenvolvedor não acompanhará a produção de perto.
**Trade-off:** Menos flexibilidade técnica; pode limitar funcionalidades avançadas.
**Impact:** Vieses de design favorecem Sheets/Forms/PWA, SSO Google e cotas gratuitas; evitar servidores e dependências de manutenção contínua.

### AD-002: Convenção de idioma (2026-06-20)

**Decision:** UI e documentação para o usuário em pt-BR; código e identificadores em inglês.
**Reason:** Usuários são brasileiros sem experiência técnica; código se mantém padronizado.
**Trade-off:** Documentos de planejamento misturam cabeçalhos em inglês com conteúdo em pt-BR.
**Impact:** Strings/labels/manuais em pt-BR; nomes de variáveis, funções e arquivos em inglês.

### AD-003: Robô da Biblioteca via automação de navegador (2026-06-20)

**Decision:** O cadastro de livros será feito por automação Playwright sobre o sistema web de catálogo existente.
**Reason:** O sistema de catálogo não possui API.
**Trade-off:** RPA é mais frágil que integração via API (quebra com mudanças de UI).
**Impact:** Necessário spike para identificar o sistema e validar estabilidade da automação (B-002).

### AD-004: Google Workspace SSO obrigatório nas três ferramentas (2026-06-20)

**Decision:** Todas as áreas autenticadas das três ferramentas usam Google Workspace SSO (`@ensinablumenau.sc.gov.br`). Somente páginas externas/públicas explicitamente marcadas dispensam login.
**Reason:** Remove ambiguidade do escopo (antes só o Banco de Horas citava SSO) e padroniza login sem fricção reaproveitando contas existentes.
**Trade-off:** Páginas públicas precisam ser conscientemente marcadas como exceção; dependência do provedor Google.
**Impact:** Toda feature autenticada assume identidade Google; o Spike SSO (M0) valida o mecanismo comum e a isenção das páginas públicas.

### AD-005: Google Drive como camada de armazenamento de arquivos (2026-06-20)

**Decision:** Arquivos (fotos/scans de comprovantes, anexos, PDFs de relatório) serão guardados no Google Drive do Workspace municipal, não em object storage de terceiros.
**Reason:** O Drive já é licenciado, tem cota ampla, usa o mesmo SSO e permissionamento do domínio e é familiar aos usuários. Neutraliza limites/custos de storage (ex.: Supabase Free = 1 GB; Firebase removeu o Storage do plano gratuito em fev/2026).
**Trade-off:** Acoplamento ao ecossistema Google; gestão de permissões/links do Drive precisa ser desenhada com cuidado (evitar exposição pública indevida).
**Impact:** A escolha de backend (M0) passa a focar só nos dados estruturados (lançamentos, saldos) — volume pequeno que cabe em qualquer free tier ou até em Sheets. Apps Script acessa o Drive nativamente; em stack não-Google, usar a Google Drive API.

### AD-006: "Construível por agente de IA" como critério de plataforma de 1ª classe (2026-06-20)

**Decision:** A plataforma deve permitir que o sistema seja construído e mantido por um agente de IA como código versionado (git). Ferramentas no-code (AppSheet, Glide, Softr, Bubble) ficam despriorizadas para a construção.
**Reason:** No-code só expõe APIs de dados (ler/gravar linhas) e IA de autoria interna à GUI do fornecedor; não há API/MCP externo para o agente *construir* a aplicação. Stacks de código (Apps Script via clasp, Supabase via MCP/CLI, Playwright) são totalmente dirigíveis por agente.
**Trade-off:** Abre mão da "autonomia de autoria" do usuário final via GUI no-code. A autonomia passa a significar "operar com confiança", atendida por UI simples + boa documentação, não "o usuário monta o app".
**Impact:** Inclina o M0 para stack code-first (preferência: Apps Script + Sheets/Drive; web app + Supabase quando precisar de lógica/relatórios mais ricos). Robô da biblioteca em Playwright já é code-first. Validar no spike a ausência de API de autoria no-code antes de descartar em definitivo.

### AD-007: Stack provisória — Pure Google (Apps Script + Sheets/Drive) + Playwright (2026-06-20)

**Decision:** Adotar **provisoriamente** a estratégia híbrida da matriz (ver `.specs/spikes/M0-platform-decision.md`): Apps Script + Sheets/Drive para Fluxo de Caixa e Banco de Horas; Playwright (GitHub Actions ou PC local) para o Robô da Biblioteca; Google Drive como storage; B/C (Supabase/Cloudflare) como rota de escalonamento.
**Reason:** Maior pontuação na matriz (82/95) em custo, manutenção, SSO e autonomia, mantendo construção por agente.
**Trade-off:** Decisão **NÃO é definitiva** — depende de comprovação técnica nos spikes. Se Apps Script não comportar os desafios abaixo, escalar para B/C na(s) ferramenta(s) afetada(s).
**Impact:** Condicionada à validação, via spikes, de TODOS estes desafios: (1) integração NFe/NFC-e; (2) leitura de QR/código de barras (incl. ISBN); (3) geração de relatórios; (4) gráficos/insights; (5) controle de autorização por papéis integrado ao SSO Google. Falha em qualquer um reabre a decisão para a ferramenta correspondente.

---

## Active Blockers

### B-001: Plataforma decidida provisoriamente (aguardando comprovação nos spikes)

**Discovered:** 2026-06-20
**Impact:** Stack provisória definida (AD-007). Ainda bloqueia o design *definitivo* até os spikes de capacidade confirmarem que a stack comporta os desafios técnicos.
**Workaround:** Seguir com a stack provisória (Pure Google + Playwright) nos spikes de validação.
**Resolution:** Concluir os spikes de capacidade do M0 (NFe/NFC-e, QR/barcode, relatórios, gráficos, papéis+SSO). Confirmação → consolidar AD-007; falha → escalar a ferramenta afetada para B/C.

### B-002: Sistema web de catálogo da biblioteca não identificado

**Discovered:** 2026-06-20
**Impact:** Bloqueia o M3 (Robô da Biblioteca) — sem conhecer o sistema, não há como validar o Playwright.
**Workaround:** Nenhum.
**Resolution:** Identificar o sistema com a equipe da biblioteca durante o Spike Robô da Biblioteca.

### B-003: Viabilidade da integração NFe/NFC-e incerta

**Discovered:** 2026-06-20
**Impact:** Afeta a feature "Captura por NFe/NFC-e" do M1 — consulta à SEFAZ pode exigir certificado/captcha.
**Workaround:** Permitir entrada manual da despesa como fallback.
**Resolution:** Concluir o Spike NFe/NFC-e no M0.

### B-004: Políticas de governança do Workspace municipal desconhecidas

**Discovered:** 2026-06-20
**Impact:** 🔴 Pode invalidar a stack A (AD-007). O admin pode bloquear deploy de web app Apps Script, a Apps Script API (clasp/CI), escopos OAuth, Shared Drives ou compartilhamento externo.
**Workaround:** Nenhum; se bloqueado, escalar para stack B/C (web app + Supabase/Cloudflare).
**Resolution:** Teste empírico “Hello World” em `spikes/m0-hello-world/` — a diretora implanta um Web App mínimo na conta da escola. Prova deploy + SSO + câmera (B-005) de uma vez. Capturar avisos/bloqueios do admin como resultado.

### B-005: Acesso à câmera dentro do iframe sandbox do HtmlService incerto

**Discovered:** 2026-06-20
**Impact:** 🔴 Afeta todas as leituras (ISBN, QR/NFC-e, barcode). Se `getUserMedia` não funcionar no sandbox do HtmlService, o scanner não roda dentro do Apps Script.
**Workaround:** Página de scanner hospedada à parte (GitHub Pages) que envia o código lido ao Apps Script.
**Resolution:** Testado junto com B-004 no `spikes/m0-hello-world/` (botão “Testar câmera” via `getUserMedia` dentro do iframe do HtmlService).

### B-006: Acesso externo da associação (APP) vs. premissa SSO-only

**Discovered:** 2026-06-20
**Impact:** O Fluxo de Caixa é da associação de pais e mestres; membros/pais podem não ter conta `@ensinablumenau`. Se precisarem de acesso (transparência/leitura), conflita com AD-004 (SSO-only).
**Workaround:** Limitar v1 ao tesoureiro/staff com conta do domínio; transparência via relatório PDF exportado.
**Resolution:** Esclarecer a necessidade de acesso externo com o cliente.

---

## Lessons Learned

_(none yet)_

---

## Quick Tasks Completed

| #   | Description | Date | Commit | Status |
| --- | ----------- | ---- | ------ | ------ |

---

## Deferred Ideas

- [ ] Integração/painel único entre as três ferramentas — Captured during: project init
- [ ] App mobile nativo (se PWA não atender) — Captured during: project init

---

## Todos

- [x] M0: Comparar stacks e registrar AD da plataforma — feito (matriz em `.specs/spikes/M0-platform-decision.md`, AD-007 provisório).
- [ ] M0 (Spike de Capacidades): comprovar na stack provisória (Apps Script) cada desafio; falha → escalar a ferramenta para Supabase/Cloudflare:
  - [ ] Integração NFe/NFC-e (parsing/consulta SEFAZ-SC).
  - [ ] Leitura de QR/código de barras pela câmera (incl. ISBN).
  - [ ] Geração de relatórios (mensal/anual).
  - [ ] Gráficos e insights.
  - [ ] Autorização por papéis (admin/tesoureiro/leitor) integrada ao SSO Google.
- [ ] M0: Confirmar form factor do app de banco de horas (PWA responsivo vs. outro) com SSO Google.
- [ ] M0 (🔴 Governança/B-004): confirmar com admin de TI as permissões do tenant (deploy web app, Apps Script API, OAuth, Shared Drives, compartilhamento externo).
- [ ] M0 (🔴 Scanner/B-005): validar câmera no iframe do HtmlService + libs externas sob CSP; senão, página de scanner à parte.
- [ ] M0: integridade de dados em Sheets (LockService/concorrência, auditoria append-only, backup/restore).
- [ ] M0: isolamento server-side de privacidade (funcionário vê só o próprio saldo) e papéis enforced no servidor.
- [ ] M0: storage no Drive (Shared Drive, titularidade, evitar link público) + upload de foto do celular.
- [ ] B-006: esclarecer com o cliente a necessidade de acesso externo da associação (pais sem conta do domínio).

---

## Preferences

**Model Guidance Shown:** never
