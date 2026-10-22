const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_BUCKET_NAME = 'media';

function getBucket() {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error('MongoDB chưa kết nối, không thể lưu tệp');
  }

  return new mongoose.mongo.GridFSBucket(database, {
    bucketName: process.env.MONGO_GRIDFS_BUCKET || DEFAULT_BUCKET_NAME,
  });
}

function safeExtension(originalName) {
  const extension = path.extname(String(originalName || '')).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
}

async function saveMediaFile(file, category = 'upload') {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Tệp tải lên không có dữ liệu hợp lệ');
  }

  const filename = `${category}-${crypto.randomUUID()}${safeExtension(file.originalname)}`;
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(filename, {
    metadata: {
      originalName: String(file.originalname || filename).slice(0, 255),
      contentType: file.mimetype || 'application/octet-stream',
    },
  });

  await new Promise((resolve, reject) => {
    uploadStream.once('error', reject);
    uploadStream.once('finish', resolve);
    uploadStream.end(file.buffer);
  });

  return `/api/media/${uploadStream.id.toString()}`;
}

function getMediaObjectId(value) {
  const candidate = String(value || '').trim();
  const mediaPath = candidate.startsWith('http://') || candidate.startsWith('https://')
    ? new URL(candidate).pathname
    : candidate;
  const match = mediaPath.match(/\/api\/media\/([a-f\d]{24})\/?$/i) || mediaPath.match(/^([a-f\d]{24})$/i);
  return match ? new mongoose.Types.ObjectId(match[1]) : null;
}

async function deleteMediaFile(value) {
  const id = value instanceof mongoose.Types.ObjectId ? value : getMediaObjectId(value);
  if (!id) return false;

  try {
    await getBucket().delete(id);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = { getBucket, saveMediaFile, getMediaObjectId, deleteMediaFile };
