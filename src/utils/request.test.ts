import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { request } from './request'

describe('request module', () => {
  it('returns the response body', async () => {
    const body = { ok: true }
    const result = await request<typeof body>({
      url: '/health',
      adapter: async (config) => ({
        data: body,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as InternalAxiosRequestConfig,
      }),
    })

    expect(result).toEqual(body)
  })
})
