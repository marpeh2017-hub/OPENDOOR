import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// FlatCompat ships with ESLint 9; resolve it from ESLint's dependencies so
// pnpm's strict dependency layout does not require a second installation.
const require = createRequire(import.meta.url)
const eslintRequire = createRequire(require.resolve('eslint'))
const { FlatCompat } = eslintRequire('@eslint/eslintrc')
const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) })

const config = [
  { ignores: ['.next/**', '.next-preview/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals'),
]

export default config
