import React from 'react'

export default function PersonalInfoSection({
  form,
  displayAvatar,
  uploadingAvatar,
  imgError,
  setImgError,
  updateAvatar,
  updateField,
  isInvalid,
  submitted,
  setForm,
  setError,
  setSuccess,
  dobDisplay,
  handleDobChange,
  handleDobBlur,
  age,
  getLocalDateValue,
  isoToDisplayDate,
  PHONE_RE,
}) {
  return (
    <section className="hp-card" aria-labelledby="sec-personal">
      <div className="hp-card__header">
        <div className="hp-card__badge">1</div>
        <div>
          <h2 id="sec-personal">Thông tin cá nhân</h2>
          <p>Thông tin định danh hiển thị trong tài khoản NutriLens của bạn.</p>
        </div>
      </div>

      <div className="hp-avatar-row">
        <div className="hp-avatar">
          {displayAvatar && !imgError ? (
            <img src={displayAvatar} alt="Ảnh đại diện" onError={() => setImgError(true)} />
          ) : (
            <i className="bi bi-person-fill" />
          )}
          <label className={`hp-avatar__edit ${uploadingAvatar ? 'is-busy' : ''}`} title="Đổi ảnh đại diện">
            {uploadingAvatar ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-camera-fill" />}
            <input type="file" accept="image/jpeg,image/png" onChange={updateAvatar} disabled={uploadingAvatar} />
          </label>
        </div>
        <div className="hp-avatar-info">
          <strong>Ảnh đại diện</strong>
          <p>Hỗ trợ JPG hoặc PNG, dung lượng tối đa 3 MB.</p>
          <label className={`hp-upload-btn ${uploadingAvatar ? 'is-busy' : ''}`}>
            <i className="bi bi-cloud-arrow-up" />
            {uploadingAvatar ? 'Đang tải lên…' : 'Tải ảnh lên'}
            <input type="file" accept="image/jpeg,image/png" onChange={updateAvatar} disabled={uploadingAvatar} />
          </label>
        </div>
      </div>

      <div className="hp-grid hp-grid--2">
        <div className={`hp-field ${isInvalid('fullName') ? 'is-invalid' : ''}`}>
          <label htmlFor="fullName">Họ và tên <span className="hp-required">*</span></label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            maxLength="100"
            placeholder="Nguyễn Văn A"
            value={form.fullName}
            onChange={updateField}
          />
          {isInvalid('fullName') && <span className="hp-field__error">Vui lòng nhập họ và tên</span>}
        </div>

        <div className={`hp-field ${submitted && !PHONE_RE.test(form.phone) ? 'is-invalid' : ''}`}>
          <label htmlFor="phone">Số điện thoại <span className="hp-required">*</span></label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength="10"
            placeholder="0912345678"
            value={form.phone}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
              setForm((c) => ({ ...c, phone: digits }))
              setError('')
              setSuccess('')
            }}
          />
          {submitted && !PHONE_RE.test(form.phone) && (
            <span className="hp-field__error">Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0</span>
          )}
        </div>

        <div className={`hp-field ${isInvalid('gender') ? 'is-invalid' : ''}`}>
          <label htmlFor="gender">Giới tính <span className="hp-required">*</span></label>
          <select id="gender" name="gender" value={form.gender} onChange={updateField}>
            <option value="">Chọn giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
          {isInvalid('gender') && <span className="hp-field__error">Vui lòng chọn giới tính</span>}
        </div>

        <div className={`hp-field ${submitted && !form.dateOfBirth ? 'is-invalid' : isInvalid('dateOfBirth') ? 'is-invalid' : ''}`}>
          <label htmlFor="dobDisplay">
            Ngày sinh <span className="hp-required">*</span>
            <span className="hp-field__hint-inline">(dd/mm/yy)</span>
            {age > 0 && (
              <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                ({age} tuổi)
              </span>
            )}
          </label>
          <div className="hp-dob-input">
            <input
              id="dobDisplay"
              name="dobDisplay"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yy (vd: 15/05/98 hoặc 15/05/1998)"
              maxLength="10"
              value={dobDisplay}
              onChange={handleDobChange}
              onBlur={handleDobBlur}
              autoComplete="bday"
            />
            <label className="hp-dob-input__picker-btn" title="Chọn ngày từ lịch">
              <i className="bi bi-calendar3" />
              <input
                type="date"
                tabIndex="-1"
                max={getLocalDateValue()}
                value={form.dateOfBirth}
                onChange={(e) => {
                  const val = e.target.value
                  setForm((c) => ({ ...c, dateOfBirth: val }))
                  handleDobChange({ target: { value: isoToDisplayDate(val) } })
                  setError('')
                  setSuccess('')
                }}
              />
            </label>
          </div>
          {(isInvalid('dateOfBirth') || (submitted && !form.dateOfBirth)) && (
            <span className="hp-field__error">
              {dobDisplay.trim()
                ? 'Ngày sinh không hợp lệ (vui lòng nhập dạng dd/mm/yy hoặc dd/mm/yyyy)'
                : 'Vui lòng nhập ngày sinh'}
            </span>
          )}
          {/* Cảnh báo dưới 18 tuổi */}
          {age > 0 && age < 18 && (
            <div className="hp-field__warning">
              <i className="bi bi-exclamation-triangle" />
              Công thức Mifflin-St Jeor được thiết kế cho người trưởng thành. Kết quả BMR/TDEE ở độ tuổi dưới 18 chỉ mang tính tham khảo.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
