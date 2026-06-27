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
// Web entry — serve a UI pt-BR (Index.html). Padrão doGet dos spikes.
// ===========================================================================

/**
 * Ponto de entrada do Web App: devolve a página única `Index.html`. As funções
 * de negócio são chamadas a partir dela via `google.script.run`. Mantém o padrão
 * dos spikes (título + viewport) e libera o embed (XFrameOptionsMode.ALLOWALL).
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Fluxo de Caixa — APP')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

// ===========================================================================
// Helpers de escrita: lock, leitura de linhas, períodos fechados, auditoria
// ===========================================================================

/**
 * Serializa toda escrita com o lock de script. Timeout vira mensagem pt-BR.
 * Reusa o padrão de integridade em Sheets dos spikes.
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    throw new Error('Sistema ocupado, tente novamente.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Converte um valor de célula em `Date` (aceita Date ou `dd/MM/yyyy`); null se inválido. */
function toDate_(v) {
  if (v instanceof Date) return v;
  if (v == null || String(v).trim() === '') return null;
  try { return parseDateBR_(String(v)); } catch (e) { return null; }
}

/**
 * Lê todas as linhas da aba Lancamentos como objetos no formato esperado pela
 * lógica pura (Data como Date; Excluido como boolean). Inclui `_row` (número da
 * linha na planilha) para edição/exclusão.
 */
function readLancamentoRows_() {
  var values = getSheet_(SH_LANC).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    out.push({
      Id: String(r[0]),
      Data: toDate_(r[1]),
      Tipo: String(r[2]).toLowerCase(),
      Categoria: String(r[3] == null ? '' : r[3]),
      Valor: Number(r[4]) || 0,
      Descricao: String(r[5] == null ? '' : r[5]),
      CriadoPor: String(r[6] || ''),
      CriadoEm: String(r[7] || ''),
      AlteradoPor: String(r[8] || ''),
      AlteradoEm: String(r[9] || ''),
      Excluido: r[10] === true || String(r[10]).toLowerCase() === 'true',
      ExcluidoPor: String(r[11] || ''),
      ExcluidoEm: String(r[12] || ''),
      ClientToken: String(r[13] || ''),
      _row: i + 1
    });
  }
  return out;
}

/** Lista de períodos `YYYY-MM` atualmente fechados (Status = `fechado`). */
function closedPeriods_() {
  var values = getSheet_(SH_FECH).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    if (String(values[i][1]).toLowerCase() === 'fechado') out.push(String(values[i][0]));
  }
  return out;
}

/** Anexa um registro append-only à trilha de Auditoria (sempre dentro do lock). */
function appendAudit_(acao, lancamentoId, detalhe) {
  getSheet_(SH_AUD).appendRow([
    nowStamp_(), acao, String(lancamentoId || ''), getEffectiveEmail_(), String(detalhe || '')
  ]);
}

/** Resumo curto (JSON) de um lançamento sanitizado, para a coluna Detalhe. */
function resumoLancamento_(l) {
  return JSON.stringify({ data: l.data, tipo: l.tipo, valor: l.valor, categoria: l.categoria });
}

// ===========================================================================
// Lançamentos service — criação (idempotente + auditada)
// ===========================================================================

/**
 * Cria um lançamento. Ordem das barreiras: autorização → (lock) → idempotência
 * (dedup por clientToken) → guarda de data/período → sanitização/limites →
 * append da linha (CriadoPor/CriadoEm do servidor) → auditoria(`criar`).
 * Reenvio com o mesmo clientToken retorna o id existente (sucesso idempotente).
 */
function addLancamento(item, clientToken) {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var cache = CacheService.getScriptCache();
    var rows = readLancamentoRows_();
    var existingTokens = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].ClientToken) existingTokens.push({ token: rows[i].ClientToken, id: rows[i].Id });
    }
    var cachedId = clientToken ? cache.get('tok_' + clientToken) : null;
    if (cachedId) existingTokens.push({ token: String(clientToken), id: cachedId });

    // Decisão pura: token ausente lança; token repetido vira sucesso idempotente.
    var dec = dedupDecision_(existingTokens, clientToken);
    if (dec.isDup) return { ok: true, id: dec.existingId, duplicate: true };

    // Revalidação server-side (a UI é cosmética).
    var data = parseDateBR_(item && item.data);
    assertNotFuture_(data, hoje_());
    assertPeriodOpen_(data, closedPeriods_());
    var clean = sanitizeLancamento_(item);
    assertLimits_(clean);

    var id = Utilities.getUuid();
    getSheet_(SH_LANC).appendRow([
      id, formatDate_(data), clean.tipo, clean.categoria, clean.valor, clean.descricao,
      who.email, nowStamp_(), '', '', false, '', '', String(clientToken)
    ]);
    cache.put('tok_' + clientToken, id, IDEMPOTENCY_TTL_S);
    appendAudit_('criar', id, resumoLancamento_(clean));
    return { ok: true, id: id };
  });
}

// ===========================================================================
// Lançamentos service — edição e exclusão lógica (auditadas)
// ===========================================================================

/** Localiza um lançamento vivo (não excluído) por id; null se ausente. */
function findLancamentoById_(rows, id) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].Id === String(id) && !rows[i].Excluido) return rows[i];
  }
  return null;
}

/** Resumo (JSON) a partir de uma linha lida (Data como Date). */
function resumoRow_(row) {
  return resumoLancamento_({
    data: row.Data ? formatDate_(row.Data) : '',
    tipo: row.Tipo,
    valor: row.Valor,
    categoria: row.Categoria
  });
}

/**
 * Edita um lançamento de período aberto: atualiza a linha no lugar, grava
 * AlteradoPor/AlteradoEm e anexa auditoria(`editar`, antes→depois). Revalida no
 * servidor data futura, mês fechado (origem e destino) e limites de valor/texto.
 */
function editLancamento(id, item) {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var rows = readLancamentoRows_();
    var current = findLancamentoById_(rows, id);
    if (!current) throw new Error('Lançamento não encontrado.');

    var closed = closedPeriods_();
    assertPeriodOpen_(current.Data, closed);          // origem deve estar aberta

    var novaData = parseDateBR_(item && item.data);
    assertNotFuture_(novaData, hoje_());
    assertPeriodOpen_(novaData, closed);              // não mover p/ mês fechado

    var clean = sanitizeLancamento_(item);
    assertLimits_(clean);

    var antes = resumoRow_(current);
    var sheet = getSheet_(SH_LANC);
    sheet.getRange(current._row, 2, 1, 5)
      .setValues([[formatDate_(novaData), clean.tipo, clean.categoria, clean.valor, clean.descricao]]);
    sheet.getRange(current._row, 9, 1, 2).setValues([[who.email, nowStamp_()]]);

    appendAudit_('editar', id, antes + ' => ' + resumoLancamento_(clean));
    return { ok: true };
  });
}

/**
 * Exclusão LÓGICA (soft-delete): marca Excluido=true + ExcluidoPor/ExcluidoEm,
 * nunca remove a linha, e anexa auditoria(`excluir`). Revalida período aberto.
 */
function deleteLancamento(id) {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var rows = readLancamentoRows_();
    var current = findLancamentoById_(rows, id);
    if (!current) throw new Error('Lançamento não encontrado.');

    assertPeriodOpen_(current.Data, closedPeriods_());

    getSheet_(SH_LANC).getRange(current._row, 11, 1, 3)
      .setValues([[true, who.email, nowStamp_()]]);

    appendAudit_('excluir', id, resumoRow_(current));
    return { ok: true };
  });
}

// ===========================================================================
// Config (key-value) — leitura
// ===========================================================================

/** Mapa Chave→Valor da aba Config. */
function readConfigMap_() {
  var values = getSheet_(SH_CONFIG).getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    map[String(values[i][0])] = values[i][1];
  }
  return map;
}

/**
 * Config de abertura no formato esperado por `computeCashState_`:
 * `{ saldoAbertura }` se definida e numérica; `null` caso contrário
 * (a abertura é considerada indefinida → tratada como 0).
 */
function aberturaConfig_() {
  var raw = readConfigMap_()['SALDO_ABERTURA_VALOR'];
  if (raw == null || String(raw).trim() === '') return null;
  var n = Number(raw);
  return isFinite(n) ? { saldoAbertura: n } : null;
}

// ===========================================================================
// Leituras (papel inclui leitor) — delegam à lógica pura
// ===========================================================================

/** Lista de lançamentos para a UI (oculta excluídos, ordena/filtra). LANC-04/09/11. */
function listLancamentos(filtro) {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return listForView_(readLancamentoRows_(), filtro || {});
}

/** Estado do caixa (abertura + totais + saldo corrente, ignora excluídos). LANC-03. */
function getCashState() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return computeCashState_(aberturaConfig_(), readLancamentoRows_());
}

/** Categorias distintas (normalizadas) para autocomplete. LANC-06. */
function listCategorias() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return computeCategorias_(readLancamentoRows_());
}

// ===========================================================================
// Saldo service — saldo de abertura (singleton em Config)
// ===========================================================================

/**
 * Valida o valor de abertura na fronteira: aceita `>= 0` (zero permitido),
 * normaliza vírgula/ponto e arredonda a 2 casas. Vazio/não numérico/negativo
 * são rejeitados com a mensagem pt-BR do design.
 */
function parseOpeningValue_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (typeof raw !== 'number') {
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.split('.').length - 1) > 1) s = s.replace(/\./g, '');
  }
  var n = Number(s);
  if (s === '' || !isFinite(n) || n < 0) {
    throw new Error('Saldo de abertura não pode ser negativo.');
  }
  return Math.round(n * 100) / 100;
}

/**
 * Registra o saldo de abertura (uma única vez). Aceita `valor >= 0` e data
 * não-futura; rejeita se já definido. Grava `SALDO_ABERTURA_VALOR/DATA` na aba
 * Config e anexa auditoria. LANC-01.
 */
function setOpeningBalance(opts) {
  var who = requireRole_(['admin', 'tesoureiro']);
  opts = opts || {};
  return withLock_(function () {
    var existente = readConfigMap_()['SALDO_ABERTURA_VALOR'];
    if (existente != null && String(existente).trim() !== '') {
      throw new Error('O saldo de abertura já foi registrado.');
    }
    var valor = parseOpeningValue_(opts.valor);
    var data = parseDateBR_(opts.data);
    assertNotFuture_(data, hoje_());

    var stamp = nowStamp_();
    var sheet = getSheet_(SH_CONFIG);
    sheet.appendRow(['SALDO_ABERTURA_VALOR', valor, who.email, stamp]);
    sheet.appendRow(['SALDO_ABERTURA_DATA', formatDate_(data), who.email, stamp]);

    appendAudit_('criar', 'abertura', JSON.stringify({ valor: valor, data: formatDate_(data) }));
    return { ok: true };
  });
}

// ===========================================================================
// Fechamento service — fechar/reabrir mês (transições delegadas à lógica pura)
// ===========================================================================

/** Localiza a linha de Fechamentos de um período; null se inexistente (= aberto). */
function findFechamentoRow_(periodo) {
  var values = getSheet_(SH_FECH).getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(periodo)) {
      return { row: i + 1, status: String(values[i][1]).toLowerCase() };
    }
  }
  return null;
}

/** Lista os períodos atualmente fechados com quem/quando. LANC-07. */
function listClosedPeriods() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  var values = getSheet_(SH_FECH).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    if (String(values[i][1]).toLowerCase() !== 'fechado') continue;
    out.push({
      periodo: String(values[i][0]),
      status: 'fechado',
      fechadoPor: String(values[i][2] || ''),
      fechadoEm: String(values[i][3] || ''),
      reabertoPor: String(values[i][4] || ''),
      reabertoEm: String(values[i][5] || '')
    });
  }
  return out;
}

/**
 * Fecha um mês `<=` corrente. Mês futuro é rejeitado pela decisão pura; já
 * fechado é no-op idempotente. Cria/atualiza a linha e audita o fechamento.
 * LANC-07.
 */
function closeMonth(periodo) {
  var who = requireRole_(['admin', 'tesoureiro']);
  periodo = String(periodo);
  return withLock_(function () {
    var found = findFechamentoRow_(periodo);
    var status = found ? found.status : 'aberto';
    var dec = closeDecision_(periodo, status, mesCorrente_()); // lança se mês futuro
    if (!dec.changed) return { ok: true, jaFechado: true };

    var stamp = nowStamp_();
    var sheet = getSheet_(SH_FECH);
    if (found) {
      sheet.getRange(found.row, 2).setValue('fechado');
      sheet.getRange(found.row, 3, 1, 2).setValues([[who.email, stamp]]);
    } else {
      sheet.appendRow([periodo, 'fechado', who.email, stamp, '', '']);
    }
    appendAudit_('editar', 'fechamento:' + periodo, JSON.stringify({ acao: 'fechar', periodo: periodo }));
    return { ok: true };
  });
}

/**
 * Reabre um mês fechado (já aberto = no-op idempotente). Grava
 * ReabertoPor/ReabertoEm preservando o registro de fechamento, e audita. LANC-08.
 */
function reopenMonth(periodo) {
  var who = requireRole_(['admin', 'tesoureiro']);
  periodo = String(periodo);
  return withLock_(function () {
    var found = findFechamentoRow_(periodo);
    var status = found ? found.status : 'aberto';
    var dec = reopenDecision_(periodo, status);
    if (!dec.changed) return { ok: true, jaAberto: true };

    var stamp = nowStamp_();
    var sheet = getSheet_(SH_FECH);
    sheet.getRange(found.row, 2).setValue('aberto');
    sheet.getRange(found.row, 5, 1, 2).setValues([[who.email, stamp]]);
    appendAudit_('editar', 'fechamento:' + periodo, JSON.stringify({ acao: 'reabrir', periodo: periodo }));
    return { ok: true };
  });
}
