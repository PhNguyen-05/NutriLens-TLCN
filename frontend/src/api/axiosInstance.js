import axios from 'axios'
import { store } from '../store'
import { tokenRefreshed, logout } from '../store/slices/authSlice'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// ---------------------------------------------------------------------------
// Request Interceptor — tự động đính kèm access token
// ---------------------------------------------------------------------------
axiosInstance.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---------------------------------------------------------------------------
// Response Interceptor — tự động làm mới token khi nhận 401
// ---------------------------------------------------------------------------
let isRefreshing = false
/** Hàng đợi các request bị chặn trong khi đang refresh */
let waitingQueue = []

function resolveQueue(newToken) {
  waitingQueue.forEach((cb) => cb(newToken))
  waitingQueue = []
}

function rejectQueue(error) {
  waitingQueue.forEach((cb) => cb(null, error))
  waitingQueue = []
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Chỉ xử lý 401 và chưa retry
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Nếu đang refresh, đưa request vào hàng đợi
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitingQueue.push((token, err) => {
          if (err) return reject(err)
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(axiosInstance(originalRequest))
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = store.getState().auth.refreshToken
    if (!refreshToken) {
      store.dispatch(logout())
      isRefreshing = false
      return Promise.reject(error)
    }

    try {
      // Gọi thẳng axios để tránh vòng lặp interceptor
      const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken })
      store.dispatch(tokenRefreshed({ accessToken: data.accessToken }))
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`
      resolveQueue(data.accessToken)
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return axiosInstance(originalRequest)
    } catch (refreshError) {
      rejectQueue(refreshError)
      store.dispatch(logout())
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default axiosInstance
