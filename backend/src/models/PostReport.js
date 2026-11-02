const mongoose = require('mongoose');

const REPORT_REASONS = [
  'Nội dung spam hoặc quảng cáo',
  'Nội dung không phù hợp / phản cảm',
  'Thông tin sai lệch / gây hiểu nhầm',
  'Ngôn ngữ thù địch / quấy rối',
  'Vi phạm quyền riêng tư',
  'Lý do khác',
];

const postReportSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, enum: REPORT_REASONS },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  evidenceImageUrl: { type: String, default: null, trim: true },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
}, { timestamps: true });

// Một người chỉ được báo cáo một bài 1 lần
postReportSchema.index({ postId: 1, reporterId: 1 }, { unique: true });

module.exports = { PostReport: mongoose.model('PostReport', postReportSchema), REPORT_REASONS };
