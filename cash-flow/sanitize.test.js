import { describe, it, expect } from 'vitest';
const {
  sanitizeLancamento_,
  assertLimits_,
} = require('./logic.js');

const base = { tipo: 'entrada', valor: '200', categoria: 'Doação', descricao: 'x', data: '01/06/2026' };

describe('sanitizeLancamento_ — tipo e valor', () => {
  it('aceita entrada válida e devolve valor numérico', () => {
    const r = sanitizeLancamento_(base);
    expect(r.tipo).toBe('entrada');
    expect(r.valor).toBe(200);
    expect(r.categoria).toBe('Doação');
  });

  it('aceita saida', () => {
    expect(sanitizeLancamento_({ ...base, tipo: 'saida', valor: '50' }).tipo).toBe('saida');
  });

  it('rejeita tipo inválido (pt-BR)', () => {
    expect(() => sanitizeLancamento_({ ...base, tipo: 'foo' })).toThrow(/entrada ou saída/);
    expect(() => sanitizeLancamento_({ ...base, tipo: '' })).toThrow();
  });

  it('apara texto e remove caracteres de controle', () => {
    const r = sanitizeLancamento_({ ...base, categoria: '  Material  ', descricao: 'ok\u0007' });
    expect(r.categoria).toBe('Material');
    expect(r.descricao).toBe('ok');
  });
});

describe('sanitizeLancamento_ — normalização de moeda', () => {
  it('aceita vírgula como separador decimal', () => {
    expect(sanitizeLancamento_({ ...base, valor: '50,00' }).valor).toBe(50);
    expect(sanitizeLancamento_({ ...base, valor: '1.234,56' }).valor).toBe(1234.56);
  });

  it('aceita ponto como separador decimal', () => {
    expect(sanitizeLancamento_({ ...base, valor: '1234.56' }).valor).toBe(1234.56);
  });

  it('aceita milhar com pontos sem decimais', () => {
    expect(sanitizeLancamento_({ ...base, valor: '1.000.000' }).valor).toBe(1000000);
  });

  it('aceita número', () => {
    expect(sanitizeLancamento_({ ...base, valor: 200 }).valor).toBe(200);
  });
});

describe('sanitizeLancamento_ — valores inválidos', () => {
  it('rejeita valor <= 0', () => {
    expect(() => sanitizeLancamento_({ ...base, valor: '0' })).toThrow(/maior que zero/);
    expect(() => sanitizeLancamento_({ ...base, valor: '-5' })).toThrow(/maior que zero/);
    expect(() => sanitizeLancamento_({ ...base, valor: 0 })).toThrow();
  });

  it('rejeita vazio / ausente', () => {
    expect(() => sanitizeLancamento_({ ...base, valor: '' })).toThrow();
    expect(() => sanitizeLancamento_({ ...base, valor: null })).toThrow();
  });

  it('rejeita não numérico', () => {
    expect(() => sanitizeLancamento_({ ...base, valor: 'abc' })).toThrow();
  });

  it('rejeita mais de 2 casas decimais', () => {
    expect(() => sanitizeLancamento_({ ...base, valor: '10,005' })).toThrow(/dois centavos/);
    expect(() => sanitizeLancamento_({ ...base, valor: '10.005' })).toThrow(/dois centavos/);
  });
});

describe('assertLimits_', () => {
  it('aceita descrição de 280 e categoria de 60', () => {
    const r = assertLimits_({ valor: 100, descricao: 'a'.repeat(280), categoria: 'b'.repeat(60) });
    expect(r.requiresConfirmation).toBe(false);
  });

  it('rejeita descrição > 280 (pt-BR)', () => {
    expect(() => assertLimits_({ valor: 100, descricao: 'a'.repeat(281), categoria: 'x' }))
      .toThrow(/Descrição muito longa/);
  });

  it('rejeita categoria > 60 (pt-BR)', () => {
    expect(() => assertLimits_({ valor: 100, descricao: 'x', categoria: 'a'.repeat(61) }))
      .toThrow(/Categoria muito longa/);
  });

  it('valor no teto (1.000.000) não exige confirmação', () => {
    expect(assertLimits_({ valor: 1000000, descricao: '', categoria: '' }).requiresConfirmation).toBe(false);
  });

  it('valor acima do teto sinaliza confirmação (não bloqueia)', () => {
    expect(assertLimits_({ valor: 1000000.01, descricao: '', categoria: '' }).requiresConfirmation).toBe(true);
  });
});
