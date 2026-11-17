import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UserHeader from '../../components/common/UserHeader'
import UserFooter from '../../components/common/UserFooter'
import axiosInstance from '../../api/axiosInstance'
import './AnalyticsTrendsPage.css'

// Modularized Chart Components
import EnergyTrendChart from '../../components/analytics/EnergyTrendChart'
import MacroBreakdownChart from '../../components/analytics/MacroBreakdownChart'
import MealDistributionChart from '../../components/analytics/MealDistributionChart'
import DayOfWeekChart from '../../components/analytics/DayOfWeekChart'

function formatDateVi(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

export default function AnalyticsTrendsPage() {
  const [period, setPeriod] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)

  useEffect(() => {
    let isMounted = true
    async function fetchAnalytics() {
      try {
        setLoading(true)
        setError(null)
        const res = await axiosInstance.get(`/profile/analytics?period=${period}`)
        if (isMounted) {
          setAnalyticsData(res.data)
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu chỉ số & xu hướng:', err)
        if (isMounted) {
          setError(err.response?.data?.message || 'Không thể tải dữ liệu chỉ số và xu hướng')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchAnalytics()
    return () => {
      isMounted = false
    }
  }, [period])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const res = await axiosInstance.get(`/profile/analytics?period=${period}`)
      setAnalyticsData(res.data)
    } catch (err) {
      console.error('Lỗi làm mới:', err)
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  const kpi = analyticsData?.kpiSummary || {}
  const macros = analyticsData?.macroAnalysis || {}
  const weight = analyticsData?.weightAnalysis || {}
  const exercises = analyticsData?.exerciseAnalysis || {}
  const meals = analyticsData?.mealAnalysis || {}
  const dow = analyticsData?.dayOfWeekAnalysis || []
  const daily = analyticsData?.dailyData || []
  const mealBreakdown = meals.mealBreakdown || {}

  return (
    <div className="at-shell">
      {/* ── HEADER NAVIGATION BAR ── */}
      <UserHeader />

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="at-container">
        {/* ── EXECUTIVE HEADER BANNER ── */}
        <section className="at-hero">
          <div className="at-hero__left">
            <div className="at-hero__badge-icon">
              <i className="bi bi-graph-up-arrow" />
            </div>
            <div className="at-hero__title-wrap">
              <div className="at-hero__title-row">
                <h1>Chỉ số &amp; Xu hướng</h1>
                {analyticsData?.startDate && analyticsData?.endDate && (
                  <span className="at-hero__period-pill">
                    <i className="bi bi-calendar3" />
                    {formatDateVi(analyticsData.startDate)} — {formatDateVi(analyticsData.endDate)}
                    <span className="at-hero__dot" />
                    {analyticsData.numDays} ngày
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="at-hero__right">
            <div className="at-timeframe-group" role="group" aria-label="Chọn khoảng thời gian">
              {[
                { id: '7d', label: '7 ngày' },
                { id: '14d', label: '14 ngày' },
                { id: '30d', label: '30 ngày' },
                { id: '90d', label: '90 ngày' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  className={`at-tf-btn ${period === tf.id ? 'is-active' : ''}`}
                  onClick={() => setPeriod(tf.id)}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`at-refresh-btn ${refreshing ? 'is-spinning' : ''}`}
              onClick={handleRefresh}
              title="Làm mới dữ liệu"
              aria-label="Làm mới dữ liệu"
            >
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
        </section>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="at-loading-skeleton">
            <div className="at-skeleton-box" style={{ height: '90px' }} />
            <div className="at-skeleton-box" style={{ height: '360px' }} />
            <div className="at-skeleton-box" style={{ height: '280px' }} />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="at-empty-state">
            <i className="bi bi-exclamation-octagon text-danger" />
            <h3>Không thể tải chỉ số</h3>
            <p>{error}</p>
            <button
              type="button"
              className="at-action-btn at-action-btn--primary"
              onClick={() => setPeriod(period)}
            >
              <i className="bi bi-arrow-clockwise" /> Thử lại
            </button>
          </div>
        )}

        {/* Unified Full-Page Dashboard Content */}
        {!loading && !error && analyticsData && (
          <>
            {/* ── 1. KPI SUMMARY CARDS ── */}
            <section className="at-kpi-grid">
              {/* 1. Calo nạp trung bình */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Calo nạp trung bình</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--orange">
                    <i className="bi bi-fire" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.avgCaloriesIn ? kpi.avgCaloriesIn.toLocaleString() : 0}
                    <small>kcal/ngày</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    Mục tiêu: <strong>{kpi.calorieTarget ? kpi.calorieTarget.toLocaleString() : 2000} kcal</strong>
                    {kpi.calorieTarget && (
                      <span className={`at-badge ${(kpi.avgCaloriesIn || 0) <= kpi.calorieTarget ? 'at-badge--success' : 'at-badge--warning'}`}>
                        {Math.round(((kpi.avgCaloriesIn || 0) / kpi.calorieTarget) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Tiêu hao vận động */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Tiêu hao vận động</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--blue">
                    <i className="bi bi-lightning-charge" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.avgCaloriesBurned ? kpi.avgCaloriesBurned.toLocaleString() : 0}
                    <small>kcal/ngày</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    TB: <strong>{exercises.avgMinutesPerDay || 0} phút</strong> vận động/ngày
                  </div>
                </div>
              </div>

              {/* 3. Cân bằng năng lượng */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Cân bằng năng lượng Net</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--emerald">
                    <i className="bi bi-bullseye" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value" style={{ color: (kpi.avgNetCalories || 0) <= (kpi.calorieTarget || 2000) ? '#059669' : '#ea580c' }}>
                    {kpi.avgNetCalories ? kpi.avgNetCalories.toLocaleString() : 0}
                    <small>kcal</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    {kpi.avgDailyDeficit != null && (
                      <span className="text-emerald-700 font-medium">
                        {kpi.avgDailyDeficit < 0
                          ? `Thâm hụt: ${Math.abs(kpi.avgDailyDeficit)} kcal/ngày`
                          : `Thặng dư: +${kpi.avgDailyDeficit} kcal/ngày`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Cân nặng hiện tại */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Cân nặng hiện tại</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--purple">
                    <i className="bi bi-speedometer2" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {weight.currentWeight || '-'}
                    <small>kg</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    BMI: <strong>{weight.bmi || '-'}</strong> ({weight.bmiCategory || 'Bình thường'})
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. XU HƯỚNG NĂNG LƯỢNG & CÂN BẰNG CALO (WIDESCREEN SVG) ── */}
            <EnergyTrendChart
              daily={daily}
              calorieTarget={kpi.calorieTarget || 2000}
              kpi={kpi}
            />

            {/* ── 3. HAI CỘT: DINH DƯỠNG (MACROS & BỮA ĂN) & VẬN ĐỘNG THỂ CHẤT ── */}
            <div className="at-columns-grid">
              {/* CỘT 1: CƠ CẤU DINH DƯỠNG & BỮA ĂN */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-pie-chart" /> Cơ cấu Dinh dưỡng &amp; Bữa ăn
                    </h2>
                  </div>
                </div>

                <div className="at-nutrition-clean">
                  <MacroBreakdownChart macros={macros} />
                  <MealDistributionChart
                    mealBreakdown={mealBreakdown}
                    daily={daily}
                    exercises={exercises}
                  />
                </div>
              </section>

              {/* CỘT 2: THỜI LƯỢNG & HOẠT ĐỘNG THỂ CHẤT */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-calendar-week-fill" /> So sánh các ngày trong tuần
                    </h2>
                  </div>
                  <div className="at-chart-legend">
                    <span className="at-legend-item">
                      <span className="at-legend-color" style={{ background: '#10b981' }} />
                      Calo nạp
                    </span>
                    <span className="at-legend-item">
                      <span className="at-legend-color" style={{ background: '#0284c7' }} />
                      Calo đốt
                    </span>
                  </div>
                </div>

                <DayOfWeekChart
                  dow={dow}
                  calorieTarget={kpi.calorieTarget || 2000}
                />
              </section>
            </div>

            {/* ── 4. THỂ TRẠNG & THƯỚC ĐO BMI Y KHOA ── */}
            <section className="at-card at-card--full" style={{ marginTop: '20px' }}>
              <div className="at-card__header">
                <div className="at-card__title-group">
                  <h2>
                    <i className="bi bi-speedometer2" /> Thể trạng &amp; Thước đo BMI
                  </h2>
                </div>
                <Link to="/weight-tracker" className="at-link-sm">
                  Chi tiết &rarr;
                </Link>
              </div>

              <div className="at-body-clean">
                <div className="at-weight-stats-clean">
                  <div className="at-weight-box-sm">
                    <span className="at-weight-box__label">Cân đầu kỳ</span>
                    <div className="at-weight-box__val">{weight.initialWeight || '-'} kg</div>
                  </div>
                  <div className="at-weight-box-sm">
                    <span className="at-weight-box__label">Cân hiện tại</span>
                    <div className="at-weight-box__val text-emerald-600">{weight.currentWeight || '-'} kg</div>
                  </div>
                  <div className="at-weight-box-sm">
                    <span className="at-weight-box__label">Biến thiên</span>
                    <div className="at-weight-box__val">
                      {weight.weightChange != null ? (
                        <span style={{ color: weight.weightChange <= 0 ? '#059669' : '#ea580c' }}>
                          {weight.weightChange > 0 ? `+${weight.weightChange}` : weight.weightChange} kg
                        </span>
                      ) : '-'}
                    </div>
                  </div>
                  <div className="at-weight-box-sm">
                    <span className="at-weight-box__label">Mục tiêu</span>
                    <div className="at-weight-box__val">
                      {weight.targetWeight ? `${weight.targetWeight} kg` : '-'}
                    </div>
                  </div>
                </div>

                {/* BMI Gauge */}
                <div className="at-bmi-gauge-card-clean">
                  <div className="at-bmi-gauge-header-clean">
                    <div className="at-bmi-score-row">
                      <span className="at-bmi-number">{weight.bmi || '-'}</span>
                      <span className={`at-badge ${weight.bmiCategory === 'Bình thường' ? 'at-badge--success' : 'at-badge--warning'}`}>
                        {weight.bmiCategory || 'Bình thường'}
                      </span>
                    </div>
                    <div className="at-ideal-range-note">
                      <span>Cân nặng chuẩn: <strong>{weight.minHealthyWeight || 50} — {weight.maxHealthyWeight || 65} kg</strong></span>
                    </div>
                  </div>

                  <div className="at-bmi-track-wrapper">
                    <div className="at-bmi-track">
                      {weight.bmi && (
                        <div
                          className="at-bmi-pin"
                          style={{
                            left: `${Math.min(98, Math.max(2, ((weight.bmi - 15) / 15) * 100))}%`,
                          }}
                          title={`BMI: ${weight.bmi}`}
                        >
                          <span className="at-bmi-pin-bubble">{weight.bmi}</span>
                        </div>
                      )}
                    </div>

                    <div className="at-bmi-labels">
                      <span className="at-bmi-zone--under">&lt;18.5 Thiếu cân</span>
                      <span className="at-bmi-zone--normal">18.5 - 22.9 Chuẩn</span>
                      <span className="at-bmi-zone--over">23 - 24.9 Thừa cân</span>
                      <span className="at-bmi-zone--obese">&ge;25 Béo phì</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <UserFooter />
    </div>
  )
}
