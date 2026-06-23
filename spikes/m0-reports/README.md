# Spike M0 — Capacidade de Relatórios & Gráficos

**O que este teste prova (desafio E do AD-007):**

- **Relatórios** mensal e anual do Fluxo de Caixa da APP, agregados a partir de uma planilha (Sheets).
- **Gráficos ricos** na tela (Chart.js carregado sob a CSP do HtmlService): barras, linha e rosca.
- **Insights anuais** automáticos (melhor mês, meses no vermelho, maior despesa/receita, média mensal, superávit/déficit).
- **Exportação em PDF** com link de **leitura pública** no Drive — a transparência para os pais sem conta do domínio (B-006).
- **Localização pt-BR**: R$ 1.234,56, vírgula decimal, dd/mm/aaaa, timezone `America/Sao_Paulo`.

> É um spike descartável. Na **primeira execução** ele cria sozinho uma planilha de
> exemplo com ~1 ano de lançamentos fictícios da associação de pais e mestres.
> **Nenhum dado real** é usado e nada precisa ser configurado à mão.

---

## O que estamos validando

| Pergunta de capacidade | Onde no código |
| --- | --- |
| Apps Script agrega dados do Sheets em relatórios? | `getMonthlyReport`, `getAnnualReport` em [Code.gs](Code.gs) |
| Dá para ter gráficos ricos no HtmlService? | Chart.js via CDN em [Index.html](Index.html) (com aviso se a CSP bloquear) |
| Dá para gerar insights anuais? | `buildInsights_` em [Code.gs](Code.gs) |
| Dá para exportar PDF e compartilhar? | `exportAnnualPdf` (HTML → PDF via Blob + Drive link público) |
| pt-BR funciona ponta a ponta? | `formatBRL_` / `formatDate_` (servidor) + `Intl` pt-BR (cliente) |

Se **tudo** funcionar, o desafio "Relatórios/gráficos" do AD-007 está coberto para o
Fluxo de Caixa e **não** é preciso escalar essa ferramenta para Supabase/Cloudflare.

---

## Como rodar (passo a passo)

> Pode ser feito numa **conta pessoal** do Google (o motor do Apps Script é o mesmo).
> Só a governança do tenant (B-004) precisa da conta `@ensinablumenau` — isso é o spike Hello World, não este.

1. Abra **https://script.google.com** → **Novo projeto**.
2. No arquivo `Código.gs`: apague tudo e **cole** o conteúdo de [Code.gs](Code.gs).
3. Ao lado de **Arquivos**, clique **`+`** → **HTML**, nomeie exatamente **`Index`** e **cole** o conteúdo de [Index.html](Index.html).
4. (Opcional, recomendado) Abra **Configurações do projeto** ⚙️ → marque **"Mostrar arquivo de manifesto `appsscript.json`"**, abra o `appsscript.json` e cole o conteúdo de [appsscript.json](appsscript.json) (define timezone e os escopos de Sheets/Drive).
5. **Salve** (disquete).
6. **Implantar** → **Nova implantação** → engrenagem ⚙️ → **App da Web**.
   - **Executar como:** `Eu`
   - **Quem pode acessar:** `Qualquer pessoa` (conta pessoal) ou `Qualquer pessoa em Ensina Blumenau` (tenant).
7. **Implantar** → **autorizar** (vai pedir acesso a Planilhas e Drive — é esperado, o spike cria a planilha de exemplo e o PDF).
8. Abra a **URL do App da Web**.

---

## O que conferir (resultado do teste)

1. **Relatório Mensal** carrega: KPIs (entradas, saídas, saldo do mês, acumulado), gráfico de barras por categoria e a tabela de lançamentos — tudo em **R$ pt-BR** e datas **dd/mm/aaaa**.
2. Troque **mês/ano** nos seletores → os números e gráficos atualizam.
3. **Relatório Anual**: aparecem 3 gráficos (barras entradas×saídas, linha do saldo acumulado, rosca de despesas) e a lista de **insights**.
4. **Gerar PDF e link público** → retorna um link; abra-o e confira o PDF formatado (KPIs, gráfico de saldo em SVG, tabelas e destaques). O link deve abrir **sem login**.
5. Se aparecer o aviso *"Chart.js não carregou sob a CSP"* → anote; significa que precisamos de um plano B para gráficos (ex.: imagens de Sheets charts ou SVG server-side). As tabelas e o PDF não dependem do Chart.js.

> **Para reapresentar com dados limpos:** rode a função `resetData` no editor (menu de funções → `resetData` → Executar).

---

## Notas de design

- **HTML → PDF** usa `Utilities.newBlob(html).getAs('application/pdf')` (sem libs externas). O gráfico do PDF é **SVG gerado no servidor** porque o conversor não executa JavaScript (Chart.js só roda na tela).
- O **link público de leitura** usa `DriveApp.Access.ANYONE_WITH_LINK` + `Permission.VIEW` — escrita continua restrita; só o PDF de prestação de contas é exposto (alinhado ao B-006).
- A planilha de exemplo fica guardada via `ScriptProperties` (`REPORTS_SPIKE_SHEET_ID`), então não duplica a cada execução.
