import {
  calcCalories,
  extractYouTubeId,
} from '../../constants/exerciseConstants'

export default function ExerciseVideoModal({
  videoExercise,
  userWeight = null,
  onClose,
  onLogThisExercise,
}) {
  if (!videoExercise) return null

  const videoId = extractYouTubeId(videoExercise.youtubeUrl)
  const defaultDur = videoExercise.defaultDurationMinutes || 30
  const estCalories = userWeight ? calcCalories(videoExercise.met, userWeight, defaultDur) : null

  return (
    <div
      className="ex-overlay ex-overlay--video"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ex-dialog ex-dialog--video">
        <div className="ex-dialog-head">
          <div className="ex-dialog-title-group">
            <small className="ex-dialog-cat-badge">
              <i className="bi bi-youtube" style={{ color: '#ef4444', marginRight: 4 }} />
              Video hướng dẫn bài tập
            </small>
            <h3>{videoExercise.name}</h3>
          </div>
          <div className="ex-video-head-actions">
            <a
              href={videoExercise.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ex-btn ex-btn--ghost ex-btn--yt-ext"
              title="Mở video trên YouTube tab mới"
            >
              <i className="bi bi-box-arrow-up-right" /> Mở YouTube
            </a>
            <button
              type="button"
              className="ex-dialog-close"
              onClick={onClose}
              aria-label="Đóng"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        <div className="ex-video-player-wrap">
          {videoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={`Video hướng dẫn ${videoExercise.name}`}
              className="ex-video-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="ex-video-fallback">
              <i className="bi bi-youtube" style={{ fontSize: '3rem', color: '#ef4444' }} />
              <h4>Xem video hướng dẫn trên YouTube</h4>
              <p>Bấm liên kết bên dưới để xem trực tiếp trên YouTube.</p>
              <a
                href={videoExercise.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ex-btn ex-btn--primary"
              >
                <i className="bi bi-play-circle-fill" /> Mở trên YouTube
              </a>
            </div>
          )}
        </div>

        <div className="ex-dialog-body ex-video-dialog-body">
          <div className="ex-info-chips">
            <span>
              MET: <b>{videoExercise.met}</b>
            </span>
            <span>
              Cường độ: <b>{videoExercise.intensity}</b>
            </span>
            <span>
              Nhóm: <b>{videoExercise.categoryName || videoExercise.category}</b>
            </span>
            {estCalories != null && (
              <span>
                Ước tính: <b>~{estCalories} kcal</b> / {defaultDur}p
              </span>
            )}
          </div>
          {videoExercise.description && (
            <p className="ex-video-desc">{videoExercise.description}</p>
          )}
        </div>

        <div className="ex-dialog-foot">
          <button
            type="button"
            className="ex-btn ex-btn--ghost"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="ex-btn ex-btn--primary"
            onClick={() => {
              const target = videoExercise
              onClose()
              onLogThisExercise(target)
            }}
          >
            <i className="bi bi-plus-lg" /> Ghi nhận bài tập này
          </button>
        </div>
      </div>
    </div>
  )
}
