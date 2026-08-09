// ============================================================================
// Axios HTTP 客户端 - 指向 Python Agent Runtime 后端
// ============================================================================
import axios from 'axios'

const API_BASE = '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': 'demo-user', // Demo 模式固定用户
  },
})

// 响应拦截：统一提取 data 字段
apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || err.message || '未知错误'
    console.error('[API Error]', msg)
    return Promise.reject(err)
  }
)
