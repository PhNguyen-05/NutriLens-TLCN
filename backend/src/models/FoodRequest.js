const mongoose = require('mongoose');

const { Schema } = mongoose;

const foodRequestSchema = new Schema(
  {
    requestCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    // requestedBy/name and the *Per100g fields keep compatibility with the
    // user submission API; the admin dashboard uses userId/foodName and
    // serving-based nutrition fields.
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestType: { type: String, enum: ['addition', 'reopen'], default: 'addition', index: true },
    targetFoodId: { type: Schema.Types.ObjectId, ref: 'Food', default: null, index: true },
    feedbackReason: { type: String, trim: true, default: null },
    name: { type: String, trim: true },
    foodName: { type: String, required: true, trim: true, index: true },
    imageUrl: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    foodGroup: { type: String, trim: true, default: null },
    servingSize: { type: Number, default: 100, min: 0 },
    servingLabel: { type: String, trim: true, default: '1 Suất (100g)' },
    calories: { type: Number, default: null, min: 0 },
    protein: { type: Number, default: null, min: 0 },
    fat: { type: Number, default: null, min: 0 },
    carbs: { type: Number, default: null, min: 0 },
    caloriesPer100g: { type: Number, default: null, min: 0 },
    proteinPer100g: { type: Number, default: null, min: 0 },
    fatPer100g: { type: Number, default: null, min: 0 },
    carbPer100g: { type: Number, default: null, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    rejectReason: { type: String, trim: true, default: null },
    adminNote: { type: String, trim: true, default: null },
    approvedFoodId: { type: Schema.Types.ObjectId, ref: 'Food', default: null },
    approvedFoodItemId: { type: Schema.Types.ObjectId, ref: 'Food', default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

function syncAlias(doc, primary, legacy) {
  const primaryModified = doc.isModified(primary);
  const legacyModified = doc.isModified(legacy);
  const primaryValue = doc.get(primary);
  const legacyValue = doc.get(legacy);

  if (primaryModified && !legacyModified) {
    doc.set(legacy, primaryValue);
  } else if (legacyModified && !primaryModified) {
    doc.set(primary, legacyValue);
  } else if (primaryValue == null && legacyValue != null) {
    doc.set(primary, legacyValue);
  } else if (legacyValue == null && primaryValue != null) {
    doc.set(legacy, primaryValue);
  }
}

foodRequestSchema.pre('validate', function syncFoodRequestFields() {
  if (!this.requestCode && this._id) {
    this.requestCode = `FR-${this._id.toString().slice(-8).toUpperCase()}`;
  }

  syncAlias(this, 'userId', 'requestedBy');
  syncAlias(this, 'foodName', 'name');
  syncAlias(this, 'calories', 'caloriesPer100g');
  syncAlias(this, 'protein', 'proteinPer100g');
  syncAlias(this, 'carbs', 'carbPer100g');
  syncAlias(this, 'fat', 'fatPer100g');
  syncAlias(this, 'rejectionReason', 'rejectReason');
  syncAlias(this, 'approvedFoodId', 'approvedFoodItemId');

  const statusAliases = {
    'Chờ duyệt': 'pending',
    'Đã duyệt': 'approved',
    'Từ chối': 'rejected',
  };
  if (statusAliases[this.status]) this.status = statusAliases[this.status];
});

foodRequestSchema.index({ status: 1, createdAt: -1 });
foodRequestSchema.index({ requestedBy: 1, createdAt: -1 });
foodRequestSchema.index({ userId: 1, createdAt: -1 });
foodRequestSchema.index({ foodName: 'text', name: 'text' });

module.exports = mongoose.model('FoodRequest', foodRequestSchema);
