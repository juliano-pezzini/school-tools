import { describe, it, expect } from 'vitest';
const {
  normalizeCategoryKey_,
  computeCategorias_,
} = require('./logic.js');

describe('normalizeCategoryKey_', () => {
  it('colapsa caixa, acentos, cedilha e espaços nas pontas', () => {
    const k = normalizeCategoryKey_('Doação');
    expect(normalizeCategoryKey_('doação')).toBe(k);
    expect(normalizeCategoryKey_('Doaçao ')).toBe(k);
    expect(normalizeCategoryKey_(' DOACAO')).toBe(k);
    expect(k).toBe('doacao');
  });

  it('trata vazio/nulo', () => {
    expect(normalizeCategoryKey_('')).toBe('');
    expect(normalizeCategoryKey_(null)).toBe('');
  });
});

describe('computeCategorias_', () => {
  it('agrupa variações numa única sugestão mantendo a 1ª grafia', () => {
    const rows = [
      { Categoria: 'Doação', Excluido: false },
      { Categoria: 'doação', Excluido: false },
      { Categoria: 'Doaçao ', Excluido: false },
      { Categoria: ' DOACAO', Excluido: false },
    ];
    expect(computeCategorias_(rows)).toEqual(['Doação']);
  });

  it('ignora lançamentos excluídos', () => {
    const rows = [
      { Categoria: 'Material', Excluido: true },
      { Categoria: 'Doação', Excluido: false },
    ];
    expect(computeCategorias_(rows)).toEqual(['Doação']);
  });

  it('retorna distintas ordenadas pela chave normalizada', () => {
    const rows = [
      { Categoria: 'Material', Excluido: false },
      { Categoria: 'Doação', Excluido: false },
      { Categoria: 'Aluguel', Excluido: false },
    ];
    expect(computeCategorias_(rows)).toEqual(['Aluguel', 'Doação', 'Material']);
  });

  it('ignora categoria vazia/em branco', () => {
    const rows = [
      { Categoria: '   ', Excluido: false },
      { Categoria: '', Excluido: false },
      { Categoria: 'Doação', Excluido: false },
    ];
    expect(computeCategorias_(rows)).toEqual(['Doação']);
  });

  it('retorna lista vazia quando não há linhas', () => {
    expect(computeCategorias_([])).toEqual([]);
    expect(computeCategorias_()).toEqual([]);
  });
});
