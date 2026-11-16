import axiosInstance from '../../../api/axiosInstance'

export const DEFAULT_FOOD_GROUPS = [
  'Cơm & Xôi',
  'Bún, Mì & Phở',
  'Bánh mì & Sandwich',
  'Bánh truyền thống & Dimsum',
  'Món thịt, cá & Hải sản',
  'Canh, Cháo & Súp',
  'Rau, Gỏi & Salad',
  'Ăn vặt & Đường phố',
  'Tráng miệng & Chè',
  'Đồ uống & Giải khát',
  'Khác',
]

export const SERVING_PRESETS = [
  { label: '1 Chén (150g)', value: '150' },
  { label: '1 Tô vừa (400g)', value: '400' },
  { label: '1 Tô lớn (550g)', value: '550' },
  { label: '1 Đĩa vừa (250g)', value: '250' },
  { label: '1 Suất (100g)', value: '100' },
  { label: '1 Ổ / Cái (200g)', value: '200' },
]

export const PAGE_SIZE = 10

export const EMPTY_FORM = {
  name: '',
  foodGroup: '',
  servingLabel: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  servingSize: '100',
  imageUrl: '',
  description: '',
}

export function getImageUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const base = axiosInstance.defaults?.baseURL || ''
  return `${base.replace(/\/api\/?$/, '')}${url}`
}

export function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Tên món ăn không được để trống'
  for (const f of ['calories', 'protein', 'fat', 'carbs']) {
    const v = Number(form[f])
    if (form[f] === '' || !Number.isFinite(v) || v < 0) errors[f] = 'Phải là số ≥ 0'
  }
  const sv = Number(form.servingSize)
  if (!Number.isFinite(sv) || sv <= 0) errors.servingSize = 'Phải là số dương'
  return errors
}

export function calcServingKcal(form) {
  const sv = parseFloat(form.servingSize)
  const cal = parseFloat(form.calories)
  if (!sv || sv <= 0 || !cal || cal < 0) return null
  return Math.round((cal * sv) / 100)
}

export function nutrientPercent(form) {
  const p = parseFloat(form.protein) || 0
  const c = parseFloat(form.carbs) || 0
  const f = parseFloat(form.fat) || 0
  const total = p * 4 + c * 4 + f * 9
  if (!total) return { p: 0, c: 0, f: 0 }
  return {
    p: Math.round(((p * 4) / total) * 100),
    c: Math.round(((c * 4) / total) * 100),
    f: Math.round(((f * 9) / total) * 100),
  }
}
