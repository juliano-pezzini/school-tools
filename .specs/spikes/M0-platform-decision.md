# Spike M0 — Decisão de Plataforma (Matriz de Decisão)

**Status:** Decisão **provisória** aprovada (AD-007) — a ser comprovada pelos spikes de capacidade do M0
**Data:** 2026-06-20
**Relacionado:** B-001, AD-001, AD-004, AD-005, AD-006

> Restrição-chave: stack **code-first** (construível e mantível por agente de IA, versionada em git — ver AD-006). Por isso as opções no-code (AppSheet/Glide/Softr/Bubble) ficam fora desta matriz de *construção* (só expõem API de dados, não de autoria).

## Opções avaliadas

| ID | Stack | Resumo |
|----|-------|--------|
| **A** | **Apps Script + Sheets/Drive** (100% Google) | Dados em Sheets, arquivos no Drive, UI via HTML Service responsivo, SSO automático do domínio |
| **B** | **Web PWA + Supabase + Drive** | Front estático grátis (Pages), Postgres+Auth no Supabase, arquivos no Drive |
| **C** | **Web PWA + Cloudflare (Pages/Workers/D1) + Drive** | Tudo no free tier da Cloudflare, auth via Google OAuth/Access, arquivos no Drive |
| **D** | **Firebase (Firestore/Auth/Hosting) + Drive** | BaaS do Google; evitar Cloud Functions/Storage (saíram do free) |

> O **robô da biblioteca (Playwright)** é um componente à parte em qualquer cenário — precisa de runtime de navegador (PC local ou GitHub Actions). Não entra na matriz de backend.

## Critérios e pesos

| Critério | Peso | Por quê |
|----------|:----:|---------|
| Custo recorrente | ×3 | Orçamento ~zero (AD-001) |
| Manutenção/longevidade sem o dev | ×3 | Dev ausente em produção (AD-001) |
| Construível por agente de IA (CLI/MCP) | ×3 | Critério de 1ª classe (AD-006) |
| SSO Google nativo | ×2 | Obrigatório nas 3 ferramentas (AD-004) |
| Mobile/PWA + scanner câmera | ×2 | Banco de horas mobile + ISBN/NFC-e |
| Relatórios/gráficos ricos | ×2 | Relatório anual com insights (fluxo de caixa) |
| Autonomia/familiaridade do usuário | ×2 | Usuários só usam Office básico |
| Risco de free-tier sumir / lock-in | ×2 | Sustentabilidade a longo prazo |

Notas de 1 (ruim) a 5 (ótimo). Pontuação máxima possível = 19 × 5 = **95**.

## Matriz de pontuação

| Critério (peso) | A · Apps Script | B · Supabase | C · Cloudflare | D · Firebase |
|---|:---:|:---:|:---:|:---:|
| Custo recorrente (×3) | 5 | 4 | 5 | 3 |
| Manutenção/longevidade (×3) | 5 | 3 | 3 | 3 |
| Construível por agente (×3) | 4 | 5 | 5 | 4 |
| SSO Google nativo (×2) | 5 | 4 | 3 | 5 |
| Mobile/PWA + scanner (×2) | 3 | 5 | 5 | 5 |
| Relatórios/gráficos (×2) | 3 | 5 | 4 | 3 |
| Autonomia do usuário (×2) | 5 | 2 | 2 | 2 |
| Risco free-tier/lock-in (×2) | 4 | 3 | 4 | 2 |
| **Total ponderado** | **82** | **74** | **75** | **64** |

## Leitura dos resultados

- **A (Apps Script) lidera (82).** Ganha em custo, manutenção (nunca "dorme", Google mantém o runtime), SSO automático e autonomia (os dados ficam numa planilha que o usuário entende). Pontos fracos: UX mobile e relatórios anuais sofisticados.
- **C (Cloudflare, 75) e B (Supabase, 74) empatam tecnicamente.** Vencem em construção por agente, UX mobile (PWA dedicado) e relatórios ricos. Perdem em manutenção (deps do web app apodrecem; Supabase free pausa após 1 semana) e autonomia (dados em DB que o usuário não acessa direto).
- **D (Firebase, 64) fica atrás:** Storage saiu do free (fev/2026), Functions exigem Blaze sem teto de gasto (risco de conta surpresa), Firestore NoSQL complica relatórios agregados e o lock-in é alto.

## Recomendação: estratégia híbrida por ferramenta

Não há um vencedor único — a melhor jogada é casar cada ferramenta ao seu perfil, mantendo tudo code-first e em git:

| Ferramenta | Stack recomendado | Racional |
|------------|-------------------|----------|
| **Fluxo de Caixa** | **A (Apps Script + Sheets/Drive)** como padrão; escalar para **B/C** só se os relatórios anuais/insights superarem o que o Sheets entrega bem | Dados pequenos, papéis simples, comprovantes no Drive, gráficos do Sheets cobrem o básico |
| **Banco de Horas** | **A (Apps Script web app responsivo)** | Gestor lança, funcionário consulta saldo; dados triviais; SSO grátis; mobile responsivo basta |
| **Robô da Biblioteca** | **Playwright** rodando em **GitHub Actions (grátis) ou PC local**, alimentando uma planilha/catálogo | RPA é inerentemente code-first; runtime separado do backend |

**Padrão = "Pure Google" (A) para as duas ferramentas de dados + Playwright para a biblioteca.** Maximiza custo zero, baixa manutenção, SSO, autonomia e construção por agente. Mantém **B/C como rota de escalonamento** caso uma ferramenta cresça em exigência de UX/relatórios.

### Componentes transversais
- **Storage:** Google Drive em todos os casos (AD-005).
- **Playwright runner:** decidir entre GitHub Actions (grátis, mas precisa alcançar o sistema da biblioteca) vs. PC local da bibliotecária — depende do B-002.
- **NFC-e:** scanner do QR/código de barras no front; consulta SEFAZ-SC pode exigir certificado/captcha → fallback de entrada manual (B-003).

## Riscos e validações pendentes

- **Apps Script** tem cotas (tempo de execução, gatilhos/dia) — validar que cobrem o volume escolar (deve sobrar).
- **Relatórios anuais** do fluxo de caixa: confirmar no design se Sheets+Apps Script entregam os gráficos/insights desejados ou se justificam escalar para B/C.
- **B-002 / B-003** seguem abertos e independem desta decisão de backend.

## Desafios técnicos adicionais a comprovar (revisão da spec)

Itens descobertos na revisão completa da spec. Prioridade: 🔴 pode invalidar a stack A · 🟠 alto · 🟡 médio.

### A. Plataforma / Governança do Workspace (B-004)

> **Método de teste (empírico):** artefato em `spikes/m0-hello-world/` — a diretora implanta um Web App mínimo na conta `@ensinablumenau`. Um único teste prova deploy + SSO/identidade + câmera (B-005). Avisos/bloqueios do admin durante a autorização SÃO o resultado.
- 🔴 O **admin do Workspace municipal** permite **deploy de web app** Apps Script para o domínio e execução de scripts? Escopos OAuth necessários liberados? (política de org pode bloquear tudo).
- 🔴 **Apps Script API habilitada** no tenant para permitir `clasp` (construção por agente / CI).
- 🟠 **Shared Drives** habilitados? Compartilhamento externo permitido ou bloqueado por política?
- 🟡 Cotas Apps Script sob multiusuário: `UrlFetch`/dia (consultas ISBN e NFC-e), execuções simultâneas, gatilhos/dia, `MailApp` (notificações).

### B. UI mobile / Scanner (sandbox do HtmlService) (B-005)
- 🔴 `getUserMedia` (**câmera**) funciona dentro do **iframe sandbox** do HtmlService (`allow="camera"`)? É o maior risco das features de leitura.
- 🟠 Carregar **libs externas** (ZXing/html5-qrcode, Chart.js) sob a **CSP** do HtmlService.
- 🟠 Plano B se a câmera não funcionar no iframe: **página de scanner hospedada à parte** (GitHub Pages) conversando com o Apps Script.
- 🟡 **Upload de foto** do comprovante pelo celular (limite de payload, base64, fotos grandes).
- 🟡 Instalabilidade **PWA / offline** (fila offline na biblioteca com wifi ruim).

### C. Integridade de dados (app financeiro sobre Sheets)
- 🟠 **Concorrência:** `LockService` para evitar *lost updates* e saldo corrompido com vários escritores simultâneos.
- 🟠 **Trilha de auditoria append-only** (quem criou/editou/excluiu) — Sheets é editável por natureza.
- 🟠 **Backup/restore** e proteção contra **exclusão acidental** por usuário com acesso direto à planilha (risco da própria autonomia).
- 🟡 Validação/sanitização de entrada (**XSS** no HtmlService; parsing de números pt-BR).

### D. Autorização & Privacidade
- 🔴 Papéis admin/tesoureiro/leitor **enforced no servidor** (não só escondidos na UI).
- 🔴 **Isolamento server-side:** funcionário enxerga **só o próprio** saldo no banco de horas.
- 🟡 Confiabilidade de `Session.getActiveUser().getEmail()` no modo "executar como usuário que acessa".
- 🟠 **Storage no Drive:** localização (Shared Drive), titularidade dos arquivos e **prevenção de link público** indevido.

### E. Relatórios & Gráficos
- 🟡 Sheets charts vs. lib no HtmlService; **export PDF** e compartilhamento do relatório com a associação.
- 🟡 Profundidade dos **insights anuais** (categorias, tendências) viável em Sheets/Apps Script.
- 🟡 **Localização pt-BR:** R$, vírgula decimal, dd/mm/aaaa, timezone `America/Sao_Paulo`.

### F. NFe/NFC-e (detalha B-003)
**Requisito:** obter **valor + itens** automaticamente. Compras são **mistas** (CNPJ da APP às vezes, cupom às vezes); recebem **NFC-e (QR)** e **NFe (DANFE)**; **sem certificado digital** (evitar custo).
- ✅ **Chave de acesso (44 díg.) decodificável offline:** UF, ano/mês, **CNPJ emitente**, modelo, série, número (não traz valor/itens).
- 🟢 **Nome do fornecedor automático:** CNPJ → **BrasilAPI** (`/api/cnpj/v1/{cnpj}`, grátis, sem auth) → razão social/nome fantasia. (Confirmado 2026-06-20.)
- ✅ **NFe (DANFE):** chave do código de barras → **MeuDanfe** (consulta por chave, **grátis e sem certificado**, com API) → **XML completo (itens+valores)**. (Serviço confirmado 2026-06-20; falta validar com chave real.)
- 🟠 **NFC-e (QR):** captcha só na consulta **manual**; o **link do QR** (chave|versão|amb|token|hash) tende a abrir a nota completa **sem captcha** — **validar com cupom real**. MeuDanfe pode também cobrir NFC-e por chave (testar).
- 🟡 **OCR do cupom/DANFE impresso** (itens+total em texto) como fallback certificado-free quando QR/chave falham.
- 🔴 **Caminho oficial descartado por escolha:** e-CNPJ A1 + Distribuição DFe daria XML oficial, mas exige certificado pago — evitado.
- 🔴 **Riscos:** dependência de **terceiros** (MeuDanfe pode mudar/limitar/cobrar; checar **ToS**) e de **scraping SEFAZ** (anti-bot/mudança de página). Mitigar com cache, retries e fallback OCR/manual.
- 🟡 **Testes pendentes (nota real):** (1) link do QR da NFC-e abre itens sem captcha? (2) MeuDanfe retorna XML para uma chave de NFe e de NFC-e? (3) taxa de leitura do QR/Code-128 no scanner.

### G. Robô da Biblioteca (detalha B-002)
- 🟡 **Pergamum central identificado** (`pergamum.blumenau.sc.gov.br`, SPA, internet pública), mas o filtro de unidades **não lista escolas** → a biblioteca da **escola usa outro sistema** (a confirmar). Central serve só de referência.
- 🔴 **Identificar o sistema da escola** (nome/URL ou ícone do programa) direto com a bibliotecária + print da tela de cadastro.
- 🔴 **Fluxo de catalogacão:** é no **navegador** (Playwright serve) ou **cliente desktop** (Playwright NÃO serve, exigiria automacão de desktop)?
- 🟢 **Importacão por ISBN (Z39.50 / cópia de catalogacão):** se o sistema importa o registro pelo ISBN, o robô dispensa buscar metadados no Google Books/Open Library.
- 🟠 Login com **captcha/2FA** no módulo de catalogacão? Estabilidade de seletores; rate limiting / anti-bot.
- 🟡 **Orquestracão** celular→fila→Playwright (trigger, deduplicacão, feedback de erro ao usuário).

#### G.1 Fonte dos metadados (a partir do ISBN)
- 🟢 **Preferencial — importacão nativa do próprio sistema** (Z39.50/cópia de catalogacão): já vem em MARC e com a **classificacão** que o sistema espera; é a fonte mais limpa. Só existe se o sistema da escola tiver essa funcão (a confirmar).
- 🔴 **Cobertura de livros BR é o maior risco:** acervo escolar = didáticos/paradidáticos/infantis nacionais, mal cobertos em **Google Books** e **Open Library**. Medir taxa de acerto com ISBNs reais do acervo antes de decidir.
- 🟠 **Fontes brasileiras a avaliar:** CBL / Câmara Brasileira do Livro (Mercado Editorial API), **Biblioteca Nacional** (catálogo/Z39.50), agência **ISBN Brasil**. Verificar acesso, custo e termos de uso.
- 🟠 **Classificacão (CDD vs CDU) e campos mínimos:** título, subtítulo, autor(es), editora, ano, edicão, idioma, assunto + a classificacão que o sistema exige. Metadados externos raramente trazem CDD/CDU → pode exigir preenchimento/regra manual.
- 🟡 **Qualidade/desempate:** ISBN-10 vs ISBN-13, edicões diferentes com mesmo título, registros divergentes entre fontes → estratégia de prioridade de fontes + revisão humana.
- 🟡 **Fallback manual** sempre disponível quando o ISBN não é encontrado em nenhuma fonte.

### H. Escopo / Acesso externo (B-006)
- 🟠 O **Fluxo de Caixa é da APP** (associação de pais e mestres). Membros/pais podem **não** ter conta `@ensinablumenau`. Precisam de acesso (transparência/leitura pública)? Conflita com a premissa SSO-only (AD-004).

## Próximos passos

1. **Spike de Governança (B-004)** primeiro — sem permissão de deploy/Apps Script API no tenant, a stack A cai e vamos direto para B/C.
2. **Spike de UI/Scanner no HtmlService (B-005)** — câmera no iframe é o segundo risco que pode forçar página hospedada à parte.
3. Demais spikes de capacidade: papéis+SSO+isolamento, concorrência/auditoria, relatórios/gráficos, NFe/NFC-e (B-003).
4. **Spike Biblioteca (B-002)** — identificar o sistema e conectividade (intranet vs. internet).
5. Esclarecer **acesso externo da associação (B-006)** com o cliente.
