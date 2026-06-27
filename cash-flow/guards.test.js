import { describe, it, expect } from 'vitest';
const {
  parseDateBR_,
  assertNotFuture_,
  assertPeriodOpen_,
} = require('./logic.js');

const d = (s) => parseDateBR_(s);

describe('assertNotFuture_', () => {
  const hoje = d('15/06/2026');

  it('aceita a data de hoje', () => {
    expect(assertNotFuture_(d('15/06/2026'), hoje)).toBe(true);
  });

  it('aceita data passada', () => {
    expect(assertNotFuture_(d('14/06/2026'), hoje)).toBe(true);
    expect(assertNotFuture_(d('01/06/2026'), hoje)).toBe(true);
    expect(assertNotFuture_(d('31/12/2025'), hoje)).toBe(true);
  });

  it('rejeita data futura (pt-BR)', () => {
    expect(() => assertNotFuture_(d('16/06/2026'), hoje)).toThrow(/data futura/);
    expect(() => assertNotFuture_(d('30/06/2026'), hoje)).toThrow(/data futura/);
    expect(() => assertNotFuture_(d('01/01/2027'), hoje)).toThrow(/data futura/);
  });

  it('aceita o último dia do mês corrente quando é hoje', () => {
    expect(assertNotFuture_(d('30/06/2026'), d('30/06/2026'))).toBe(true);
  });
});

describe('assertPeriodOpen_', () => {
  it('aceita mês sem linha (aberto)', () => {
    expect(assertPeriodOpen_(d('10/06/2026'), [])).toBe(true);
    expect(assertPeriodOpen_(d('10/06/2026'), ['2026-05'])).toBe(true);
  });

  it('rejeita data em mês fechado com rótulo MM/AAAA', () => {
    expect(() => assertPeriodOpen_(d('10/05/2026'), ['2026-05']))
      .toThrow(/05\/2026 está fechado/);
  });

  it('rejeita qualquer dia dentro do mês fechado', () => {
    expect(() => assertPeriodOpen_(d('01/05/2026'), ['2026-05'])).toThrow();
    expect(() => assertPeriodOpen_(d('31/05/2026'), ['2026-05'])).toThrow();
  });

  it('só fecha o período exato (mês vizinho permanece aberto)', () => {
    expect(assertPeriodOpen_(d('30/04/2026'), ['2026-05'])).toBe(true);
    expect(assertPeriodOpen_(d('01/06/2026'), ['2026-05'])).toBe(true);
  });
});
