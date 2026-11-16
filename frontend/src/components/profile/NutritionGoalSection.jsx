import React from 'react'
import { NUTRITION_GOAL_OPTIONS, getGoalRisk } from '../../constants/healthConstants'

export default function NutritionGoalSection({
  form,
  updateField,
  handleGoalChange,
  systemAdvice,
  selectedGoalConfig,
  bmiInfo,
  age,
  targetWeightConstraint,
  targetWeightBmiWarning,
  estimatedWeeks,
  customized,
  setCustomized,
  customForm,
  setCustomForm,
  activeCalorieTarget,
  activeMacros,
  activeGrams,
  actualDeficit,
  customWarnings,
  macroSum,
  macroSumOk,
  bmr,
  tdee,
}) {
  return (
    <section className="hp-card" aria-labelledby="sec-goal">
      <div className="hp-card__header">
        <div className="hp-card__badge">4</div>
        <div>
          <h2 id="sec-goal">Mục tiêu dinh dưỡng &amp; Phân bổ năng lượng</h2>
          <p>Hệ thống tự động đề xuất mục tiêu calo và tỉ lệ macro dựa trên chỉ số trao đổi chất của bạn. Kết quả chỉ mang tính tham khảo.</p>
        </div>
      </div>

      {/* Thông báo khi goal đang được auto-chọn theo gợi ý hệ thống */}
      {systemAdvice && form.healthGoal === systemAdvice.recommended && (
        <div className="hp-advice-note hp-advice-note--info" style={{ marginBottom: '12px' }}>
          <i className="bi bi-stars" />
          <span>
            Mục tiêu <strong>{selectedGoalConfig.label}</strong> đã được hệ thống tự động chọn dựa trên chỉ số BMI của bạn.
            Bạn có thể thay đổi tùy ý bên dưới.
          </span>
        </div>
      )}

      {/* 3 lựa chọn mục tiêu */}
      <div className="hp-goal-grid">
        {NUTRITION_GOAL_OPTIONS.map((opt) => {
          const isActive = (form.healthGoal || 'maintain_weight') === opt.value
          const isRecommended = systemAdvice?.recommended === opt.value
          const optRisk = bmiInfo ? getGoalRisk(opt.value, bmiInfo.label, age, form.specialConditions) : null
          const isUnscientific = Boolean(optRisk?.isUnscientific)
          return (
            <label
              className={`hp-goal-card ${isActive ? 'is-active' : ''} ${isUnscientific ? 'is-unscientific' : ''}`}
              key={opt.value}
              style={isActive ? { borderColor: isUnscientific ? '#ef4444' : opt.color, backgroundColor: isUnscientific ? '#fff5f5' : opt.bg } : {}}
            >
              <input
                type="radio" name="healthGoal" value={opt.value}
                checked={isActive}
                onChange={() => handleGoalChange(opt.value)}
              />
              <div className="hp-goal-card__icon" style={{ color: opt.color, backgroundColor: opt.bg }}>
                <i className={`bi ${opt.icon}`} />
              </div>
              <strong className="hp-goal-card__label">{opt.label}</strong>
              <small className="hp-goal-card__sub">{opt.sub}</small>
              <div className="hp-goal-card__badges">
                {isRecommended && (
                  <span className="hp-goal-card__recommended" style={{ color: opt.color }}>
                    <i className="bi bi-patch-check-fill" /> Được gợi ý
                  </span>
                )}
              </div>
              {isActive && <i className="bi bi-check-circle-fill hp-goal-card__check" style={{ color: isUnscientific ? '#ef4444' : opt.color }} />}
            </label>
          )
        })}
      </div>

      {/* Cân nặng mục tiêu */}
      <div className="hp-target-weight-section">
        <h3 className="hp-target-weight-section__title">
          <i className="bi bi-bullseye" /> Cân nặng mục tiêu
        </h3>
        {targetWeightConstraint.disabled ? (
          <div className="hp-target-weight-disabled">
            <i className="bi bi-info-circle" />
            <span>
              Bạn đang chọn <strong>Duy trì cân nặng</strong> — cân nặng mục tiêu bằng cân nặng hiện tại
              {form.currentWeightKg && <strong> ({form.currentWeightKg} kg)</strong>}.
            </span>
          </div>
        ) : (
          <div className="hp-field">
            <label htmlFor="targetWeightKg">
              Cân nặng mục tiêu
              {targetWeightConstraint.hint && (
                <small className="hp-target-weight-hint"> — {targetWeightConstraint.hint}</small>
              )}
            </label>
            <div className="hp-unit-input">
              <input
                id="targetWeightKg" name="targetWeightKg" type="number"
                min={targetWeightConstraint.min} max={targetWeightConstraint.max}
                step="0.1"
                placeholder={form.healthGoal === 'lose_weight' ? `< ${form.currentWeightKg || '?'} kg` : `> ${form.currentWeightKg || '?'} kg`}
                value={form.targetWeightKg} onChange={updateField}
              />
              <span>kg</span>
            </div>
            {targetWeightBmiWarning && (
              <div className="hp-field__warning">
                <i className="bi bi-exclamation-triangle" /> {targetWeightBmiWarning}
              </div>
            )}
            {/* Safe upper hint for gain_weight */}
            {form.healthGoal === 'gain_weight' && targetWeightConstraint.safeguardMax && (
              <small className="hp-target-weight-hint" style={{ display: 'block', marginTop: '4px' }}>
                <i className="bi bi-shield" /> Cân nặng dưới {targetWeightConstraint.safeguardMax} kg tương ứng BMI &lt; 23 (ngưỡng thừa cân WHO Châu Á).
              </small>
            )}
            {estimatedWeeks && (
              <div className="hp-estimate-row">
                <div className="hp-estimate-row__main">
                  <i className="bi bi-clock-history" />
                  <span>Ước tính đạt mục tiêu sau khoảng</span>
                  <strong className="hp-estimate-row__value">
                    {estimatedWeeks} tuần
                    <em>({Math.round(estimatedWeeks / 4.3)} tháng)</em>
                  </strong>
                </div>
                <p className="hp-estimate-row__note">
                  <i className="bi bi-info-circle" />
                  Chỉ mang tính tham khảo — kết quả thực tế phụ thuộc vào nhiều yếu tố.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bảng Calo & Macro */}
      <div className="hp-macro-panel">
        <div className="hp-macro-panel__header">
          <div className="hp-macro-panel__title">
            <span className="hp-macro-panel__tag">Đề xuất của hệ thống mỗi ngày</span>
            <h3>{selectedGoalConfig.label}</h3>
          </div>
          <button
            type="button" className="hp-macro-panel__btn-toggle"
            onClick={() => {
              if (!customized) {
                setCustomForm({
                  calorieTarget: activeCalorieTarget ? String(Math.round(activeCalorieTarget)) : '',
                  protein: String(activeMacros.protein),
                  carbs: String(activeMacros.carbs),
                  fat: String(activeMacros.fat),
                })
              }
              setCustomized(!customized)
            }}
          >
            <i className={`bi ${customized ? 'bi-stars' : 'bi-sliders2'}`} />
            {customized ? 'Dùng đề xuất của hệ thống' : 'Tùy chỉnh mục tiêu'}
          </button>
        </div>

        <div className="hp-macro-calories">
          <div>
            <span>Mục tiêu năng lượng mỗi ngày</span>
            <strong>
              {activeCalorieTarget
                ? <>{Math.round(activeCalorieTarget).toLocaleString('vi-VN')} <small>kcal/ngày</small></>
                : <span style={{ color: '#94a3b8' }}>— (cần hoàn tất thông tin)</span>
              }
            </strong>
          </div>
          {bmr && tdee && (
            <div className="hp-macro-calories__sub">
              <span><i className="bi bi-fire" /> BMR: <b>{bmr.toLocaleString('vi-VN')} kcal</b></span>
              <span><i className="bi bi-lightning-charge" /> TDEE: <b>{tdee.toLocaleString('vi-VN')} kcal</b></span>
            </div>
          )}
        </div>

        {/* Ghi chú khi calo giảm cân bị giới hạn ở BMR */}
        {actualDeficit?.capped && (
          <div className="hp-advice-note hp-advice-note--info">
            <i className="bi bi-info-circle-fill" />
            Mức thâm hụt thực tế được điều chỉnh xuống <strong>{actualDeficit.kcal} kcal/ngày</strong>{' '}
            (thay vì 500 kcal) để không thấp hơn BMR — đảm bảo an toàn cho sức khỏe.
          </div>
        )}

        {customized && (
          <div className="hp-custom-row mb-3">
            <div className="hp-field">
              <label>
                Calo mục tiêu (kcal/ngày)
                {bmr && tdee && (
                  <small className="text-muted ms-2">
                    (Khoảng an toàn: {bmr.toLocaleString('vi-VN')} – {(tdee + 1000).toLocaleString('vi-VN')} kcal)
                  </small>
                )}
              </label>
              <div className="hp-unit-input">
                <input
                  type="number" min={bmr || 1000} max={(tdee || 2000) + 1000}
                  placeholder="Nhập calo mục tiêu"
                  value={customForm.calorieTarget}
                  onChange={(e) => setCustomForm((c) => ({ ...c, calorieTarget: e.target.value }))}
                />
                <span>kcal</span>
              </div>
            </div>
          </div>
        )}

        {/* Real-time warnings in custom mode */}
        {customWarnings.map((w, i) => (
          <div key={i} className={`hp-advice-note hp-advice-note--${w.level}`}>
            <i className={`bi ${w.level === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill'}`} />
            {w.msg}
          </div>
        ))}

        {/* Macro cards */}
        <div className="hp-macro-grid">
          <div className="hp-macro-card hp-macro-card--protein">
            <div className="hp-macro-card__top"><span>Đạm (Protein)</span><small>4 kcal/g</small></div>
            {customized ? (
              <div className="hp-macro-input-wrap">
                <input type="number" min="5" max="70" placeholder="5–70" value={customForm.protein}
                  onChange={(e) => setCustomForm((c) => ({ ...c, protein: e.target.value }))} />
                <span>%</span>
              </div>
            ) : (
              <strong className="hp-macro-pct">{activeMacros.protein}%</strong>
            )}
            <b className="hp-macro-grams">{activeGrams.protein ?? '—'} g</b>
          </div>

          <div className="hp-macro-card hp-macro-card--carbs">
            <div className="hp-macro-card__top"><span>Tinh bột (Carbs)</span><small>4 kcal/g</small></div>
            {customized ? (
              <div className="hp-macro-input-wrap">
                <input type="number" min="5" max="80" placeholder="5–80" value={customForm.carbs}
                  onChange={(e) => setCustomForm((c) => ({ ...c, carbs: e.target.value }))} />
                <span>%</span>
              </div>
            ) : (
              <strong className="hp-macro-pct">{activeMacros.carbs}%</strong>
            )}
            <b className="hp-macro-grams">{activeGrams.carbs ?? '—'} g</b>
          </div>

          <div className="hp-macro-card hp-macro-card--fat">
            <div className="hp-macro-card__top"><span>Chất béo (Lipid)</span><small>9 kcal/g</small></div>
            {customized ? (
              <div className="hp-macro-input-wrap">
                <input type="number" min="5" max="60" placeholder="5–60" value={customForm.fat}
                  onChange={(e) => setCustomForm((c) => ({ ...c, fat: e.target.value }))} />
                <span>%</span>
              </div>
            ) : (
              <strong className="hp-macro-pct">{activeMacros.fat}%</strong>
            )}
            <b className="hp-macro-grams">{activeGrams.fat ?? '—'} g</b>
          </div>
        </div>

        {/* Tổng macro — ngưỡng nhất quán ±1% */}
        {customized && (
          <div className={`hp-macro-sum ${macroSumOk ? 'is-valid' : 'is-invalid'}`}>
            <i className={`bi ${macroSumOk ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
            <span>
              Tổng tỉ lệ: <b>{macroSum}%</b>{' '}
              {macroSumOk ? '(Đạt chuẩn 100%)' : '(Cần điều chỉnh sao cho tổng trong khoảng 99–101%)'}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
