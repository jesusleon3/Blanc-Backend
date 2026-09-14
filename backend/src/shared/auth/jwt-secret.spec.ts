import { resolverJwtSecret } from './jwt-secret';

describe('resolverJwtSecret — BLOCKER #3, pre-arranque de Identidad', () => {
  it('devuelve JWT_SECRET cuando está configurado, sin importar el entorno', () => {
    expect(resolverJwtSecret({ JWT_SECRET: 'secreto-real' })).toBe('secreto-real');
    expect(resolverJwtSecret({ JWT_SECRET: 'secreto-real', NODE_ENV: 'production' })).toBe('secreto-real');
  });

  it('en NODE_ENV=test, sin JWT_SECRET, devuelve un secreto de pruebas fijo (no falla)', () => {
    expect(resolverJwtSecret({ NODE_ENV: 'test' })).toBe('secreto-de-pruebas-nunca-usado-fuera-de-jest');
  });

  it('fuera de test, sin JWT_SECRET, lanza en vez de usar un fallback conocido', () => {
    expect(() => resolverJwtSecret({})).toThrow(/JWT_SECRET no está configurado/);
    expect(() => resolverJwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET no está configurado/);
    expect(() => resolverJwtSecret({ NODE_ENV: 'staging' })).toThrow(/JWT_SECRET no está configurado/);
  });

  it('un JWT_SECRET vacío o solo espacios se trata como ausente', () => {
    expect(() => resolverJwtSecret({ JWT_SECRET: '   ', NODE_ENV: 'production' })).toThrow(/JWT_SECRET no está configurado/);
    expect(resolverJwtSecret({ JWT_SECRET: '   ', NODE_ENV: 'test' })).toBe('secreto-de-pruebas-nunca-usado-fuera-de-jest');
  });
});
