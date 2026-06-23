/**
 * Spike M0 — Autorização por papéis + Isolamento server-side (desafio D do AD-007).
 *
 * Objetivo: comprovar EMPIRICAMENTE que a stack provisória (Apps Script + Sheets)
 * consegue:
 *   1. Enforçar PAPÉIS no SERVIDOR (admin / tesoureiro / leitor / funcionário) —
 *      não apenas esconder botões na UI. Toda ação privilegiada é barrada no
 *      servidor mesmo que o cliente a chame diretamente.
 *   2. ISOLAMENTO por linha (row-level): um funcionário enxerga SÓ o próprio saldo
 *      do banco de horas; só admin vê o de todos.
 *   3. Usar a identidade do SSO (Session.getActiveUser) como âncora de segurança.
 *
 * Modelo de segurança:
 *   - Web app "Executar como: EU (implantador)" + acesso ao DOMÍNIO. O script roda
 *     com a conta dona da planilha (tem acesso à base); o VISITANTE não tem acesso
 *     direto ao Sheets — só recebe o que as funções server-side liberam.
 *   - A identidade do visitante vem de Session.getActiveUser().getEmail() (confiável
 *     dentro do mesmo domínio Google — já validado no spike Hello World).
 *   - "Ver como" (simulação) é um PRIVILÉGIO de admin para testar os papéis numa
 *     única conta; um não-admin não consegue simular. Sair da simulação usa a
 *     identidade REAL, então o admin nunca fica preso num papel menor.
 *
 * Descartável: na 1ª execução cria uma planilha de exemplo com usuários, lançamentos
 * e banco de horas fictícios. Nenhum dado real.
 */

var TZ = 'America/Sao_Paulo';
var PROP_SHEET_ID = 'ROLES_SPIKE_SHEET_ID';
var PROP_SIM_PREFIX = 'ROLES_SIM_'; // + realEmail -> simulatedEmail
var SH_USERS = 'Usuarios';
var SH_CASH = 'Lancamentos';
var SH_HOURS = 'BancoHoras';

var ROLES = ['admin', 'tesoureiro', 'leitor', 'funcionario'];

// ---------------------------------------------------------------------------
// Web app entry
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Spike Papéis & Privacidade — Ensina Blumenau')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// Identity & authorization core
// ---------------------------------------------------------------------------

function getRealEmail_() {
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}

/** Identidade EFETIVA = alvo da simulação se o caller REAL é admin; senão o real. */
function getEffectiveEmail_() {
  var real = getRealEmail_();
  if (!real) return '';
  var sim = PropertiesService.getScriptProperties().getProperty(PROP_SIM_PREFIX + real);
  if (sim && roleOf_(real) === 'admin') return sim;
  return real;
}

function roleOf_(email) {
  var u = getUsers_()[String(email).toLowerCase()];
  return u ? u.role : 'desconhecido';
}

/**
 * Barreira do servidor: lança erro se o papel EFETIVO não estiver na lista.
 * É o coração da prova — toda função privilegiada chama isto primeiro.
 */
function requireRole_(allowed) {
  var email = getEffectiveEmail_();
  var role = roleOf_(email);
  if (allowed.indexOf(role) < 0) {
    throw new Error('Acesso negado pelo servidor: ação exige papel [' +
      allowed.join(' ou ') + '], mas seu papel é [' + role + '].');
  }
  return { email: email, role: role };
}

// ---------------------------------------------------------------------------
// Session (exposed)
// ---------------------------------------------------------------------------

function getSession() {
  ensureBootstrapAdmin_();
  var real = getRealEmail_();
  var eff = getEffectiveEmail_();
  var realRole = roleOf_(real);
  return {
    realEmail: real || '(sem e-mail — getActiveUser vazio)',
    realRole: realRole,
    effectiveEmail: eff,
    effectiveRole: roleOf_(eff),
    simulating: !!eff && eff !== real,
    canSimulate: realRole === 'admin',
    users: realRole === 'admin' ? usersList_() : null
  };
}

// ---------------------------------------------------------------------------
// Cash flow (papéis: ler = admin/tesoureiro/leitor; escrever = admin/tesoureiro; excluir = admin)
// ---------------------------------------------------------------------------

function listLancamentos() {
  requireRole_(['admin', 'tesoureiro', 'leitor']);
  return readCash_();
}

function addLancamento(item) {
  var who = requireRole_(['admin', 'tesoureiro']); // leitor/funcionário são barrados aqui
  var clean = sanitizeLancamento_(item);
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SH_CASH);
  var id = Utilities.getUuid();
  var createdAt = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
  sheet.appendRow([id, clean.data, clean.tipo, clean.categoria, clean.valor, clean.descricao, who.email, createdAt]);
  return { ok: true, id: id, by: who.email };
}

function deleteLancamento(id) {
  requireRole_(['admin']); // só admin exclui
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SH_CASH);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { ok: true, deleted: id };
    }
  }
  throw new Error('Lançamento não encontrado: ' + id);
}

// ---------------------------------------------------------------------------
// Banco de horas (ISOLAMENTO server-side)
// ---------------------------------------------------------------------------

/** Qualquer usuário autenticado vê APENAS o próprio extrato/saldo. */
function getMyBalance() {
  var eff = getEffectiveEmail_();
  if (!eff) throw new Error('Sem identidade — não foi possível resolver o usuário.');
  return computeBalanceFor_(eff);
}

/** Só admin vê o saldo de TODOS (gestor/diretora). */
function listAllBalances() {
  requireRole_(['admin']);
  var users = getUsers_();
  var out = [];
  Object.keys(users).forEach(function (email) {
    if (users[email].role === 'funcionario' || users[email].role === 'admin') {
      out.push(computeBalanceFor_(email));
    }
  });
  return out.sort(function (a, b) { return a.name.localeCompare(b.name); });
}

/**
 * Buscar o saldo de OUTRO usuário só é permitido a admin.
 * Existe para PROVAR que um funcionário NÃO consegue ler o saldo alheio,
 * mesmo chamando a função diretamente.
 */
function getBalanceOf(email) {
  requireRole_(['admin']);
  return computeBalanceFor_(email);
}

function computeBalanceFor_(email) {
  email = String(email).toLowerCase();
  var ss = getSpreadsheet_();
  var rows = ss.getSheetByName(SH_HOURS).getDataRange().getValues();
  var users = getUsers_();
  var name = users[email] ? users[email].name : email;
  var entries = [];
  var balance = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() !== email) continue; // filtro server-side por linha
    var tipo = String(rows[i][3]).toLowerCase();
    var hours = Number(rows[i][4]) || 0;
    var signed = tipo === 'compensacao' ? -hours : hours;
    balance += signed;
    entries.push({
      date: formatCell_(rows[i][2]),
      tipo: tipo,
      hours: hours,
      signed: signed,
      descricao: String(rows[i][5] || '')
    });
  }
  return { email: email, name: name, balanceHours: balance, entries: entries };
}

// ---------------------------------------------------------------------------
// Admin: user management + simulation
// ---------------------------------------------------------------------------

function setRole(email, role) {
  requireRole_(['admin']);
  email = String(email).toLowerCase();
  if (ROLES.indexOf(role) < 0) throw new Error('Papel inválido: ' + role);
  var users = getUsers_();
  if (!users[email]) throw new Error('Usuário não cadastrado: ' + email);
  // Trava de segurança: não permitir remover o ÚLTIMO admin (evita lockout).
  if (users[email].role === 'admin' && role !== 'admin' && countAdmins_(users) <= 1) {
    throw new Error('Não é possível rebaixar o único admin (evita travar o sistema).');
  }
  writeUserRole_(email, role);
  return { ok: true, email: email, role: role };
}

function startSimulation(email) {
  var real = getRealEmail_();
  if (roleOf_(real) !== 'admin') throw new Error('Apenas admin pode usar "Ver como".');
  email = String(email).toLowerCase();
  if (!getUsers_()[email]) throw new Error('Usuário não cadastrado: ' + email);
  PropertiesService.getScriptProperties().setProperty(PROP_SIM_PREFIX + real, email);
  return getSession();
}

function stopSimulation() {
  var real = getRealEmail_(); // usa identidade REAL: admin sempre consegue sair
  PropertiesService.getScriptProperties().deleteProperty(PROP_SIM_PREFIX + real);
  return getSession();
}

// ---------------------------------------------------------------------------
// Data layer (Sheets)
// ---------------------------------------------------------------------------

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* recria abaixo */ }
  }
  var ss = SpreadsheetApp.create('Spike Papéis — Dados (exemplo)');
  buildSheets_(ss);
  props.setProperty(PROP_SHEET_ID, ss.getId());
  return ss;
}

function buildSheets_(ss) {
  var first = ss.getSheets()[0];
  var users = ss.insertSheet(SH_USERS);
  var cash = ss.insertSheet(SH_CASH);
  var hours = ss.insertSheet(SH_HOURS);
  ss.deleteSheet(first);

  users.getRange(1, 1, 1, 3).setValues([['Email', 'Nome', 'Papel']]).setFontWeight('bold');
  var me = getRealEmail_();
  var seedUsers = [];
  if (me) seedUsers.push([me, 'Você (admin real)', 'admin']);
  seedUsers.push(['tesoureiro@escola.exemplo', 'Tina Tesoureira', 'tesoureiro']);
  seedUsers.push(['leitor@escola.exemplo', 'Lúcia Leitora', 'leitor']);
  seedUsers.push(['ana@escola.exemplo', 'Ana (professora)', 'funcionario']);
  seedUsers.push(['bruno@escola.exemplo', 'Bruno (professor)', 'funcionario']);
  users.getRange(2, 1, seedUsers.length, 3).setValues(seedUsers);

  cash.getRange(1, 1, 1, 8)
    .setValues([['Id', 'Data', 'Tipo', 'Categoria', 'Valor', 'Descricao', 'CriadoPor', 'CriadoEm']])
    .setFontWeight('bold');
  cash.appendRow([Utilities.getUuid(), '05/06/2025', 'entrada', 'Contribuição', 1200, 'Contribuição mensal', 'tesoureiro@escola.exemplo', '05/06/2025 09:10']);
  cash.appendRow([Utilities.getUuid(), '08/06/2025', 'saida', 'Material', 280, 'Material escolar', 'tesoureiro@escola.exemplo', '08/06/2025 14:22']);
  cash.appendRow([Utilities.getUuid(), '14/06/2025', 'entrada', 'Evento', 4820.9, 'Festa junina', 'tesoureiro@escola.exemplo', '14/06/2025 20:00']);

  hours.getRange(1, 1, 1, 6)
    .setValues([['Email', 'Nome', 'Data', 'Tipo', 'Horas', 'Descricao']])
    .setFontWeight('bold');
  var seedHours = [
    ['ana@escola.exemplo', 'Ana (professora)', '03/06/2025', 'extra', 3, 'Conselho de classe'],
    ['ana@escola.exemplo', 'Ana (professora)', '10/06/2025', 'extra', 2, 'Reunião de pais'],
    ['ana@escola.exemplo', 'Ana (professora)', '20/06/2025', 'compensacao', 2, 'Saída antecipada'],
    ['bruno@escola.exemplo', 'Bruno (professor)', '05/06/2025', 'extra', 4, 'Festa junina'],
    ['bruno@escola.exemplo', 'Bruno (professor)', '18/06/2025', 'compensacao', 1, 'Folga']
  ];
  if (me) {
    seedHours.push([me, 'Você (admin real)', '06/06/2025', 'extra', 1.5, 'Plantão']);
  }
  hours.getRange(2, 1, seedHours.length, 6).setValues(seedHours);
}

function getUsers_() {
  var ss = getSpreadsheet_();
  var rows = ss.getSheetByName(SH_USERS).getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    map[String(rows[i][0]).toLowerCase()] = { name: String(rows[i][1]), role: String(rows[i][2]).toLowerCase() };
  }
  return map;
}

function usersList_() {
  var users = getUsers_();
  return Object.keys(users).map(function (email) {
    return { email: email, name: users[email].name, role: users[email].role };
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });
}

/**
 * Bootstrap anti-lockout: garante que sempre exista um admin.
 * Em conta pessoal, a 1ª execução (durante a autorização) pode ter
 * getActiveUser() vazio, criando a base sem o admin. Aqui, se NÃO há nenhum
 * admin e o usuário real é conhecido pelo SSO, ele é promovido a admin.
 */
function ensureBootstrapAdmin_() {
  var real = getRealEmail_();
  if (!real) return;
  var users = getUsers_();
  if (users[real]) return;            // já cadastrado: não mexe
  if (countAdmins_(users) > 0) return; // já existe admin: usuário novo fica como 'desconhecido'
  addUser_(real, 'Você (admin)', 'admin');
}

function addUser_(email, name, role) {
  var ss = getSpreadsheet_();
  ss.getSheetByName(SH_USERS).appendRow([String(email).toLowerCase(), name, role]);
}

function writeUserRole_(email, role) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SH_USERS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email) {
      sheet.getRange(i + 1, 3).setValue(role);
      return;
    }
  }
  throw new Error('Usuário não encontrado para atualizar: ' + email);
}

function countAdmins_(users) {
  var n = 0;
  Object.keys(users).forEach(function (e) { if (users[e].role === 'admin') n++; });
  return n;
}

function readCash_() {
  var ss = getSpreadsheet_();
  var rows = ss.getSheetByName(SH_CASH).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      id: String(rows[i][0]),
      data: formatCell_(rows[i][1]),
      tipo: String(rows[i][2]).toLowerCase(),
      categoria: String(rows[i][3]),
      valor: Number(rows[i][4]) || 0,
      descricao: String(rows[i][5] || ''),
      criadoPor: String(rows[i][6] || '')
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation / helpers
// ---------------------------------------------------------------------------

/** Sanitização na fronteira do sistema (entrada do cliente nunca confiável). */
function sanitizeLancamento_(item) {
  item = item || {};
  var tipo = String(item.tipo || '').toLowerCase();
  if (tipo !== 'entrada' && tipo !== 'saida') throw new Error('Tipo inválido (use entrada/saida).');
  var valor = Number(item.valor);
  if (!isFinite(valor) || valor < 0) throw new Error('Valor inválido.');
  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').slice(0, n); }
  var data = clip(item.data, 10) || Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');
  return {
    data: data,
    tipo: tipo,
    categoria: clip(item.categoria, 40) || 'Sem categoria',
    valor: Math.round(valor * 100) / 100,
    descricao: clip(item.descricao, 120)
  };
}

function formatCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
  return String(v);
}

/** Re-popula os dados de exemplo (apaga e recria a planilha). */
function resetData() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* ignore */ }
  }
  // Limpa simulações
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf(PROP_SIM_PREFIX) === 0) props.deleteProperty(k); });
  props.deleteProperty(PROP_SHEET_ID);
  getSpreadsheet_();
  return 'Dados de exemplo recriados.';
}
