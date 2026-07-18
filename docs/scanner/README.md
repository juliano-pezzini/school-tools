# Scanner — Leitor ao vivo (GitHub Pages)

Página estática de scanner que roda **fora** do iframe do Apps Script, então tem acesso à
câmera (`getUserMedia`) e faz **leitura ao vivo** de código de barras / QR com ZXing.
Devolve o código lido ao app do Apps Script.

> **Por que existe:** o HtmlService bloqueia `getUserMedia` (Permissions Policy do iframe sem
> `allow="camera"`), e leitura por foto estática se mostrou pouco confiável (ZXing não detecta).
> Ver finding do B-005 em `.specs/project/STATE.md`. Esta página resolve isso (AD-008).

## Modos de operação

### Modo legado (padrão)

URL: `?return=<URL_DO_EXEC>`

Ao escanear um código, redireciona de volta para o Apps Script com o valor bruto:
`<URL_DO_EXEC>?code=<codigo_lido>`

### Modo NFe (`?mode=nfe`)

URL: `?mode=nfe&return=<URL_DO_EXEC>`

Neste modo o scanner:
1. Lê o QR/barras da nota fiscal (NFe 44 dígitos ou NFC-e URL com chave).
2. Valida a chave de acesso (check-digit mod 11).
3. Consulta o proxy SEFAZ para extrair dados da nota.
4. Redireciona de volta com `?scanData=<JSON_base64url>` em vez de `?code=`.

Se a consulta falhar (rede offline, nota antiga), retorna dados parciais extraídos
da própria chave (UF, data de emissão, CNPJ emitente) e marca `"partial": true`.

#### Parâmetro `?proxy=URL`

Por padrão o scanner usa o proxy Apps Script configurado no código. Para sobrescrever
(útil em dev/teste), passe `?proxy=<URL_do_proxy>` na query string.

#### Formato `scanData` (JSON)

```json
{
  "chave": "43260712345678000195550010000012341000012348",
  "tipo": "saida",
  "valor": 123.45,
  "data": "2026-07-10",
  "fornecedor": "FORNECEDOR LTDA",
  "itens": "2x Produto A; 1x Produto B",
  "partial": false
}
```

| Campo        | Tipo    | Descrição                                     |
|------------- |---------|-----------------------------------------------|
| `chave`      | string  | Chave de acesso (44 dígitos)                  |
| `tipo`       | string  | Sempre `"saida"`                              |
| `valor`      | number  | Valor total da nota (null se parcial)         |
| `data`       | string  | Data de emissão YYYY-MM-DD                    |
| `fornecedor` | string  | Razão social do emitente                      |
| `itens`      | string  | Resumo dos itens (pode ser vazio se parcial)  |
| `partial`    | boolean | `true` se dados são incompletos (fallback)    |

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

No modo NFe, o passo 2 envia `?scanData=<base64url>` em vez de `?code=`.

Tudo continua grátis e na stack A: dados, SSO e telas no Apps Script; só o **scanner** é um
satélite estático no Pages.

## O que este spike comprova

- [x] Câmera ao vivo abre na página hospedada (fora do iframe).
- [x] ZXing lê EAN-13/ISBN ao vivo de forma confiável.
- [x] ZXing lê QR (para NFC-e) ao vivo.
- [x] Round-trip `?return=` → `?code=` devolve o valor ao Apps Script.
