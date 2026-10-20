import { describe, expect, it } from 'vitest'
import {
  AxiosError,
  CanceledError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ApiError, request, requestData } from './request'

function respond(data: unknown): AxiosRequestConfig {
  return {
    url: '/test',
    adapter: async (config) => ({ data, status: 200, statusText: 'OK', headers: {}, config }),
  }
}

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

  it('unwraps successful business responses, including null data', async () => {
    await expect(
      requestData(respond({ code: 'OK', data: { bpmnXml: '<definitions/>' }, message: '' })),
    ).resolves.toEqual({ bpmnXml: '<definitions/>' })
    await expect(requestData(respond({ code: 'OK', data: null, message: '' }))).resolves.toBeNull()
  })

  it('rejects business failures even when HTTP succeeds', async () => {
    const promise = requestData(
      respond({ code: 'INVALID_MODEL', data: null, message: '流程缺少开始节点' }),
    )
    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_MODEL',
      message: '流程缺少开始节点',
    })
  })

  it.each([null, '<!DOCTYPE html>', { data: {} }])(
    'rejects a malformed API envelope: %j',
    async (body) => {
      await expect(requestData(respond(body))).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    },
  )

  it('preserves backend validation details on HTTP errors', async () => {
    await expect(
      request({
        url: '/test',
        adapter: async (config) => {
          throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
            config,
            status: 502,
            statusText: 'Bad Gateway',
            headers: {},
            data: { code: 'ENGINE_ERROR', message: '任务 task_1 的表单字段无效' },
          })
        },
      }),
    ).rejects.toThrow('任务 task_1 的表单字段无效')
  })

  it('reports timeouts and leaves cancellation untouched', async () => {
    await expect(
      request({
        url: '/test',
        adapter: async () => {
          throw new AxiosError('timeout', 'ECONNABORTED')
        },
      }),
    ).rejects.toThrow('请求超时，请稍后重试')
    const cancellation = new CanceledError('request canceled')
    await expect(
      request({
        url: '/test',
        adapter: async () => {
          throw cancellation
        },
      }),
    ).rejects.toBe(cancellation)
  })
})
