import { describe, it, expect } from 'vitest';
const { parseDateBR_, listForView_ } = require('./logic.js');

const d = (s) => parseDateBR_(s);

// CriadoEm como Date (comparável) garante desempate determinístico.
const dt = (s) => new Date(s);

describe('listForView_ — ordenação', () => {
  it('ordena por Data desc e, em empate, por CriadoEm desc', () => {
    const A = { id: 'A', Data: d('10/06/2026'), CriadoEm: dt('2026-06-10T08:00'), Tipo: 'entrada', Categoria: 'X', Excluido: false };
    const B = { id: 'B', Data: d('12/06/2026'), CriadoEm: dt('2026-06-12T08:00'), Tipo: 'saida', Categoria: 'X', Excluido: false };
    const C = { id: 'C', Data: d('10/06/2026'), CriadoEm: dt('2026-06-10T09:30'), Tipo: 'entrada', Categoria: 'X', Excluido: false };
    const out = listForView_([A, B, C], {});
    expect(out.map((r) => r.id)).toEqual(['B', 'C', 'A']);
  });
});

describe('listForView_ — soft-delete', () => {
  it('oculta lançamentos excluídos', () => {
    const rows = [
      { id: 'A', Data: d('10/06/2026'), CriadoEm: dt('2026-06-10T08:00'), Tipo: 'entrada', Categoria: 'X', Excluido: true },
      { id: 'B', Data: d('11/06/2026'), CriadoEm: dt('2026-06-11T08:00'), Tipo: 'saida', Categoria: 'X', Excluido: false },
    ];
    expect(listForView_(rows, {}).map((r) => r.id)).toEqual(['B']);
  });
});

describe('listForView_ — filtros', () => {
  const rows = [
    { id: 'jun-in', Data: d('10/06/2026'), CriadoEm: dt('2026-06-10'), Tipo: 'entrada', Categoria: 'Doação', Excluido: false },
    { id: 'jun-out', Data: d('20/06/2026'), CriadoEm: dt('2026-06-20'), Tipo: 'saida', Categoria: 'Material', Excluido: false },
    { id: 'jul-out', Data: d('05/07/2026'), CriadoEm: dt('2026-07-05'), Tipo: 'saida', Categoria: 'Material', Excluido: false },
  ];

  it('filtra por mês', () => {
    expect(listForView_(rows, { mes: '2026-06' }).map((r) => r.id)).toEqual(['jun-out', 'jun-in']);
  });

  it('filtra por tipo', () => {
    expect(listForView_(rows, { tipo: 'saida' }).map((r) => r.id)).toEqual(['jul-out', 'jun-out']);
  });

  it('filtra por categoria (normalizada, ignora caixa/acento)', () => {
    expect(listForView_(rows, { categoria: 'doacao' }).map((r) => r.id)).toEqual(['jun-in']);
  });

  it('combina mês + tipo (Junho/2026 + saída)', () => {
    expect(listForView_(rows, { mes: '2026-06', tipo: 'saida' }).map((r) => r.id)).toEqual(['jun-out']);
  });

  it('retorna vazio quando o filtro não casa', () => {
    expect(listForView_(rows, { mes: '2026-01' })).toEqual([]);
    expect(listForView_(rows, { categoria: 'inexistente' })).toEqual([]);
  });
});
