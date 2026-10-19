import axios, { type AxiosRequestConfig } from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (axios.isAxiosError(error)) {
      error.message =
        error.code === 'ECONNABORTED'
          ? '请求超时，请稍后重试'
          : error.response
            ? '请求失败（' + error.response.status + '）'
            : '网络连接失败，请检查网络'
    }
    return Promise.reject(error)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}
