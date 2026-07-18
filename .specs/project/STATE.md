# State

**Last Updated:** 2026-07-18
**Current Work:** **M1 — Fluxo de Caixa MVP: ✅ COMPLETO (5/5 features).** Todas as features implementadas e verificadas (PASS):
- **Lançamentos & Saldo** (107 testes) — entrada/saída, saldo, abertura, edição/exclusão soft-delete, fechamento mensal, categoria autocomplete, idempotência, auditoria.
- **Comprovantes** (+16 testes) — foto/PDF por lançamento, link público (AD-011), substituir/remover, soft-delete cascata.
- **Papéis** (built-in) — guard `requireRole_` em todos os endpoints (admin/tesoureiro/leitor), `Usuarios`, anti-lockout.
- **Relatórios** (+49 testes) — mensal (totais + comprovantes + provisório/oficial) e anual (KPIs, Chart.js, insights). PDF público no Drive (B-006).
- **Captura por NFe/NFC-e** (+16 testes, **188 total**) — escanear Code-128 (NFe) ou QR (NFC-e), extração automática (proxy consultadanfe / client-side SEFAZ-SC), pré-preenche lançamento (valor/data/fornecedor/itens). Degradação graciosa. Scanner em GitHub Pages (AD-008).

**Pendente:** deploy smoke manual (passos 1–25 no cabeçalho de `cash-flow/Index.html`) + publicar scanner no GitHub Pages.
**Próximo:** M2 (Banco de Horas) ou deploy+smoke do M1.
Em paralelo, B-002 (Robô da Biblioteca/MSTECH) aguarda infos da bibliotecária. M0 técnico fechado para a stack A.

---

## Recent Decisions (Last 60 days)

### AD-012: Versionamento visível (semver automática) nos apps (2026-07-18)

**Decision:** Cada superfície exibe um **badge de versão discreto** (canto fixo, `pointer-events:none`) com a versão **semver do repositório**. A versão é **calculada pela pipeline** a partir da última tag + Conventional Commits (`mathieudutour/github-tag-action@v6.2`, `default_bump: false`) e **cria a tag `vX.Y.Z` no commit publicado**. Nos 4 apps do Apps Script a versão é **injetada por `sed` no deploy** (mesmo padrão dos URLs do portal, placeholder `__APP_VERSION__`); as 2 páginas estáticas (`docs/scanner`, `docs/nota`) — servidas direto do repo pelo GitHub Pages — buscam a **última tag em runtime** via API pública do GitHub, com degradação graciosa. Fora do deploy, o badge mostra `dev`. Lógica pura testável: `versionLabel_` (`cash-flow/logic.js`, +10 testes → **198 total**).
**Reason:** Sem versão visível, o troubleshooting era às cegas (não dava para correlacionar o relato do usuário ao commit/deploy). Semver automática dispensa bump manual e mantém o badge rastreável 1:1 à tag.
**Trade-off:** Dois mecanismos (injeção no deploy vs. fetch runtime) por causa dos dois modelos de hospedagem (clasp vs. Pages-from-repo); as páginas estáticas dependem da API do GitHub em runtime (rate-limit 60/h por IP, aceitável no uso escolar, com fallback gracioso). Exceção consciente ao padrão "sed no deploy".
**Impact:** Feature `app-versioning` (spec/design/tasks/validation em `.specs/features/app-versioning/`). Todo novo app/superfície deve incluir o mesmo badge; o job `version` do `deploy.yml` é o ponto único de cálculo/tag.

### AD-011: Comprovantes expostos por link público do Drive (2026-07-16)

**Decision:** Os arquivos de comprovante (foto/PDF por lançamento) são gravados no Drive com permissão **"qualquer pessoa com o link pode ver"** (`ANYONE_WITH_LINK, VIEW`), para poderem aparecer nos **relatórios públicos** dos pais (B-006). Um comprovante por lançamento, referenciado por `ComprovanteId`/`ComprovanteUrl` na aba `Lancamentos`.
**Reason:** O usuário confirmou que os pais (sem conta do domínio) precisam **ver o comprovante** na prestação de contas. Reusa o precedente do spike `m0-reports` (PDF público por link).
**Trade-off:** Comprovante acessível por link sem login → o tesoureiro deve evitar anexar documentos com dados pessoais sensíveis. A UI exibe aviso discreto de privacidade.
**Impact:** **Exceção consciente e escopada a AD-005** ("evitar link público") — AD-005 segue ativo para os demais arquivos; comprovantes e relatórios públicos são a exceção justificada por B-006. Guia a feature Comprovantes (`uploadComprovante_` + `setSharing`).

### AD-010: Lançamentos & Saldo — spec v2 oficializada (segunda leitura) (2026-06-26)

**Decision:** Oficializar uma **segunda leitura "olhos novos"** da feature como spec canon (`.specs/features/lancamentos-saldo/spec.md`), substituindo o rascunho v1. Três decisões reabertas e confirmadas: (1) **exclusão lógica (soft-delete)** em vez de exclusão física; (2) **trilha de auditoria append-only** (aba `Auditoria`) além do "quem/quando da última alteração"; (3) **idempotência de gravação** via `clientToken` (anti-duplo-clique). Mais endurecimentos de precisão (sinal/zero da abertura, desempate de ordenação, transições/idempotência de fechar-reabrir, normalização de categoria, limites de campo/teto de valor, abertura indefinida, gotcha do e-mail vazio).
**Reason:** A v1 divergia da lição "auditoria append-only" do STATE e não cobria duplicação silenciosa por `google.script.run` nem vários casos de borda. A v2 mantém a UX simples para o tesoureiro e fortalece a prestação de contas.
**Trade-off:** Soft-delete + aba `Auditoria` adicionam um pouco de schema/escrita; idempotência exige token no cliente. Custo baixo na stack Sheets, benefício alto em confiabilidade/auditoria.
**Impact:** **Supera a D-4 do AD-009** (correção por exclusão física rastreando só a última alteração). Guia o novo design (aba `Auditoria`, soft-delete, dedup por token) e os IDs novos LANC-10/11/12.

### AD-009: Lançamentos & Saldo — decisões de escopo do MVP do caixa (2026-06-25)

**Decision:** Caixa **único**; **saldo de abertura** registrado uma vez; categoria **texto livre com autocomplete** das anteriores; correção por **edição/exclusão direta** do lançamento rastreando **só a última alteração** (usuário+data); **fechamento mensal** do caixa que torna o período **totalmente imutável** (sem novo lançamento/edição/exclusão), **reabrível** com auditoria, por **admin ou tesoureiro**; data retroativa só em mês aberto, data futura bloqueada.
**Reason:** Simplicidade para o tesoureiro não-técnico, mantendo proteção da prestação de contas via barreira de fechamento.
**Trade-off:** Edição/exclusão diverge da lição "auditoria append-only" do STATE.md. Mitigado por: campos de última alteração + o fechamento mensal como fronteira de imutabilidade (a auditoria forte vive no fechamento, não no histórico por linha).
**Impact:** Guia o design da feature (modelo Sheets com registro de meses fechados, guard server-side de fechamento/data reaproveitando o padrão `requireRole_` do spike `m0-roles`).
**Status:** Parcialmente **superado por AD-010** — a D-4 (correção por exclusão física rastreando só a última alteração) foi substituída por soft-delete + trilha de auditoria append-only. As demais decisões (caixa único, abertura única, categoria autocomplete, fechamento mensal, regras de data) permanecem ativas.

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

### B-002: Sistema web de catálogo da biblioteca — IDENTIFICADO (MSTECH "Sala de Leitura" / Ensinablu-Biblioteca v1.70.1.0, ASP.NET WebForms, login duplo usuário-senha/Google, staging disponível); fluxo de cadastro a confirmar

**Discovered:** 2026-06-20
**Status:** 🟡 **PARCIALMENTE RESOLVIDO (2026-06-25).** Sistema, fornecedor e stack identificados; confirmado **web app** (Playwright serve), com **login usuário/senha** alternativo ao Google (de-risca o SSO) e **ambiente de homologação** para testes seguros. Resta o **print do fluxo de cadastro** e confirmar se há **importação por ISBN** (ou importação em massa de acervo).
**Impact:** Bloqueia o M3 (Robô da Biblioteca) — falta detalhar o fluxo de cadastro e o login SAML para validar o Playwright ponta a ponta.
**Workaround:** Nenhum.
**Resolution:** Identificar o sistema com a equipe da biblioteca durante o Spike Robô da Biblioteca.
**Finding (2026-06-20, pesquisa web):** A rede de Blumenau usa **Pergamum** (consórcio PUCPR), instância `https://pergamum.blumenau.sc.gov.br/` (Biblioteca Municipal Dr. Fritz Müller), versão **web nova (SPA)**. **Conectividade: internet pública** — um runner Playwright em nuvem (GitHub Actions) alcança (não é intranet). O login público visto é o do **catálogo do leitor** (“Código de usuário + senha de empréstimo”), **sem captcha aparente** — mas é o lado patrono, não a catalogacão.
**Finding (2026-06-20, check do filtro de unidades):** No filtro “Biblioteca/Unidade” da Pesquisa Avançada **NÃO aparecem escolas** — só a Biblioteca Municipal (+ Arquivo Histórico). Conclusão: a biblioteca da **escola NÃO está nesta base** do Pergamum central. O sistema da escola é **outro** (outra base Pergamum, outro software, ou inexistente) e só será identificado direto com a bibliotecária/print. A instância central só serve de referência (existe API pública de leitura `cod_empresa=212`).
**Finding (2026-06-24, sistema IDENTIFICADO pela bibliotecária):** A biblioteca da escola usa **"Ensinablu - Biblioteca", versão 1.70.1.0**, em **`https://ensinablu.blumenau.sc.gov.br/Biblioteca/`**. NÃO é o Pergamum central — é o módulo de biblioteca da plataforma municipal **Ensinablu** (mesma plataforma das contas `@ensinablumenau`). Confirmações da própria URL/verificação (2026-06-24):
- ✅ **É sistema WEB** (acessado pelo navegador) → **Playwright serve** (não é desktop). Responde 1 das 3 perguntas pendentes.
- ✅ **Conectividade: internet pública** (domínio `blumenau.sc.gov.br`) → runner em nuvem (GitHub Actions) alcança; não é intranet.
- ⚠️ **Autenticação via SAML SSO** — o endpoint redireciona para `https://ensinablu.blumenau.sc.gov.br/SAML/` (resposta SAML `RequestDenied` sem sessão; há `Logout.ashx`). **Implicação p/ o robô:** o login NÃO é um form usuário/senha simples — é federado (provável IdP municipal, possivelmente ligado ao Google Workspace do domínio). O Playwright terá de **percorrer o fluxo SAML** (e talvez o consentimento Google). Risco: 2FA/sessão e a fragilidade de automatizar SSO. Mitigação a avaliar: reaproveitar sessão/cookies, conta de serviço, ou rodar com a sessão da bibliotecária.
**Ainda a confirmar com a bibliotecária (tenant-only, exige login/print):** (1) ✅ resolvido — é web. (2) o **fluxo de cadastro** de um livro novo (campos do formulário, telas) — pedir **print da tela de cadastro**. (3) o cadastro permite **importar por ISBN (Z39.50/cópia de catalogação)** trazendo título/autor/capa — se sim, o robô dispensa o scraping de metadados (Google Books); senão, preenche via Google Books a partir do ISBN. (4) qual o **mecanismo de login** que ela vê (botão "Entrar com Google"? usuário/senha próprio? redireciona sozinho?).
**Finding (2026-06-25, fornecedor + produto + stack identificados via pesquisa web):**
- **Fornecedor/empresa:** **MSTECH — Educação e Tecnologia** (Bauru/SP; `mstech.com.br`; tel. (14) 3235-5500; `contato@mstech.com.br`). Empresa BR, +20 anos, +10 mil unidades escolares, certificação MPS.BR. "Ensinablu" é a marca da Prefeitura de Blumenau para o **Gestão Escolar** da MSTECH (login `Versão: 2.56.3.0`).
- **Produto da biblioteca = "Sala de Leitura MSTECH"** (`mstech.com.br/Sala-de-Leitura.html`) — é o módulo `/Biblioteca/` (v1.70.1.0). **Funcionalidades anunciadas:** cadastro de acervo e leitores centralizado; categorização personalizada; relatórios de acervo/leitores; **pesquisa on-line do acervo**; **impressão de etiquetas de lombada**; movimentação de acervo; **"permite a importação de acervo de uma ou mais bibliotecas"** (⭐ possível **importação em massa** — rota alternativa ao RPA por livro; investigar se aceita planilha/lote). **NÃO menciona** importação por ISBN/Z39.50 com auto-preenchimento → continua a confirmar com a bibliotecária (pergunta 3).
- **Stack técnica (p/ o Playwright):** **ASP.NET WebForms** — páginas `.aspx`, navegação por **`__doPostBack` + ViewState**, handlers `.ashx`, **SAML SSO** (`/SAML/`). Implicações: o robô precisa **esperar postbacks** (não é SPA com rotas limpas), e os seletores caem em IDs gerados pelo servidor (`ctl00$ContentPlaceHolder1$...`) — preferir âncoras por label/texto estável.
- **Login é DUPLO (de-risca o SSO):** a tela oferece **usuário/senha** *e* botão **"Login com o Google"** (`__doPostBack('ctl00$ContentPlaceHolder1$_btnLoginGoogle','')`). Ou seja, o robô **pode evitar o fluxo Google** se a bibliotecária tiver **usuário/senha local** do sistema — bem mais simples de automatizar que o SAML/Google. Confirmar com ela qual login ela usa.
- **⭐ Ambiente de HOMOLOGAÇÃO (staging) existe:** `https://h-ensinablu.blumenau.sc.gov.br/Login.aspx` (entidade "Prefeitura Municipal de Blumenau"). **Ideal para testar o Playwright sem tocar na base de produção** — validar login + fluxo de cadastro ali primeiro. Confirmar se a biblioteca da escola existe/está populada nesse ambiente.
- **Suporte/docs:** sem manual público do módulo encontrado (produto é B2B, docs atrás de login). Há vídeos de tutorial do EnsinaBlu no YouTube (diários/boletim) — pode haver um de biblioteca. Documentação detalhada provavelmente só via MSTECH/SEMED ou print da bibliotecária.

### B-003: Viabilidade da integração NFe/NFC-e incerta

**Discovered:** 2026-06-20
**Status:** ✅ **RESOLVIDO (2026-06-21).** Ambos os caminhos validados empiricamente com notas reais: **NFe (55)** → proxy backend (Apps Script + consultadanfe) renderiza itens+total na página; **NFC-e (65)** → link SEFAZ-SC abre itens+valor **sem captcha** (só desafio rápido do Cloudflare). Scanner lê QR (NFC-e) e Code-128 (NFe) no S24+. cDV validado offline. Caminho **sem certificado** confirmado para notas do **mês corrente** (limite do consultadanfe p/ NFe). Conclusão de capacidade: o desafio de integração NFe/NFC-e do AD-007 está coberto.
**Impact:** Afeta a feature "Captura por NFe/NFC-e" do M1 — consulta à SEFAZ pode exigir certificado/captcha.
**Workaround:** Permitir entrada manual da despesa como fallback.
**Resolution:** Concluir o Spike NFe/NFC-e no M0.
**Finding (2026-06-20, pesquisa web):** Consulta manual por chave na SEFAZ-SC (`sat.sef.sc.gov.br/nfce/consulta`) **exige captcha** ("Validação de segurança") → inviável automatizar. O portal do contribuinte exige senha ou **certificado digital ICP-Brasil**. **A chave de acesso (44 díg.) é decodificável offline** (sem rede/certificado): UF, ano/mês, **CNPJ do emitente**, modelo, série, número — mas **NÃO** traz valor nem itens. QR da NFC-e v2.00 só carrega chave+token+hash (valor/itens exigem abrir a página SEFAZ, com anti-bot/captcha — frágil). DANFE Code-128 traz só a chave. **API pública grátis confirmada:** BrasilAPI `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` retorna razão social / nome fantasia / endereço, sem auth.
**Requisito reforcado (2026-06-20):** valor + itens são **obrigatórios** (não basta o usuário digitar o total). Compras **mistas** (CNPJ da APP às vezes, cupom às vezes); recebem **NFC-e (QR)** e **NFe (DANFE)**; **sem certificado** (evitar custo).
**Caminho certificado-free para itens+valor (2026-06-20):** (a) **NFe** → chave → **MeuDanfe** (consulta por chave grátis, sem certificado, com API) → XML completo (itens+valores), confirmado como serviço; (b) **NFC-e** → scraping do **link do QR** na SEFAZ (captcha só na consulta manual — validar com cupom real); (c) **OCR** do cupom/DANFE impresso como fallback; (d) **manual** último recurso. **Riscos:** dependência de terceiros (MeuDanfe — checar ToS/limite) e de scraping SEFAZ. **Testes pendentes (nota real):** link do QR abre itens sem captcha? MeuDanfe retorna XML p/ chave de NFe e NFC-e?
**Decisão de arquitetura (de-risca B-003):** v1 NÃO depende de certificado. Combina chave (CNPJ/data offline) + BrasilAPI (fornecedor) + MeuDanfe/scraping-QR (itens+valor) + OCR/manual de fallback.
**Viável confirmado (2026-06-21, subagentes + fetch):** **NFe modelo 55 → `consultadanfe.com` `POST /api/v1/consulta`** devolve **XML (itens+valores) + PDF**, **grátis, sem cadastro/API-Key**, 60 req/min — limite **mês corrente** (modelo 55). ⚠️ **CORS restrito**: chamada direta do navegador (github.io) recebe **403 "Origem não autorizada"** → **exige backend**. **VALIDADO PONTA A PONTA (2026-06-21):** proxy **Apps Script** (`doGet ?chave` + `UrlFetchApp`, deploy "Qualquer pessoa") consulta server-side e a página `docs/nota/` renderiza fornecedor+itens+total (testado: NFe R$173,91, ANTARES/Itu-SP). Front chama o proxy via **GET ?chave** (sem preflight, sem redirect de POST). Código do proxy em `backend/nfe-proxy.gs`. Fallbacks pagos p/ notas antigas: `danferapida.com.br` (R$0,05+key) e MeuDanfe (R$0,03+key). Canais oficiais só dão **valor total sem itens** + reCAPTCHA; SEFAZ-RS exige gov.br; NFe 55 não tem QR. **cDV validável offline** (pego erro de leitura sem rede — já pegou um mis-scan no teste). ✅ Scanner lê QR da NFC-e e Code-128 da NFe (o zoom −/+ foi decisivo p/ QR pequeno; NFe larga lê melhor em 1× aproximando). ✅ **NFC-e (chave `4226068326...247765`):** link da SEFAZ-SC abre **itens+valor sem captcha** (1ª vez passou por desafio Cloudflare, 2ª vez nem isso). ✅ **NFe (chave `3525074796...683344`, Magazine Luiza/SP):** chave decodificada + fornecedor via BrasilAPI OK; era nota antiga (07/2025) → fora da janela do consultadanfe, mas o caminho grátis vale para notas do mês corrente. ⚠️ Cloudflare na SEFAZ **inviabiliza fetch/UrlFetchApp puro** → raspar itens da NFC-e exige navegador real/headless (a NFe via consultadanfe não tem esse problema, pois a API já entrega o XML com CORS).

### B-004: Políticas de governança do Workspace municipal desconhecidas

**Discovered:** 2026-06-20
**Status:** ✅ **RESOLVIDO (2026-06-24).** A diretora rodou os dois testes em `@ensinablumenau` (roteiro `TESTE-DIRETORA.md`) e ambos **passaram sem bloqueio do admin**:
- **Teste 1 (deploy de web app Apps Script):** concluiu e gerou URL pública; o endpoint responde **`ok`** (verificado). Confirma que o tenant **permite** publicar web app Apps Script com **"Executar como: Eu"** e **"Quem tem acesso: Qualquer pessoa"** — base da stack A e do **endpoint de leitura pública** dos relatórios (B-006).
- **Teste 2 (compartilhamento externo):** compartilhou um Doc com um Gmail pessoal (fora do domínio) **sem restrição** — confirma que o tenant **não bloqueia** compartilhamento externo (relevante para AD-005/Drive e transparência da APP).
**Conclusão:** stack A (AD-007) **não é invalidada** pela governança; M0 técnico pode fechar para Pure Google.
**Ainda não testado diretamente (verificar quando necessário, sem bloquear o M1):** Apps Script API habilitada para `clasp`/CI (deploy automatizado), Shared Drives, e escopos OAuth de Advanced Services. Mitigação: editar/implantar pelo editor do Apps Script (manual) já é suficiente para começar; automação via clasp é otimização, não bloqueio.
**Impact:** 🔴 Pode invalidar a stack A (AD-007). O admin pode bloquear deploy de web app Apps Script, a Apps Script API (clasp/CI), escopos OAuth, Shared Drives ou compartilhamento externo.
**Workaround:** Nenhum; se bloqueado, escalar para stack B/C (web app + Supabase/Cloudflare).
**Resolution:** Teste empírico “Hello World” em `spikes/m0-hello-world/` — a diretora implanta um Web App mínimo na conta da escola. Prova deploy + SSO + câmera (B-005) de uma vez. Capturar avisos/bloqueios do admin como resultado. → **Substituído pelo roteiro simplificado `TESTE-DIRETORA.md` (2 testes); ambos passaram em 2026-06-24.**

### B-005: Acesso à câmera dentro do iframe sandbox do HtmlService incerto

**Discovered:** 2026-06-20
**Impact:** 🔴 Afeta todas as leituras (ISBN, QR/NFC-e, barcode). Se `getUserMedia` não funcionar no sandbox do HtmlService, o scanner não roda dentro do Apps Script.
**Workaround:** Página de scanner hospedada à parte (GitHub Pages) que envia o código lido ao Apps Script.
**Resolution:** Testado junto com B-004 no `spikes/m0-hello-world/` (botão “Testar câmera” via `getUserMedia` dentro do iframe do HtmlService).
**Finding (2026-06-20, conta pessoal):** `getUserMedia` ao vivo **BLOQUEADO** no iframe do HtmlService — `NotAllowedError: Permission denied`, sem prompt (a Permissions Policy do iframe não inclui `allow="camera"`; não é negação do usuário). `<input type="file" capture="environment">` (câmera nativa) funciona, e **ZXing carrega OK sob a CSP**, mas **decodificar de foto estática falhou** mesmo com `TRY_HARDER`+hints (`NotFoundException`). **RESOLVIDO via AD-008:** scan ao vivo numa página hospedada à parte (`docs/scanner/`), devolvendo o código ao Apps Script.
**Validação (2026-06-20, Samsung S24+, Chrome e Edge):** scanner ao vivo em GitHub Pages **FUNCIONA** — imagem nítida (foco contínuo), ISBN lido corretamente em dois livros, sem falsos positivos. Chaves do sucesso: (1) abrir a câmera com `getUserMedia` próprio em vez de deixar a lib abrir (controle real de foco/lanterna); (2) usar `BarcodeDetector` nativo do Android quando disponível (ZXing só como fallback) — muito mais robusto a desfoque; (3) confirmação dupla (2 leituras idênticas) para eliminar misreads. Lanterna: capability `torch` não reportada de imediato no S24+; mitigado com retries + fallback de acionamento direto. **B-005 VALIDADO.**

### B-006: Acesso externo da associação (APP) vs. premissa SSO-only

**Discovered:** 2026-06-20
**Status:** ✅ RESOLVIDO (2026-06-21)
**Impact:** O Fluxo de Caixa é da associação de pais e mestres; membros/pais podem não ter conta `@ensinablumenau`. Se precisarem de acesso (transparência/leitura), conflita com AD-004 (SSO-only).
**Resolution (cliente confirmou 2026-06-21):** os **pais/membros da APP (sem conta do domínio) PRECISAM consultar os relatórios** (prestação de contas). Portanto a transparência será por **relatório de leitura pública** — página/PDF acessível por link, **sem login**. Escrita/lançamento continua SSO-only (tesoureiro/staff); leitura dos relatórios é pública. Isso exige que a plataforma sirva um endpoint/arquivo público de leitura (compatível com Apps Script Web App "qualquer pessoa" ou PDF no Drive com link público).

---

## Lessons Learned

- **HtmlService bloqueia `getUserMedia`:** o iframe do Apps Script não delega `allow="camera"`, então scanner de vídeo ao vivo falha com `NotAllowedError` (sem prompt). Solução: `<input type="file" accept="image/*" capture="environment">` abre a câmera nativa e funciona; decodificar o código da foto client-side (ex.: ZXing). Confirmado empiricamente em 2026-06-20.
- **Conta pessoal de-risca parte do M0:** motor do Apps Script/HtmlService é idêntico ao Workspace — reproduz fielmente câmera/CSP/capacidades. **Não** reproduz: governança do admin (B-004), SSO por domínio e Shared Drives (são tenant-only).
- **Scanner ao vivo confiável (validado S24+):** abrir o stream manualmente (não via lib), preferir `BarcodeDetector` nativo ao ZXing, e exigir 2 leituras idênticas antes de aceitar. `decodeFromConstraints` do ZXing tira o controle do track (lanterna/foco não pegam) e gera falsos positivos em código borrado. Capability `torch` no Samsung pode demorar a aparecer — usar retries + fallback.
- **Relatórios/gráficos viáveis no Apps Script (validado 2026-06-22):** Chart.js (CDN jsdelivr) **carrega sob a CSP do HtmlService** — barras/linha/rosca renderizam na tela. Para o **PDF** o conversor `Utilities.newBlob(html).getAs('application/pdf')` **não executa JS** → usar **SVG gerado no servidor** (Chart.js só vale para a tela). Link de leitura pública via `DriveApp.Access.ANYONE_WITH_LINK + Permission.VIEW` cobre a transparência da APP (B-006). Formatação pt-BR: `Intl` no cliente, helper manual no servidor.
- **Autorização server-side no Apps Script (padrão validado em lógica 2026-06-22):** usar `executeAs USER_DEPLOYING` para o script ter acesso à base e **filtrar** server-side (o visitante não toca na planilha); identidade do visitante via `Session.getActiveUser().getEmail()` (confiável no mesmo domínio). Toda função privilegiada começa com um guard `requireRole_([...])` — esconder botão na UI é só cosmético. Isolamento por linha = filtrar pelas linhas do e-mail efetivo. Para testar vários papéis numa conta só: "ver como" gated por admin (saída usa identidade real). Incluir trava do último admin (anti-lockout) e sanitização na fronteira.
- **`getActiveUser().getEmail()` pode vir VAZIO na 1ª execução (gotcha, 2026-06-22):** em conta pessoal, durante o fluxo de autorização inicial o `getActiveUser` retornou vazio — se o seed do admin depende disso, a base nasce **sem admin** (usuário fica `desconhecido`). Mitigação aplicada no spike `m0-roles`: **bootstrap anti-lockout** — se não existe nenhum admin e o usuário real é conhecido pelo SSO, ele é promovido a admin ao abrir a sessão (basta recarregar). Não depender do `getActiveUser` no exato momento da criação da base.

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
  - [x] Integração NFe/NFC-e (parsing/consulta SEFAZ-SC). — validado 2026-06-21 (NFe via proxy consultadanfe; NFC-e via link SEFAZ-SC sem captcha).
  - [x] Leitura de QR/código de barras pela câmera (incl. ISBN). — validado 2026-06-20 (B-005, scanner ao vivo S24+).
  - [x] Geração de relatórios (mensal/anual). — **VALIDADO (2026-06-22)**: spike `spikes/m0-reports/` implantado e testado no deploy (todos os checks passaram): agregação consistente (Σ mensal == anual, acumulado == saldo do ano), pt-BR (R$/dd-mm-aaaa), Sheets real, conversão HTML→PDF e link público do Drive.
  - [x] Gráficos e insights. — **VALIDADO (2026-06-22)** no mesmo spike `m0-reports`: Chart.js carrega sob a CSP do HtmlService (barras/linha/rosca na tela), SVG server-side no PDF, insights anuais automáticos.
  - [x] Autorização por papéis (admin/tesoureiro/leitor/funcionário) integrada ao SSO Google. — **VALIDADO (2026-06-22)**: spike `spikes/m0-roles/` implantado e testado no deploy (todos os checks passaram — papel desconhecido corrigido via bootstrap anti-lockout). Papéis enforçados server-side (`requireRole_`), **isolamento por linha** (funcionário vê só o próprio saldo), painel de "ataque" confirma que chamar a função direto também é barrado. Modelo: `executeAs USER_DEPLOYING` + `Session.getActiveUser` como âncora.
  - [ ] Autorização por papéis (admin/tesoureiro/leitor) integrada ao SSO Google.
- [x] M0: Confirmar form factor do app de banco de horas (PWA responsivo vs. outro) com SSO Google. → CONFIRMADO (2026-06-21): professores usam **mais no celular** para **consultar saldos/extratos** → PWA responsivo mobile-first. Regras (cliente): **diretora aprova e lança**, **sem limites**; **obrigatório rastrear o vínculo hora extra ↔ compensação** (qual compensação quitou qual hora extra).
- [x] M0 (🔴 Governança/B-004): a **diretora** roda um **teste prático** com a conta `@ensinablumenau` (publicar web app de teste + compartilhar arquivo externo) para confirmar permissões do tenant, em vez de abrir chamado com a TI da Prefeitura. → **RESOLVIDO (2026-06-24): ambos os testes passaram — deploy de web app "Qualquer pessoa" e compartilhamento externo liberados.**
- [ ] M0 (🔴 Scanner/B-005): validar câmera no iframe do HtmlService + libs externas sob CSP; senão, página de scanner à parte.
- [ ] M0: integridade de dados em Sheets (LockService/concorrência, auditoria append-only, backup/restore).
- [ ] M0: isolamento server-side de privacidade (funcionário vê só o próprio saldo) e papéis enforced no servidor.
- [ ] M0: storage no Drive (Shared Drive, titularidade, evitar link público) + upload de foto do celular.
- [x] B-006: esclarecer com o cliente a necessidade de acesso externo da associação (pais sem conta do domínio). → CONFIRMADO: pais precisam consultar relatórios → leitura pública sem login.

---

## Preferences

**Model Guidance Shown:** never
