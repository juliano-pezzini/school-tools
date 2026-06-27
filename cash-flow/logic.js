// cash-flow/logic.js — lógica pura do Fluxo de Caixa.
//
// Padrão dual-environment: este arquivo precisa rodar tanto no Node (para os
// testes Vitest) quanto no Apps Script (deploy via clasp, que converte .js → .gs).
// - No Apps Script NÃO existe `module`/`require`; o arquivo compartilha o escopo
//   global com Code.gs (sem `import`/`export`). Por isso o guard abaixo testa
//   `typeof module` antes de tocar em `module.exports` — assim não há ReferenceError.
// - No Node, o guard popula `module.exports` e os testes importam as funções puras.
//
// As funções puras são adicionadas na Phase 2.
//
// ARQUITETURA (crítico): tudo aqui é PURO — determinístico, sem I/O, sem
// `new Date()` sem argumentos. Datas/"hoje"/"mês corrente" entram por parâmetro.
// Formatação pt-BR é MANUAL (sem Intl / sem Apps Script Utilities) para que o
// comportamento seja idêntico no Node e no Apps Script V8.

// ===========================================================================
// T2 — Helpers pt-BR: data e moeda
// ===========================================================================

/**
 * Formata um número como moeda pt-BR: `R$ 1.234,56` (2 casas, ponto de milhar,
 * vírgula decimal). Trata negativos: `-R$ 50,00`.
 */
function formatBRL_(value) {
  var n = Math.round(Number(value) * 100) / 100;
  if (!isFinite(n)) n = 0;
  var neg = n < 0;
  n = Math.abs(n);
  var parts = n.toFixed(2).split('.');
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + 'R$ ' + intPart + ',' + parts[1];
}

/** Zero-pad à esquerda para 2 dígitos. */
function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * Formata uma `Date` como `dd/MM/yyyy` usando os componentes de calendário da
 * própria data (determinístico; sem fuso/Utilities).
 */
function formatDate_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Data inválida.');
  }
  return pad2_(date.getDate()) + '/' + pad2_(date.getMonth() + 1) + '/' + date.getFullYear();
}

/**
 * Converte `dd/MM/yyyy` em `Date` (meia-noite local). Rejeita vazio, formato
 * incorreto ou data inexistente (ex.: 31/02). Mensagens em pt-BR.
 */
function parseDateBR_(str) {
  if (str == null || String(str).trim() === '') {
    throw new Error('Informe uma data.');
  }
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(str).trim());
  if (!m) throw new Error('Data inválida (use dd/mm/aaaa).');
  var day = Number(m[1]);
  var month = Number(m[2]);
  var year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('Data inválida (use dd/mm/aaaa).');
  }
  var d = new Date(year, month - 1, day);
  // Detecta overflow (ex.: 31/02 vira 03/03).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new Error('Data inválida (use dd/mm/aaaa).');
  }
  return d;
}

/** Chave de período `YYYY-MM` a partir de uma `Date`. */
function periodKey_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Data inválida.');
  }
  return date.getFullYear() + '-' + pad2_(date.getMonth() + 1);
}

/**
 * Helper de "mês corrente": dada a data de "hoje" (parâmetro, sem relógio
 * interno), retorna a chave `YYYY-MM` do mês corrente.
 */
function currentMonthKey_(hoje) {
  return periodKey_(hoje);
}

// ===========================================================================
// T3 — Sanitização de valor e limites de campo
// ===========================================================================

var VALOR_TETO = 1000000;     // R$ 1.000.000,00 — teto técnico (exige confirmação)
var DESCRICAO_MAX = 280;      // chars
var CATEGORIA_MAX = 60;       // chars

/**
 * Normaliza um valor monetário aceito como número ou string pt-BR/US.
 * Aceita vírgula OU ponto como separador decimal e ponto como milhar.
 * Rejeita vazio, não-numérico, `<= 0` ou mais de 2 casas decimais (pt-BR).
 * Retorna número arredondado a 2 casas.
 */
function parseMoney_(raw) {
  if (raw == null || String(raw).trim() === '') {
    throw new Error('Informe um valor maior que zero, com até dois centavos.');
  }
  var s = String(raw).trim();
  if (typeof raw === 'number') {
    if (!isFinite(raw)) throw new Error('Informe um valor maior que zero, com até dois centavos.');
    s = String(raw);
  } else {
    // String: normaliza separadores.
    if (s.indexOf(',') !== -1) {
      // Vírgula é o separador decimal; pontos são milhar.
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Sem vírgula: 2+ pontos => milhar; 1 ponto => decimal.
      var dots = s.split('.').length - 1;
      if (dots > 1) s = s.replace(/\./g, '');
    }
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error('Informe um valor maior que zero, com até dois centavos.');
  }
  var decimals = s.indexOf('.') === -1 ? '' : s.split('.')[1];
  if (decimals.length > 2) {
    throw new Error('Informe um valor maior que zero, com até dois centavos.');
  }
  var n = Number(s);
  if (!isFinite(n) || n <= 0) {
    throw new Error('Informe um valor maior que zero, com até dois centavos.');
  }
  return Math.round(n * 100) / 100;
}

/** Remove caracteres de controle e converte para string aparada. */
function cleanText_(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').trim();
}

/**
 * Sanitiza um lançamento vindo do cliente (fronteira do sistema).
 * Valida tipo (`entrada`/`saida`) e valor (`> 0`, ≤ 2 casas, normalizado).
 * Não aplica limites de tamanho/teto — isso é `assertLimits_`.
 * Retorna `{ data, tipo, categoria, valor, descricao }`.
 */
function sanitizeLancamento_(item) {
  item = item || {};
  var tipo = String(item.tipo == null ? '' : item.tipo).toLowerCase().trim();
  if (tipo !== 'entrada' && tipo !== 'saida') {
    throw new Error('Tipo inválido: use entrada ou saída.');
  }
  var valor = parseMoney_(item.valor);
  return {
    data: cleanText_(item.data),
    tipo: tipo,
    categoria: cleanText_(item.categoria),
    valor: valor,
    descricao: cleanText_(item.descricao)
  };
}

/**
 * Aplica limites de campo a um item já sanitizado.
 * Lança (pt-BR) para descrição > 280 ou categoria > 60.
 * Para valor acima do teto técnico, NÃO bloqueia: retorna
 * `{ requiresConfirmation: true }` (a UI confirma antes de gravar).
 */
function assertLimits_(item) {
  item = item || {};
  var categoria = String(item.categoria == null ? '' : item.categoria);
  var descricao = String(item.descricao == null ? '' : item.descricao);
  if (categoria.length > CATEGORIA_MAX) {
    throw new Error('Categoria muito longa (máximo de 60 caracteres).');
  }
  if (descricao.length > DESCRICAO_MAX) {
    throw new Error('Descrição muito longa (máximo de 280 caracteres).');
  }
  var valor = Number(item.valor);
  return { requiresConfirmation: isFinite(valor) && valor > VALOR_TETO };
}

// ===========================================================================
// T4 — Guardas de data/período (puras)
// ===========================================================================

/** Valor comparável (apenas ano/mês/dia) de uma `Date`. */
function dayValue_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Data inválida.');
  }
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Rejeita data futura em relação a `hoje` (ambos `Date`, comparados por dia).
 * Aceita hoje e datas passadas.
 */
function assertNotFuture_(date, hoje) {
  if (dayValue_(date) > dayValue_(hoje)) {
    throw new Error('Não é possível lançar com data futura.');
  }
  return true;
}

/** Formata `YYYY-MM` como `MM/AAAA` para mensagens ao usuário. */
function periodLabel_(yyyymm) {
  var p = String(yyyymm).split('-');
  return p[1] + '/' + p[0];
}

/**
 * Rejeita uma data cujo período (`YYYY-MM`) esteja na lista de períodos
 * fechados. `closedPeriods` é um array de chaves `YYYY-MM`. Mês sem linha
 * (ausente da lista) é considerado aberto.
 */
function assertPeriodOpen_(date, closedPeriods) {
  var key = periodKey_(date);
  var closed = closedPeriods || [];
  for (var i = 0; i < closed.length; i++) {
    if (closed[i] === key) {
      throw new Error('O período ' + periodLabel_(key) + ' está fechado. Reabra-o para alterar.');
    }
  }
  return true;
}

// ===========================================================================
// T5 — Normalização e listagem de categorias
// ===========================================================================

/**
 * Chave normalizada de categoria: sem diferenciar maiúsculas/minúsculas,
 * acentos (incl. cedilha) ou espaços nas pontas. `normalize('NFD')` é parte do
 * core JS (V8-safe), não depende de `Intl`.
 */
function normalizeCategoryKey_(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Lista de categorias distintas para autocomplete: agrupa por chave
 * normalizada, mantém a 1ª grafia usada, ignora lançamentos `Excluido`,
 * e ordena pela chave normalizada (determinístico).
 */
function computeCategorias_(rows) {
  rows = rows || [];
  var seen = {};
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row || row.Excluido === true) continue;
    var grafia = String(row.Categoria == null ? '' : row.Categoria).trim();
    if (grafia === '') continue;
    var key = normalizeCategoryKey_(grafia);
    if (Object.prototype.hasOwnProperty.call(seen, key)) continue;
    seen[key] = true;
    out.push({ key: key, grafia: grafia });
  }
  out.sort(function (a, b) {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return 0;
  });
  return out.map(function (e) { return e.grafia; });
}

// ===========================================================================
// T6 — Cálculo de saldo (abertura + corrente)
// ===========================================================================

/** Arredonda para 2 casas, evitando ruído de ponto flutuante. */
function round2_(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Estado do caixa a partir da fonte (recálculo sob demanda).
 * `config` pode trazer `saldoAbertura` (número ≥ 0). Se a abertura não estiver
 * definida (config nulo ou sem `saldoAbertura` numérico), trata como 0 e marca
 * `aberturaDefinida=false`. Soma só lançamentos não `Excluido`. Saldo negativo
 * é permitido (retornado, não bloqueado).
 * Retorna `{ aberturaDefinida, saldoAbertura, totalEntradas, totalSaidas, saldoAtual }`.
 */
function computeCashState_(config, rows) {
  rows = rows || [];
  var abertura = 0;
  var aberturaDefinida = false;
  if (config != null && config.saldoAbertura != null && isFinite(Number(config.saldoAbertura))) {
    abertura = Number(config.saldoAbertura);
    aberturaDefinida = true;
  }
  var totalEntradas = 0;
  var totalSaidas = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row || row.Excluido === true) continue;
    var valor = Number(row.Valor);
    if (!isFinite(valor)) continue;
    if (row.Tipo === 'entrada') totalEntradas += valor;
    else if (row.Tipo === 'saida') totalSaidas += valor;
  }
  totalEntradas = round2_(totalEntradas);
  totalSaidas = round2_(totalSaidas);
  return {
    aberturaDefinida: aberturaDefinida,
    saldoAbertura: round2_(abertura),
    totalEntradas: totalEntradas,
    totalSaidas: totalSaidas,
    saldoAtual: round2_(abertura + totalEntradas - totalSaidas)
  };
}

// ===========================================================================
// T7 — Listagem: ordenação, ocultação de excluídos e filtros
// ===========================================================================

/** Valor comparável de uma `Data` (aceita `Date`). */
function dataSortValue_(v) {
  if (v instanceof Date) return v.getTime();
  return v;
}

/**
 * View de lançamentos para a UI:
 * - oculta `Excluido`;
 * - ordena por `Data` desc e, em empate, por `CriadoEm` desc (determinístico);
 * - filtra por `mes` (`YYYY-MM`), `tipo` (`entrada`/`saida`) e/ou `categoria`
 *   (comparada por chave normalizada). Cada filtro é opcional.
 */
function listForView_(rows, filtro) {
  rows = rows || [];
  filtro = filtro || {};
  var catKey = filtro.categoria != null && String(filtro.categoria).trim() !== ''
    ? normalizeCategoryKey_(filtro.categoria) : null;

  var visible = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row || row.Excluido === true) continue;
    if (filtro.mes && periodKey_(row.Data) !== filtro.mes) continue;
    if (filtro.tipo && row.Tipo !== filtro.tipo) continue;
    if (catKey !== null && normalizeCategoryKey_(row.Categoria) !== catKey) continue;
    visible.push(row);
  }

  visible.sort(function (a, b) {
    var da = dataSortValue_(a.Data);
    var db = dataSortValue_(b.Data);
    if (da < db) return 1;
    if (da > db) return -1;
    // Empate de Data → CriadoEm desc.
    var ca = a.CriadoEm, cb = b.CriadoEm;
    if (ca < cb) return 1;
    if (ca > cb) return -1;
    return 0;
  });
  return visible;
}

// ===========================================================================
// T8 — Decisão de idempotência (clientToken)
// ===========================================================================

/**
 * Decisão pura de deduplicação por `clientToken` (usada dentro do lock).
 * `existingTokens` é a lista de tokens já gravados, como array de
 * `{ token, id }`. Regras:
 * - token novo ⇒ `{ isDup: false }`;
 * - token já visto ⇒ `{ isDup: true, existingId }` (sucesso idempotente);
 * - token vazio/ausente ⇒ rejeita (default do design: token é obrigatório).
 */
function dedupDecision_(existingTokens, clientToken) {
  if (clientToken == null || String(clientToken).trim() === '') {
    throw new Error('Token de idempotência ausente.');
  }
  var token = String(clientToken);
  var list = existingTokens || [];
  for (var i = 0; i < list.length; i++) {
    var entry = list[i] || {};
    if (String(entry.token) === token) {
      return { isDup: true, existingId: entry.id };
    }
  }
  return { isDup: false };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatBRL_: formatBRL_,
    formatDate_: formatDate_,
    parseDateBR_: parseDateBR_,
    periodKey_: periodKey_,
    currentMonthKey_: currentMonthKey_,
    parseMoney_: parseMoney_,
    sanitizeLancamento_: sanitizeLancamento_,
    assertLimits_: assertLimits_,
    assertNotFuture_: assertNotFuture_,
    assertPeriodOpen_: assertPeriodOpen_,
    normalizeCategoryKey_: normalizeCategoryKey_,
    computeCategorias_: computeCategorias_,
    computeCashState_: computeCashState_,
    listForView_: listForView_,
    dedupDecision_: dedupDecision_
  };
}
