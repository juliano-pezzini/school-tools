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

/**
 * Estado do caixa para um mês específico.
 * `config` e `allRows` como em `computeCashState_`; `mes` é a chave `YYYY-MM`.
 *
 * - `saldoInicio`: abertura global + saldo acumulado dos meses anteriores a `mes`.
 * - `totalEntradas`/`totalSaidas`: apenas os lançamentos do mês `mes`.
 * - `saldoFinal`: saldoInicio + totalEntradas − totalSaidas.
 * - `aberturaDefinida`: flag da abertura global.
 */
function computeMonthState_(config, allRows, mes) {
  allRows = allRows || [];
  mes = String(mes);
  var abertura = 0;
  var aberturaDefinida = false;
  if (config != null && config.saldoAbertura != null && isFinite(Number(config.saldoAbertura))) {
    abertura = Number(config.saldoAbertura);
    aberturaDefinida = true;
  }
  var carryEntradas = 0, carrySaidas = 0;
  var mesEntradas = 0, mesSaidas = 0;
  for (var i = 0; i < allRows.length; i++) {
    var row = allRows[i];
    if (!row || row.Excluido === true) continue;
    var valor = Number(row.Valor);
    if (!isFinite(valor)) continue;
    var rp = periodKey_(row.Data);
    if (rp < mes) {
      if (row.Tipo === 'entrada') carryEntradas += valor;
      else if (row.Tipo === 'saida') carrySaidas += valor;
    } else if (rp === mes) {
      if (row.Tipo === 'entrada') mesEntradas += valor;
      else if (row.Tipo === 'saida') mesSaidas += valor;
    }
  }
  var saldoInicio = round2_(abertura + carryEntradas - carrySaidas);
  mesEntradas = round2_(mesEntradas);
  mesSaidas = round2_(mesSaidas);
  return {
    aberturaDefinida: aberturaDefinida,
    saldoInicio: saldoInicio,
    totalEntradas: mesEntradas,
    totalSaidas: mesSaidas,
    saldoFinal: round2_(saldoInicio + mesEntradas - mesSaidas)
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

// ===========================================================================
// T9 — Transições de período (fechar/reabrir)
// ===========================================================================

/**
 * Decisão de FECHAR um período (`YYYY-MM`).
 * `status` é o estado atual (`fechado`/`aberto`; ausente = aberto, mês sem
 * linha). `mesCorrente` é a chave `YYYY-MM` do mês corrente.
 * - mês futuro (`periodo > mesCorrente`) ⇒ erro pt-BR;
 * - já `fechado` ⇒ no-op idempotente `{ changed:false, jaFechado:true }`;
 * - senão ⇒ `{ changed:true, status:'fechado' }`.
 * Comparação lexicográfica de `YYYY-MM` é válida (formato fixo, zero-padded).
 */
function closeDecision_(periodo, status, mesCorrente) {
  if (String(periodo) > String(mesCorrente)) {
    throw new Error('Não é possível fechar um mês futuro.');
  }
  if (status === 'fechado') {
    return { changed: false, jaFechado: true, status: 'fechado' };
  }
  return { changed: true, status: 'fechado' };
}

/**
 * Decisão de REABRIR um período (`YYYY-MM`).
 * - já `aberto` (ou sem linha) ⇒ no-op idempotente `{ changed:false, jaAberto:true }`;
 * - `fechado` ⇒ `{ changed:true, status:'aberto' }`.
 */
function reopenDecision_(periodo, status) {
  if (status === 'fechado') {
    return { changed: true, status: 'aberto' };
  }
  return { changed: false, jaAberto: true, status: 'aberto' };
}

// ===========================================================================
// Client pre-validation (pure — mirrors server guards for optimistic UI)
// ===========================================================================

/**
 * Client-side pre-validation that mirrors the server guards executed before
 * writing a lançamento. Pure: no DOM, no I/O, no clock — everything comes in
 * via `params`. Returns the first error message (pt-BR) or `''` if valid.
 *
 * @param {Object} params
 * @param {string} params.dateISO       – 'yyyy-MM-dd' from the date input (may be '')
 * @param {string} params.todayISO      – 'yyyy-MM-dd' of "today" in America/Sao_Paulo
 * @param {string[]} params.closedPeriods – array of 'YYYY-MM' keys of closed months
 * @param {*}      params.valor         – raw value string from the input (e.g. '200,00')
 * @param {string} params.categoria     – category text
 * @param {string} params.descricao     – description text
 * @param {boolean} [params.isEdit]     – true when editing an existing lançamento
 * @param {string} [params.originDateISO] – 'yyyy-MM-dd' of the original lançamento (edit only)
 */
function validateLancamentoClient_(params) {
  params = params || {};
  // 1) Data preenchida
  if (!params.dateISO) return 'Informe uma data.';
  // 2) Data não-futura
  if (params.dateISO > params.todayISO) return 'Não é possível lançar com data futura.';
  // 3) Período destino não fechado
  var periodo = params.dateISO.substring(0, 7);
  var closed = params.closedPeriods || [];
  for (var i = 0; i < closed.length; i++) {
    if (closed[i] === periodo) {
      var lbl = periodo.split('-');
      return 'O período ' + lbl[1] + '/' + lbl[0] + ' está fechado. Reabra-o para alterar.';
    }
  }
  // 3b) Edição: período de origem também deve estar aberto
  if (params.isEdit && params.originDateISO) {
    var origPeriodo = params.originDateISO.substring(0, 7);
    for (var j = 0; j < closed.length; j++) {
      if (closed[j] === origPeriodo) {
        var ol = origPeriodo.split('-');
        return 'O período ' + ol[1] + '/' + ol[0] + ' está fechado. Reabra-o para alterar.';
      }
    }
  }
  // 4) Valor > 0, numérico, ≤ 2 casas decimais (mirrors parseMoney_)
  var valStr = String(params.valor == null ? '' : params.valor).trim();
  if (valStr === '') return 'Informe um valor maior que zero, com até dois centavos.';
  var normStr = valStr;
  if (normStr.indexOf(',') !== -1) {
    normStr = normStr.replace(/\./g, '').replace(',', '.');
  } else if ((normStr.split('.').length - 1) > 1) {
    normStr = normStr.replace(/\./g, '');
  }
  var n = Number(normStr);
  if (!isFinite(n) || n <= 0) return 'Informe um valor maior que zero, com até dois centavos.';
  var dotIdx = normStr.indexOf('.');
  if (dotIdx !== -1 && normStr.length - dotIdx - 1 > 2) {
    return 'Informe um valor maior que zero, com até dois centavos.';
  }
  // 5) Limites de campo
  if ((params.categoria || '').length > CATEGORIA_MAX) return 'Categoria muito longa (máximo de 60 caracteres).';
  if ((params.descricao || '').length > DESCRICAO_MAX) return 'Descrição muito longa (máximo de 280 caracteres).';
  return '';
}

/**
 * Pre-check for deletion: returns error message if the lançamento's period is
 * closed, or '' if ok.
 */
function validateDeleteClient_(dateISO, closedPeriods) {
  if (!dateISO) return '';
  var periodo = dateISO.substring(0, 7);
  var closed = closedPeriods || [];
  for (var i = 0; i < closed.length; i++) {
    if (closed[i] === periodo) {
      var lbl = periodo.split('-');
      return 'O período ' + lbl[1] + '/' + lbl[0] + ' está fechado. Reabra-o para alterar.';
    }
  }
  return '';
}

// ===========================================================================
// T1 (Comprovantes) — validação de arquivo e nome (lógica pura)
// ===========================================================================
//
// Parte decidível da feature Comprovantes: whitelist de tipo, teto de tamanho e
// nome determinístico do arquivo. A cola de Drive/Sheets (upload/lixeira) fica
// em Code.gs. Mensagens pt-BR aqui são a fonte única, espelhadas na UI.

/** Teto de tamanho do comprovante: 10 MB. */
var COMPROVANTE_MAX_BYTES = 10 * 1024 * 1024;

/** Tipos MIME aceitos para comprovante (foto de celular + PDF). */
var COMPROVANTE_TIPOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
];

/** MIME → extensão de arquivo. Desconhecido → `bin` (não deveria ocorrer após validar). */
function extForMime_(mimeType) {
  switch (String(mimeType || '').toLowerCase()) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    case 'application/pdf': return 'pdf';
    default: return 'bin';
  }
}

/** Extensão do nome do arquivo (minúscula, sem ponto); `''` se não houver. */
function fileExt_(name) {
  var s = String(name == null ? '' : name);
  var dot = s.lastIndexOf('.');
  if (dot < 0 || dot === s.length - 1) return '';
  return s.substring(dot + 1).toLowerCase();
}

/** Extensão → MIME (fallback quando o MIME reportado vem vazio/impreciso). */
function mimeForExt_(ext) {
  switch (String(ext || '').toLowerCase()) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'pdf': return 'application/pdf';
    default: return '';
  }
}

/** Nome determinístico do arquivo no Drive: `<lancamentoId>_<timestampMs>.<ext>`. */
function comprovanteFileName_(lancamentoId, mimeType, timestampMs) {
  return String(lancamentoId) + '_' + String(timestampMs) + '.' + extForMime_(mimeType);
}

/**
 * Valida um comprovante na fronteira (COMP-05): tipo na whitelist e tamanho
 * dentro do teto. Se o MIME reportado vier vazio ou fora da whitelist, tenta
 * inferir pelo tipo da extensão do nome; só rejeita se a extensão também não
 * casar. Retorna `{ ok, mimeType }` com o MIME resolvido (para o blob correto)
 * ou lança `Error` com mensagem pt-BR.
 */
function validateComprovante_(file, opts) {
  opts = opts || {};
  var allowed = opts.allowedTypes || COMPROVANTE_TIPOS;
  var maxBytes = opts.maxBytes || COMPROVANTE_MAX_BYTES;

  if (!file || String(file.name == null ? '' : file.name).trim() === '') {
    throw new Error('Selecione um arquivo de comprovante.');
  }

  var reported = String(file.mimeType || '').toLowerCase();
  var resolved = '';
  if (reported && allowed.indexOf(reported) >= 0) {
    resolved = reported;
  } else {
    var inferred = mimeForExt_(fileExt_(file.name));
    if (inferred && allowed.indexOf(inferred) >= 0) resolved = inferred;
  }
  if (!resolved) {
    throw new Error('Tipo de arquivo não permitido. Use imagem (JPG, PNG, WEBP, HEIC) ou PDF.');
  }

  var size = Number(file.size);
  if (!(size > 0)) {
    throw new Error('O arquivo do comprovante está vazio.');
  }
  if (size > maxBytes) {
    var mb = Math.round(maxBytes / (1024 * 1024));
    throw new Error('O comprovante excede o limite de ' + mb + ' MB.');
  }

  return { ok: true, mimeType: resolved };
}

// ===========================================================================
// Relatórios — helpers puros (T1)
// ===========================================================================

/** Escapa caracteres perigosos para embedding em HTML (PDF/tela). */
function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pares `{key, value}` de um objeto, ordenados por `value` decrescente. */
function toSortedPairs_(obj) {
  return Object.keys(obj)
    .map(function (k) { return { key: k, value: obj[k] }; })
    .sort(function (a, b) { return b.value - a.value; });
}

/** Percentual inteiro como string (ex.: `'25%'`). `0%` se `whole` é zero. */
function pct_(part, whole) {
  if (!whole) return '0%';
  return Math.round(part / whole * 100) + '%';
}

/**
 * Nome determinístico do PDF de relatório no Drive.
 * `tipo` = `'mensal'` | `'anual'`; `periodo` = `'2025-07'` | `'2025'`.
 */
function reportPdfFileName_(tipo, periodo) {
  return 'Relatorio_APP_' + tipo + '_' + periodo + '.pdf';
}

// ===========================================================================
// Relatórios — agregação + builders (T2)
// ===========================================================================

var MONTH_NAMES_REL = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Relatório mensal completo (puro).
 * `config` = `{ saldoAbertura }` ou `null`; `allRows` = array de objetos
 * de lançamento; `mes` = `'YYYY-MM'`; `closedPeriods` = array de `'YYYY-MM'`.
 */
function computeMonthReport_(config, allRows, mes, closedPeriods) {
  mes = String(mes);
  var parts = mes.split('-');
  var ano = Number(parts[0]);
  var mesNum = Number(parts[1]);

  var state = computeMonthState_(config, allRows, mes);
  var lancamentos = listForView_(allRows, { mes: mes });

  var provisorio = true;
  var closed = closedPeriods || [];
  for (var i = 0; i < closed.length; i++) {
    if (closed[i] === mes) { provisorio = false; break; }
  }

  return {
    mes: mes,
    ano: ano,
    mesFmt: pad2_(mesNum) + '/' + ano,
    entradasMes: state.totalEntradas,
    saidasMes: state.totalSaidas,
    saldoMes: round2_(state.totalEntradas - state.totalSaidas),
    saldoAcumulado: state.saldoFinal,
    provisorio: provisorio,
    lancamentos: lancamentos.map(function (r) {
      var d = r.Data;
      var dataFmt = (d instanceof Date && !isNaN(d.getTime())) ? formatDate_(d) : '';
      return {
        Id: r.Id,
        Data: dataFmt,
        Tipo: r.Tipo,
        Categoria: r.Categoria,
        Valor: r.Valor,
        Descricao: r.Descricao,
        ComprovanteUrl: r.ComprovanteUrl || '',
        TemComprovante: !!(r.ComprovanteId && r.ComprovanteUrl)
      };
    })
  };
}

/**
 * Relatório anual completo (puro). Itera todos os 12 meses do ano, computa
 * séries mensais, quebra por categoria (normalizada), insights e flag
 * provisório por mês.
 */
function computeAnnualReport_(config, allRows, ano, closedPeriods) {
  ano = Number(ano);
  allRows = allRows || [];
  closedPeriods = closedPeriods || [];

  var abertura = 0;
  if (config != null && config.saldoAbertura != null && isFinite(Number(config.saldoAbertura))) {
    abertura = Number(config.saldoAbertura);
  }

  var meses = [];
  var totalEntradas = 0, totalSaidas = 0;
  var catEntrada = {}, catSaida = {};

  for (var m = 1; m <= 12; m++) {
    var mesKey = ano + '-' + pad2_(m);
    var state = computeMonthState_(config, allRows, mesKey);

    var provisorio = true;
    for (var ci = 0; ci < closedPeriods.length; ci++) {
      if (closedPeriods[ci] === mesKey) { provisorio = false; break; }
    }

    meses.push({
      mesKey: mesKey,
      mesFmt: pad2_(m) + '/' + ano,
      entradas: state.totalEntradas,
      saidas: state.totalSaidas,
      saldo: round2_(state.totalEntradas - state.totalSaidas),
      acumulado: state.saldoFinal,
      provisorio: provisorio
    });

    totalEntradas = round2_(totalEntradas + state.totalEntradas);
    totalSaidas = round2_(totalSaidas + state.totalSaidas);
  }

  // Categorias (normalizada → soma; primeira grafia)
  for (var ri = 0; ri < allRows.length; ri++) {
    var row = allRows[ri];
    if (!row || row.Excluido === true) continue;
    var rp = periodKey_(row.Data);
    if (rp.substring(0, 4) !== String(ano)) continue;
    var val = Number(row.Valor);
    if (!isFinite(val)) continue;
    var catRaw = String(row.Categoria == null ? '' : row.Categoria).trim();
    var catKey = normalizeCategoryKey_(catRaw);
    if (!catKey) continue;
    if (row.Tipo === 'entrada') {
      if (!catEntrada[catKey]) catEntrada[catKey] = { categoria: catRaw, total: 0 };
      catEntrada[catKey].total = round2_(catEntrada[catKey].total + val);
    } else if (row.Tipo === 'saida') {
      if (!catSaida[catKey]) catSaida[catKey] = { categoria: catRaw, total: 0 };
      catSaida[catKey].total = round2_(catSaida[catKey].total + val);
    }
  }

  function catList(map) {
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  var porCategoriaEntrada = catList(catEntrada);
  var porCategoriaSaida = catList(catSaida);
  var resultado = round2_(totalEntradas - totalSaidas);
  var saldoAcumulado = meses.length > 0 ? meses[11].acumulado : round2_(abertura);

  return {
    ano: ano,
    totalEntradas: totalEntradas,
    totalSaidas: totalSaidas,
    resultado: resultado,
    saldoAcumulado: saldoAcumulado,
    meses: meses,
    porCategoriaEntrada: porCategoriaEntrada,
    porCategoriaSaida: porCategoriaSaida,
    insights: buildInsights_(ano, meses, porCategoriaEntrada, porCategoriaSaida, totalEntradas, totalSaidas)
  };
}

/** Gera frases de insight em pt-BR a partir das séries mensais agregadas. */
function buildInsights_(ano, meses, catEntrada, catSaida, totalEntradas, totalSaidas) {
  var insights = [];
  if (!meses || !meses.length) return insights;

  var maxIdx = 0, minIdx = 0;
  for (var i = 1; i < meses.length; i++) {
    if (meses[i].saldo > meses[maxIdx].saldo) maxIdx = i;
    if (meses[i].saldo < meses[minIdx].saldo) minIdx = i;
  }
  insights.push('Melhor mês: ' + MONTH_NAMES_REL[maxIdx] + ' (saldo ' + formatBRL_(meses[maxIdx].saldo) + ').');
  insights.push('Mês mais apertado: ' + MONTH_NAMES_REL[minIdx] + ' (saldo ' + formatBRL_(meses[minIdx].saldo) + ').');

  var redMonths = [];
  for (var j = 0; j < meses.length; j++) {
    if (meses[j].saldo < 0) redMonths.push(MONTH_NAMES_REL[j]);
  }
  if (redMonths.length) {
    insights.push(redMonths.length + ' mês(es) fechou(aram) no vermelho: ' + redMonths.join(', ') + '.');
  } else {
    insights.push('Nenhum mês fechou no vermelho — saldo mensal sempre positivo.');
  }

  if (catSaida.length) {
    var top = catSaida[0];
    insights.push('Maior despesa do ano: ' + top.categoria + ' (' + formatBRL_(top.total)
      + ', ' + pct_(top.total, totalSaidas) + ' das saídas).');
  }
  if (catEntrada.length) {
    var topE = catEntrada[0];
    insights.push('Maior fonte de receita: ' + topE.categoria + ' (' + formatBRL_(topE.total)
      + ', ' + pct_(topE.total, totalEntradas) + ' das entradas).');
  }

  insights.push('Média de saídas por mês: ' + formatBRL_(totalSaidas / 12) + '.');

  var res = round2_(totalEntradas - totalSaidas);
  insights.push('Resultado de ' + ano + ': ' + (res >= 0 ? 'superávit' : 'déficit')
    + ' de ' + formatBRL_(Math.abs(res)) + '.');

  return insights;
}

/** Gera um gráfico de barras de saldo mensal em SVG puro. */
function buildSvgBars_(meses) {
  var w = 720, h = 200, pad = 28, n = 12;
  var maxAbs = 1;
  for (var i = 0; i < n && i < meses.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(meses[i].saldo));
  }
  var midY = h / 2;
  var slot = (w - pad * 2) / n;
  var barW = slot * 0.6;
  var svg = '<svg width="100%" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">';
  svg += '<line x1="' + pad + '" y1="' + midY + '" x2="' + (w - pad) + '" y2="' + midY + '" stroke="#999" stroke-width="1"/>';
  for (var j = 0; j < n && j < meses.length; j++) {
    var val = meses[j].saldo;
    var barH = Math.abs(val) / maxAbs * (h / 2 - pad);
    var x = pad + slot * j + (slot - barW) / 2;
    var y = val >= 0 ? midY - barH : midY;
    var color = val >= 0 ? '#137333' : '#c5221f';
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
      '" height="' + barH.toFixed(1) + '" fill="' + color + '"/>';
    svg += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - 8) +
      '" font-size="10" text-anchor="middle" fill="#555">' + MONTH_NAMES_REL[j] + '</text>';
  }
  svg += '</svg>';
  return svg;
}

/** Monta o HTML do PDF mensal (KPIs + tabela de lançamentos + comprovantes + privacy note). */
function buildMonthlyPdfHtml_(report, generatedStamp) {
  var badge = report.provisorio ? '<span style="color:#e65100">⚠ Provisório</span>' : '<span style="color:#137333">✔ Oficial (fechado)</span>';

  var rowsHtml = '';
  var lancs = report.lancamentos || [];
  for (var i = 0; i < lancs.length; i++) {
    var l = lancs[i];
    var compLink = l.TemComprovante
      ? '<a href="' + escapeHtml_(l.ComprovanteUrl) + '">ver</a>'
      : '—';
    rowsHtml += '<tr>'
      + '<td>' + escapeHtml_(l.Data) + '</td>'
      + '<td>' + escapeHtml_(l.Tipo) + '</td>'
      + '<td>' + escapeHtml_(l.Categoria) + '</td>'
      + '<td>' + escapeHtml_(l.Descricao) + '</td>'
      + '<td class="num">' + formatBRL_(l.Valor) + '</td>'
      + '<td>' + compLink + '</td>'
      + '</tr>';
  }

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>'
    + 'body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:12px;margin:24px;}'
    + 'h1{font-size:20px;margin:0 0 2px;}h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #1565c0;padding-bottom:4px;color:#0d47a1;}'
    + '.sub{color:#666;margin:0 0 16px;}'
    + '.kpis{width:100%;border-collapse:collapse;margin-bottom:8px;}'
    + '.kpis td{width:25%;background:#f4f6f8;border:1px solid #e0e0e0;padding:10px;text-align:center;}'
    + '.kpis .k{font-size:11px;color:#666;text-transform:uppercase;}'
    + '.kpis .v{font-size:17px;font-weight:bold;}'
    + 'table.data{width:100%;border-collapse:collapse;margin-bottom:8px;}'
    + 'table.data th,table.data td{border:1px solid #ddd;padding:5px 8px;}'
    + 'table.data th{background:#1565c0;color:#fff;text-align:left;font-size:11px;}'
    + '.num{text-align:right;font-variant-numeric:tabular-nums;}'
    + '.neg{color:#c5221f;}'
    + '.privacy{font-size:10px;color:#999;margin-top:4px;}'
    + '</style></head><body>'
    + '<h1>Prestação de Contas — APP</h1>'
    + '<p class="sub">Relatório Mensal · ' + escapeHtml_(report.mesFmt) + ' · ' + badge
    + ' · Emitido em ' + escapeHtml_(generatedStamp) + '</p>'
    + '<table class="kpis"><tr>'
    + '<td><div class="k">Entradas</div><div class="v">' + formatBRL_(report.entradasMes) + '</div></td>'
    + '<td><div class="k">Saídas</div><div class="v">' + formatBRL_(report.saidasMes) + '</div></td>'
    + '<td><div class="k">Saldo do Mês</div><div class="v ' + (report.saldoMes < 0 ? 'neg' : '') + '">' + formatBRL_(report.saldoMes) + '</div></td>'
    + '<td><div class="k">Acumulado</div><div class="v ' + (report.saldoAcumulado < 0 ? 'neg' : '') + '">' + formatBRL_(report.saldoAcumulado) + '</div></td>'
    + '</tr></table>'
    + '<h2>Lançamentos</h2>'
    + '<table class="data"><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Comprovante</th></tr>'
    + rowsHtml
    + '</table>'
    + '<p class="privacy">Os links de comprovante são públicos. Evite anexar documentos com dados pessoais sensíveis.</p>'
    + '</body></html>';
}

/** Monta o HTML do PDF anual (KPIs + tabela mensal + categorias + SVG + insights). */
function buildAnnualPdfHtml_(report, generatedStamp) {
  var bars = buildSvgBars_(report.meses);

  function catRows(list) {
    return list.map(function (c) {
      return '<tr><td>' + escapeHtml_(c.categoria) + '</td><td class="num">' + formatBRL_(c.total) + '</td></tr>';
    }).join('');
  }

  var monthRows = '';
  for (var i = 0; i < report.meses.length; i++) {
    var m = report.meses[i];
    monthRows += '<tr>'
      + '<td>' + MONTH_NAMES_REL[i] + '</td>'
      + '<td class="num">' + formatBRL_(m.entradas) + '</td>'
      + '<td class="num">' + formatBRL_(m.saidas) + '</td>'
      + '<td class="num ' + (m.saldo < 0 ? 'neg' : '') + '">' + formatBRL_(m.saldo) + '</td>'
      + '<td class="num ' + (m.acumulado < 0 ? 'neg' : '') + '">' + formatBRL_(m.acumulado) + '</td>'
      + '</tr>';
  }

  var insightItems = (report.insights || []).map(function (s) {
    return '<li>' + escapeHtml_(s) + '</li>';
  }).join('');

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>'
    + 'body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:12px;margin:24px;}'
    + 'h1{font-size:20px;margin:0 0 2px;}h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #1565c0;padding-bottom:4px;color:#0d47a1;}'
    + '.sub{color:#666;margin:0 0 16px;}'
    + '.kpis{width:100%;border-collapse:collapse;margin-bottom:8px;}'
    + '.kpis td{width:33%;background:#f4f6f8;border:1px solid #e0e0e0;padding:10px;text-align:center;}'
    + '.kpis .k{font-size:11px;color:#666;text-transform:uppercase;}'
    + '.kpis .v{font-size:17px;font-weight:bold;}'
    + 'table.data{width:100%;border-collapse:collapse;margin-bottom:8px;}'
    + 'table.data th,table.data td{border:1px solid #ddd;padding:5px 8px;}'
    + 'table.data th{background:#1565c0;color:#fff;text-align:left;font-size:11px;}'
    + '.num{text-align:right;font-variant-numeric:tabular-nums;}'
    + '.neg{color:#c5221f;}'
    + '.cols{width:100%;}.cols td{vertical-align:top;width:50%;}'
    + 'ul{margin:6px 0 0 18px;}li{margin-bottom:4px;}'
    + '</style></head><body>'
    + '<h1>Prestação de Contas — APP</h1>'
    + '<p class="sub">Associação de Pais e Mestres · Exercício ' + report.ano
    + ' · Emitido em ' + escapeHtml_(generatedStamp) + '</p>'
    + '<table class="kpis"><tr>'
    + '<td><div class="k">Entradas</div><div class="v">' + formatBRL_(report.totalEntradas) + '</div></td>'
    + '<td><div class="k">Saídas</div><div class="v">' + formatBRL_(report.totalSaidas) + '</div></td>'
    + '<td><div class="k">Resultado</div><div class="v ' + (report.resultado < 0 ? 'neg' : '') + '">'
    + formatBRL_(report.resultado) + '</div></td>'
    + '</tr></table>'
    + '<h2>Saldo por mês</h2>' + bars
    + '<h2>Movimento mensal</h2>'
    + '<table class="data"><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Acumulado</th></tr>'
    + monthRows + '</table>'
    + '<h2>Por categoria</h2>'
    + '<table class="cols"><tr><td>'
    + '<table class="data"><tr><th>Receita</th><th>Total</th></tr>' + catRows(report.porCategoriaEntrada) + '</table>'
    + '</td><td>'
    + '<table class="data"><tr><th>Despesa</th><th>Total</th></tr>' + catRows(report.porCategoriaSaida) + '</table>'
    + '</td></tr></table>'
    + '<h2>Destaques do ano</h2><ul>' + insightItems + '</ul>'
    + '</body></html>';
}

// ===========================================================================
// NFe key parsing, validation & scan description builder
// ===========================================================================

var UF_CODES = {
  11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',
  24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',
  41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'
};

/**
 * Decodes a 44-digit NFe access key into its components.
 * Throws if input is not exactly 44 digits.
 */
function parseChaveNFe_(chave) {
  if (typeof chave !== 'string' || !/^\d{44}$/.test(chave)) {
    throw new Error('Chave NFe deve conter exatamente 44 dígitos numéricos.');
  }
  var cUF = parseInt(chave.substring(0, 2), 10);
  return {
    cUF: cUF,
    uf: UF_CODES[cUF] || '',
    ano: parseInt(chave.substring(2, 4), 10),
    mes: parseInt(chave.substring(4, 6), 10),
    cnpj: chave.substring(6, 20),
    modelo: parseInt(chave.substring(20, 22), 10),
    serie: parseInt(chave.substring(22, 25), 10),
    numero: parseInt(chave.substring(25, 34), 10),
    cDV: parseInt(chave.substring(43, 44), 10)
  };
}

/**
 * Returns true if the key is exactly 44 digits AND the cDV mod-11 check passes.
 * Never throws.
 */
function chaveValida_(chave) {
  try {
    if (typeof chave !== 'string' || !/^\d{44}$/.test(chave)) return false;
    var ch43 = chave.substring(0, 43);
    var pesos = [2, 3, 4, 5, 6, 7, 8, 9];
    var soma = 0;
    var p = 0;
    for (var i = ch43.length - 1; i >= 0; i--) {
      soma += parseInt(ch43.charAt(i), 10) * pesos[p % 8];
      p++;
    }
    var dv = 11 - (soma % 11);
    var expected = dv >= 10 ? 0 : dv;
    return expected === parseInt(chave.charAt(43), 10);
  } catch (e) {
    return false;
  }
}

/**
 * Builds scan description: FORNECEDOR (Cidade/UF) — itens
 * Truncated to DESCRICAO_MAX chars with '…'.
 */
function buildScanDescription_(data) {
  var fornecedor = (data && data.fornecedor || '').trim();
  if (!fornecedor) return '';

  var cidade = (data.cidade || '').trim();
  var uf = (data.uf || '').trim();
  var itens = (data.itens || '').trim();

  var result = fornecedor;
  if (cidade || uf) {
    result += ' (' + (cidade && uf ? cidade + '/' + uf : cidade || uf) + ')';
  }
  if (itens) {
    result += ' \u2014 ' + itens;
  }
  if (result.length > DESCRICAO_MAX) {
    result = result.substring(0, DESCRICAO_MAX - 1) + '\u2026';
  }
  return result;
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
    computeMonthState_: computeMonthState_,
    listForView_: listForView_,
    dedupDecision_: dedupDecision_,
    closeDecision_: closeDecision_,
    reopenDecision_: reopenDecision_,
    validateLancamentoClient_: validateLancamentoClient_,
    validateDeleteClient_: validateDeleteClient_,
    validateComprovante_: validateComprovante_,
    comprovanteFileName_: comprovanteFileName_,
    extForMime_: extForMime_,
    COMPROVANTE_TIPOS: COMPROVANTE_TIPOS,
    COMPROVANTE_MAX_BYTES: COMPROVANTE_MAX_BYTES,
    escapeHtml_: escapeHtml_,
    toSortedPairs_: toSortedPairs_,
    pct_: pct_,
    reportPdfFileName_: reportPdfFileName_,
    computeMonthReport_: computeMonthReport_,
    computeAnnualReport_: computeAnnualReport_,
    buildInsights_: buildInsights_,
    buildSvgBars_: buildSvgBars_,
    buildMonthlyPdfHtml_: buildMonthlyPdfHtml_,
    buildAnnualPdfHtml_: buildAnnualPdfHtml_,
    MONTH_NAMES_REL: MONTH_NAMES_REL,
    UF_CODES: UF_CODES,
    parseChaveNFe_: parseChaveNFe_,
    chaveValida_: chaveValida_,
    buildScanDescription_: buildScanDescription_
  };
}
