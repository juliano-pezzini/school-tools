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

### AD-008: Scanner de código/QR roda em página estática hospedada à parte (2026-06-20)

**Decision:** A leitura de código de barras/QR (ISBN na biblioteca, NFC-e no caixa) roda numa **página estática hospedada à parte** (GitHub Pages, em `docs/scanner/`) com scan de vídeo ao vivo (ZXing), **não** dentro do HtmlService. A página devolve o código ao Apps Script via round-trip `?return=…` → `?code=…`.
**Reason:** Comprovado empiricamente (2026-06-20): o HtmlService bloqueia `getUserMedia` (sem `allow="camera"`) e a leitura por foto estática é não confiável (ZXing não detecta). Scan ao vivo exige página top-level fora do iframe.
**Trade-off:** Um satélite estático extra a hospedar/manter (grátis no Pages, agent-buildable). Round-trip por URL precisa de cuidado (validar/sanitizar o `code` recebido).
**Impact:** Mantém a stack A (dados/SSO/telas no Apps Script). Vale para os 3 apps que escaneiam. ZXing carrega OK sob a CSP do HtmlService (validado) — útil para decodificação auxiliar, mas a captura ao vivo fica no Pages.

---

## Active Blockers

### B-001: Plataforma decidida provisoriamente (aguardando comprovação nos spikes)

**Discovered:** 2026-06-20
**Impact:** Stack provisória definida (AD-007). Ainda bloqueia o design *definitivo* até os spikes de capacidade confirmarem que a stack comporta os desafios técnicos.
**Workaround:** Seguir com a stack provisória (Pure Google + Playwright) nos spikes de validação.
**Resolution:** Concluir os spikes de capacidade do M0 (NFe/NFC-e, QR/barcode, relatórios, gráficos, papéis+SSO). Confirmação → consolidar AD-007; falha → escalar a ferramenta afetada para B/C.

### B-002: Sistema web de catálogo da biblioteca — identificado (Pergamum); fluxo de catalogacão a confirmar

**Discovered:** 2026-06-20
**Impact:** Bloqueia o M3 (Robô da Biblioteca) — sem conhecer o sistema e o fluxo de cadastro, não há como validar o Playwright.
**Workaround:** Nenhum.
**Resolution:** Identificar o sistema com a equipe da biblioteca durante o Spike Robô da Biblioteca.
**Finding (2026-06-20, pesquisa web):** A rede de Blumenau usa **Pergamum** (consórcio PUCPR), instância `https://pergamum.blumenau.sc.gov.br/` (Biblioteca Municipal Dr. Fritz Müller), versão **web nova (SPA)**. **Conectividade: internet pública** — um runner Playwright em nuvem (GitHub Actions) alcança (não é intranet). O login público visto é o do **catálogo do leitor** (“Código de usuário + senha de empréstimo”), **sem captcha aparente** — mas é o lado patrono, não a catalogacão.
**Finding (2026-06-20, check do filtro de unidades):** No filtro “Biblioteca/Unidade” da Pesquisa Avançada **NÃO aparecem escolas** — só a Biblioteca Municipal (+ Arquivo Histórico). Conclusão: a biblioteca da **escola NÃO está nesta base** do Pergamum central. O sistema da escola é **outro** (outra base Pergamum, outro software, ou inexistente) e só será identificado direto com a bibliotecária/print. A instância central só serve de referência (existe API pública de leitura `cod_empresa=212`).
**Ainda a confirmar com a bibliotecária (tenant-only):** (1) **qual sistema** a biblioteca da escola usa para cadastrar livros (nome/URL ou ícone do programa)? (2) é pelo **navegador** (Playwright serve) ou **programa desktop** (não serve)? (3) o cadastro permite **importar por ISBN (Z39.50/cópia de catalogacão)** — se sim, o robô dispensa o scraping de metadados (Google Books).

### B-003: Viabilidade da integração NFe/NFC-e incerta

**Discovered:** 2026-06-20
**Impact:** Afeta a feature "Captura por NFe/NFC-e" do M1 — consulta à SEFAZ pode exigir certificado/captcha.
**Workaround:** Permitir entrada manual da despesa como fallback.
**Resolution:** Concluir o Spike NFe/NFC-e no M0.
**Finding (2026-06-20, pesquisa web):** Consulta manual por chave na SEFAZ-SC (`sat.sef.sc.gov.br/nfce/consulta`) **exige captcha** ("Validação de segurança") → inviável automatizar. O portal do contribuinte exige senha ou **certificado digital ICP-Brasil**. **A chave de acesso (44 díg.) é decodificável offline** (sem rede/certificado): UF, ano/mês, **CNPJ do emitente**, modelo, série, número — mas **NÃO** traz valor nem itens. QR da NFC-e v2.00 só carrega chave+token+hash (valor/itens exigem abrir a página SEFAZ, com anti-bot/captcha — frágil). DANFE Code-128 traz só a chave. **API pública grátis confirmada:** BrasilAPI `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` retorna razão social / nome fantasia / endereço, sem auth.
**Requisito reforcado (2026-06-20):** valor + itens são **obrigatórios** (não basta o usuário digitar o total). Compras **mistas** (CNPJ da APP às vezes, cupom às vezes); recebem **NFC-e (QR)** e **NFe (DANFE)**; **sem certificado** (evitar custo).
**Caminho certificado-free para itens+valor (2026-06-20):** (a) **NFe** → chave → **MeuDanfe** (consulta por chave grátis, sem certificado, com API) → XML completo (itens+valores), confirmado como serviço; (b) **NFC-e** → scraping do **link do QR** na SEFAZ (captcha só na consulta manual — validar com cupom real); (c) **OCR** do cupom/DANFE impresso como fallback; (d) **manual** último recurso. **Riscos:** dependência de terceiros (MeuDanfe — checar ToS/limite) e de scraping SEFAZ. **Testes pendentes (nota real):** link do QR abre itens sem captcha? MeuDanfe retorna XML p/ chave de NFe e NFC-e?
**Decisão de arquitetura (de-risca B-003):** v1 NÃO depende de certificado. Combina chave (CNPJ/data offline) + BrasilAPI (fornecedor) + MeuDanfe/scraping-QR (itens+valor) + OCR/manual de fallback.
**Validação empírica (2026-06-21, página `docs/nota/` + notas reais):** ✅ Scanner lê QR da NFC-e e Code-128 da NFe (o zoom −/+ foi decisivo p/ QR pequeno; NFe larga lê melhor em 1× aproximando). ✅ **NFC-e (chave `4226068326...247765`):** link da SEFAZ-SC abre **itens+valor sem captcha** (1ª vez passou por desafio Cloudflare, 2ª vez nem isso). ✅ **NFe (chave `3525074796...683344`, Magazine Luiza/SP):** chave decodificada + fornecedor via BrasilAPI OK, **mas itens+valor da NFe seguem indisponíveis grátis** — NFe **não tem** link público por chave; só via MeuDanfe (pago R$0,03 + API-Key + backend) ou OCR. ⚠️ Cloudflare na SEFAZ **inviabiliza fetch/UrlFetchApp puro** → raspar itens da NFC-e exige navegador real/headless.

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
**Finding (2026-06-20, conta pessoal):** `getUserMedia` ao vivo **BLOQUEADO** no iframe do HtmlService — `NotAllowedError: Permission denied`, sem prompt (a Permissions Policy do iframe não inclui `allow="camera"`; não é negação do usuário). `<input type="file" capture="environment">` (câmera nativa) funciona, e **ZXing carrega OK sob a CSP**, mas **decodificar de foto estática falhou** mesmo com `TRY_HARDER`+hints (`NotFoundException`). **RESOLVIDO via AD-008:** scan ao vivo numa página hospedada à parte (`docs/scanner/`), devolvendo o código ao Apps Script.
**Validação (2026-06-20, Samsung S24+, Chrome e Edge):** scanner ao vivo em GitHub Pages **FUNCIONA** — imagem nítida (foco contínuo), ISBN lido corretamente em dois livros, sem falsos positivos. Chaves do sucesso: (1) abrir a câmera com `getUserMedia` próprio em vez de deixar a lib abrir (controle real de foco/lanterna); (2) usar `BarcodeDetector` nativo do Android quando disponível (ZXing só como fallback) — muito mais robusto a desfoque; (3) confirmação dupla (2 leituras idênticas) para eliminar misreads. Lanterna: capability `torch` não reportada de imediato no S24+; mitigado com retries + fallback de acionamento direto. **B-005 VALIDADO.**

### B-006: Acesso externo da associação (APP) vs. premissa SSO-only

**Discovered:** 2026-06-20
**Impact:** O Fluxo de Caixa é da associação de pais e mestres; membros/pais podem não ter conta `@ensinablumenau`. Se precisarem de acesso (transparência/leitura), conflita com AD-004 (SSO-only).
**Workaround:** Limitar v1 ao tesoureiro/staff com conta do domínio; transparência via relatório PDF exportado.
**Resolution:** Esclarecer a necessidade de acesso externo com o cliente.

---

## Lessons Learned

- **HtmlService bloqueia `getUserMedia`:** o iframe do Apps Script não delega `allow="camera"`, então scanner de vídeo ao vivo falha com `NotAllowedError` (sem prompt). Solução: `<input type="file" accept="image/*" capture="environment">` abre a câmera nativa e funciona; decodificar o código da foto client-side (ex.: ZXing). Confirmado empiricamente em 2026-06-20.
- **Conta pessoal de-risca parte do M0:** motor do Apps Script/HtmlService é idêntico ao Workspace — reproduz fielmente câmera/CSP/capacidades. **Não** reproduz: governança do admin (B-004), SSO por domínio e Shared Drives (são tenant-only).
- **Scanner ao vivo confiável (validado S24+):** abrir o stream manualmente (não via lib), preferir `BarcodeDetector` nativo ao ZXing, e exigir 2 leituras idênticas antes de aceitar. `decodeFromConstraints` do ZXing tira o controle do track (lanterna/foco não pegam) e gera falsos positivos em código borrado. Capability `torch` no Samsung pode demorar a aparecer — usar retries + fallback.

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
