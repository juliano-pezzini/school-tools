// portal/Code.gs — Portal principal das Ferramentas Escolares.
//
// Serve a página Index.html como web app Google Apps Script.
// Requer autenticação pelo Google Workspace do domínio.

var DOMAIN = 'ensinablumenau.sc.gov.br';

// Contas extras autorizadas (ex.: ambiente de desenvolvimento) além do domínio.
// Configure via repo variable PORTAL_ALLOWED_EMAILS (injetada no deploy) ou
// via Script Property ALLOWED_EMAILS (sobrepõe o default). Lista por vírgula.
var ALLOWED_EMAILS_DEFAULT = 'REPLACE_WITH_ALLOWED_EMAILS';

function _parseEmails(raw) {
  return (raw || '').split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(String);
}

function _allowedEmails() {
  var prop = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS');
  var list = _parseEmails(prop);
  return list.length ? list : _parseEmails(ALLOWED_EMAILS_DEFAULT);
}

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------

function doGet(e) {
  var user = Session.getActiveUser().getEmail();
  if (!user || (!user.endsWith('@' + DOMAIN) && _allowedEmails().indexOf(user.toLowerCase()) === -1)) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:system-ui;padding:2rem">Acesso restrito ao domínio @' + DOMAIN + '</p>'
    );
  }

  var tpl = HtmlService.createTemplateFromFile('Index');
  tpl.userEmail = user;
  tpl.userInitials = _initials(user);
  tpl.firstName = _firstName(user);

  return tpl.evaluate()
    .setTitle('Ferramentas Escolares')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _initials(email) {
  var parts = email.split('@')[0].split('.');
  return parts.slice(0, 2).map(function(p) { return p[0].toUpperCase(); }).join('');
}

function _firstName(email) {
  var local = email.split('@')[0];
  var name  = local.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
