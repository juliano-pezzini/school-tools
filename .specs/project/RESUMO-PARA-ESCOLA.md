# Resumo do projeto — para conferir com a equipe da escola

**Data:** 21/06/2026
**Objetivo deste documento:** alinhar com a equipe da escola o que já foi
levantado/testado e, principalmente, **confirmar as dúvidas em aberto** antes de
construir as ferramentas.

> Observação: este é um resumo em linguagem simples. Os detalhes técnicos completos
> ficam nos arquivos de planejamento do projeto.

---

## 1. As três ferramentas

1. **Fluxo de Caixa** (Associação de Pais e Mestres / APP) — registrar despesas e
   receitas, com captura automática de **notas fiscais** (NFe e NFC-e).
2. **Banco de Horas** (servidores) — controle de horas extras/compensação.
3. **Cadastro de Livros da Biblioteca** — automatizar a inclusão de livros no
   sistema de catálogo da escola.

---

## 2. Princípios que estamos seguindo

- **Custo quase zero**: usar o que a escola já tem (Google Workspace Education) e
  serviços gratuitos. Sem servidores caros.
- **Fácil de operar**: a equipe usa as ferramentas no dia a dia sem depender do
  desenvolvedor.
- **Login com a conta Google da escola** (`@ensinablumenau.sc.gov.br`) nas áreas
  protegidas.
- **Arquivos no Google Drive** da escola (fotos de comprovantes, PDFs de relatório).

---

## 3. O que já está confirmado (testado de verdade)

- ✅ **Leitura de código de barras / QR pela câmera do celular funciona.**
  Testado em celular real: leu o **ISBN** de livros e o **QR/código** de notas
  fiscais corretamente.
- ✅ **Notas fiscais sem precisar de certificado digital pago:**
  - **NFe (a nota "DANFE" em papel A4):** conseguimos puxar **fornecedor, itens e
    valor total** automaticamente, para notas **do mês corrente**.
  - **NFC-e (o cupom com QR Code):** o QR abre a nota no site da SEFAZ-SC mostrando
    **itens e valor, sem captcha**.
- ✅ **Nome do fornecedor** vem automático a partir do CNPJ (serviço gratuito).

---

## 4. ⭐ O que precisamos que a escola confirme

Esta é a parte mais importante. Sem estas respostas, não conseguimos avançar em
alguns pontos.

### A) Biblioteca — qual sistema vocês usam?
Descobrimos que a Biblioteca **Municipal** de Blumenau usa o sistema *Pergamum*, mas
**a biblioteca da escola não aparece nessa base** — ou seja, a escola usa **outro
sistema**. Precisamos saber:
1. **Qual programa** a bibliotecária usa para cadastrar os livros? (nome do
   sistema, ou o endereço/site, ou uma foto da tela)
2. O cadastro é feito **pelo navegador** (Chrome/Edge) ou é um **programa instalado
   no computador** (desktop)?
3. O sistema permite **importar o livro pelo ISBN** (puxa título/autor/capa sozinho)
   ou a bibliotecária digita tudo à mão?

### B) Permissões da conta Google — um teste prático com a diretora
A ferramenta depende de algumas permissões no Google Workspace da escola. Em vez de
abrir um chamado com a TI da Prefeitura, é mais rápido a **diretora fazer um teste**
com a conta da escola e nos dizer se funcionou ou se apareceu algum bloqueio. Vamos
preparar um passo a passo simples (poucos cliques) para ela:
1. Entrar no Google Apps Script com a conta `@ensinablumenau` e tentar **publicar um
   "aplicativo web"** de teste — ver se conclui ou se aparece mensagem de bloqueio;
2. Tentar **compartilhar um arquivo** do Drive da escola com um e-mail de fora do
   domínio — ver se deixa ou se bloqueia.

Com o resultado desse teste sabemos o que é permitido, sem depender da TI.

### C) Fluxo de Caixa — acesso dos pais/associação
1. ✅ **Já confirmado:** os **pais/membros da APP** (sem conta `@ensinablumenau`)
   **vão precisar consultar os relatórios** (prestação de contas). Como eles não têm
   login do domínio, a transparência será por um **relatório de leitura pública**
   (página/PDF acessível por link, sem necessidade de login).
2. ✅ **Já confirmado:** as despesas **costumam ser lançadas nos primeiros dias do
   mês seguinte** ao da nota — ou seja, **dentro da janela** que o serviço gratuito
   cobre (mês corrente, e o mês anterior até o dia 15). **Plano B** para os casos que
   não funcionarem: a ferramenta mostra **fornecedor e data** e pede a **digitação do
   valor total** (sem detalhar os itens).

### D) Banco de Horas
1. Como funciona hoje a regra de horas extras/compensação (quem aprova, limites,
   prazos)?
2. A ferramenta será usada mais no **celular** ou no **computador**?

---

## 5. Pendências que dependem de acesso da escola

Para concluir a validação técnica, precisaremos, em algum momento, de:
- A **diretora rodar o teste prático** de permissões com a conta `@ensinablumenau`
  (item B acima).
- Um **acesso/print do sistema da biblioteca** (item A acima).

---

## 6. Pontos de atenção (para vocês saberem)

- O caminho **gratuito** de notas fiscais depende de serviços de terceiros que
  podem mudar regras. Se um dia precisarmos de mais robustez (notas antigas, muitos
  cupons automáticos), existe uma opção paga barata (centavos por consulta).
- Para a NFC-e (cupom), os **itens aparecem na tela** do site da SEFAZ; a captura
  100% automática dos itens do cupom é uma evolução futura — na primeira versão o
  usuário confere os itens na tela.

---

## 7. Próximo passo sugerido

Levar as perguntas da **Seção 4** para a equipe (bibliotecária, tesoureiro/APP e a
diretora, que faz o teste de permissões). Com as respostas, fechamos o planejamento
e começamos a construir.
