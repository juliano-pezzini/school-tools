# Spike — Scanner ao vivo (Plano B do B-005)

Página estática de scanner que roda **fora** do iframe do Apps Script, então tem acesso à
câmera (`getUserMedia`) e faz **leitura ao vivo** de código de barras / QR com ZXing.
Devolve o código lido ao app do Apps Script.

> **Por que existe:** o HtmlService bloqueia `getUserMedia` (Permissions Policy do iframe sem
> `allow="camera"`), e leitura por foto estática se mostrou pouco confiável (ZXing não detecta).
> Ver finding do B-005 em `.specs/project/STATE.md`. Esta página resolve isso (AD-008).

## Como publicar no GitHub Pages (grátis, HTTPS)

1. No GitHub: **Settings → Pages**.
2. **Source:** `Deploy from a branch`.
3. **Branch:** `main` · **Folder:** `/docs` · **Save**.
4. Aguarde ~1 min. A página fica em:
   `https://juliano-pezzini.github.io/school-tools/scanner/`
5. Abra essa URL **no celular** e teste o scan ao vivo de um ISBN/código de barras.

> HTTPS é obrigatório para a câmera. `localhost` também é contexto seguro (dá para testar no PC),
> mas o celular precisa da URL pública do Pages.

## Como integra com o Apps Script (round-trip)

1. O web app (Apps Script) abre o scanner passando para onde voltar:
   `https://juliano-pezzini.github.io/school-tools/scanner/?return=<URL_DO_EXEC>`
2. O usuário escaneia; ao tocar **Enviar para o app**, a página redireciona para:
   `<URL_DO_EXEC>?code=<codigo_lido>`
3. No Apps Script, `doGet(e)` lê `e.parameter.code` e preenche o lançamento/cadastro.

Tudo continua grátis e na stack A: dados, SSO e telas no Apps Script; só o **scanner** é um
satélite estático no Pages.

## O que este spike comprova

- [ ] Câmera ao vivo abre na página hospedada (fora do iframe).
- [ ] ZXing lê EAN-13/ISBN ao vivo de forma confiável.
- [ ] ZXing lê QR (para NFC-e) ao vivo.
- [ ] Round-trip `?return=` → `?code=` devolve o valor ao Apps Script.
