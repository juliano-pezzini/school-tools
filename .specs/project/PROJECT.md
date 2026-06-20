# School Tools — Ferramentas para a Escola de Ensino Básico

**Vision:** Conjunto de ferramentas simples e de baixíssimo custo de manutenção que automatizam tarefas administrativas do dia a dia de uma escola pública de ensino básico (Blumenau/SC).
**For:** Profissionais da educação sem experiência em software (atualmente só usam ferramentas básicas de escritório, como por exemplo Word, Excel), autenticados pelo Google Workspace municipal (`@ensinablumenau.sc.gov.br`).
**Solves:** Tarefas manuais, repetitivas e propensas a erro — controle do caixa da APP (associação de pais e mestres), banco de horas dos funcionários e catalogação de livros da biblioteca.

## Goals

- **Custo de manutenção próximo de zero:** preferir plataformas já licenciadas/gratuitas (Google Workspace Education, cotas gratuitas) e evitar hospedagem paga, servidores e dependências que apodreçam sem manutenção.
- **Autonomia do usuário final:** as pessoas devem operar e se virar sozinhas sem o desenvolvedor por perto. Sucesso = uso recorrente sem suporte técnico.
- **Login sem fricção (SSO em todos os sistemas):** as três ferramentas exigem autenticação via Google Workspace SSO (`@ensinablumenau.sc.gov.br`), reaproveitando as contas que todos já possuem, sem cadastro/senha novos. **Única exceção:** páginas externas/públicas específicas que, por natureza, não exigem autenticação.
- **Entregar valor incrementalmente:** cada uma das três ferramentas é um incremento entregável de forma independente. Também podem ser entregues de forma parcial, para acelerar a coleta de contribuições, críticas e possíveis problemas.

## Tech Stack

**Status:** _Indefinido — a ser decidido via spikes no Milestone 0 (ver ROADMAP)._

**Candidatos em avaliação:**

- Google Workspace nativo (Sheets + Forms + Apps Script) — custo zero, SSO embutido, "é só uma planilha" se o dev sumir.
- Supabase (cota gratuita) + frontend web estático gratuito (ex.: GitHub Pages) — mais flexível, porém mais superfície de manutenção.
- Playwright (RPA) para automação do sistema web de biblioteca que não possui API.

**Convenção de idioma:** UI e documentação para o usuário em **pt-BR**; código e identificadores em **inglês**.

## Scope

**v1 inclui (três ferramentas independentes):**

- **Fluxo de Caixa (APP):** lançamentos de entrada/saída, saldo, papéis (admin / tesoureiro / leitor), anexo de comprovantes, relatório mensal e relatório anual com gráficos/insights, e leitura de código de barras/QR com integração às notas NFe/NFC-e para preencher despesas.
- **Banco de Horas:** gestor lança horas extras/compensadas dos funcionários; funcionário consulta o saldo em app mobile.
- **Robô da Biblioteca:** escanear ISBN/código de barras pela câmera do celular, buscar título/autor/editora automaticamente e cadastrar no catálogo (sistema web existente, sem API) via automação Playwright.

**Explicitamente fora de escopo (v1):**

- Hospedagem própria paga, infraestrutura de servidor dedicada ou banco de dados auto-gerenciado.
- App mobile nativo publicado em lojas (preferir PWA/web responsivo, a confirmar no spike).
- Integração entre as três ferramentas (são produtos independentes por enquanto).
- Folha de pagamento, cálculo legal/trabalhista do banco de horas e emissão fiscal.

## Constraints

- **Resources:** orçamento muito limitado; custo recorrente deve tender a zero. Manutenção mínima — o desenvolvedor não acompanhará de perto em produção.
- **Technical:** usuários sem conhecimento técnico (só dominam o Word; nem o key-user sabe Excel). Toda solução precisa de UI familiar (formulário/planilha) e operação autônoma.
- **Platform:** Google Workspace Education já licenciado para o município; todos os usuários já têm conta Google ativa.
- **Auth:** Google Workspace SSO obrigatório em todas as áreas autenticadas das três ferramentas; somente páginas externas/públicas explicitamente marcadas dispensam login.
