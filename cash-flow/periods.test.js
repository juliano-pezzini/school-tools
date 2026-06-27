import { describe, it, expect } from 'vitest';
const { closeDecision_, reopenDecision_ } = require('./logic.js');

const CORRENTE = '2026-06';

describe('closeDecision_', () => {
  it('bloqueia fechar mês futuro (pt-BR)', () => {
    expect(() => closeDecision_('2026-07', 'aberto', CORRENTE)).toThrow(/mês futuro/);
    expect(() => closeDecision_('2027-01', undefined, CORRENTE)).toThrow(/mês futuro/);
  });

  it('fecha mês aberto ≤ corrente', () => {
    const r = closeDecision_('2026-06', 'aberto', CORRENTE);
    expect(r.changed).toBe(true);
    expect(r.status).toBe('fechado');
  });

  it('fecha mês sem linha (status ausente = aberto)', () => {
    const r = closeDecision_('2026-05', undefined, CORRENTE);
    expect(r.changed).toBe(true);
    expect(r.status).toBe('fechado');
  });

  it('permite fechar o mês corrente', () => {
    expect(closeDecision_(CORRENTE, 'aberto', CORRENTE).changed).toBe(true);
  });

  it('fechar mês já fechado ⇒ no-op idempotente', () => {
    const r = closeDecision_('2026-05', 'fechado', CORRENTE);
    expect(r.changed).toBe(false);
    expect(r.jaFechado).toBe(true);
    expect(r.status).toBe('fechado');
  });
});

describe('reopenDecision_', () => {
  it('reabre mês fechado ⇒ aberto', () => {
    const r = reopenDecision_('2026-05', 'fechado');
    expect(r.changed).toBe(true);
    expect(r.status).toBe('aberto');
  });

  it('reabrir mês já aberto ⇒ no-op idempotente', () => {
    const r = reopenDecision_('2026-06', 'aberto');
    expect(r.changed).toBe(false);
    expect(r.jaAberto).toBe(true);
    expect(r.status).toBe('aberto');
  });

  it('reabrir mês sem linha (status ausente) ⇒ no-op idempotente', () => {
    const r = reopenDecision_('2026-06', undefined);
    expect(r.changed).toBe(false);
    expect(r.jaAberto).toBe(true);
  });
});
