import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'

/**
 * Redux store trung tâm.
 * Thêm reducer mới vào đây khi mở rộng (ví dụ: nutritionReducer, profileReducer).
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // nutrition: nutritionReducer,
    // profile:   profileReducer,
  },
})
