// cash-flow/Code.gs — cola Apps Script do Fluxo de Caixa.
//
// ARQUITETURA (crítico): este arquivo é a CAMADA FINA de integração com os
// serviços do Apps Script (SpreadsheetApp, LockService, CacheService, Session,
// PropertiesService, Utilities). TODA decisão de negócio — saldo, guardas de
// data/período, dedup de idempotência, transições de fechamento, sanitização,
// limites e formatação — é DELEGADA às funções puras de `logic.js`, que
// compartilham o escopo global no Apps Script (sem import/require) e são
// testadas isoladamente no Node (Vitest).
//
// "Hoje"/"mês corrente" vêm do relógio do servidor no fuso America/Sao_Paulo
// (via Utilities.formatDate) e são PASSADOS para as guardas puras; nunca se
// recalcula data/período inline.
//
// Padrão de dados e auth seam reusados do spike spikes/m0-roles/Code.gs.

// ===========================================================================
// Constantes
// ===========================================================================

var TZ = 'America/Sao_Paulo';
var PROP_SHEET_ID = 'CASHFLOW_SHEET_ID';

var SH_LANC = 'Lancamentos';
var SH_CONFIG = 'Config';
var SH_FECH = 'Fechamentos';
var SH_USERS = 'Usuarios';
var SH_AUD = 'Auditoria';

var ROLES = ['admin', 'tesoureiro', 'leitor'];

var LOCK_TIMEOUT_MS = 20000;       // espera máxima pelo lock de escrita
var IDEMPOTENCY_TTL_S = 21600;     // 6 h de cache de clientToken

// ===========================================================================
// Helpers de relógio (servidor, TZ America/Sao_Paulo)
// ===========================================================================

/** "Hoje" como Date à meia-noite local, derivado do relógio do servidor (TZ). */
function hoje_() {
  return parseDateBR_(Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy'));
}

/** Chave `YYYY-MM` do mês corrente (TZ). */
function mesCorrente_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
}

/** Carimbo de data/hora do servidor `dd/MM/yyyy HH:mm` (TZ). */
function nowStamp_() {
  return Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
}

// ===========================================================================
// Camada de dados (Sheets) — bootstrap da planilha + 5 abas
// ===========================================================================

/**
 * Abre a planilha de dados (id em PropertiesService `CASHFLOW_SHEET_ID`).
 * Na 1ª execução cria a planilha e as 5 abas, e persiste o id.
 */
function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* recria abaixo */ }
  }
  var ss = SpreadsheetApp.create('Fluxo de Caixa — APP (dados)');
  buildSheets_(ss);
  props.setProperty(PROP_SHEET_ID, ss.getId());
  return ss;
}

/** Atalho para uma aba por nome. */
function getSheet_(name) {
  return getSpreadsheet_().getSheetByName(name);
}

/**
 * Cria as 5 abas com os cabeçalhos EXATOS do design e remove a aba padrão.
 * Lancamentos inclui Excluido/ExcluidoPor/ExcluidoEm (soft-delete) e ClientToken
 * (idempotência); a aba Auditoria é a trilha append-only.
 */
function buildSheets_(ss) {
  var first = ss.getSheets()[0];
  var lanc = ss.insertSheet(SH_LANC);
  var config = ss.insertSheet(SH_CONFIG);
  var fech = ss.insertSheet(SH_FECH);
  var usuarios = ss.insertSheet(SH_USERS);
  var aud = ss.insertSheet(SH_AUD);
  ss.deleteSheet(first);

  lanc.getRange(1, 1, 1, 14).setValues([[
    'Id', 'Data', 'Tipo', 'Categoria', 'Valor', 'Descricao',
    'CriadoPor', 'CriadoEm', 'AlteradoPor', 'AlteradoEm',
    'Excluido', 'ExcluidoPor', 'ExcluidoEm', 'ClientToken'
  ]]).setFontWeight('bold');

  config.getRange(1, 1, 1, 4)
    .setValues([['Chave', 'Valor', 'AtualizadoPor', 'AtualizadoEm']])
    .setFontWeight('bold');

  fech.getRange(1, 1, 1, 6)
    .setValues([['Periodo', 'Status', 'FechadoPor', 'FechadoEm', 'ReabertoPor', 'ReabertoEm']])
    .setFontWeight('bold');

  usuarios.getRange(1, 1, 1, 3)
    .setValues([['Email', 'Nome', 'Papel']])
    .setFontWeight('bold');

  aud.getRange(1, 1, 1, 5)
    .setValues([['Carimbo', 'Acao', 'LancamentoId', 'Autor', 'Detalhe']])
    .setFontWeight('bold');

  // Semente do 1º admin conhecido (anti-lockout): se o SSO já resolve o e-mail.
  var me = getRealEmail_();
  if (me) usuarios.appendRow([me, 'Você (admin)', 'admin']);
}

// ===========================================================================
// Auth seam (copiado de m0-roles, SEM a simulação "ver como")
// ===========================================================================

/** E-mail real do visitante via SSO (minúsculas). Pode vir vazio na 1ª execução. */
function getRealEmail_() {
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}

/**
 * Identidade efetiva. Aqui = identidade real (o seam de "ver como" pertence à
 * feature "Papéis"); mantido como ponto de extensão.
 */
function getEffectiveEmail_() {
  return getRealEmail_();
}

/** Papel do e-mail conforme a aba Usuarios; `desconhecido` se não cadastrado. */
function roleOf_(email) {
  var u = getUsers_()[String(email).toLowerCase()];
  return u ? u.role : 'desconhecido';
}

/**
 * Barreira do servidor: garante bootstrap anti-lockout e lança se o papel
 * efetivo não estiver na lista permitida. Toda função privilegiada chama isto
 * primeiro. Retorna `{ email, role }` do caller efetivo.
 */
function requireRole_(allowed) {
  ensureBootstrapAdmin_();
  var email = getEffectiveEmail_();
  var role = roleOf_(email);
  if (allowed.indexOf(role) < 0) {
    throw new Error('Acesso negado: ação exige papel [' +
      allowed.join(' ou ') + '], mas seu papel é [' + role + '].');
  }
  return { email: email, role: role };
}

/** Mapa email → { name, role } a partir da aba Usuarios. */
function getUsers_() {
  var rows = getSheet_(SH_USERS).getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    map[String(rows[i][0]).toLowerCase()] = {
      name: String(rows[i][1]),
      role: String(rows[i][2]).toLowerCase()
    };
  }
  return map;
}

function countAdmins_(users) {
  var n = 0;
  Object.keys(users).forEach(function (e) { if (users[e].role === 'admin') n++; });
  return n;
}

function addUser_(email, name, role) {
  getSheet_(SH_USERS).appendRow([String(email).toLowerCase(), name, role]);
}

/**
 * Bootstrap anti-lockout: se NÃO há nenhum admin e o SSO conhece o usuário real,
 * promove-o a admin. Mitiga o gotcha do e-mail vazio na 1ª execução (nunca grava
 * autor `desconhecido` silenciosamente).
 */
function ensureBootstrapAdmin_() {
  var real = getRealEmail_();
  if (!real) return;
  var users = getUsers_();
  if (users[real]) return;             // já cadastrado: não mexe
  if (countAdmins_(users) > 0) return; // já existe admin: usuário novo fica 'desconhecido'
  addUser_(real, 'Você (admin)', 'admin');
}
