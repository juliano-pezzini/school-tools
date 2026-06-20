# Spike M0 — Hello World de Governança

**O que este teste prova (de uma vez só):**

- **B-004 (Governança):** a conta `@ensinablumenau` consegue **implantar um Web App** do Apps Script?
- **SSO / identidade:** a página mostra o e-mail de quem acessa?
- **B-005 (Scanner):** a **câmera** abre dentro do iframe do Apps Script?

> É só um "olá mundo". Não usa planilhas nem arquivos — serve apenas para
> descobrir se a plataforma funciona na conta da escola **antes** de construir os apps de verdade.

---

## Guia para a diretora da escola (passo a passo)

> Leva ~10 minutos. Se travar em algum passo, **tire um print** e mande — o erro já é uma resposta útil.

**Antes de começar:** entre **somente** na conta da escola (`@ensinablumenau.sc.gov.br`). Se houver outra conta Google logada, saia dela.

1. Abra **https://script.google.com**
2. Clique em **Novo projeto**
3. No arquivo `Código.gs` (ou `Code.gs`): apague tudo que estiver lá e **cole** o conteúdo do arquivo [`Code.gs`](Code.gs).
4. No menu da esquerda, ao lado de **Arquivos**, clique no **`+`** → **HTML**. Dê o nome exatamente **`Index`** (sem `.html`). Apague o conteúdo dele e **cole** o conteúdo de [`Index.html`](Index.html).
5. Clique no ícone de **salvar** (disquete).
6. No canto superior direito, clique em **Implantar** → **Nova implantação**.
7. Clique na engrenagem ⚙️ e escolha **App da Web**.
8. Configure assim:
   - **Executar como:** `Eu`
   - **Quem pode acessar:** `Qualquer pessoa em Ensina Blumenau`
9. Clique em **Implantar**.
10. Vai pedir para **autorizar o acesso** → escolha a conta da escola.
    - ⚠️ **Se aparecer** algo como *"O Google não verificou este app"* **ou** uma mensagem do **administrador bloqueando** → **tire um print, anote a mensagem exata e pare aqui.** Esse aviso já é o resultado do teste.
11. Se autorizou, copie a **URL do app da Web** que aparece no final.
12. Abra essa URL **no celular** (logada na conta da escola).
13. Confira se aparece **seu e-mail** no topo e clique em **Testar câmera** → permita o acesso.

---

## O que reportar de volta (com prints)

1. **Conseguiu implantar?** (sim / não / travou no passo X)
2. **Apareceu algum aviso ou bloqueio?** Qual a mensagem exata?
3. **O e-mail apareceu certo?** (era o seu e-mail mesmo?)
4. **A câmera abriu?** (apareceu "SUCESSO" ou "FALHOU"? Qual mensagem?)
5. O que o bloco **"Diagnóstico do ambiente"** mostrou?

> **Bônus (teste de SSO real):** peça para **outra pessoa da escola** abrir a mesma URL.
> O e-mail no topo deve mudar para o e-mail **dela** — isso confirma que a identidade funciona para qualquer usuário do domínio.

---

## Alternativa mais fácil (se o dev preparar)

Em vez de colar código, o desenvolvedor pode criar este projeto numa conta própria,
compartilhar o link e a diretora só precisa **Fazer uma cópia** e depois **Implantar**
(pulando os passos 2 a 5). O resultado do teste de governança é o mesmo, pois o que importa
é a **implantação na conta da escola**.
