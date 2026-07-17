// cash-flow/relatorio.test.js — Testes dos helpers e funções de relatório (logic.js)
import { describe, it, expect } from 'vitest';
import {
  escapeHtml_,
  toSortedPairs_,
  pct_,
  reportPdfFileName_
} from './logic.js';

// ===========================================================================
// T1 — Helpers puros de relatório
// ===========================================================================

describe('escapeHtml_', () => {
  it('escapa & < > " \'', () => {
    expect(escapeHtml_('a & b < c > d "e" f\'g'))
      .toBe('a &amp; b &lt; c &gt; d &quot;e&quot; f&#39;g');
  });

  it('retorna string inalterada quando não há caracteres especiais', () => {
    expect(escapeHtml_('texto simples 123')).toBe('texto simples 123');
  });

  it('converte não-strings para string', () => {
    expect(escapeHtml_(42)).toBe('42');
    expect(escapeHtml_(null)).toBe('null');
    expect(escapeHtml_(undefined)).toBe('undefined');
  });
});

describe('toSortedPairs_', () => {
  it('retorna pares ordenados por value decrescente', () => {
    expect(toSortedPairs_({ a: 10, b: 30, c: 20 })).toEqual([
      { key: 'b', value: 30 },
      { key: 'c', value: 20 },
      { key: 'a', value: 10 }
    ]);
  });

  it('retorna array vazio para objeto vazio', () => {
    expect(toSortedPairs_({})).toEqual([]);
  });

  it('lida com valores iguais (ordem estável entre chaves)', () => {
    var result = toSortedPairs_({ x: 5, y: 5 });
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(5);
    expect(result[1].value).toBe(5);
  });
});

describe('pct_', () => {
  it('calcula percentual inteiro', () => {
    expect(pct_(50, 200)).toBe('25%');
  });

  it('retorna 0% quando whole é zero', () => {
    expect(pct_(0, 0)).toBe('0%');
  });

  it('retorna 0% quando whole é falsy (null/undefined)', () => {
    expect(pct_(10, null)).toBe('0%');
    expect(pct_(10, undefined)).toBe('0%');
  });

  it('arredonda para o inteiro mais próximo', () => {
    expect(pct_(1, 3)).toBe('33%');
    expect(pct_(2, 3)).toBe('67%');
  });

  it('retorna 100% quando part === whole', () => {
    expect(pct_(500, 500)).toBe('100%');
  });
});

describe('reportPdfFileName_', () => {
  it('gera nome para relatório mensal', () => {
    expect(reportPdfFileName_('mensal', '2025-07'))
      .toBe('Relatorio_APP_mensal_2025-07.pdf');
  });

  it('gera nome para relatório anual', () => {
    expect(reportPdfFileName_('anual', '2025'))
      .toBe('Relatorio_APP_anual_2025.pdf');
  });
});
