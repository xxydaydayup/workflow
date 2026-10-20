import axios, { type AxiosRequestConfig } from 'axios'

export interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (axios.isAxiosError(error)) {
      const body: unknown = error.response?.data
      const backendMessage =
        body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message.trim()
          : ''
      error.message =
        backendMessage ||
        (error.code === 'ECONNABORTED'
          ? '请求超时，请稍后重试'
          : error.response
            ? error.response.status === 401
              ? '认证失败，请检查服务端 Basic Auth 配置'
              : '请求失败（' + error.response.status + '）'
            : '网络连接失败，请检查网络')
    }
    return Promise.reject(error)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}

export async function requestData<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await request<ApiResponse<T>>(config)
  if (!response || typeof response !== 'object' || typeof response.code !== 'string') {
    throw new ApiError('后端返回格式不正确，请检查 API 地址和代理配置', 'INVALID_RESPONSE')
  }
  if (response.code !== 'OK') {
    throw new ApiError(response.message || '业务请求失败（' + response.code + '）', response.code)
  }
  return response.data
}
