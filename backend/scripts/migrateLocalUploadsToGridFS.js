require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const connectDB = require('../src/config/db');
const { saveMediaFile } = require('../src/services/mediaStorage');
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

async function readLegacyReferences() {
  const references = [];
  for (const [Model, field] of singleImageFields) {
    const documents = await Model.collection.find({ [field]: { $type: 'string' } }).toArray();
    for (const document of documents) {
      const relativePath = getLegacyRelativePath(document[field]);
      if (relativePath) references.push({ collection: Model.collection, document, field, relativePath });
    }
  }

  const actionLogs = await AdminActionLog.collection.find({ 'evidence.url': { $type: 'string' } }).toArray();
  for (const document of actionLogs) {
    for (let index = 0; index < (document.evidence || []).length; index += 1) {
      const relativePath = getLegacyRelativePath(document.evidence[index]?.url);
      if (relativePath) references.push({
        collection: AdminActionLog.collection,
        document,
        field: `evidence.${index}.url`,
        relativePath,
      });
    }
  }
  return references;
}

async function main() {
  await connectDB();
  const references = await readLegacyReferences();
  if (references.length === 0) {
    console.log('Không còn URL /uploads cần chuyển sang GridFS.');
    return;
  }

  const localFiles = await listLocalFiles(uploadsDirectory);
  const filesByRelativePath = new Map();
  for (const absolutePath of localFiles) {
    const relativePath = path.relative(uploadsDirectory, absolutePath).split(path.sep).join('/');
    filesByRelativePath.set(relativePath, absolutePath);
  }

  const requiredPaths = [...new Set(references.map((reference) => reference.relativePath))];
  const missingFiles = requiredPaths.filter((relativePath) => !filesByRelativePath.has(relativePath));
  const availablePaths = requiredPaths.filter((relativePath) => filesByRelativePath.has(relativePath));

  const migratedUrls = new Map();
  for (const relativePath of availablePaths) {
    const originalname = path.basename(relativePath);
    const buffer = await fs.readFile(filesByRelativePath.get(relativePath));
    migratedUrls.set(relativePath, await saveMediaFile({
      buffer,
      originalname,
      mimetype: getContentType(originalname),
    }, 'migrated'));
  }

  let updatedReferences = 0;
  for (const reference of references) {
    if (!migratedUrls.has(reference.relativePath)) continue;
    const update = { $set: { [reference.field]: migratedUrls.get(reference.relativePath) } };
    await reference.collection.updateOne({ _id: reference.document._id }, update);
    updatedReferences += 1;
  }

  console.log(`Đã chuyển ${availablePaths.length} tệp và cập nhật ${updatedReferences} tham chiếu sang GridFS.`);
  if (missingFiles.length) {
    console.warn(`Còn ${missingFiles.length} tệp không có trong backend/uploads; URL của chúng vẫn giữ nguyên:`);
    missingFiles.forEach((relativePath) => console.warn(`- ${relativePath}`));
    console.warn('Khôi phục các tệp này vào đúng đường dẫn rồi chạy lại lệnh để chuyển tiếp.');
    process.exitCode = 2;
  }
  console.log('Tệp local được giữ nguyên; chỉ dọn chúng sau khi kiểm tra ảnh trên ứng dụng.');
}

main()
  .catch((error) => {
    console.error('Không thể di chuyển ảnh local sang GridFS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect().catch(() => {});
  });
