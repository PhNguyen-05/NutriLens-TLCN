/**
 * exerciseConstants.js
 * Các hằng số, danh mục và hàm tiện ích chuẩn hóa cho Phân hệ Luyện tập (Exercise System)
 */

export const EXERCISE_FALLBACK_IMAGES = {
  cardio: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=700&q=80',
  strength: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=700&q=80',
  sports: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=700&q=80',
  flexibility: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=700&q=80',
  other: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=700&q=80',
}

export function getExerciseThumbnail(ex) {
  if (ex?.imageUrl && String(ex.imageUrl).trim()) {
    return ex.imageUrl.trim()
  }
  return EXERCISE_FALLBACK_IMAGES[ex?.category] || EXERCISE_FALLBACK_IMAGES.cardio
}

/**
 * Trích xuất YouTube Video ID từ nhiều định dạng URL khác nhau:
 * - https://www.youtube.com/watch?v={id}
 * - https://youtu.be/{id}
 * - https://www.youtube.com/embed/{id}
 * - https://www.youtube.com/shorts/{id}
 * - https://www.youtube.com/live/{id}
 */
export function extractYouTubeId(url) {
  if (!url) return null
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/)
  return match ? match[1] : null
}

export const CATEGORY_TABS = [
  { id: 'all',         label: 'Tất cả',          icon: 'bi-grid' },
  { id: 'my',          label: 'Bài tập của tôi', icon: 'bi-person-heart' },
  { id: 'cardio',      label: 'Cardio',           icon: 'bi-lightning-charge' },
  { id: 'strength',    label: 'Sức mạnh',         icon: 'bi-trophy' },
  { id: 'flexibility', label: 'Yoga & Thư giãn',  icon: 'bi-flower1' },
  { id: 'sports',      label: 'Thể thao',         icon: 'bi-dribbble' },
]

export const INTENSITY_CHIP = {
  'Nhẹ':        { cls: 'ex-chip--low',    icon: 'bi-circle-fill' },
  'Trung bình': { cls: 'ex-chip--mid',    icon: 'bi-circle-fill' },
  'Cao':        { cls: 'ex-chip--high',   icon: 'bi-circle-fill' },
}

/**
 * Lấy chuỗi YYYY-MM-DD theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 * Tránh lỗi lệch ngày khi máy client ở múi giờ khác
 */
export function getTodayStr(d = new Date()) {
  try {
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  } catch {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Lấy chuỗi HH:mm theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getTimeStr(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
}

export function getMinDateStr(daysAgo = 90) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getTodayStr(d)
}

export function validateDateTime(date, time) {
  const today = getTodayStr()
  const nowTime = getTimeStr()
  const minDate = getMinDateStr(90)

  if (!date) {
    return 'Vui lòng chọn ngày tập'
  }
  if (date > today) {
    return 'Ngày tập không thể ở thời điểm tương lai'
  }
  if (date < minDate) {
    return 'Ngày tập không được vượt quá 90 ngày trong quá khứ'
  }
  if (date === today && time && time > nowTime) {
    return 'Giờ bắt đầu tập không thể ở thời điểm tương lai'
  }
  return null
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(`${dateStr}T12:00:00`))
  } catch {
    return dateStr
  }
}

/**
 * Công thức tính Calories tiêu hao:
 * Calories = (MET * 3.5 * Cân nặng (kg) * Thời gian (phút)) / 200
 */
export function calcCalories(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes || Number(minutes) <= 0) return 0
  return Math.round((Number(met) * 3.5 * Number(weightKg) * Number(minutes)) / 200)
}

// ─── ADMIN CONSTANTS ─────────────────────────────────────────────────────────

export const ADMIN_CATEGORIES = [
  { id: 'cardio', label: 'Cardio & Vận động', icon: 'bi-lightning-charge' },
  { id: 'strength', label: 'Sức mạnh & Gym', icon: 'bi-shield-check' },
  { id: 'sports', label: 'Thể thao', icon: 'bi-dribbble' },
  { id: 'flexibility', label: 'Yoga & Thư giãn', icon: 'bi-yin-yang' },
  { id: 'other', label: 'Khác', icon: 'bi-activity' },
]

export const ADMIN_INTENSITIES = [
  { label: 'Nhẹ', cls: 'exm-chip--low', desc: 'MET < 3.0 • Vận động thư giãn nhẹ nhàng' },
  { label: 'Trung bình', cls: 'exm-chip--mid', desc: 'MET 3.0 - 6.0 • Nhịp tim tăng vừa phải' },
  { label: 'Cao', cls: 'exm-chip--high', desc: 'MET > 6.0 • Thử thách thể lực, đốt mỡ tối đa' },
]

export const ICON_CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'running', label: '🏃 Chạy & Đi bộ' },
  { id: 'cycling', label: '🚴 Đạp xe' },
  { id: 'water', label: '🏊 Bơi & Dưới nước' },
  { id: 'strength', label: '🏋️ Gym & Thể hình' },
  { id: 'sports', label: '⚽ Thể thao & Bóng' },
  { id: 'mind', label: '🧘 Yoga & Giãn cơ' },
  { id: 'cardio', label: '⚡ Cardio & Tim mạch' },
  { id: 'dance', label: '🎵 Nhảy & Vũ đạo' },
]

export const EXERCISE_ICON_LIBRARY = [
  // Chạy & Đi bộ
  { id: 'bi-person-walking', name: 'Đi bộ', cat: 'running', keywords: 'di bo, walk, buoc chan' },
  { id: 'bi-person-running', name: 'Chạy bộ', cat: 'running', keywords: 'chay bo, run, chay, sprint, marathon' },
  { id: 'bi-compass', name: 'Leo núi / Trekking', cat: 'running', keywords: 'leo nui, trekking, da ngoai, hike, compass' },
  { id: 'bi-geo-alt', name: 'Lộ trình chạy', cat: 'running', keywords: 'lo trinh, ngoai troi, outdoor, gps' },
  { id: 'bi-signpost-2', name: 'Chạy việt dã (Trail)', cat: 'running', keywords: 'viet da, trail, duong mon' },
  { id: 'bi-wind', name: 'Chạy cản gió', cat: 'running', keywords: 'gio, toc do, wind' },

  // Đạp xe
  { id: 'bi-bicycle', name: 'Đạp xe', cat: 'cycling', keywords: 'dap xe, xe dap, cycling, bike' },
  { id: 'bi-speedometer2', name: 'Đạp xe tốc độ', cat: 'cycling', keywords: 'toc do, cadence, speed, van toc' },
  { id: 'bi-arrow-repeat', name: 'Vòng lặp / Cadence', cat: 'cycling', keywords: 'vong lap, cadence, tap xoay' },

  // Bơi lội
  { id: 'bi-water', name: 'Bơi lội', cat: 'water', keywords: 'boi loi, boi, swim, water, ho boi' },
  { id: 'bi-droplet-half', name: 'Thủy lực / Dưới nước', cat: 'water', keywords: 'nuoc, aqua, droplet' },
  { id: 'bi-tsunami', name: 'Lướt sóng / Vượt sóng', cat: 'water', keywords: 'luot song, song, surf, bien' },

  // Gym & Thể hình
  { id: 'bi-hammer', name: 'Tập tạ / Gym', cat: 'strength', keywords: 'ta, ta tay, dumbbell, gym, ta nang, hammer, the hinh' },
  { id: 'bi-shield-check', name: 'Sức mạnh cơ bắp', cat: 'strength', keywords: 'co bap, the hinh, gym, strength, shield, chong day' },
  { id: 'bi-fire', name: 'Đốt mỡ / Siết cơ', cat: 'strength', keywords: 'dot mo, chay mo, calo, burn, fire, siet co' },
  { id: 'bi-lightning-charge', name: 'HIIT / Thể lực cao', cat: 'strength', keywords: 'bung no, hiit, nang luong, lightning, the luc' },
  { id: 'bi-trophy', name: 'Thử thách tạ nặng', cat: 'strength', keywords: 'thu thach, ta nang, trophy, cup, thi dau' },
  { id: 'bi-award', name: 'Huy chương thể hình', cat: 'strength', keywords: 'huan chuong, huy chuong, award, dat chuan' },
  { id: 'bi-box-seam', name: 'CrossFit / Bật hộp', cat: 'strength', keywords: 'crossfit, bat hop, box jump, plyometrics' },

  // Thể thao & Bóng
  { id: 'bi-dribbble', name: 'Bóng rổ / Bóng đá', cat: 'sports', keywords: 'bong, bong ro, bong da, bong chuyen, ball, dribble' },
  { id: 'bi-bullseye', name: 'Bắn cung / Mục tiêu', cat: 'sports', keywords: 'ban cung, muc tieu, target, archery, phi tieu' },
  { id: 'bi-flag', name: 'Golf / Cờ hiệu', cat: 'sports', keywords: 'golf, co hieu, flag, the thao' },
  { id: 'bi-disc', name: 'Ném đĩa / Frisbee', cat: 'sports', keywords: 'nem dia, frisbee, disc' },
  { id: 'bi-controller', name: 'Thể thao điện tử', cat: 'sports', keywords: 'game, dien tu, esports' },

  // Yoga & Giãn cơ
  { id: 'bi-yin-yang', name: 'Yoga / Khí công', cat: 'mind', keywords: 'yoga, thai cuc quyen, khi cong, balance, can bang' },
  { id: 'bi-flower1', name: 'Thiền định / Tĩnh tâm', cat: 'mind', keywords: 'thien, thu gian, relax, meditation, tinh tam' },
  { id: 'bi-brightness-high', name: 'Vận động buổi sáng', cat: 'mind', keywords: 'buoi sang, nang, morning, nang luong' },
  { id: 'bi-moon-stars', name: 'Giãn cơ buổi tối', cat: 'mind', keywords: 'buoi toi, ngu, night, stretch, gian co' },
  { id: 'bi-peace', name: 'Hài hòa thân tâm', cat: 'mind', keywords: 'can bang, hoa binh, peace, hai hoa' },
  { id: 'bi-heart', name: 'Tập dưỡng sinh', cat: 'mind', keywords: 'duong sinh, tim, yeu thich, heart' },

  // Cardio & Tim mạch
  { id: 'bi-heart-pulse', name: 'Đo nhịp tim / Cardio', cat: 'cardio', keywords: 'nhip tim, cardio, heart rate, pulse, tim mach' },
  { id: 'bi-activity', name: 'Vận động tổng hợp', cat: 'cardio', keywords: 'tong hop, hoat dong, activity, van dong' },
  { id: 'bi-stopwatch', name: 'Bấm giờ / Tabata', cat: 'cardio', keywords: 'bam gio, tabata, stopwatch, interval, ngat quang' },
  { id: 'bi-clock-history', name: 'Sức bền đường dài', cat: 'cardio', keywords: 'suc ben, thoi gian, endurance, lich su' },
  { id: 'bi-hourglass-split', name: 'Thử thách thời gian', cat: 'cardio', keywords: 'tinh gio, hourglass, thoi gian' },

  // Nhảy & Vũ đạo
  { id: 'bi-music-note-beamed', name: 'Zumba / Khiêu vũ', cat: 'dance', keywords: 'zumba, nhay, vu dao, khieu vu, dance, music, am nhac' },
  { id: 'bi-headphones', name: 'Tập cùng âm nhạc', cat: 'dance', keywords: 'tai nghe, nhac, beat, giai điệu' },
  { id: 'bi-soundwave', name: 'Aerobic / Vũ đạo', cat: 'dance', keywords: 'aerobic, nhip dieu, soundwave, vu dao' },
]

export const DEFAULT_CATEGORY_ICONS = {
  cardio: 'bi-person-walking',
  strength: 'bi-hammer',
  sports: 'bi-dribbble',
  flexibility: 'bi-yin-yang',
  other: 'bi-activity',
}

export const DURATION_PRESETS = [
  { value: '15', label: '15 phút' },
  { value: '30', label: '30 phút (Mặc định)' },
  { value: '45', label: '45 phút' },
  { value: '60', label: '60 phút (1 giờ)' },
]

export function getRecommendedIntensity(met) {
  const m = Number(met)
  if (!Number.isFinite(m) || m <= 0) return null
  if (m < 3.0) return 'Nhẹ'
  if (m <= 6.0) return 'Trung bình'
  return 'Cao'
}
