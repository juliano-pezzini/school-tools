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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatBRL_: formatBRL_,
    formatDate_: formatDate_,
    parseDateBR_: parseDateBR_,
    periodKey_: periodKey_,
    currentMonthKey_: currentMonthKey_
  };
}
