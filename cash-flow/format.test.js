import { describe, it, expect } from 'vitest';
const {
  formatBRL_,
  formatDate_,
  parseDateBR_,
  periodKey_,
  currentMonthKey_,
} = require('./logic.js');

describe('formatBRL_', () => {
  it('formata valor com milhar e 2 casas (pt-BR)', () => {
    expect(formatBRL_(1234.56)).toBe('R$ 1.234,56');
  });

  it('formata o saldo do cenário do spec (1150)', () => {
    expect(formatBRL_(1150)).toBe('R$ 1.150,00');
  });

  it('formata o teto técnico com dois separadores de milhar', () => {
    expect(formatBRL_(1000000)).toBe('R$ 1.000.000,00');
  });

  it('formata zero', () => {
    expect(formatBRL_(0)).toBe('R$ 0,00');
  });

  it('formata negativos com sinal antes do R$', () => {
    expect(formatBRL_(-50)).toBe('-R$ 50,00');
  });

  it('arredonda para 2 casas', () => {
    expect(formatBRL_(2.005)).toBe('R$ 2,01');
  });
});

describe('parseDateBR_ / formatDate_', () => {
  it('faz ida-e-volta dd/MM/yyyy', () => {
    expect(formatDate_(parseDateBR_('25/12/2026'))).toBe('25/12/2026');
  });

  it('preserva zero à esquerda em dia/mês', () => {
    expect(formatDate_(parseDateBR_('05/03/2026'))).toBe('05/03/2026');
  });

  it('rejeita data vazia', () => {
    expect(() => parseDateBR_('')).toThrow();
    expect(() => parseDateBR_(null)).toThrow();
    expect(() => parseDateBR_('   ')).toThrow();
  });

  it('rejeita formato incorreto', () => {
    expect(() => parseDateBR_('2026-01-01')).toThrow();
    expect(() => parseDateBR_('abc')).toThrow();
    expect(() => parseDateBR_('1/1/2026')).toThrow();
  });

  it('rejeita data inexistente (31/02)', () => {
    expect(() => parseDateBR_('31/02/2026')).toThrow();
    expect(() => parseDateBR_('00/01/2026')).toThrow();
    expect(() => parseDateBR_('13/13/2026')).toThrow();
  });

  it('formatDate_ rejeita Date inválida', () => {
    expect(() => formatDate_(new Date('invalid'))).toThrow();
    expect(() => formatDate_('25/12/2026')).toThrow();
  });
});

describe('periodKey_ / currentMonthKey_', () => {
  it('retorna YYYY-MM', () => {
    expect(periodKey_(parseDateBR_('25/12/2026'))).toBe('2026-12');
  });

  it('preenche o mês com zero à esquerda', () => {
    expect(periodKey_(parseDateBR_('05/03/2026'))).toBe('2026-03');
  });

  it('currentMonthKey_ usa a data de "hoje" (parâmetro)', () => {
    expect(currentMonthKey_(parseDateBR_('15/06/2026'))).toBe('2026-06');
  });
});
