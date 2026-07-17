import { describe, it, expect } from 'vitest';
const {
  validateComprovante_,
  comprovanteFileName_,
  extForMime_,
  COMPROVANTE_TIPOS,
  COMPROVANTE_MAX_BYTES,
} = require('./logic.js');

const okFile = (over) => ({ name: 'cupom.jpg', mimeType: 'image/jpeg', size: 1024, ...over });

describe('validateComprovante_ — tipos aceitos (whitelist)', () => {
  it('aceita cada tipo da whitelist e devolve o MIME resolvido', () => {
    const cases = [
      ['a.jpg', 'image/jpeg'],
      ['a.png', 'image/png'],
      ['a.webp', 'image/webp'],
      ['a.heic', 'image/heic'],
      ['a.heif', 'image/heif'],
      ['a.pdf', 'application/pdf'],
    ];
    for (const [name, mime] of cases) {
      const r = validateComprovante_({ name, mimeType: mime, size: 2048 });
      expect(r.ok).toBe(true);
      expect(r.mimeType).toBe(mime);
    }
  });

  it('a whitelist exportada tem exatamente os 6 tipos esperados', () => {
    expect(COMPROVANTE_TIPOS).toEqual([
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
    ]);
  });
});

describe('validateComprovante_ — tipo rejeitado', () => {
  it('rejeita tipo fora da whitelist (image/gif) com mensagem pt-BR', () => {
    expect(() => validateComprovante_({ name: 'x.gif', mimeType: 'image/gif', size: 100 }))
      .toThrow(/Tipo de arquivo não permitido/);
  });

  it('rejeita executável/zip mesmo que pareça arquivo', () => {
    expect(() => validateComprovante_({ name: 'v.exe', mimeType: 'application/octet-stream', size: 100 }))
      .toThrow(/não permitido/);
    expect(() => validateComprovante_({ name: 'a.zip', mimeType: 'application/zip', size: 100 }))
      .toThrow(/não permitido/);
  });
});

describe('validateComprovante_ — MIME vazio/impreciso → fallback por extensão', () => {
  it('MIME vazio + extensão válida (.jpg) → aceita e resolve image/jpeg', () => {
    const r = validateComprovante_({ name: 'foto.jpg', mimeType: '', size: 500 });
    expect(r.ok).toBe(true);
    expect(r.mimeType).toBe('image/jpeg');
  });

  it('MIME impreciso (application/octet-stream) + .pdf → aceita e resolve application/pdf', () => {
    const r = validateComprovante_({ name: 'nota.pdf', mimeType: 'application/octet-stream', size: 500 });
    expect(r.mimeType).toBe('application/pdf');
  });

  it('MIME vazio + extensão inválida (.exe) → rejeita', () => {
    expect(() => validateComprovante_({ name: 'run.exe', mimeType: '', size: 500 }))
      .toThrow(/não permitido/);
  });
});

describe('validateComprovante_ — nome e tamanho', () => {
  it('rejeita quando não há arquivo/nome (pt-BR)', () => {
    expect(() => validateComprovante_(null)).toThrow(/Selecione um arquivo/);
    expect(() => validateComprovante_({ name: '   ', mimeType: 'image/jpeg', size: 10 }))
      .toThrow(/Selecione um arquivo/);
  });

  it('rejeita arquivo vazio (size <= 0) com pt-BR', () => {
    expect(() => validateComprovante_(okFile({ size: 0 }))).toThrow(/vazio/);
    expect(() => validateComprovante_(okFile({ size: -5 }))).toThrow(/vazio/);
  });

  it('rejeita acima do teto de 10 MB com a mensagem do limite', () => {
    expect(() => validateComprovante_(okFile({ size: COMPROVANTE_MAX_BYTES + 1 })))
      .toThrow(/excede o limite de 10 MB/);
  });

  it('aceita exatamente no limite (size === maxBytes)', () => {
    const r = validateComprovante_(okFile({ size: COMPROVANTE_MAX_BYTES }));
    expect(r.ok).toBe(true);
  });

  it('respeita maxBytes customizado na mensagem (deriva os MB)', () => {
    const oneMB = 1 * 1024 * 1024;
    expect(() => validateComprovante_(okFile({ size: oneMB + 1 }), { maxBytes: oneMB }))
      .toThrow(/excede o limite de 1 MB/);
  });
});

describe('extForMime_', () => {
  it('mapeia cada MIME da whitelist para a extensão correta', () => {
    expect(extForMime_('image/jpeg')).toBe('jpg');
    expect(extForMime_('image/png')).toBe('png');
    expect(extForMime_('image/webp')).toBe('webp');
    expect(extForMime_('image/heic')).toBe('heic');
    expect(extForMime_('image/heif')).toBe('heif');
    expect(extForMime_('application/pdf')).toBe('pdf');
  });

  it('MIME desconhecido → bin', () => {
    expect(extForMime_('application/zip')).toBe('bin');
    expect(extForMime_('')).toBe('bin');
  });
});

describe('comprovanteFileName_', () => {
  it('monta <id>_<timestamp>.<ext> a partir do MIME', () => {
    expect(comprovanteFileName_('L1', 'image/jpeg', 123)).toBe('L1_123.jpg');
    expect(comprovanteFileName_('abc', 'application/pdf', 999)).toBe('abc_999.pdf');
  });

  it('MIME desconhecido → extensão bin', () => {
    expect(comprovanteFileName_('L2', 'application/zip', 7)).toBe('L2_7.bin');
  });
});
