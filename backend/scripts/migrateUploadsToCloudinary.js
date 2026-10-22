require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { getBucket, getMediaObjectId } = require('../src/services/mediaStorage');
const { uploadFileToCloudinary } = require('../src/services/cloudinaryStorage');
const User = require('../src/models/User');
const Food = require('../src/models/Food');
const FoodRequest = require('../src/models/FoodRequest');
const MealLog = require('../src/models/MealLog');
const BlogPost = require('../src/models/BlogPost');
const AdminActionLog = require('../src/models/AdminActionLog');

const uploadsDirectory = path.join(__dirname, '../uploads');
const singleImageFields = [
  [Food, 'imageUrl'],
  [FoodRequest, 'imageUrl'],
  [MealLog, 'imageUrl'],
  [BlogPost, 'imageUrl'],
  [User, 'avatarUrl'],
];

function getLegacyRelativePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const pathname = new URL(value, 'http://legacy.local').pathname;
    if (!pathname.startsWith('/uploads/')) return null;
    const relativePath = decodeURIComponent(pathname.slice('/uploads/'.length)).replace(/\\/g, '/');
    if (!relativePath || relativePath.split('/').some((part) => !part || part === '.' || part === '..')) return null;
    return relativePath;
  } catch {
    return null;
  }
}

function getUploadSource(value) {
  const mediaId = getMediaObjectId(value);
  if (mediaId) return { type: 'gridfs', key: mediaId.toString() };
  const relativePath = getLegacyRelativePath(value);
  if (relativePath) return { type: 'local', key: relativePath };
  return null;
}

function getContentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  })[extension] || 'application/octet-stream';
}

async function listLocalFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listLocalFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

async function readGridFsFile(bucket, id) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    const stream = bucket.openDownloadStream(id);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.once('error', reject);
    stream.once('end', resolve);
  });
  return Buffer.concat(chunks);
}

async function readUploadReferences() {
  const references = [];
  for (const [Model, field] of singleImageFields) {
    const documents = await Model.collection.find({ [field]: { $type: 'string' } }).toArray();
    for (const document of documents) {
      const source = getUploadSource(document[field]);
      if (source) references.push({ collection: Model.collection, document, field, source });
    }
  }

  const actionLogs = await AdminActionLog.collection.find({ 'evidence.url': { $type: 'string' } }).toArray();
  for (const document of actionLogs) {
    for (let index = 0; index < (document.evidence || []).length; index += 1) {
      const source = getUploadSource(document.evidence[index]?.url);
      if (source) references.push({
        collection: AdminActionLog.collection,
        document,
        field: `evidence.${index}.url`,
        source,
      });
    }
  }
  return references;
}

async function main() {
  await connectDB();
  const references = await readUploadReferences();
  if (references.length === 0) {
    console.log('Không còn URL local hoặc GridFS cần chuyển sang Cloudinary.');
    return;
  }

  const localFiles = await listLocalFiles(uploadsDirectory);
  const filesByRelativePath = new Map(localFiles.map((absolutePath) => [
    path.relative(uploadsDirectory, absolutePath).split(path.sep).join('/'),
    absolutePath,
  ]));
  const bucket = getBucket();
  const uniqueSources = new Map();
  references.forEach(({ source }) => uniqueSources.set(`${source.type}:${source.key}`, source));
  const migratedUrls = new Map();
  const missingSources = [];
  const gridFsFilesToDelete = [];

  for (const [sourceKey, source] of uniqueSources) {
    let buffer;
    let filename;
    let mimetype;

    if (source.type === 'local') {
      const absolutePath = filesByRelativePath.get(source.key);
      if (!absolutePath) {
        missingSources.push(source.key);
        continue;
      }
      filename = path.basename(source.key);
      buffer = await fs.readFile(absolutePath);
      mimetype = getContentType(filename);
    } else {
      const id = new mongoose.Types.ObjectId(source.key);
      const file = await bucket.find({ _id: id }).next();
      if (!file) {
        missingSources.push(`GridFS:${source.key}`);
        continue;
      }
      filename = file.metadata?.originalName || file.filename;
      buffer = await readGridFsFile(bucket, id);
      mimetype = file.metadata?.contentType || getContentType(filename);
      gridFsFilesToDelete.push(id);
    }

    const url = await uploadFileToCloudinary(
      { buffer, originalname: filename, mimetype },
      process.env.CLOUDINARY_MIGRATED_FOLDER || 'nutrilens/migrated'
    );
    migratedUrls.set(sourceKey, url);
  }

  let updatedReferences = 0;
  for (const reference of references) {
    const sourceKey = `${reference.source.type}:${reference.source.key}`;
    const imageUrl = migratedUrls.get(sourceKey);
    if (!imageUrl) continue;
    await reference.collection.updateOne(
      { _id: reference.document._id },
      { $set: { [reference.field]: imageUrl } }
    );
    updatedReferences += 1;
  }

  for (const id of gridFsFilesToDelete) {
    const sourceKey = `gridfs:${id.toString()}`;
    if (!migratedUrls.has(sourceKey)) continue;
    await bucket.delete(id);
  }

  console.log(`Đã chuyển ${migratedUrls.size} tệp và cập nhật ${updatedReferences} tham chiếu sang Cloudinary.`);
  if (missingSources.length) {
    console.warn(`Còn ${missingSources.length} tệp nguồn bị thiếu; URL của chúng vẫn giữ nguyên:`);
    missingSources.forEach((source) => console.warn(`- ${source}`));
    console.warn('Khôi phục các file local vào đúng đường dẫn rồi chạy lại lệnh để chuyển tiếp.');
    process.exitCode = 2;
  }

  const remainingGridFsFile = await bucket.find({}).limit(1).next();
  if (!remainingGridFsFile) {
    await bucket.drop().catch((error) => {
      if (error.codeName !== 'NamespaceNotFound') throw error;
    });
    console.log('GridFS bucket media đã rỗng và được dọn khỏi MongoDB.');
  } else {
    console.log('Còn file GridFS chưa được chuyển; giữ lại bucket media để bảo toàn dữ liệu đó.');
  }
}

main()
  .catch((error) => {
    console.error('Không thể chuyển ảnh sang Cloudinary:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
