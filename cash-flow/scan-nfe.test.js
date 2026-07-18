import { describe, it, expect } from 'vitest';
import {
  parseChaveNFe_,
  chaveValida_,
  buildScanDescription_,
  UF_CODES
} from './logic.js';

// Real key: Magazine Luiza, SP — cDV = 7 (mod-11 validated)
var VALID_KEY = '35250747968740000139550010000016321459683347';
// Invalid key: last digit flipped (7 → 8)
var INVALID_KEY = '35250747968740000139550010000016321459683348';

describe('UF_CODES', function () {
  it('exports a map with all 27 UF codes', function () {
    expect(UF_CODES[35]).toBe('SP');
    expect(UF_CODES[11]).toBe('RO');
    expect(UF_CODES[53]).toBe('DF');
    expect(Object.keys(UF_CODES).length).toBe(27);
  });
});

describe('parseChaveNFe_', function () {
  it('decodes a real 44-digit key correctly', function () {
    var r = parseChaveNFe_(VALID_KEY);
    expect(r.cUF).toBe(35);
    expect(r.uf).toBe('SP');
    expect(r.ano).toBe(25);
    expect(r.mes).toBe(7);
    expect(r.cnpj).toBe('47968740000139');
    expect(r.modelo).toBe(55);
    expect(r.serie).toBe(1);
    expect(r.numero).toBe(1632);
    expect(r.cDV).toBe(7);
  });

  it('throws for input shorter than 44 digits', function () {
    expect(function () { parseChaveNFe_('1234'); }).toThrow();
  });

  it('throws for input longer than 44 digits', function () {
    expect(function () { parseChaveNFe_(VALID_KEY + '0'); }).toThrow();
  });

  it('throws for non-digit characters', function () {
    expect(function () { parseChaveNFe_('3525074796874000013955001000001632145968334A'); }).toThrow();
  });
});

describe('chaveValida_', function () {
  it('returns true for a valid key with correct cDV', function () {
    expect(chaveValida_(VALID_KEY)).toBe(true);
  });

  it('returns false for a key with wrong cDV', function () {
    expect(chaveValida_(INVALID_KEY)).toBe(false);
  });

  it('returns false for input shorter than 44 digits', function () {
    expect(chaveValida_('12345')).toBe(false);
  });

  it('returns false for input longer than 44 digits', function () {
    expect(chaveValida_(VALID_KEY + '9')).toBe(false);
  });

  it('returns false for non-digit characters', function () {
    expect(chaveValida_('3525074796874000013955001000001632145968334X')).toBe(false);
  });

  it('never throws', function () {
    expect(function () { chaveValida_(null); }).not.toThrow();
    expect(function () { chaveValida_(undefined); }).not.toThrow();
    expect(function () { chaveValida_(''); }).not.toThrow();
    expect(chaveValida_(null)).toBe(false);
  });
});

describe('buildScanDescription_', function () {
  it('builds full description with all fields', function () {
    var result = buildScanDescription_({
      fornecedor: 'ANTARES',
      cidade: 'Itu',
      uf: 'SP',
      itens: '3x Arroz, 2x Feijão'
    });
    expect(result).toBe('ANTARES (Itu/SP) — 3x Arroz, 2x Feijão');
  });

  it('omits (Cidade/UF) when both cidade and uf are missing', function () {
    var result = buildScanDescription_({
      fornecedor: 'LOJA X',
      itens: 'item A'
    });
    expect(result).toBe('LOJA X — item A');
  });

  it('omits — itens when itens is empty', function () {
    var result = buildScanDescription_({
      fornecedor: 'LOJA Y',
      cidade: 'SP',
      uf: 'SP'
    });
    expect(result).toBe('LOJA Y (SP/SP)');
  });

  it('returns empty string when fornecedor is empty', function () {
    expect(buildScanDescription_({})).toBe('');
    expect(buildScanDescription_({ fornecedor: '' })).toBe('');
    expect(buildScanDescription_({ fornecedor: '  ' })).toBe('');
  });

  it('truncates to 280 chars with …', function () {
    var longItens = 'x'.repeat(300);
    var result = buildScanDescription_({
      fornecedor: 'LOJA',
      itens: longItens
    });
    expect(result.length).toBeLessThanOrEqual(280);
    expect(result.endsWith('…')).toBe(true);
  });
});
