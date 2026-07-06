import { describe, it, expect } from 'vitest';
const {
  validateLancamentoClient_,
  validateDeleteClient_,
} = require('./logic.js');

const TODAY = '2026-07-02';

const valid = {
  dateISO: '2026-07-01',
  todayISO: TODAY,
  closedPeriods: [],
  valor: '200,00',
  categoria: 'Doação',
  descricao: 'pagamento',
};

// ── validateLancamentoClient_ ─────────────────────────────────────────

describe('validateLancamentoClient_ — data', () => {
  it('rejeita data vazia', () => {
    expect(validateLancamentoClient_({ ...valid, dateISO: '' }))
      .toBe('Informe uma data.');
  });

  it('aceita data de hoje', () => {
    expect(validateLancamentoClient_({ ...valid, dateISO: TODAY }))
      .toBe('');
  });

  it('aceita data passada', () => {
    expect(validateLancamentoClient_({ ...valid, dateISO: '2026-06-15' }))
      .toBe('');
  });

  it('rejeita data futura', () => {
    expect(validateLancamentoClient_({ ...valid, dateISO: '2026-07-03' }))
      .toBe('Não é possível lançar com data futura.');
  });
});

describe('validateLancamentoClient_ — período fechado', () => {
  const closed = ['2026-05'];

  it('rejeita data em mês fechado com rótulo MM/AAAA', () => {
    expect(validateLancamentoClient_({ ...valid, dateISO: '2026-05-10', closedPeriods: closed }))
      .toBe('O período 05/2026 está fechado. Reabra-o para alterar.');
  });

  it('aceita data em mês aberto mesmo com outros meses fechados', () => {
    expect(validateLancamentoClient_({ ...valid, dateISO: '2026-06-10', closedPeriods: closed }))
      .toBe('');
  });

  it('edição: rejeita quando período de ORIGEM está fechado', () => {
    expect(validateLancamentoClient_({
      ...valid,
      dateISO: '2026-06-10',
      closedPeriods: closed,
      isEdit: true,
      originDateISO: '2026-05-15',
    })).toBe('O período 05/2026 está fechado. Reabra-o para alterar.');
  });

  it('edição: aceita quando ambos períodos abertos', () => {
    expect(validateLancamentoClient_({
      ...valid,
      dateISO: '2026-06-10',
      closedPeriods: closed,
      isEdit: true,
      originDateISO: '2026-06-01',
    })).toBe('');
  });
});

describe('validateLancamentoClient_ — valor', () => {
  it('rejeita valor vazio', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '' }))
      .toMatch(/maior que zero/);
  });

  it('rejeita valor nulo', () => {
    expect(validateLancamentoClient_({ ...valid, valor: null }))
      .toMatch(/maior que zero/);
  });

  it('rejeita valor zero', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '0' }))
      .toMatch(/maior que zero/);
  });

  it('rejeita valor negativo', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '-5' }))
      .toMatch(/maior que zero/);
  });

  it('rejeita não-numérico', () => {
    expect(validateLancamentoClient_({ ...valid, valor: 'abc' }))
      .toMatch(/maior que zero/);
  });

  it('rejeita mais de 2 casas decimais (vírgula)', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '10,005' }))
      .toMatch(/dois centavos/);
  });

  it('rejeita mais de 2 casas decimais (ponto)', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '10.005' }))
      .toMatch(/dois centavos/);
  });

  it('aceita valor com vírgula', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '1.234,56' }))
      .toBe('');
  });

  it('aceita valor inteiro', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '200' }))
      .toBe('');
  });

  it('aceita valor com 2 casas', () => {
    expect(validateLancamentoClient_({ ...valid, valor: '50,99' }))
      .toBe('');
  });
});

describe('validateLancamentoClient_ — limites de campo', () => {
  it('rejeita categoria > 60 chars', () => {
    expect(validateLancamentoClient_({ ...valid, categoria: 'a'.repeat(61) }))
      .toMatch(/Categoria muito longa/);
  });

  it('aceita categoria de 60 chars', () => {
    expect(validateLancamentoClient_({ ...valid, categoria: 'a'.repeat(60) }))
      .toBe('');
  });

  it('rejeita descrição > 280 chars', () => {
    expect(validateLancamentoClient_({ ...valid, descricao: 'a'.repeat(281) }))
      .toMatch(/Descrição muito longa/);
  });

  it('aceita descrição de 280 chars', () => {
    expect(validateLancamentoClient_({ ...valid, descricao: 'a'.repeat(280) }))
      .toBe('');
  });
});

describe('validateLancamentoClient_ — caso feliz completo', () => {
  it('retorna string vazia quando tudo válido', () => {
    expect(validateLancamentoClient_(valid)).toBe('');
  });

  it('retorna o PRIMEIRO erro encontrado (prioridade: data > período > valor)', () => {
    // data vazia + valor vazio → data é reportada primeiro
    expect(validateLancamentoClient_({ ...valid, dateISO: '', valor: '' }))
      .toBe('Informe uma data.');
  });
});

// ── validateDeleteClient_ ─────────────────────────────────────────────

describe('validateDeleteClient_', () => {
  it('aceita exclusão em período aberto', () => {
    expect(validateDeleteClient_('2026-06-10', [])).toBe('');
    expect(validateDeleteClient_('2026-06-10', ['2026-05'])).toBe('');
  });

  it('rejeita exclusão em período fechado', () => {
    expect(validateDeleteClient_('2026-05-10', ['2026-05']))
      .toBe('O período 05/2026 está fechado. Reabra-o para alterar.');
  });

  it('retorna vazio quando dateISO ausente', () => {
    expect(validateDeleteClient_('', ['2026-05'])).toBe('');
  });
});
