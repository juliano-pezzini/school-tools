import { describe, it, expect } from 'vitest';
const { computeCashState_, computeMonthState_, parseDateBR_ } = require('./logic.js');

const d = (s) => parseDateBR_(s);

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

describe('computeMonthState_', () => {
  const config = { saldoAbertura: 1000 };
  const rows = [
    { Data: d('10/05/2026'), Tipo: 'entrada', Valor: 300, Excluido: false },
    { Data: d('20/05/2026'), Tipo: 'saida', Valor: 100, Excluido: false },
    { Data: d('05/06/2026'), Tipo: 'entrada', Valor: 200, Excluido: false },
    { Data: d('15/06/2026'), Tipo: 'saida', Valor: 50, Excluido: false },
    { Data: d('01/07/2026'), Tipo: 'entrada', Valor: 80, Excluido: false },
  ];

  it('junho: carry-forward = 1000+300−100 = 1200; entradas 200, saídas 50, final 1350', () => {
    const s = computeMonthState_(config, rows, '2026-06');
    expect(s.saldoInicio).toBe(1200);
    expect(s.totalEntradas).toBe(200);
    expect(s.totalSaidas).toBe(50);
    expect(s.saldoFinal).toBe(1350);
    expect(s.aberturaDefinida).toBe(true);
  });

  it('maio: carry-forward = 1000 (nada antes); entradas 300, saídas 100, final 1200', () => {
    const s = computeMonthState_(config, rows, '2026-05');
    expect(s.saldoInicio).toBe(1000);
    expect(s.totalEntradas).toBe(300);
    expect(s.totalSaidas).toBe(100);
    expect(s.saldoFinal).toBe(1200);
  });

  it('julho: carry-forward = 1000+300+200−100−50 = 1350; entradas 80, final 1430', () => {
    const s = computeMonthState_(config, rows, '2026-07');
    expect(s.saldoInicio).toBe(1350);
    expect(s.totalEntradas).toBe(80);
    expect(s.totalSaidas).toBe(0);
    expect(s.saldoFinal).toBe(1430);
  });

  it('mês sem movimentação: carry-forward intacto, entradas/saídas zero', () => {
    const s = computeMonthState_(config, rows, '2026-08');
    expect(s.saldoInicio).toBe(1430);
    expect(s.totalEntradas).toBe(0);
    expect(s.totalSaidas).toBe(0);
    expect(s.saldoFinal).toBe(1430);
  });

  it('ignora excluídos no carry-forward e no mês', () => {
    const rowsExcl = [
      { Data: d('10/05/2026'), Tipo: 'entrada', Valor: 300, Excluido: true },
      { Data: d('05/06/2026'), Tipo: 'entrada', Valor: 200, Excluido: false },
    ];
    const s = computeMonthState_(config, rowsExcl, '2026-06');
    expect(s.saldoInicio).toBe(1000);    // excluído não carrega
    expect(s.totalEntradas).toBe(200);
    expect(s.saldoFinal).toBe(1200);
  });

  it('abertura indefinida ⇒ carry-forward parte de 0', () => {
    const s = computeMonthState_(null, rows, '2026-06');
    expect(s.aberturaDefinida).toBe(false);
    expect(s.saldoInicio).toBe(200);     // 0+300−100
    expect(s.saldoFinal).toBe(350);      // 200+200−50
  });
});
