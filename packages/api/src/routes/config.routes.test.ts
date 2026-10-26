import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { configRoutes } from './config.routes'

const app = express().use('/api/config', configRoutes)

describe('GET /api/config', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sem chave do gateway: pagamentos simulados', async () => {
    vi.stubEnv('ABACATEPAY_API_KEY', '')
    const res = await request(app).get('/api/config')
    expect(res.body).toEqual({ paymentsSimulated: true })
  })

  it('com chave do gateway: pagamentos reais e a chave nunca vaza', async () => {
    vi.stubEnv('ABACATEPAY_API_KEY', 'abc_dev_segredo')
    const res = await request(app).get('/api/config')
    expect(res.body).toEqual({ paymentsSimulated: false })
    expect(JSON.stringify(res.body)).not.toContain('segredo')
  })
})
