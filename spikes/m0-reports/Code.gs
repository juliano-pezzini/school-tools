/**
 * Spike M0 — Capacidade de Relatórios & Gráficos (desafio E do AD-007).
 *
 * Objetivo: comprovar EMPIRICAMENTE que a stack provisória (Apps Script + Sheets/Drive)
 * dá conta dos relatórios do Fluxo de Caixa da APP, especificamente:
 *   1. Agregar dados de lançamentos (Sheets) em relatórios MENSAL e ANUAL.
 *   2. Renderizar GRÁFICOS ricos na UI (Chart.js sob a CSP do HtmlService).
 *   3. Gerar INSIGHTS anuais (categorias, tendências, meses no vermelho).
 *   4. Exportar um RELATÓRIO EM PDF e compartilhá-lo por link (transparência da APP — B-006).
 *   5. Localização pt-BR (R$, vírgula decimal, dd/mm/aaaa, timezone America/Sao_Paulo).
 *
 * É descartável: na primeira execução cria uma planilha de exemplo com ~1 ano de
 * lançamentos fictícios da associação de pais e mestres. Nenhum dado real é usado.
 */

var TZ = 'America/Sao_Paulo';
var PROP_SHEET_ID = 'REPORTS_SPIKE_SHEET_ID';
var DATA_SHEET_NAME = 'Lancamentos';

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Spike Relatórios — Ensina Blumenau')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// Data layer (Sheets)
// ---------------------------------------------------------------------------

/**
 * Devolve a planilha de dados, criando e populando com exemplos na 1ª vez.
 */
function getDataSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // planilha foi apagada — recria abaixo
    }
  }
  var ss = SpreadsheetApp.create('Spike Relatórios — Dados (exemplo)');
  var sheet = ss.getSheets()[0];
  sheet.setName(DATA_SHEET_NAME);
  seedData_(sheet);
  props.setProperty(PROP_SHEET_ID, ss.getId());
  return ss;
}

/**
 * Escreve ~1 ano de lançamentos fictícios da APP (entradas e saídas).
 * Colunas: Data | Tipo (entrada/saida) | Categoria | Descrição | Valor
 */
function seedData_(sheet) {
  sheet.clear();
  sheet.getRange(1, 1, 1, 5)
    .setValues([['Data', 'Tipo', 'Categoria', 'Descricao', 'Valor']])
    .setFontWeight('bold');

  var rows = [];
  function add(y, m, d, type, cat, desc, val) {
    rows.push([new Date(y, m - 1, d), type, cat, desc, val]);
  }

  // Padrão mensal recorrente + variações sazonais (ano de 2025).
  for (var month = 1; month <= 12; month++) {
    // Entradas recorrentes
    add(2025, month, 5, 'entrada', 'Contribuição', 'Contribuição mensal dos pais', 1200 + (month % 3) * 80);
    add(2025, month, 12, 'entrada', 'Cantina', 'Receita da cantina', 320 + (month % 4) * 45);

    // Saídas recorrentes
    add(2025, month, 8, 'saida', 'Material', 'Material escolar e de uso', 280 + (month % 5) * 30);
    add(2025, month, 15, 'saida', 'Limpeza', 'Produtos de limpeza', 160 + (month % 2) * 40);
    add(2025, month, 20, 'saida', 'Manutenção', 'Pequenos reparos', 210 + (month % 6) * 55);
  }

  // Eventos sazonais (entradas grandes pontuais)
  add(2025, 3, 22, 'entrada', 'Evento', 'Festa de outono — barracas', 2150.50);
  add(2025, 6, 14, 'entrada', 'Evento', 'Festa junina — quermesse', 4820.90);
  add(2025, 10, 18, 'entrada', 'Rifa', 'Rifa do dia das crianças', 1875.00);
  add(2025, 11, 29, 'entrada', 'Evento', 'Bazar de fim de ano', 2640.75);

  // Despesas grandes pontuais (alguns meses ficam no vermelho)
  add(2025, 2, 19, 'saida', 'Manutenção', 'Conserto do telhado da quadra', 3650.00);
  add(2025, 6, 10, 'saida', 'Evento', 'Insumos da festa junina', 2980.40);
  add(2025, 8, 25, 'saida', 'Material', 'Compra de livros paradidáticos', 1740.00);
  add(2025, 9, 9, 'saida', 'Manutenção', 'Pintura das salas', 2310.30);
  add(2025, 12, 5, 'saida', 'Evento', 'Lembrancinhas de formatura', 1980.00);

  // Ordena por data antes de gravar
  rows.sort(function (a, b) { return a[0] - b[0]; });
  sheet.getRange(2, 1, rows.length, 5).setValues(rows);

  // Formatação pt-BR da própria planilha (autonomia: usuário entende os dados)
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, 5, rows.length, 1).setNumberFormat('R$ #,##0.00');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

/**
 * Lê todos os lançamentos como objetos.
 */
function readEntries_() {
  var ss = getDataSpreadsheet_();
  var sheet = ss.getSheetByName(DATA_SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var entries = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var date = row[0] instanceof Date ? row[0] : new Date(row[0]);
    entries.push({
      date: date,
      year: date.getFullYear(),
      month: date.getMonth() + 1, // 1..12
      day: date.getDate(),
      type: String(row[1]).toLowerCase(),
      category: String(row[2]),
      description: String(row[3]),
      value: Number(row[4]) || 0
    });
  }
  return entries;
}

/** Reseta os dados de exemplo (re-popula a planilha). */
function resetData() {
  var ss = getDataSpreadsheet_();
  seedData_(ss.getSheetByName(DATA_SHEET_NAME));
  return 'Dados de exemplo recriados.';
}

// ---------------------------------------------------------------------------
// Report aggregation
// ---------------------------------------------------------------------------

var MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Lista os anos com lançamentos (para o seletor). */
function getAvailableYears() {
  var entries = readEntries_();
  var set = {};
  entries.forEach(function (e) { set[e.year] = true; });
  return Object.keys(set).map(Number).sort();
}

/**
 * Relatório mensal: totais, saldo do mês, saldo acumulado e quebra por categoria.
 */
function getMonthlyReport(year, month) {
  year = Number(year);
  month = Number(month);
  var entries = readEntries_();

  var income = 0, expense = 0;
  var byCategoryIncome = {}, byCategoryExpense = {};
  var lines = [];
  var runningBalance = 0; // acumulado até o fim do mês selecionado

  entries.forEach(function (e) {
    if (e.year !== year) return;
    var beforeOrIn = e.month <= month;
    if (e.type === 'entrada') {
      if (beforeOrIn) runningBalance += e.value;
      if (e.month === month) {
        income += e.value;
        byCategoryIncome[e.category] = (byCategoryIncome[e.category] || 0) + e.value;
      }
    } else {
      if (beforeOrIn) runningBalance -= e.value;
      if (e.month === month) {
        expense += e.value;
        byCategoryExpense[e.category] = (byCategoryExpense[e.category] || 0) + e.value;
      }
    }
    if (e.month === month) {
      lines.push({
        date: formatDate_(e.date),
        type: e.type,
        category: e.category,
        description: e.description,
        value: e.value
      });
    }
  });

  lines.sort(function (a, b) { return a.date.localeCompare(b.date); });

  return {
    year: year,
    month: month,
    monthName: MONTH_NAMES[month - 1],
    income: income,
    expense: expense,
    balance: income - expense,
    accumulatedBalance: runningBalance,
    byCategoryIncome: toSortedPairs_(byCategoryIncome),
    byCategoryExpense: toSortedPairs_(byCategoryExpense),
    lines: lines
  };
}

/**
 * Relatório anual: séries por mês + quebras por categoria + insights.
 */
function getAnnualReport(year) {
  year = Number(year);
  var entries = readEntries_();

  var monthlyIncome = zeros12_();
  var monthlyExpense = zeros12_();
  var byCategoryIncome = {}, byCategoryExpense = {};
  var totalIncome = 0, totalExpense = 0;

  entries.forEach(function (e) {
    if (e.year !== year) return;
    if (e.type === 'entrada') {
      monthlyIncome[e.month - 1] += e.value;
      byCategoryIncome[e.category] = (byCategoryIncome[e.category] || 0) + e.value;
      totalIncome += e.value;
    } else {
      monthlyExpense[e.month - 1] += e.value;
      byCategoryExpense[e.category] = (byCategoryExpense[e.category] || 0) + e.value;
      totalExpense += e.value;
    }
  });

  // Séries derivadas
  var monthlyBalance = [];
  var accumulated = [];
  var running = 0;
  for (var i = 0; i < 12; i++) {
    var bal = monthlyIncome[i] - monthlyExpense[i];
    monthlyBalance.push(bal);
    running += bal;
    accumulated.push(running);
  }

  return {
    year: year,
    months: MONTH_NAMES,
    monthlyIncome: monthlyIncome,
    monthlyExpense: monthlyExpense,
    monthlyBalance: monthlyBalance,
    accumulated: accumulated,
    totalIncome: totalIncome,
    totalExpense: totalExpense,
    yearBalance: totalIncome - totalExpense,
    byCategoryIncome: toSortedPairs_(byCategoryIncome),
    byCategoryExpense: toSortedPairs_(byCategoryExpense),
    insights: buildInsights_(year, monthlyIncome, monthlyExpense, monthlyBalance,
      byCategoryIncome, byCategoryExpense, totalIncome, totalExpense)
  };
}

/** Gera frases de insight em pt-BR a partir das séries agregadas. */
function buildInsights_(year, mInc, mExp, mBal, catInc, catExp, totalInc, totalExp) {
  var insights = [];

  // Mês de maior e menor saldo
  var maxIdx = 0, minIdx = 0;
  for (var i = 1; i < 12; i++) {
    if (mBal[i] > mBal[maxIdx]) maxIdx = i;
    if (mBal[i] < mBal[minIdx]) minIdx = i;
  }
  insights.push('Melhor mês: ' + MONTH_NAMES[maxIdx] + ' (saldo ' + formatBRL_(mBal[maxIdx]) + ').');
  insights.push('Mês mais apertado: ' + MONTH_NAMES[minIdx] + ' (saldo ' + formatBRL_(mBal[minIdx]) + ').');

  // Meses no vermelho
  var redMonths = [];
  for (var j = 0; j < 12; j++) if (mBal[j] < 0) redMonths.push(MONTH_NAMES[j]);
  if (redMonths.length) {
    insights.push(redMonths.length + ' mês(es) fechou(aram) no vermelho: ' + redMonths.join(', ') + '.');
  } else {
    insights.push('Nenhum mês fechou no vermelho — saldo mensal sempre positivo.');
  }

  // Maior categoria de despesa e de receita
  var topExp = topPair_(catExp);
  var topInc = topPair_(catInc);
  if (topExp) {
    insights.push('Maior despesa do ano: ' + topExp.key + ' (' + formatBRL_(topExp.value)
      + ', ' + pct_(topExp.value, totalExp) + ' das saídas).');
  }
  if (topInc) {
    insights.push('Maior fonte de receita: ' + topInc.key + ' (' + formatBRL_(topInc.value)
      + ', ' + pct_(topInc.value, totalInc) + ' das entradas).');
  }

  // Média mensal de saídas
  insights.push('Média de saídas por mês: ' + formatBRL_(totalExp / 12) + '.');

  // Resultado do ano
  var result = totalInc - totalExp;
  insights.push('Resultado de ' + year + ': ' + (result >= 0 ? 'superávit' : 'déficit')
    + ' de ' + formatBRL_(Math.abs(result)) + '.');

  return insights;
}

// ---------------------------------------------------------------------------
// PDF export + sharing (Drive)
// ---------------------------------------------------------------------------

/**
 * Gera o relatório anual em PDF (HTML → PDF via Blob), salva no Drive,
 * libera por link de leitura e devolve a URL. Prova a transparência da APP (B-006).
 */
function exportAnnualPdf(year) {
  year = Number(year);
  var r = getAnnualReport(year);
  var html = buildPdfHtml_(r);

  var blob = Utilities.newBlob(html, 'text/html', 'relatorio.html').getAs('application/pdf');
  blob.setName('Relatorio_APP_' + year + '.pdf');

  var folder = getReportFolder_();
  var file = folder.createFile(blob);
  // Link público de LEITURA (transparência para pais sem conta do domínio).
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return { name: file.getName(), url: file.getUrl(), id: file.getId() };
}

function getReportFolder_() {
  var name = 'Spike Relatórios — PDFs';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** Monta o HTML do PDF: cabeçalho, KPIs, gráfico de barras em SVG, tabelas e insights. */
function buildPdfHtml_(r) {
  var generated = Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy 'às' HH:mm");

  var bars = buildSvgBars_(r);

  function catRows(pairs) {
    return pairs.map(function (p) {
      return '<tr><td>' + escapeHtml_(p.key) + '</td><td class="num">' + formatBRL_(p.value) + '</td></tr>';
    }).join('');
  }

  function monthRows() {
    var out = '';
    for (var i = 0; i < 12; i++) {
      out += '<tr>'
        + '<td>' + r.months[i] + '</td>'
        + '<td class="num">' + formatBRL_(r.monthlyIncome[i]) + '</td>'
        + '<td class="num">' + formatBRL_(r.monthlyExpense[i]) + '</td>'
        + '<td class="num ' + (r.monthlyBalance[i] < 0 ? 'neg' : '') + '">' + formatBRL_(r.monthlyBalance[i]) + '</td>'
        + '<td class="num ' + (r.accumulated[i] < 0 ? 'neg' : '') + '">' + formatBRL_(r.accumulated[i]) + '</td>'
        + '</tr>';
    }
    return out;
  }

  var insightItems = r.insights.map(function (s) {
    return '<li>' + escapeHtml_(s) + '</li>';
  }).join('');

  return '' +
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:12px;margin:24px;}' +
    'h1{font-size:20px;margin:0 0 2px;}h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #1565c0;padding-bottom:4px;color:#0d47a1;}' +
    '.sub{color:#666;margin:0 0 16px;}' +
    '.kpis{width:100%;border-collapse:collapse;margin-bottom:8px;}' +
    '.kpis td{width:33%;background:#f4f6f8;border:1px solid #e0e0e0;padding:10px;text-align:center;}' +
    '.kpis .k{font-size:11px;color:#666;text-transform:uppercase;}' +
    '.kpis .v{font-size:17px;font-weight:bold;}' +
    'table.data{width:100%;border-collapse:collapse;margin-bottom:8px;}' +
    'table.data th,table.data td{border:1px solid #ddd;padding:5px 8px;}' +
    'table.data th{background:#1565c0;color:#fff;text-align:left;font-size:11px;}' +
    '.num{text-align:right;font-variant-numeric:tabular-nums;}' +
    '.neg{color:#c5221f;}' +
    'ul{margin:6px 0 0 18px;}li{margin-bottom:4px;}' +
    '.cols{width:100%;}.cols td{vertical-align:top;width:50%;}' +
    '</style></head><body>' +
    '<h1>Prestação de Contas — APP</h1>' +
    '<p class="sub">Associação de Pais e Mestres · Exercício ' + r.year +
    ' · Emitido em ' + generated + '</p>' +

    '<table class="kpis"><tr>' +
    '<td><div class="k">Entradas</div><div class="v">' + formatBRL_(r.totalIncome) + '</div></td>' +
    '<td><div class="k">Saídas</div><div class="v">' + formatBRL_(r.totalExpense) + '</div></td>' +
    '<td><div class="k">Resultado</div><div class="v ' + (r.yearBalance < 0 ? 'neg' : '') + '">' +
    formatBRL_(r.yearBalance) + '</div></td>' +
    '</tr></table>' +

    '<h2>Saldo por mês</h2>' + bars +

    '<h2>Movimento mensal</h2>' +
    '<table class="data"><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Acumulado</th></tr>' +
    monthRows() + '</table>' +

    '<h2>Por categoria</h2>' +
    '<table class="cols"><tr><td>' +
    '<table class="data"><tr><th>Receita</th><th>Total</th></tr>' + catRows(r.byCategoryIncome) + '</table>' +
    '</td><td>' +
    '<table class="data"><tr><th>Despesa</th><th>Total</th></tr>' + catRows(r.byCategoryExpense) + '</table>' +
    '</td></tr></table>' +

    '<h2>Destaques do ano</h2><ul>' + insightItems + '</ul>' +

    '</body></html>';
}

/** Gera um gráfico de barras de saldo mensal em SVG puro (sem dependências). */
function buildSvgBars_(r) {
  var w = 720, h = 200, pad = 28, n = 12;
  var maxAbs = 1;
  for (var i = 0; i < 12; i++) maxAbs = Math.max(maxAbs, Math.abs(r.monthlyBalance[i]));
  var midY = h / 2;
  var slot = (w - pad * 2) / n;
  var barW = slot * 0.6;
  var svg = '<svg width="100%" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">';
  svg += '<line x1="' + pad + '" y1="' + midY + '" x2="' + (w - pad) + '" y2="' + midY + '" stroke="#999" stroke-width="1"/>';
  for (var j = 0; j < 12; j++) {
    var val = r.monthlyBalance[j];
    var barH = Math.abs(val) / maxAbs * (h / 2 - pad);
    var x = pad + slot * j + (slot - barW) / 2;
    var y = val >= 0 ? midY - barH : midY;
    var color = val >= 0 ? '#137333' : '#c5221f';
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
      '" height="' + barH.toFixed(1) + '" fill="' + color + '"/>';
    svg += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - 8) +
      '" font-size="10" text-anchor="middle" fill="#555">' + r.months[j] + '</text>';
  }
  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------------
// Helpers (pt-BR formatting + utils)
// ---------------------------------------------------------------------------

function zeros12_() { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; }

function toSortedPairs_(obj) {
  return Object.keys(obj)
    .map(function (k) { return { key: k, value: obj[k] }; })
    .sort(function (a, b) { return b.value - a.value; });
}

function topPair_(obj) {
  var pairs = toSortedPairs_(obj);
  return pairs.length ? pairs[0] : null;
}

function pct_(part, whole) {
  if (!whole) return '0%';
  return Math.round(part / whole * 100) + '%';
}

/** Formata valor em Reais no padrão pt-BR (R$ 1.234,56). */
function formatBRL_(value) {
  var n = Math.round(value * 100) / 100;
  var neg = n < 0;
  n = Math.abs(n);
  var s = n.toFixed(2).split('.');
  var intPart = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + 'R$ ' + intPart + ',' + s[1];
}

function formatDate_(date) {
  return Utilities.formatDate(date, TZ, 'dd/MM/yyyy');
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
