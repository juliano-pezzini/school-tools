/**
 * Spike M0 — Hello World de Governanca (B-004) + SSO/Scanner (B-005).
 *
 * Objetivo: comprovar EMPIRICAMENTE, na conta @ensinablumenau, se:
 *   1. e possivel IMPLANTAR um Web App do Apps Script no dominio (B-004);
 *   2. o SSO/identidade funciona (Session.getActiveUser retorna o e-mail);
 *   3. a CAMERA abre dentro do iframe sandbox do HtmlService (B-005).
 *
 * Nao usa Sheets nem Drive de proposito: isola o teste de deploy/SSO/camera
 * sem escopos OAuth extras que poderiam confundir o resultado.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Spike Hello World — Ensina Blumenau')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Retorna o e-mail de quem esta acessando (teste de SSO/identidade).
 * Com "Executar como: Eu" + acesso restrito ao dominio, deve retornar o
 * e-mail do VISITANTE (mesmo dominio), nao o do implantador.
 */
function getUsuarioAtual() {
  var email = Session.getActiveUser().getEmail();
  return email || '(vazio — getActiveUser nao retornou e-mail)';
}
