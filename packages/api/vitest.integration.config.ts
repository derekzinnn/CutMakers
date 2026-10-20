import { defineConfig } from 'vitest/config'

/**
 * Testes de integração: falam com Postgres de verdade, no schema isolado
 * cutmakers_test. Rodam no `pnpm test:integration`.
 *
 * fileParallelism desligado: os testes compartilham um banco e limpam tabelas
 * entre si. Em paralelo, a limpeza de um arquivo apagaria as fixtures de outro.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['./test/setup-integration.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
