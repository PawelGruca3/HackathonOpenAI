import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/.expo/**', '**/dist/**', 'mobile/**', '**/expo-env.d.ts', '**/next-env.d.ts'] },
  js.configs.recommended, ...ts.configs.recommended,
  { files: ['**/*.{js,mjs,ts,tsx}'], languageOptions: { globals: { console: 'readonly', process: 'readonly', fetch: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', Request: 'readonly', Response: 'readonly', FormData: 'readonly', File: 'readonly', AbortSignal: 'readonly', window: 'readonly', document: 'readonly', HTMLInputElement: 'readonly', HTMLElement: 'readonly', globalThis: 'readonly', require: 'readonly', module: 'readonly', __dirname: 'readonly' } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], '@typescript-eslint/no-require-imports': 'off' } }
);
