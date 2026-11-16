import React from 'react'
import { ACTIVITY_OPTIONS } from '../../constants/healthConstants'

export default function ActivityLevelSection({
  form,
  updateField,
  isInvalid,
  bmr,
  tdee,
}) {
  return (
    <section className="hp-card" aria-labelledby="sec-activity">
      <div className="hp-card__header">
        <div className="hp-card__badge">3</div>
        <div>
          <h2 id="sec-activity">Mức độ vận động thể chất <span className="hp-required">*</span></h2>
          <p>Chọn mức độ vận động để NutriLens tính toán chính xác tổng năng lượng tiêu hao mỗi ngày (TDEE) từ năng lượng chuyển hóa cơ bản (BMR).</p>
        </div>
      </div>
      <div className="hp-activity-grid">
        {ACTIVITY_OPTIONS.map((opt) => {
          const isActive = form.activityLevel === opt.value
          const isErr = isInvalid('activityLevel')
          return (
            <label className={`hp-activity-card ${isActive ? 'is-active' : ''} ${isErr ? 'is-error' : ''}`} key={opt.value}>
              <input type="radio" name="activityLevel" value={opt.value} checked={isActive} onChange={updateField} />
              <div className="hp-activity-card__icon"><i className={`bi ${opt.icon}`} /></div>
              <div className="hp-activity-card__body">
                <div className="hp-activity-card__head">
                  <strong>{opt.label}</strong>
                  <span className="hp-activity-card__mult">×{opt.multiplier}</span>
                </div>
                <small>{opt.detail}</small>
              </div>
              <i className="bi bi-check-circle-fill hp-activity-card__check" />
            </label>
          )
        })}
      </div>
      {isInvalid('activityLevel') && (
        <div className="hp-section-error"><i className="bi bi-exclamation-triangle" /> Vui lòng chọn mức độ vận động</div>
      )}

      {/* Hiển thị BMR & TDEE sau khi chọn mức độ vận động */}
      {bmr && form.activityLevel && tdee ? (
        <div className="hp-activity-results">
          <div className="hp-activity-results__header">
            <div className="hp-activity-results__title">
              <i className="bi bi-fire" />
              <div>
                <h3>Chỉ số chuyển hóa &amp; Tiêu hao năng lượng (Mifflin-St Jeor)</h3>
                <p>Dựa trên chỉ số thể chất kết hợp với mức độ vận động bạn vừa chọn</p>
              </div>
            </div>
            <span className="hp-activity-results__tag">
              <i className="bi bi-check2-circle" /> Đã cập nhật theo mức vận động
            </span>
          </div>

          <div className="hp-bmr-stats">
            <div className="hp-bmr-stat">
              <i className="bi bi-heart-pulse-fill" />
              <div>
                <strong>{bmr.toLocaleString('vi-VN')} <span>kcal/ngày</span></strong>
                <p>BMR (Năng lượng chuyển hóa cơ bản)</p>
                <small className="hp-bmr-stat__detail">Lượng calo tối thiểu cơ thể cần ở trạng thái nghỉ ngơi hoàn toàn</small>
              </div>
            </div>
            <div className="hp-bmr-stat hp-bmr-stat--highlight">
              <i className="bi bi-lightning-charge-fill" />
              <div>
                <strong>{tdee.toLocaleString('vi-VN')} <span>kcal/ngày</span></strong>
                <p>TDEE (Tổng năng lượng tiêu hao cả ngày)</p>
                <small className="hp-bmr-stat__detail">
                  = BMR ({bmr.toLocaleString('vi-VN')} kcal) × {ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)?.multiplier || 1.2} ({ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)?.label})
                </small>
              </div>
            </div>
          </div>

          <div className="hp-activity-results__footer">
            <i className="bi bi-info-circle-fill" />
            <span>
              Chỉ số <strong>TDEE ({tdee.toLocaleString('vi-VN')} kcal/ngày)</strong> phản ánh tổng lượng calo cơ thể bạn đốt cháy mỗi ngày và là căn cứ cốt lõi để xác định mục tiêu calo ở bước tiếp theo.
            </span>
          </div>
        </div>
      ) : bmr && !form.activityLevel ? (
        <div className="hp-activity-prompt">
          <div className="hp-activity-prompt__icon">
            <i className="bi bi-arrow-up-circle-fill" />
          </div>
          <div>
            <strong>BMR của bạn là {bmr.toLocaleString('vi-VN')} kcal/ngày</strong>
            <p>Vui lòng chọn 1 mức độ vận động ở trên để hệ thống tính toán chính xác chỉ số <strong>TDEE</strong> (Tổng năng lượng tiêu hao hàng ngày).</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
