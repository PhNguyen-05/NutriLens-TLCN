import React from 'react'
import { Link } from 'react-router-dom'

export default function WeightKpiCards({
  stats,
  profile,
  weightLogs,
  formatLogDate,
}) {
  return (
    <section className="wt-kpi-grid">
      {/* Card 1: Cân nặng mới nhất trong nhật ký */}
      <article className="wt-kpi-card wt-kpi-card--current">
        <div className="wt-kpi-card__header">
          <span>Cân nặng mới nhất</span>
          <i className="bi bi-speedometer2" />
        </div>
        <div className="wt-kpi-card__val">
          <strong>{stats?.currentWeight ?? profile?.currentWeightKg ?? '—'}</strong>
          <small>kg</small>
        </div>
        <div className="wt-kpi-card__sub">
          {stats?.bmiInfo ? (
            <span className="wt-badge" style={{ backgroundColor: stats.bmiInfo.bg, color: stats.bmiInfo.color }}>
              BMI {stats.bmiInfo.bmi} • {stats.bmiInfo.label}
            </span>
          ) : (
            <span className="text-muted">Chưa có dữ liệu BMI</span>
          )}
          {stats?.latestDate && (
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
              <i className="bi bi-clock" /> Ghi nhận: {formatLogDate(stats.latestDate)} {stats.latestTime ? `lúc ${stats.latestTime}` : ''}
            </div>
          )}
        </div>
      </article>

      {/* Card 2: Thay đổi tổng cộng */}
      <article className="wt-kpi-card wt-kpi-card--change">
        <div className="wt-kpi-card__header">
          <span>Thay đổi tổng cộng</span>
          <i className="bi bi-arrow-left-right" />
        </div>
        <div className="wt-kpi-card__val">
          <strong className={stats?.totalDiff && stats.totalDiff < 0 ? 'is-down' : stats?.totalDiff && stats.totalDiff > 0 ? 'is-up' : ''}>
            {stats?.totalDiff ? (stats.totalDiff > 0 ? `+${stats.totalDiff}` : stats.totalDiff) : '0.0'}
          </strong>
          <small>kg</small>
        </div>
        <div className="wt-kpi-card__sub">
          <span>Bắt đầu: <b>{stats?.initialWeight ?? '—'} kg</b> ({formatLogDate(weightLogs[0]?.recordedDate || profile?.currentWeightRecordedDate || profile?.createdAt) || '—'})</span>
        </div>
      </article>

      {/* Card 3: Mục tiêu */}
      <article className="wt-kpi-card wt-kpi-card--target">
        <div className="wt-kpi-card__header">
          <span>Cân nặng mục tiêu</span>
          <i className="bi bi-bullseye" />
        </div>
        <div className="wt-kpi-card__val">
          <strong>{stats?.targetWeight ?? '—'}</strong>
          <small>kg</small>
        </div>
        <div className="wt-kpi-card__sub">
          {stats?.distanceToTarget != null ? (
            stats.distanceToTarget === 0 ? (
              <span className="wt-badge wt-badge--green"><i className="bi bi-check2" /> Đã đạt mục tiêu!</span>
            ) : (
              <span>Còn cách: <b>{stats.distanceToTarget} kg</b> {stats.progressPct != null && `(${stats.progressPct}%)`}</span>
            )
          ) : (
            <Link to="/profile" className="wt-link-small">Thiết lập mục tiêu trong hồ sơ →</Link>
          )}
        </div>
      </article>

      {/* Card 4: Tốc độ thay đổi */}
      <article className="wt-kpi-card wt-kpi-card--rate">
        <div className="wt-kpi-card__header">
          <span>Tốc độ trung bình</span>
          <i className="bi bi-graph-up-arrow" />
        </div>
        <div className="wt-kpi-card__val">
          <strong>{stats?.weeklyRate != null ? (stats.weeklyRate > 0 ? `+${stats.weeklyRate}` : stats.weeklyRate) : '—'}</strong>
          <small>kg/tuần</small>
        </div>
        <div className="wt-kpi-card__sub">
          <small className="text-muted">
            {stats?.weeklyRate != null
              ? Math.abs(stats.weeklyRate) <= 0.75
                ? '✦ Tốc độ an toàn, lành mạnh'
                : '⚠ Tốc độ thay đổi tương đối nhanh'
              : 'Cần ít nhất 2 bản ghi cách 1 tuần'}
          </small>
        </div>
      </article>
    </section>
  )
}
