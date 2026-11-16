import React from 'react'
import { BMI_REFERENCE_ROWS } from '../../constants/healthConstants'

export default function BmiGauge({
  bmi,
  bmiInfo,
  bmiTableView,
  setBmiTableView,
}) {
  if (!bmi || !bmiInfo) return null

  return (
    <div className="hp-metrics">
      <div className="hp-bmi">
        <div className="hp-bmi__left">
          <span className="hp-bmi__label">Chỉ số khối cơ thể (BMI)</span>
          <strong className="hp-bmi__value" style={{ color: bmiInfo.color }}>{bmi}</strong>
          <span className="hp-bmi__cat" style={{ color: bmiInfo.color, backgroundColor: bmiInfo.bg }}>
            {bmiInfo.label} (WHO Châu Á)
          </span>
        </div>
        <div className="hp-bmi__right">
          <div className="hp-bmi__bar-wrap">
            {/* Thanh 4 phân đoạn chuẩn hóa bằng nhau (25% mỗi đoạn) */}
            <div className="hp-bmi__bar">
              <div className="hp-bmi__seg hp-bmi__seg--underweight" title="Thiếu cân (< 18.5)" />
              <div className="hp-bmi__seg hp-bmi__seg--normal" title="Bình thường (18.5 – 22.9)" />
              <div className="hp-bmi__seg hp-bmi__seg--overweight" title="Thừa cân (23.0 – 24.9)" />
              <div className="hp-bmi__seg hp-bmi__seg--obese" title="Béo phì (≥ 25.0)" />

              {/* Kim chỉ thị nội suy mượt mà trong từng phân đoạn */}
              <div
                className="hp-bmi__needle"
                style={{ left: `${bmiInfo.pct}%`, backgroundColor: bmiInfo.color }}
                title={`BMI của bạn: ${bmi} (${bmiInfo.label})`}
              >
                <span className="hp-bmi__needle-val">{bmi}</span>
              </div>
            </div>

            {/* 4 cột nhãn phân loại khớp chính xác 100% với 4 đoạn màu */}
            <div className="hp-bmi__scale-grid">
              <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Thiếu cân' ? 'is-active' : ''}`}>
                <strong>Thiếu cân</strong>
                <small>&lt; 18,5</small>
              </div>
              <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Bình thường' ? 'is-active' : ''}`}>
                <strong>Bình thường</strong>
                <small>18,5 – 22,9</small>
              </div>
              <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Thừa cân' ? 'is-active' : ''}`}>
                <strong>Thừa cân</strong>
                <small>23 – 24,9</small>
              </div>
              <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Béo phì' ? 'is-active' : ''}`}>
                <strong>Béo phì</strong>
                <small>≥ 25</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bảng & hình ảnh phân loại BMI chi tiết */}
      <div className="hp-bmi-detail-card">
        <div className="hp-bmi-detail-card__header">
          <div className="hp-bmi-detail-card__title">
            <i className="bi bi-table" />
            <div>
              <h3>Bảng phân loại chỉ số BMI chi tiết</h3>
              <p>So sánh tiêu chuẩn WHO (Toàn cầu) và IDI &amp; WPRO (Khuyến nghị cho người Châu Á)</p>
            </div>
          </div>
          <div className="hp-bmi-detail-card__tabs">
            <button
              type="button"
              className={`hp-bmi-tab-btn ${bmiTableView === 'table' ? 'is-active' : ''}`}
              onClick={() => setBmiTableView('table')}
            >
              <i className="bi bi-grid-3x3" /> Bảng phân tích
            </button>
            <button
              type="button"
              className={`hp-bmi-tab-btn ${bmiTableView === 'image' ? 'is-active' : ''}`}
              onClick={() => setBmiTableView('image')}
            >
              <i className="bi bi-image" /> Xem hình ảnh gốc
            </button>
          </div>
        </div>

        {bmiTableView === 'table' ? (
          <div className="hp-bmi-table-responsive">
            <table className="hp-bmi-table">
              <colgroup>
                <col className="hp-bmi-col--label" />
                <col className="hp-bmi-col--who" />
                <col className="hp-bmi-col--asian" />
                <col className="hp-bmi-col--status" />
              </colgroup>
              <thead>
                <tr>
                  <th className="hp-bmi-th hp-bmi-th--label">Phân loại thể trạng</th>
                  <th className="hp-bmi-th hp-bmi-th--who">
                    <span className="hp-bmi-th__title">BMI (kg/m²) - WHO</span>
                    <span className="hp-bmi-th__sub">Toàn cầu</span>
                  </th>
                  <th className="hp-bmi-th hp-bmi-th--asian">
                    <span className="hp-bmi-th-asian__tag">
                      <i className="bi bi-star-fill" /> Chuẩn áp dụng
                    </span>
                    <span className="hp-bmi-th-asian__title">
                      BMI (kg/m²) - IDI &amp; WPRO <em>(Châu Á)</em>
                    </span>
                  </th>
                  <th className="hp-bmi-th hp-bmi-th--status">Trạng thái của bạn</th>
                </tr>
              </thead>
              <tbody>
                {BMI_REFERENCE_ROWS.map((row) => {
                  const isUserMatch = row.matches && row.matches(Number(bmi))
                  return (
                    <tr
                      key={row.key}
                      className={`hp-bmi-table__row hp-bmi-table__row--${row.key} ${isUserMatch ? 'is-user-current' : ''}`}
                      style={isUserMatch ? { '--cat-color': row.color, '--cat-bg': row.bg } : undefined}
                    >
                      <td className="hp-bmi-table__cell-label">
                        <div className="hp-bmi-table__label-flex">
                          <span
                            className={`hp-bmi-table__color-dot ${isUserMatch ? 'is-pulse' : ''}`}
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="hp-bmi-table__label-main">{row.label}</span>
                          {row.subLabel && (
                            <span className="hp-bmi-table__label-sub">{row.subLabel}</span>
                          )}
                        </div>
                      </td>
                      <td className="hp-bmi-table__cell-val hp-bmi-table__cell-val--who">
                        {row.who}
                      </td>
                      <td
                        className={`hp-bmi-table__cell-val hp-bmi-table__cell-val--asian ${isUserMatch ? 'is-user-target' : ''}`}
                      >
                        {isUserMatch ? (
                          <span className="hp-bmi-asian-pill">{row.idiWpro}</span>
                        ) : (
                          <span className="hp-bmi-asian-val">{row.idiWpro}</span>
                        )}
                      </td>
                      <td className="hp-bmi-table__cell-status">
                        {isUserMatch ? (
                          <span
                            className="hp-bmi-table__user-badge"
                            style={{ color: row.color, borderColor: row.color, backgroundColor: row.bg }}
                          >
                            <i className="bi bi-geo-alt-fill" /> Vị trí của bạn: <strong>{bmi}</strong>
                          </span>
                        ) : (
                          <span className="hp-bmi-table__empty-dash">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="hp-bmi-table__source">
              <i className="bi bi-info-circle-fill" />
              <div>
                <strong>✦ NutriLens áp dụng chuẩn IDI &amp; WPRO (Khuyến nghị cho người Châu Á):</strong>
                <span>
                  {' '}Người Châu Á có nguy cơ bệnh lý tim mạch và đái tháo đường ở mức BMI thấp hơn (ngưỡng thừa cân từ <strong>23,0 kg/m²</strong> - y khoa gọi là Tiền béo phì; béo phì từ <strong>25,0 kg/m²</strong>). Nguồn: WHO (1999); IDI &amp; WPRO (2000); Bộ Y Tế.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="hp-bmi-image-view">
            <div className="hp-bmi-image-frame">
              <img
                src="/bmi-reference-table.jpg"
                alt="Bảng chi tiết phân loại BMI - WHO và IDI & WPRO"
                className="hp-bmi-reference-img"
              />
            </div>
            <p className="hp-bmi-table__source">
              <i className="bi bi-info-circle-fill" />
              <span>Hình ảnh bảng phân loại chuẩn y khoa đối chiếu giữa WHO và IDI &amp; WPRO.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
