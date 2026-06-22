/**
 * Proxy NFe — Apps Script Web App.
 *
 * Por que existe: o consultadanfe.com bloqueia chamadas diretas do navegador
 * (CORS "Origem nao autorizada"). Chamado pelo servidor (sem header Origin) funciona.
 * Este Web App recebe a chave do front, consulta o consultadanfe via UrlFetchApp
 * e devolve o JSON (com xml_base64 = itens + valores).
 *
 * Deploy:
 *   1. script.google.com -> Novo projeto -> cole este arquivo.
 *   2. Implantar -> Nova implantacao -> tipo "App da Web".
 *      - Executar como: Eu (sua conta)
 *      - Quem tem acesso: Qualquer pessoa
 *   3. Copie a URL /exec e abra a pagina de teste assim:
 *      https://juliano-pezzini.github.io/school-tools/nota/?proxy=<URL_/exec>
 *
 * Observacao: o front chama via GET (?chave=...) quando aponta para este proxy,
 * evitando preflight CORS e o problema de redirect de POST do Apps Script.
 */

var CONSULTADANFE_URL = 'https://consultadanfe.com/api/v1/consulta';

function doGet(e) {
  var chave = (e && e.parameter && e.parameter.chave)
    ? String(e.parameter.chave).replace(/\D/g, '') : '';
  if (!chave) {
    return _json({ status: 'ok', message: 'Proxy NFe ativo. Use ?chave=<44 digitos>.' });
  }
  return _consultar(chave);
}

function doPost(e) {
  var chave = '';
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    chave = String(body.chave || '').replace(/\D/g, '');
  } catch (err) {
    return _json({ status: 'erro', error: 'body_invalido', message: String(err) });
  }
  return _consultar(chave);
}

function _consultar(chave) {
  if (!/^\d{44}$/.test(chave)) {
    return _json({ status: 'erro', error: 'chave_invalida', message: 'Chave precisa ter 44 digitos.' });
  }
  try {
    var resp = UrlFetchApp.fetch(CONSULTADANFE_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chave: chave }),
      muteHttpExceptions: true,
    });
    var texto = resp.getContentText();
    // Repassa o corpo do consultadanfe como esta (ja e JSON).
    return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return _json({ status: 'erro', error: 'falha_backend', message: String(err) });
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
