import { defineConfig } from 'vitest/config'

// Testes de unidade: rápidos, sem banco. Rodam no `pnpm test`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', 'node_modules/**'],
  },
})
