# State

**Last Updated:** 2026-06-20
**Current Work:** M0 — Discovery & Platform Spikes (no feature started yet)

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

---

## Active Blockers

### B-001: Plataforma ainda não decidida

**Discovered:** 2026-06-20
**Impact:** Bloqueia o design detalhado das três ferramentas — define hospedagem, SSO, custo e manutenção.
**Workaround:** Nenhum; seguir com spikes do M0 antes de especificar features.
**Resolution:** Concluir "Decisão de Plataforma" no M0 e registrar como AD.

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

- [ ] M0: Comparar Google Workspace nativo x Supabase (cota gratuita) e registrar AD da plataforma.
- [ ] M0: Confirmar form factor do app de banco de horas (PWA responsivo vs. outro) com SSO Google.
- [ ] M0: Validar leitura/parsing de NFC-e (chave de acesso, SEFAZ-SC) sem barreiras de certificado.

---

## Preferences

**Model Guidance Shown:** never
