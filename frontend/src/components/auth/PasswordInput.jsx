import { useState } from 'react'

// ---------------------------------------------------------------------------
// Tính độ mạnh mật khẩu
// ---------------------------------------------------------------------------
function calcStrength(password) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { label: 'Yếu',      color: '#ef4444', width: '20%' }
  if (score === 2) return { label: 'Trung bình', color: '#f97316', width: '45%' }
  if (score === 3) return { label: 'Tốt',      color: '#eab308', width: '70%' }
  return              { label: 'Mạnh',     color: '#22c55e', width: '100%' }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * Input mật khẩu với:
 *   - Nút show/hide (toggle visibility)
 *   - Thanh đánh giá độ mạnh (tuỳ chọn, bật qua `showStrength`)
 *
 * Nhận toàn bộ HTML input attributes qua `...inputProps`
 * (name, autoComplete, placeholder, required, onChange, v.v.)
 *
 * @param {string}  label        - Nhãn hiển thị
 * @param {string}  id           - htmlFor + input id
 * @param {string}  value        - Giá trị (controlled)
 * @param {boolean} showStrength - Hiển thị strength bar
 *
 * @example
 * <PasswordInput
 *   label="Mật khẩu"
 *   id="password"
 *   name="password"
 *   showStrength
 *   value={form.password}
 *   onChange={handleChange}
 *   required
 * />
 */
export default function PasswordInput({
  label,
  id,
  value,
  showStrength = false,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false)
  const strength = showStrength ? calcStrength(value) : null

  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">
        {label}
      </label>

      <div className="input-group">
        <span className="input-group-text">
          <i className="bi bi-lock" aria-hidden="true" />
        </span>

        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="form-control"
          value={value}
          {...inputProps}
        />

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          <i
            className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Strength bar — chỉ hiển thị khi showStrength=true và đã nhập */}
      {strength && (
        <div aria-live="polite" aria-label={`Độ mạnh mật khẩu: ${strength.label}`}>
          <div className="strength-bar mt-2">
            <div
              className="strength-bar__fill"
              style={{ width: strength.width, backgroundColor: strength.color }}
            />
          </div>
          <span className="strength-label" style={{ color: strength.color }}>
            {strength.label}
          </span>
        </div>
      )}
    </div>
  )
}
