# Teste rápido de permissões — para a diretora

**Para quê:** as ferramentas da escola usam recursos do Google Workspace. Este teste
de poucos minutos mostra se a conta da escola permite esses recursos ou se a
Prefeitura bloqueou. **Não precisa entender de tecnologia** — é só seguir os passos e
nos contar o que apareceu (de preferência com um **print da tela**).

> Faça tudo **logada com a conta `@ensinablumenau.sc.gov.br`** (a conta da escola).

---

## Teste 1 — Publicar um "aplicativo web" (Apps Script)

1. Abra o site **https://script.google.com** (logada com a conta da escola).
2. Clique em **Novo projeto**.
3. Apague o texto que aparece e cole exatamente isto:
   ```
   function doGet() {
     return ContentService.createTextOutput('ok');
   }
   ```
4. Clique no botão **Implantar** (canto superior direito) → **Nova implantação**.
5. Em "Selecionar tipo" (ícone de engrenagem), escolha **App da Web**.
6. Em **Executar como**, deixe **Eu**. Em **Quem tem acesso**, escolha
   **Qualquer pessoa**.
7. Clique em **Implantar**. Se pedir para **autorizar/permitir**, siga e permita.
8. **O que observar e nos contar:**
   - Conseguiu concluir e apareceu uma **URL** (link) no final? ✅
   - Ou apareceu alguma mensagem de **bloqueio** tipo "ação bloqueada pelo
     administrador" / "app não verificado" que **não deixou continuar**? ❌
   - (Se quiser, copie a URL e abra numa aba nova — deve aparecer a palavra **ok**.)

---

## Teste 2 — Compartilhar um arquivo com alguém de fora da escola

1. Abra o **Google Drive** (https://drive.google.com), logada com a conta da escola.
2. Crie um documento qualquer (**Novo → Documentos Google**) e dê um nome.
3. Clique em **Compartilhar**.
4. Digite um **e-mail pessoal** (um Gmail comum, **fora** do `@ensinablumenau`) e
   tente enviar.
5. **O que observar e nos contar:**
   - Deixou compartilhar normalmente? ✅
   - Ou apareceu aviso de que **não é permitido compartilhar fora da organização**? ❌

---

## O que enviar de volta

Para cada teste, diga apenas: **funcionou** ou **bloqueou** — e, se possível, mande
um **print** da tela (especialmente se aparecer mensagem de bloqueio).

Com isso já sabemos o que a conta da escola permite. Obrigado!
