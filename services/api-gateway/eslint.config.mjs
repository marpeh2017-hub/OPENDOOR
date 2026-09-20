import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

/**
 * ESLint flat config for the API Gateway.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * There was no ESLint configuration anywhere in this repository. `pnpm lint`
 * ran `eslint src`, ESLint 9 found no flat config, and the command failed — so
 * linting has been silently unenforced for the whole life of the project. Every
 * rule below is therefore running against this codebase for the first time.
 *
 * TYPE-AWARE LINTING IS THE POINT
 * -------------------------------
 * `projectService` turns on the rules that need type information. Those are the
 * ones that catch the failure mode this codebase actually suffers from: a
 * promise that is never awaited fails silently, with no stack trace and no test
 * failure. `AuditService.record()` and `AutomationRunnerService.dispatch()` are
 * both fire-and-forget-shaped, and a missing `await` on either loses an audit
 * row or an automation run without anything going red.
 *
 * It costs a slower lint run. That is worth it for rules that TypeScript's own
 * checker cannot express.
 *
 * The rule set is deliberately NARROW. A first run that produces hundreds of
 * stylistic warnings gets switched off within a week; one that produces a short
 * list of genuine defects gets fixed. Style is Prettier's job, not this file's.
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.mjs'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // `tsconfig.test.json` is the one that includes BOTH src and test.
        // Using the default project service instead leaves every file under
        // test/ unparsed, which silently exempts the test suite from the
        // type-aware rules — and the tests are where a missing `await` is
        // most likely to make an assertion pass vacuously.
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        __dirname: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // ── The rules this config exists for ──────────────────────────────
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      // `catch (e) {}` that swallows a failure whole.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // ── Dead code, which in this codebase has meant a dropped field ───
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // ── Correctness ───────────────────────────────────────────────────
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'require-atomic-updates': 'error',
      eqeqeq: ['error', 'smart'],

      // ── Off, with reasons ─────────────────────────────────────────────
      // The codebase uses `as never` deliberately at Prisma enum boundaries,
      // where the generated types are stricter than the runtime contract.
      '@typescript-eslint/no-explicit-any': 'off',
      // Nest controllers type `@Request() req: any` by convention.
      '@typescript-eslint/no-unsafe-argument': 'off',
      // `console` is used intentionally in main.ts bootstrap output.
      'no-console': 'off',
      // Handled by TypeScript itself.
      'no-undef': 'off',
    },
  },
]
