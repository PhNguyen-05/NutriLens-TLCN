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

function getMediaObjectId(value) {
  const candidate = String(value || '').trim();
  const mediaPath = candidate.startsWith('http://') || candidate.startsWith('https://')
    ? new URL(candidate).pathname
    : candidate;
  const match = mediaPath.match(/\/api\/media\/([a-f\d]{24})\/?$/i) || mediaPath.match(/^([a-f\d]{24})$/i);
  return match ? new mongoose.Types.ObjectId(match[1]) : null;
}

module.exports = { getBucket, getMediaObjectId };
