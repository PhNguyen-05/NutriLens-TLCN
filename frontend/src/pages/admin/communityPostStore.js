export const COMMUNITY_POSTS_STORAGE_KEY = 'nutrilens.community.posts.v1'

export const INITIAL_COMMUNITY_POSTS = [
  {
    id: '671000000000000000000001',
    author: 'Nguyễn Thị Mai',
    handle: '@mainguyen',
    avatar: 'M',
    title: 'Bữa trưa đủ chất cho ngày làm việc bận rộn',
    content: 'Hôm nay mình đã thử một chế độ ăn mới và thấy khá hiệu quả. Mọi người có ai đã thử chưa? Chia sẻ với mình nhé!',
    category: 'Chế độ ăn',
    createdAt: '2026-10-30T14:30:00+07:00',
    status: 'Đã ẩn',
    reports: 1,
    comments: 3,
    likes: 12,
    image: '🥗',
    imageTone: 'salad',
    reportReason: 'Nội dung chưa chính xác, có thể gây hiểu nhầm về dinh dưỡng.',
    reportDetails: [
      { reporter: 'Nguyễn Văn A', reason: 'Nội dung quảng cáo sản phẩm không rõ nguồn gốc.', reportedAt: '2026-10-30T15:12:00+07:00' },
    ],
  },
  {
    id: '671000000000000000000002',
    author: 'Trần Văn Nam',
    handle: '@namtran',
    avatar: 'N',
    title: 'Chạy bộ sáng sớm thật là tuyệt vời!',
    content: 'Chạy bộ sáng sớm thật là tuyệt vời! Cảm giác chân tràn đầy năng lượng cho cả ngày dài.',
    category: 'Thể thao',
    createdAt: '2026-10-30T10:10:00+07:00',
    status: 'Đang hiển thị',
    reports: 0,
    comments: 0,
    likes: 0,
    image: '🏃🏻‍♂️',
    imageTone: 'run',
    reportReason: '',
  },
  {
    id: '671000000000000000000003',
    author: 'Lê Thị Hương',
    handle: '@huongle',
    avatar: 'H',
    title: 'Một ly sinh tố xanh cho buổi sáng',
    content: 'Bạn nào biết món sinh tố bổ béo này có nên nhiều calo không ạ? Mình tìm mãi chưa thấy.',
    category: 'Món ăn',
    createdAt: '2026-10-30T08:45:00+07:00',
    status: 'Đã ẩn',
    reports: 3,
    comments: 2,
    likes: 6,
    image: '🥑',
    imageTone: 'smoothie',
    reportReason: 'Bài đăng có thông tin sức khỏe chưa được kiểm chứng.',
    reportDetails: [
      { reporter: 'Nguyễn Văn A', reason: 'Nội dung quảng cáo sản phẩm không rõ nguồn gốc.', reportedAt: '2026-10-30T15:12:00+07:00' },
      { reporter: 'Trần Thị B', reason: 'Nội dung không phù hợp, gây hiểu lầm.', reportedAt: '2026-10-30T15:25:00+07:00' },
      { reporter: 'Lê Văn C', reason: 'Nội dung phản cảm.', reportedAt: '2026-10-30T15:35:00+07:00' },
    ],
  },
  {
    id: '671000000000000000000004',
    author: 'Phạm Đức Anh',
    handle: '@anhpham',
    avatar: 'A',
    title: 'Tập yoga giúp mình thư giãn hơn rất nhiều',
    content: 'Tập yoga giúp mình thư giãn hơn rất nhiều. Rất recommend cho mọi người!',
    category: 'Thể thao',
    createdAt: '2026-10-29T17:05:00+07:00',
    status: 'Đang hiển thị',
    reports: 0,
    comments: 8,
    likes: 15,
    image: '🧘🏻‍♀️',
    imageTone: 'yoga',
    reportReason: '',
  },
  {
    id: '671000000000000000000005',
    author: 'Hoàng Thu Trang',
    handle: '@tranghoang',
    avatar: 'T',
    title: 'Bữa trưa hôm nay của mình đây!',
    content: 'Món này vừa ngon vừa tốt cho sức khỏe. Cùng chia sẻ thực đơn của bạn nhé.',
    category: 'Món ăn',
    createdAt: '2026-10-29T12:10:00+07:00',
    status: 'Đã ẩn',
    reports: 0,
    comments: 4,
    likes: 7,
    image: '🍱',
    imageTone: 'lunch',
    reportReason: '',
  },
  {
    id: '671000000000000000000006',
    author: 'Đỗ Minh Quân',
    handle: '@quan.do',
    avatar: 'Q',
    title: 'Chia sẻ mẹo ăn uống lành mạnh mỗi ngày',
    content: 'Mình muốn chia sẻ một vài mẹo nhỏ để mọi người có thêm động lực chăm sóc sức khỏe.',
    category: 'Lối sống',
    createdAt: '2026-10-28T09:25:00+07:00',
    status: 'Đang hiển thị',
    reports: 0,
    comments: 0,
    likes: 2,
    image: '🍊',
    imageTone: 'fruit',
    reportReason: '',
  },
]

export function normalizeCommunityPost(post) {
  const reports = Math.max(0, Number(post?.reports) || 0)
  const hasPendingReports = reports > 0
  const wasRejected = post?.status === 'Từ chối' || Boolean(post?.rejectionReason)
  const wasHidden = post?.status === 'Đã ẩn' || post?.status === 'hidden' || post?.status === 'hidden_by_admin'
  const normalizedPost = { ...post }
  delete normalizedPost.rejectionReason
  delete normalizedPost.rejectionNote
  delete normalizedPost.moderationHistory

  return {
    ...normalizedPost,
    reports,
    reviewPending: hasPendingReports,
    status: hasPendingReports || (wasHidden && !wasRejected) ? 'Đã ẩn' : 'Đang hiển thị',
  }
}

export function getCommunityPostsSnapshot() {

  if (typeof window === 'undefined') return INITIAL_COMMUNITY_POSTS.map(normalizeCommunityPost)

  try {
    const storedPosts = window.localStorage.getItem(COMMUNITY_POSTS_STORAGE_KEY)
    const parsedPosts = storedPosts ? JSON.parse(storedPosts) : null
    return Array.isArray(parsedPosts) ? parsedPosts.map(normalizeCommunityPost) : INITIAL_COMMUNITY_POSTS.map(normalizeCommunityPost)
  } catch {
    return INITIAL_COMMUNITY_POSTS.map(normalizeCommunityPost)
  }
}

export function saveCommunityPosts(posts) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COMMUNITY_POSTS_STORAGE_KEY, JSON.stringify(posts.map(normalizeCommunityPost)))
  } catch {
    // Dữ liệu mẫu vẫn dùng được trong bộ nhớ nếu trình duyệt chặn localStorage.
  }
}

export function getCommunityDashboardStats(today) {
  const currentDay = today || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const posts = getCommunityPostsSnapshot()
  const dateInVietnam = (value) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))

  return {
    postsToday: posts.filter((post) => dateInVietnam(post.createdAt) === currentDay).length,
    reportedPosts: posts.filter((post) => post.reviewPending).length,
  }
}
