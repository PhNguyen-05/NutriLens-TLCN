/**
 * Auth-related constants dùng chung toàn bộ module xác thực.
 * Tập trung tại đây để dễ cập nhật mà không phải sửa nhiều file.
 */

/** Keys lưu trong localStorage */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'nutrilens_access_token',
  REFRESH_TOKEN: 'nutrilens_refresh_token',
  USER: 'nutrilens_user',
}

/** Giá trị khởi tạo cho các form */
export const INITIAL_LOGIN_FORM = { email: '', password: '' }
export const INITIAL_REGISTER_FORM = {
  fullName: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  password: '',
  confirmPassword: '',
}

/** Số giây đếm ngược trước khi cho phép gửi lại OTP */
export const OTP_RESEND_COUNTDOWN_SEC = 60

/** Độ dài mã OTP */
export const OTP_LENGTH = 6
