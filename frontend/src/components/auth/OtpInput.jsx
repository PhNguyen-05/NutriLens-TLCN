import { useRef } from 'react'
import { OTP_LENGTH } from '../../constants/authConstants'

/**
 * 6 ô nhập OTP riêng biệt với:
 *   - Auto-focus sang ô tiếp theo khi nhập ký tự
 *   - Backspace xoá và focus về ô trước
 *   - Paste thông minh: dán chuỗi số vào tất cả ô cùng lúc
 *
 * @param {string}   value    - Chuỗi OTP hiện tại (controlled, ví dụ "123456")
 * @param {Function} onChange - Callback nhận chuỗi OTP mới
 * @param {number}   length   - Số ô (mặc định OTP_LENGTH = 6)
 *
 * @example
 * <OtpInput value={otp} onChange={setOtp} />
 */
export default function OtpInput({ value = '', onChange, length = OTP_LENGTH }) {
  const inputRefs = useRef([])

  // Chuyển chuỗi value → mảng ký tự có độ dài cố định
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  function updateValue(index, char) {
    const arr = [...digits]
    arr[index] = char
    onChange(arr.join(''))
  }

  function handleChange(index, e) {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) return

    // Lấy ký tự cuối cùng được nhập (tránh trường hợp input type=text giữ cả chuỗi)
    const char = val.slice(-1)
    updateValue(index, char)

    // Focus ô kế tiếp
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        updateValue(index, '')
      } else if (index > 0) {
        updateValue(index - 1, '')
        inputRefs.current[index - 1]?.focus()
      }
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    const arr = Array.from({ length }, (_, i) => pasted[i] || '')
    onChange(arr.join(''))
    // Focus ô sau ký tự cuối paste
    const nextIndex = Math.min(pasted.length, length - 1)
    inputRefs.current[nextIndex]?.focus()
  }

  function handleFocus(e) {
    e.target.select()
  }

  return (
    <div
      className="d-flex gap-2 justify-content-center my-3"
      role="group"
      aria-label="Nhập mã OTP"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          className={`otp-cell form-control ${digit ? 'otp-cell--filled' : ''}`}
          aria-label={`Ký tự OTP thứ ${index + 1}`}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  )
}
