import { describe, it, expect } from 'vitest';
const { versionLabel_ } = require('./logic.js');

// versionLabel_ — rótulo do badge de versão (VER-01, VER-02)

describe('versionLabel_ — versão injetada', () => {
  it('prefixa "v" em semver sem prefixo', () => {
    expect(versionLabel_('1.2.0')).toBe('v1.2.0');
  });

  it('mantém quando já vem com "v" (idempotente)', () => {
    expect(versionLabel_('v1.2.0')).toBe('v1.2.0');
  });

  it('aceita "V" maiúsculo como prefixo válido', () => {
    expect(versionLabel_('V2.0.1')).toBe('V2.0.1');
  });

  it('prefixa "v" em versões de tamanho variado', () => {
    expect(versionLabel_('2.0')).toBe('v2.0');
    expect(versionLabel_('10.20.30')).toBe('v10.20.30');
  });

  it('remove espaços ao redor antes de prefixar', () => {
    expect(versionLabel_('  1.4.2  ')).toBe('v1.4.2');
  });
});

describe('versionLabel_ — fallback "dev"', () => {
  it('placeholder não substituído (começa com "_") → dev', () => {
    expect(versionLabel_('__APP_VERSION__')).toBe('dev');
  });

  it('string vazia → dev', () => {
    expect(versionLabel_('')).toBe('dev');
  });

  it('só espaços → dev', () => {
    expect(versionLabel_('   ')).toBe('dev');
  });

  it('null → dev', () => {
    expect(versionLabel_(null)).toBe('dev');
  });

  it('undefined → dev', () => {
    expect(versionLabel_(undefined)).toBe('dev');
  });
});
