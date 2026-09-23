import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { STORAGE_KEYS } from '../../constants/authConstants'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// ---------------------------------------------------------------------------
// Helpers — localStorage
// ---------------------------------------------------------------------------
function loadAuthFromStorage() {
  try {
    return {
      accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || null,
      refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || null,
      user: JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || 'null'),
    }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

function persistAuth(accessToken, refreshToken, user) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

function clearAuth() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

// ---------------------------------------------------------------------------
// Async Thunks
// ---------------------------------------------------------------------------

/** UC02: Đăng nhập Email/Mật khẩu */
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/login`, { email, password })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
    }
  }
)

/** UC01: Gửi thông tin đăng ký — server sẽ gửi OTP */
export const registerThunk = createAsyncThunk(
  'auth/register',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/register`, formData)
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.')
    }
  }
)

/** UC01 / UC03: Xác thực mã OTP (purpose: 'register' | 'reset') */
export const verifyOtpThunk = createAsyncThunk(
  'auth/verifyOtp',
  async ({ email, otp, purpose }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/verify-otp`, { email, otp, purpose })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.')
    }
  }
)

/** UC01 / UC03: Gửi lại mã OTP */
export const resendOtpThunk = createAsyncThunk(
  'auth/resendOtp',
  async ({ email, purpose }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/resend-otp`, { email, purpose })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Không thể gửi lại OTP lúc này.')
    }
  }
)

/** UC03: Quên mật khẩu — yêu cầu OTP reset */
export const forgotPasswordThunk = createAsyncThunk(
  'auth/forgotPassword',
  async ({ email }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/forgot-password`, { email })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Không tìm thấy tài khoản với email này.')
    }
  }
)

/** UC03: Đặt lại mật khẩu mới sau khi xác thực OTP */
export const resetPasswordThunk = createAsyncThunk(
  'auth/resetPassword',
  async ({ email, resetToken, newPassword, confirmNewPassword }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/reset-password`, {
        email,
        resetToken,
        newPassword,
        confirmNewPassword,
      })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Đặt lại mật khẩu thất bại.')
    }
  }
)

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------
const { accessToken, refreshToken, user } = loadAuthFromStorage()

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user,
    accessToken,
    refreshToken,
    loading: false,
    error: null,
  },
  reducers: {
    /** Được gọi bởi axiosInstance khi refresh token thành công */
    tokenRefreshed(state, action) {
      state.accessToken = action.payload.accessToken
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, action.payload.accessToken)
    },
    /** Đăng xuất (local + clear storage) */
    logout(state) {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.error = null
      clearAuth()
    },
    /** Reset lỗi (dùng khi user đóng alert hoặc chuyển trang) */
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // Helper tái sử dụng cho các trạng thái pending / rejected
    function addAuthCases(thunk, onFulfilled) {
      builder
        .addCase(thunk.pending, (state) => {
          state.loading = true
          state.error = null
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false
          onFulfilled?.(state, action)
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false
          state.error = action.payload
        })
    }

    addAuthCases(loginThunk, (state, action) => {
      const { user, accessToken, refreshToken } = action.payload
      state.user = user
      state.accessToken = accessToken
      state.refreshToken = refreshToken
      persistAuth(accessToken, refreshToken, user)
    })

    addAuthCases(registerThunk)
    addAuthCases(verifyOtpThunk)
    addAuthCases(resendOtpThunk)
    addAuthCases(forgotPasswordThunk)
    addAuthCases(resetPasswordThunk)
  },
})

export const { tokenRefreshed, logout, clearError } = authSlice.actions
export default authSlice.reducer
