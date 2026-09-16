module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // `tsconfig.eslint.json`, no `tsconfig.json`: cubre también los archivos de configuración de
    // la raíz (`drizzle.config.ts`), que el tsconfig de compilación no puede incluir sin alterar
    // su `rootDir` y con ello el layout de `dist/`. Ver el comentario de ese archivo.
    project: 'tsconfig.eslint.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'coverage'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};
