import { describe, it, expect } from 'vitest';
const { dedupDecision_ } = require('./logic.js');

const existing = [
  { token: 'tok-1', id: 'L001' },
  { token: 'tok-2', id: 'L002' },
];

describe('dedupDecision_', () => {
  it('token novo ⇒ não é duplicata', () => {
    const r = dedupDecision_(existing, 'tok-novo');
    expect(r.isDup).toBe(false);
    expect(r.existingId).toBeUndefined();
  });

  it('token novo com lista vazia ⇒ não é duplicata', () => {
    expect(dedupDecision_([], 'tok-1').isDup).toBe(false);
    expect(dedupDecision_(undefined, 'tok-1').isDup).toBe(false);
  });

  it('token já visto ⇒ duplicata + id existente (sucesso idempotente)', () => {
    const r = dedupDecision_(existing, 'tok-2');
    expect(r.isDup).toBe(true);
    expect(r.existingId).toBe('L002');
  });

  it('token vazio/ausente ⇒ rejeita (token obrigatório)', () => {
    expect(() => dedupDecision_(existing, '')).toThrow(/Token de idempotência ausente/);
    expect(() => dedupDecision_(existing, null)).toThrow();
    expect(() => dedupDecision_(existing, undefined)).toThrow();
    expect(() => dedupDecision_(existing, '   ')).toThrow();
  });
});
