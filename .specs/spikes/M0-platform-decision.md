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
- 🟠 Distinguir **NFC-e** (QR) de **NFe** (DANFE Code-128 + chave de 44 dígitos).
- 🔴 O que é extraível **sem certificado A1/A3**: URL do QR → página SEFAZ-SC (possível captcha); dados embutidos na própria chave (CNPJ/UF/valor parcial).
- 🟡 **Fallback manual** sempre disponível.

### G. Robô da Biblioteca (detalha B-002)
- 🔴 O sistema de catálogo é **intranet-only** (rede gov)? Se sim, Playwright só roda em **PC local** (GitHub Actions não alcança).
- 🟠 Login com **captcha/2FA**? Estabilidade de seletores; rate limiting / anti-bot.
- 🟡 Cobertura de **metadados de ISBN brasileiros** (Google Books/Open Library) + fallback manual.
- 🟡 **Orquestração** celular→fila→Playwright (trigger, deduplicação, feedback de erro ao usuário).

### H. Escopo / Acesso externo (B-006)
- 🟠 O **Fluxo de Caixa é da APP** (associação de pais e mestres). Membros/pais podem **não** ter conta `@ensinablumenau`. Precisam de acesso (transparência/leitura pública)? Conflita com a premissa SSO-only (AD-004).

## Próximos passos

1. **Spike de Governança (B-004)** primeiro — sem permissão de deploy/Apps Script API no tenant, a stack A cai e vamos direto para B/C.
2. **Spike de UI/Scanner no HtmlService (B-005)** — câmera no iframe é o segundo risco que pode forçar página hospedada à parte.
3. Demais spikes de capacidade: papéis+SSO+isolamento, concorrência/auditoria, relatórios/gráficos, NFe/NFC-e (B-003).
4. **Spike Biblioteca (B-002)** — identificar o sistema e conectividade (intranet vs. internet).
5. Esclarecer **acesso externo da associação (B-006)** com o cliente.
