# Roadmap

**Current Milestone:** M0 — Discovery & Platform Spikes
**Status:** Planning

---

## M0 — Discovery & Platform Spikes

**Goal:** Reduzir os riscos técnicos e **decidir a plataforma** antes de construir qualquer ferramenta. Cada spike é uma prova de conceito descartável com uma decisão registrada em STATE.md.
**Target:** Plataforma escolhida (AD) + viabilidade confirmada/descartada para cada integração arriscada.

### Spikes

**Decisão de Plataforma** - PLANNED

- Comparar Google Workspace nativo (Sheets/Forms/Apps Script) x Supabase (cota gratuita) + frontend estático.
- Critérios: custo recorrente, esforço de manutenção, autonomia do usuário, SSO Google, limites das cotas gratuitas.

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
