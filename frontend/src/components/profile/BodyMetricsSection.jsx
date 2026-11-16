import React from 'react'
import { Link } from 'react-router-dom'
import BmiGauge from './BmiGauge'
import { NUTRITION_GOAL_OPTIONS, formatLogDate } from '../../constants/healthConstants'

export default function BodyMetricsSection({
  form,
  updateField,
  isInvalid,
  submitted,
  baselineStatus,
  bmi,
  bmiInfo,
  bmiTableView,
  setBmiTableView,
  systemAdvice,
  openMilestoneModal,
}) {
  return (
    <section className="hp-card" aria-labelledby="sec-body">
      <div className="hp-card__header">
        <div className="hp-card__badge">2</div>
        <div>
          <h2 id="sec-body">Chỉ số thể chất &amp; Phân loại BMI</h2>
          <p>NutriLens đánh giá thể trạng dựa trên chuẩn BMI dành riêng cho người Châu Á (WHO &amp; IDI/WPRO).</p>
        </div>
      </div>

      <div className="hp-grid hp-grid--2">
        <div className={`hp-field ${submitted && (Number(form.heightCm) < 100 || Number(form.heightCm) > 250) ? 'is-invalid' : isInvalid('heightCm') ? 'is-invalid' : ''}`}>
          <label htmlFor="heightCm">Chiều cao <span className="hp-required">*</span></label>
          <div className="hp-unit-input">
            <input
              id="heightCm" name="heightCm" type="number"
              min="100" max="250" step="0.1" placeholder="165"
              value={form.heightCm} onChange={updateField}
            />
            <span>cm</span>
          </div>
          {isInvalid('heightCm') && <span className="hp-field__error">Bắt buộc</span>}
          {submitted && form.heightCm && (Number(form.heightCm) < 100 || Number(form.heightCm) > 250) && (
            <span className="hp-field__error">Chiều cao phải từ 100–250 cm</span>
          )}
        </div>

        <div className={`hp-field ${submitted && (Number(form.currentWeightKg) < 20 || Number(form.currentWeightKg) > 300) ? 'is-invalid' : isInvalid('currentWeightKg') ? 'is-invalid' : ''}`}>
          <label htmlFor="currentWeightKg">
            Cân nặng mốc (Hồ sơ) <span className="hp-required">*</span>
            {baselineStatus?.isLocked && (
              <span className="hp-baseline-chip hp-baseline-chip--locked">
                <i className="bi bi-lock-fill" /> Đang khóa 14 ngày
              </span>
            )}
            {baselineStatus?.inGracePeriod && (
              <span className="hp-baseline-chip hp-baseline-chip--grace">
                <i className="bi bi-clock-history" /> Ân hạn sửa nhầm (Còn {baselineStatus.hoursRemainingInGrace}h)
              </span>
            )}
          </label>
          <div className="hp-unit-input">
            <input
              id="currentWeightKg" name="currentWeightKg" type="number"
              min="20" max="300" step="0.1" placeholder="55"
              value={form.currentWeightKg} onChange={updateField}
              disabled={Boolean(baselineStatus?.isLocked)}
            />
            <span>kg</span>
          </div>
          {isInvalid('currentWeightKg') && <span className="hp-field__error">Bắt buộc</span>}
          {submitted && form.currentWeightKg && (Number(form.currentWeightKg) < 20 || Number(form.currentWeightKg) > 300) && (
            <span className="hp-field__error">Cân nặng phải từ 20–300 kg</span>
          )}
        </div>
      </div>

      {/* Thông báo chu kỳ dinh dưỡng 14 ngày & Ân hạn 24 giờ */}
      {baselineStatus?.inGracePeriod && (
        <div className="hp-baseline-notice hp-baseline-notice--grace">
          <i className="bi bi-clock-history" />
          <div>
            <strong>Khoảng ân hạn sửa nhầm (Còn {baselineStatus.hoursRemainingInGrace} giờ)</strong>
            <p>
              Bạn có thể chỉnh sửa lại cân nặng mốc nếu vừa nhập nhầm. Sau 24 giờ đầu, chỉ số mốc này sẽ được khóa trong 14 ngày để đánh giá kết quả dinh dưỡng.
            </p>
          </div>
        </div>
      )}

      {baselineStatus?.isLocked && (
        <div className="hp-baseline-notice hp-baseline-notice--locked">
          <div className="hp-baseline-notice__top">
            <div className="hp-baseline-notice__info">
              <span className="hp-baseline-notice__tag">
                <i className="bi bi-lock-fill" /> Bảo lưu chu kỳ 14 ngày
              </span>
              <p>
                Cân nặng mốc được cố định trong 14 ngày để cơ thể thích nghi với mức Calo &amp; TDEE mục tiêu. Chỉ số này sẽ mở khóa vào ngày <strong>{formatLogDate(baselineStatus.unlockDate)}</strong> (còn <strong>{baselineStatus.daysRemaining} ngày</strong>).
              </p>
            </div>
            <Link to="/weight-tracker" className="hp-baseline-notice__btn">
              <i className="bi bi-speedometer2" /> Ghi cân nặng hàng ngày →
            </Link>
          </div>
        </div>
      )}

      {baselineStatus?.canReviewMilestone && (
        <div className="hp-baseline-notice hp-baseline-notice--milestone">
          <div className="hp-baseline-notice__top">
            <div className="hp-baseline-notice__info">
              <span className="hp-baseline-notice__tag hp-baseline-notice__tag--milestone">
                <i className="bi bi-trophy-fill" /> Đã hoàn thành chu kỳ 14 ngày!
              </span>
              <p>
                Đã hết chu kỳ 14 ngày! Bạn có muốn cập nhật lại chỉ số mốc và tính lại mục tiêu Calo cho chu kỳ tiếp theo không?
              </p>
            </div>
            <button
              type="button"
              className="hp-baseline-notice__btn hp-baseline-notice__btn--milestone"
              onClick={openMilestoneModal}
            >
              <i className="bi bi-arrow-repeat" /> Đánh giá &amp; Cập nhật mốc mới
            </button>
          </div>
        </div>
      )}

      {/* BMI display & Bảng phân loại chi tiết */}
      <BmiGauge
        bmi={bmi}
        bmiInfo={bmiInfo}
        bmiTableView={bmiTableView}
        setBmiTableView={setBmiTableView}
      />

      {/* Gợi ý từ hệ thống — xuất hiện ngay khi có BMI hợp lệ */}
      {systemAdvice && bmiInfo && (
        <div className="hp-expert-advice" style={{ borderColor: systemAdvice.color }}>
          <div className="hp-expert-advice__header" style={{ color: systemAdvice.color }}>
            <i className={`bi ${systemAdvice.icon}`} />
            <strong>Gợi ý từ hệ thống (dựa trên chỉ số BMI)</strong>
          </div>
          <p className="hp-expert-advice__text">{systemAdvice.advice}</p>
          <div className="hp-expert-advice__tag" style={{ backgroundColor: bmiInfo.bg, color: systemAdvice.color }}>
            <i className="bi bi-lightbulb-fill" />
            Mục tiêu được gợi ý:{' '}
            <strong>{NUTRITION_GOAL_OPTIONS.find((g) => g.value === systemAdvice.recommended)?.label}</strong>
          </div>
          <p className="hp-expert-advice__disclaimer">
            <i className="bi bi-info-circle" /> Thông tin chỉ mang tính tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.
          </p>
        </div>
      )}

      {/* Callout hướng dẫn chuyển tiếp sang trang Theo dõi cân nặng */}
      <div className="hp-weight-tracker-callout">
        <div className="hp-weight-tracker-callout__icon">
          <i className="bi bi-speedometer2" />
        </div>
        <div className="hp-weight-tracker-callout__content">
          <strong>Theo dõi biến động cân nặng &amp; Biểu đồ xu hướng hàng ngày</strong>
          <p>
            Cân nặng mốc trong hồ sơ này được cố định 14 ngày để làm căn cứ tính BMR và TDEE. Để ghi nhật ký cân nặng mỗi ngày, xem biểu đồ xu hướng sinh học và phân tích chi tiết, vui lòng mở trang Tiến trình.
          </p>
        </div>
        <Link to="/weight-tracker" className="hp-weight-tracker-callout__btn">
          Mở trang Tiến trình <i className="bi bi-arrow-right" />
        </Link>
      </div>
    </section>
  )
}
