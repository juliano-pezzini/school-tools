import { describe, it, expect } from 'vitest';
const { computeCashState_ } = require('./logic.js');

describe('computeCashState_', () => {
  it('cenário do Independent Test: 1000 + 200 − 50 = 1150', () => {
    const config = { saldoAbertura: 1000 };
    const rows = [
      { Tipo: 'entrada', Valor: 200, Excluido: false },
      { Tipo: 'saida', Valor: 50, Excluido: false },
    ];
    const s = computeCashState_(config, rows);
    expect(s.totalEntradas).toBe(200);
    expect(s.totalSaidas).toBe(50);
    expect(s.saldoAtual).toBe(1150);
    expect(s.aberturaDefinida).toBe(true);
    expect(s.saldoAbertura).toBe(1000);
  });

  it('excluir a entrada leva o saldo a 950', () => {
    const config = { saldoAbertura: 1000 };
    const rows = [
      { Tipo: 'entrada', Valor: 200, Excluido: true },
      { Tipo: 'saida', Valor: 50, Excluido: false },
    ];
    const s = computeCashState_(config, rows);
    expect(s.totalEntradas).toBe(0);
    expect(s.totalSaidas).toBe(50);
    expect(s.saldoAtual).toBe(950);
  });

  it('abertura indefinida ⇒ trata como 0 e sinaliza', () => {
    const rows = [{ Tipo: 'entrada', Valor: 200, Excluido: false }];
    const s1 = computeCashState_(null, rows);
    expect(s1.aberturaDefinida).toBe(false);
    expect(s1.saldoAbertura).toBe(0);
    expect(s1.saldoAtual).toBe(200);

    const s2 = computeCashState_({}, rows);
    expect(s2.aberturaDefinida).toBe(false);
    expect(s2.saldoAtual).toBe(200);
  });

  it('abertura zero é definida (R$ 0,00 ≠ indefinida)', () => {
    const s = computeCashState_({ saldoAbertura: 0 }, []);
    expect(s.aberturaDefinida).toBe(true);
    expect(s.saldoAtual).toBe(0);
  });

  it('permite saldo negativo (não bloqueia)', () => {
    const s = computeCashState_({ saldoAbertura: 0 }, [
      { Tipo: 'saida', Valor: 50, Excluido: false },
    ]);
    expect(s.saldoAtual).toBe(-50);
  });

  it('ignora lançamentos excluídos em ambas as somas', () => {
    const rows = [
      { Tipo: 'entrada', Valor: 100, Excluido: true },
      { Tipo: 'saida', Valor: 30, Excluido: true },
      { Tipo: 'entrada', Valor: 10, Excluido: false },
    ];
    const s = computeCashState_({ saldoAbertura: 0 }, rows);
    expect(s.totalEntradas).toBe(10);
    expect(s.totalSaidas).toBe(0);
    expect(s.saldoAtual).toBe(10);
  });

  it('soma valores decimais sem ruído de ponto flutuante', () => {
    const rows = [
      { Tipo: 'entrada', Valor: 0.1, Excluido: false },
      { Tipo: 'entrada', Valor: 0.2, Excluido: false },
    ];
    const s = computeCashState_({ saldoAbertura: 0 }, rows);
    expect(s.totalEntradas).toBe(0.3);
    expect(s.saldoAtual).toBe(0.3);
  });
});
