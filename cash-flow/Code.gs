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
var PROP_COMPROVANTES_FOLDER = 'COMPROVANTES_FOLDER_ID';
var COMPROVANTES_FOLDER_NAME = 'Fluxo de Caixa — Comprovantes';

var SH_LANC = 'Lancamentos';
var SH_CONFIG = 'Config';
var SH_FECH = 'Fechamentos';
var SH_USERS = 'Usuarios';
var SH_AUD = 'Auditoria';

var ROLES = ['admin', 'tesoureiro', 'leitor'];

var LOCK_TIMEOUT_MS = 20000;       // espera máxima pelo lock de escrita
var IDEMPOTENCY_TTL_S = 21600;     // 6 h de cache de clientToken

var _ssCache = null; // memoização por-execução de getSpreadsheet_

// TTLs do CacheService para abas de baixa mutação (segundos).
var CACHE_TTL_USERS = 60;          // Usuarios: raramente muda
var CACHE_TTL_CONFIG = 60;         // Config: muda só em set/update/clearOpening
var CACHE_TTL_FECH = 120;          // Fechamentos: muda só em close/reopenMonth
var CACHE_KEY_USERS = 'c_users';
var CACHE_KEY_CONFIG = 'c_config';
var CACHE_KEY_FECH = 'c_fech';

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
    .setFaviconUrl('https://cdn.jsdelivr.net/gh/juliano-pezzini/school-tools@main/cash-flow/favicon.png')
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
  if (_ssCache) return _ssCache;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    // Já existe uma planilha configurada: NUNCA criar outra silenciosamente
    // (isso "orfanaria" os dados). Falha de abertura vira erro explícito.
    try {
      _ssCache = SpreadsheetApp.openById(id);
      return _ssCache;
    } catch (e) {
      throw new Error('Não foi possível abrir a planilha de dados (id ' + id +
        '). Verifique o acesso ou ajuste a propriedade ' + PROP_SHEET_ID +
        ' com setDataSpreadsheetId(id).');
    }
  }
  // Sem id configurado: 1ª execução cria a planilha e persiste o id.
  var ss = SpreadsheetApp.create('Fluxo de Caixa — APP (dados)');
  buildSheets_(ss);
  props.setProperty(PROP_SHEET_ID, ss.getId());
  _ssCache = ss;
  return _ssCache;
}

/**
 * Admin/diagnóstico: informa qual planilha de dados está ATIVA (a que o app lê).
 * Rode no editor do Apps Script para confirmar se aponta para a planilha certa.
 * Retorna `{ id, url, nome }`.
 */
function getDataSpreadsheetInfo() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
  if (!id) return { id: null, url: null, nome: null };
  var ss = SpreadsheetApp.openById(id);
  var info = { id: id, url: ss.getUrl(), nome: ss.getName() };
  Logger.log(JSON.stringify(info));
  return info;
}

/**
 * Admin/correção: aponta o app para uma planilha de dados específica (a que
 * contém seus lançamentos). Pegue o id da URL da planilha certa
 * (.../spreadsheets/d/ESTE_ID/edit) e rode `setDataSpreadsheetId('ESTE_ID')`
 * uma única vez no editor do Apps Script. Valida que a planilha abre e tem a
 * aba `Lancamentos` antes de gravar.
 */
function setDataSpreadsheetId(id) {
  id = String(id || '').trim();
  if (!id) throw new Error('Informe o id da planilha.');
  var ss = SpreadsheetApp.openById(id); // lança se inválida/sem acesso
  if (!ss.getSheetByName(SH_LANC)) {
    throw new Error('A planilha não tem a aba "' + SH_LANC + '". Id incorreto?');
  }
  PropertiesService.getScriptProperties().setProperty(PROP_SHEET_ID, id);
  return { ok: true, id: id, url: ss.getUrl(), nome: ss.getName() };
}

/**
 * Admin/diagnóstico: despeja EXATAMENTE o que o app lê da aba Lancamentos —
 * qual planilha, quantas linhas, e para cada linha o valor cru de Data, seu
 * tipo e o período `YYYY-MM` calculado. Rode no editor e veja o Log (Ctrl+Enter).
 */
function debugLancamentos() {
  var info = getDataSpreadsheetInfo();
  var sheet = getSheet_(SH_LANC);
  var rawRows = sheet ? sheet.getDataRange().getValues().length - 1 : -1;
  var rows = readLancamentoRows_();
  var amostra = rows.slice(0, 30).map(function (r) {
    var periodo;
    try { periodo = periodKey_(r.Data); } catch (e) { periodo = 'ERRO: ' + e.message; }
    return {
      Id: r.Id,
      dataCru: String(r.Data),
      dataTipo: (r.Data instanceof Date ? 'Date' : (r.Data == null ? 'null' : typeof r.Data)),
      periodo: periodo,
      tipo: r.Tipo,
      valor: r.Valor,
      excluido: r.Excluido
    };
  });
  var res = {
    planilha: info,
    linhasBrutas: rawRows,
    linhasLidas: rows.length,
    mesCorrenteServidor: mesCorrente_(),
    amostra: amostra
  };
  Logger.log(JSON.stringify(res, null, 2));
  return res;
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

  lanc.getRange(1, 1, 1, 16).setValues([[
    'Id', 'Data', 'Tipo', 'Categoria', 'Valor', 'Descricao',
    'CriadoPor', 'CriadoEm', 'AlteradoPor', 'AlteradoEm',
    'Excluido', 'ExcluidoPor', 'ExcluidoEm', 'ClientToken',
    'ComprovanteId', 'ComprovanteUrl'
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

/** Mapa email → { name, role } a partir da aba Usuarios (com cache). */
function getUsers_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY_USERS);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* parse falhou, relê */ }
  }
  var rows = getSheet_(SH_USERS).getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    map[String(rows[i][0]).toLowerCase()] = {
      name: String(rows[i][1]),
      role: String(rows[i][2]).toLowerCase()
    };
  }
  cache.put(CACHE_KEY_USERS, JSON.stringify(map), CACHE_TTL_USERS);
  return map;
}

function countAdmins_(users) {
  var n = 0;
  Object.keys(users).forEach(function (e) { if (users[e].role === 'admin') n++; });
  return n;
}

function addUser_(email, name, role) {
  getSheet_(SH_USERS).appendRow([String(email).toLowerCase(), name, role]);
  CacheService.getScriptCache().remove(CACHE_KEY_USERS);
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
      ComprovanteId: String(r[14] || ''),
      ComprovanteUrl: String(r[15] || ''),
      _row: i + 1
    });
  }
  return out;
}

// ===========================================================================
// Comprovantes — cola de Drive (upload/link público/lixeira)
// ===========================================================================
//
// A parte decidível (whitelist de tipo, teto de tamanho, nome do arquivo) vive
// em logic.js. Aqui só a integração com o DriveApp. Os arquivos ficam numa pasta
// dedicada e recebem link público de LEITURA (AD-011) para aparecerem nos
// relatórios que os pais acessam sem conta do domínio.

/**
 * Pasta dedicada dos comprovantes. Pin no PropertiesService (`COMPROVANTES_FOLDER_ID`)
 * para não recriar/duplicar; na 1ª vez encontra por nome ou cria, e persiste o id.
 */
function getComprovanteFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_COMPROVANTES_FOLDER);
  if (id) {
    try { return DriveApp.getFolderById(id); }
    catch (e) { /* pasta removida: cai no fluxo de recriação abaixo */ }
  }
  var it = DriveApp.getFoldersByName(COMPROVANTES_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(COMPROVANTES_FOLDER_NAME);
  props.setProperty(PROP_COMPROVANTES_FOLDER, folder.getId());
  return folder;
}

/**
 * Sobe um comprovante para o Drive e devolve `{ fileId, url }`. `file` traz
 * `{ name, mimeType, size, dataBase64 }` (conteúdo já em base64 puro, sem o
 * prefixo `data:`). Valida na fronteira via logic.js (lança pt-BR se inválido);
 * o MIME resolvido define o blob e a extensão. Link público de LEITURA (AD-011).
 */
function uploadComprovante_(lancamentoId, file) {
  var v = validateComprovante_(file, {});
  var mime = v.mimeType;
  var bytes = Utilities.base64Decode(String(file.bytesBase64 || ''));
  var nome = comprovanteFileName_(lancamentoId, mime, Date.now());
  var blob = Utilities.newBlob(bytes, mime, nome);

  var out = getComprovanteFolder_().createFile(blob);
  out.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { fileId: out.getId(), url: out.getUrl() };
}

/**
 * Manda o arquivo do comprovante para a lixeira. Tolerante: id vazio ou arquivo
 * já inexistente não é erro (a operação de negócio não deve falhar por isso).
 */
function trashComprovante_(fileId) {
  fileId = String(fileId || '').trim();
  if (!fileId) return false;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return true;
  } catch (e) {
    return false;
  }
}

/** Lista de períodos `YYYY-MM` atualmente fechados (Status = `fechado`). */
function closedPeriods_() {
  // Reutiliza listClosedPeriodsData_ (já cacheada) para evitar leitura extra.
  return listClosedPeriodsData_().map(function (p) { return p.periodo; });
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
      id, data, clean.tipo, clean.categoria, clean.valor, clean.descricao,
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
      .setValues([[novaData, clean.tipo, clean.categoria, clean.valor, clean.descricao]]);
    sheet.getRange(current._row, 9, 1, 2).setValues([[who.email, nowStamp_()]]);

    appendAudit_('editar', id, antes + ' => ' + resumoLancamento_(clean));
    return { ok: true };
  });
}

/**
 * Exclusão LÓGICA (soft-delete): marca Excluido=true + ExcluidoPor/ExcluidoEm,
 * nunca remove a linha, e anexa auditoria(`excluir`). Revalida período aberto.
 * Se houver comprovante anexado, manda o arquivo para a lixeira e limpa
 * ComprovanteId/Url (COMP-07), tudo dentro do lock já existente.
 */
function deleteLancamento(id) {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var rows = readLancamentoRows_();
    var current = findLancamentoById_(rows, id);
    if (!current) throw new Error('Lançamento não encontrado.');

    assertPeriodOpen_(current.Data, closedPeriods_());

    var sheet = getSheet_(SH_LANC);
    sheet.getRange(current._row, 11, 1, 3)
      .setValues([[true, who.email, nowStamp_()]]);

    var tinhaComprovante = !!current.ComprovanteId;
    if (tinhaComprovante) {
      trashComprovante_(current.ComprovanteId);
      sheet.getRange(current._row, 15, 1, 2).setValues([['', '']]);
    }

    appendAudit_('excluir', id,
      resumoRow_(current) + (tinhaComprovante ? ' | comprovante removido' : ''));
    return { ok: true };
  });
}

// ===========================================================================
// Comprovantes service — anexar/substituir/remover (auditados)
// ===========================================================================

/**
 * Anexa ou SUBSTITUI o comprovante de um lançamento (COMP-01/03). Barreiras:
 * autorização → (lock) → localizar linha viva → período aberto → validação de
 * arquivo (lógica pura) → upload ao Drive (link público) → se já havia arquivo,
 * manda o antigo para a lixeira → grava ComprovanteId/Url (cols 15-16) →
 * auditoria(`anexar`|`substituir`). Tudo sob o lock serializa reenvios (COMP-09),
 * então a substituição troca a referência sem deixar arquivo órfão.
 */
function setComprovante(lancamentoId, file) {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var rows = readLancamentoRows_();
    var current = findLancamentoById_(rows, lancamentoId);
    if (!current) throw new Error('Lançamento não encontrado.');

    assertPeriodOpen_(current.Data, closedPeriods_());

    var antigo = current.ComprovanteId;
    var up = uploadComprovante_(current.Id, file); // valida + sobe (lança se inválido)
    if (antigo) trashComprovante_(antigo);

    getSheet_(SH_LANC).getRange(current._row, 15, 1, 2)
      .setValues([[up.fileId, up.url]]);

    appendAudit_(antigo ? 'substituir' : 'anexar', current.Id,
      resumoRow_(current) + ' | arquivo=' + up.fileId);
    return { ok: true, id: up.fileId, url: up.url };
  });
}

/**
 * Remove o comprovante SEM apagar o lançamento (COMP-04): manda o arquivo para
 * a lixeira e limpa ComprovanteId/Url. No-op tolerante se não houver comprovante.
 * Barreiras: autorização → (lock) → localizar linha → período aberto.
 */
function removeComprovante(lancamentoId) {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var rows = readLancamentoRows_();
    var current = findLancamentoById_(rows, lancamentoId);
    if (!current) throw new Error('Lançamento não encontrado.');

    assertPeriodOpen_(current.Data, closedPeriods_());

    if (!current.ComprovanteId) return { ok: true, semComprovante: true };

    var antigo = current.ComprovanteId;
    trashComprovante_(antigo);
    getSheet_(SH_LANC).getRange(current._row, 15, 1, 2).setValues([['', '']]);

    appendAudit_('remover_comprovante', current.Id,
      resumoRow_(current) + ' | arquivo=' + antigo);
    return { ok: true };
  });
}

// ===========================================================================
// Config (key-value) — leitura e escrita
// ===========================================================================

/** Mapa Chave→Valor da aba Config (com cache). */
function readConfigMap_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY_CONFIG);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* parse falhou, relê */ }
  }
  var values = getSheet_(SH_CONFIG).getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    map[String(values[i][0])] = values[i][1];
  }
  cache.put(CACHE_KEY_CONFIG, JSON.stringify(map), CACHE_TTL_CONFIG);
  return map;
}

/**
 * Grava ou atualiza uma chave na aba Config (update-or-append).
 * Deve ser chamada DENTRO do lock.
 */
function setConfigValue_(key, val, who, stamp) {
  var sheet = getSheet_(SH_CONFIG);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[val, who, stamp]]);
      CacheService.getScriptCache().remove(CACHE_KEY_CONFIG);
      return;
    }
  }
  sheet.appendRow([key, val, who, stamp]);
  CacheService.getScriptCache().remove(CACHE_KEY_CONFIG);
}

/**
 * Remove uma chave da aba Config (deleta a linha inteira).
 * Deve ser chamada DENTRO do lock. Retorna true se encontrou e removeu.
 */
function deleteConfigKey_(key) {
  var sheet = getSheet_(SH_CONFIG);
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === key) {
      sheet.deleteRow(i + 1);
      CacheService.getScriptCache().remove(CACHE_KEY_CONFIG);
      return true;
    }
  }
  return false;
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
  return serializeRows_(listForView_(readLancamentoRows_(), filtro || {}));
}

/** Estado do caixa (abertura + totais + saldo corrente, ignora excluídos). LANC-03. */
function getCashState() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return computeCashState_(aberturaConfig_(), readLancamentoRows_());
}

/** Estado do caixa para um mês específico (carry-forward + totais do mês). */
function getMonthState(mes) {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return computeMonthState_(aberturaConfig_(), readLancamentoRows_(), String(mes));
}

/** Categorias distintas (normalizadas) para autocomplete. LANC-06. */
function listCategorias() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return computeCategorias_(readLancamentoRows_());
}

// ===========================================================================
// Dashboard consolidado — 1 round-trip para o refresh completo da UI
// ===========================================================================

/** Serializa rows de lançamento (Date → ISO string) para transporte ao cliente. */
function serializeRows_(rows) {
  return rows.map(function (r) {
    var d = r.Data;
    var dataISO = (d instanceof Date && !isNaN(d.getTime()))
      ? d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate())
      : '';
    return {
      Id: r.Id,
      Data: dataISO,
      Tipo: r.Tipo,
      Categoria: r.Categoria,
      Valor: r.Valor,
      Descricao: r.Descricao,
      ComprovanteUrl: r.ComprovanteUrl || '',
      TemComprovante: !!(r.ComprovanteId && r.ComprovanteUrl)
    };
  });
}

/** Dados de períodos fechados (sem requireRole_, para uso interno; com cache). */
function listClosedPeriodsData_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY_FECH);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* parse falhou, relê */ }
  }
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
  cache.put(CACHE_KEY_FECH, JSON.stringify(out), CACHE_TTL_FECH);
  return out;
}

/**
 * Endpoint consolidado: devolve monthState + lancamentos + categorias +
 * closedPeriods em uma única chamada, lendo Lancamentos uma só vez.
 * Substitui os 4 round-trips individuais do refreshAll do cliente.
 */
function getDashboard(filtro, mes) {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  var rows = readLancamentoRows_();
  var abertura = aberturaConfig_();
  return {
    monthState: computeMonthState_(abertura, rows, String(mes)),
    lancamentos: serializeRows_(listForView_(rows, filtro || {})),
    categorias: computeCategorias_(rows),
    closedPeriods: listClosedPeriodsData_()
  };
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
 * Registra o saldo de abertura (primeira vez). Aceita `valor >= 0` e data
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
    setConfigValue_('SALDO_ABERTURA_VALOR', valor, who.email, stamp);
    setConfigValue_('SALDO_ABERTURA_DATA', formatDate_(data), who.email, stamp);

    appendAudit_('criar', 'abertura', JSON.stringify({ valor: valor, data: formatDate_(data) }));
    return { ok: true };
  });
}

/**
 * Lê o saldo de abertura (valor + data) para pré-preencher o modal na UI.
 * Retorna `{ definida, valor, data }`.
 */
function getOpeningBalance() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  var map = readConfigMap_();
  var raw = map['SALDO_ABERTURA_VALOR'];
  if (raw == null || String(raw).trim() === '') {
    return { definida: false, valor: null, data: null };
  }
  return { definida: true, valor: Number(raw), data: String(map['SALDO_ABERTURA_DATA'] || '') };
}

/**
 * Atualiza o saldo de abertura existente. Aceita valor ≥ 0, data não-futura,
 * guarda de período aberto (mês da abertura) e auditoria antes→depois.
 */
function updateOpeningBalance(opts) {
  var who = requireRole_(['admin', 'tesoureiro']);
  opts = opts || {};
  return withLock_(function () {
    var map = readConfigMap_();
    var existente = map['SALDO_ABERTURA_VALOR'];
    if (existente == null || String(existente).trim() === '') {
      throw new Error('Não há saldo de abertura para editar. Registre primeiro.');
    }
    var antes = { valor: Number(existente), data: String(map['SALDO_ABERTURA_DATA'] || '') };

    var novoValor = parseOpeningValue_(opts.valor);
    var novaData = parseDateBR_(opts.data);
    assertNotFuture_(novaData, hoje_());

    // Guarda de período: bloqueia se o mês da data original OU da nova está fechado.
    var closed = closedPeriods_();
    var dataOrigem = null;
    try { dataOrigem = parseDateBR_(antes.data); } catch (e) { /* ok se inválida */ }
    if (dataOrigem) assertPeriodOpen_(dataOrigem, closed);
    assertPeriodOpen_(novaData, closed);

    var stamp = nowStamp_();
    setConfigValue_('SALDO_ABERTURA_VALOR', novoValor, who.email, stamp);
    setConfigValue_('SALDO_ABERTURA_DATA', formatDate_(novaData), who.email, stamp);

    var depois = { valor: novoValor, data: formatDate_(novaData) };
    appendAudit_('editar', 'abertura', JSON.stringify(antes) + ' => ' + JSON.stringify(depois));
    return { ok: true };
  });
}

/**
 * Remove o saldo de abertura (volta a indefinido). Guarda de período aberto no
 * mês da abertura atual; auditoria `excluir`.
 */
function clearOpeningBalance() {
  var who = requireRole_(['admin', 'tesoureiro']);
  return withLock_(function () {
    var map = readConfigMap_();
    var existente = map['SALDO_ABERTURA_VALOR'];
    if (existente == null || String(existente).trim() === '') {
      throw new Error('Não há saldo de abertura para remover.');
    }
    var antes = { valor: Number(existente), data: String(map['SALDO_ABERTURA_DATA'] || '') };

    // Guarda de período: bloqueia se o mês da abertura está fechado.
    var closed = closedPeriods_();
    try {
      var dataOrigem = parseDateBR_(antes.data);
      assertPeriodOpen_(dataOrigem, closed);
    } catch (e) {
      if (e.message && e.message.indexOf('fechado') !== -1) throw e;
      // Data inválida/parse error: permite remover (dados corrompidos).
    }

    deleteConfigKey_('SALDO_ABERTURA_VALOR');
    deleteConfigKey_('SALDO_ABERTURA_DATA');

    appendAudit_('excluir', 'abertura', JSON.stringify(antes));
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
    CacheService.getScriptCache().remove(CACHE_KEY_FECH);
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
    CacheService.getScriptCache().remove(CACHE_KEY_FECH);
    appendAudit_('editar', 'fechamento:' + periodo, JSON.stringify({ acao: 'reabrir', periodo: periodo }));
    return { ok: true };
  });
}
