import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        // ES2022 globals
        globalThis: 'readonly',
        // Node 18+/22 runtime globals available in CI
        fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Allow intentionally empty catch blocks in browser assets
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.serverless/', 'aws/'],
  },
  // Browser asset overrides (Design Manager JS)
  {
    files: ['clean-x-hedgehog-templates/assets/js/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        Blob: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
  },
  // GitHub automation scripts run in Node 18+/22 where fetch exists
  {
    files: ['.github/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
      },
    },
  },
];
