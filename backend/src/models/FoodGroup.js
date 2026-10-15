const mongoose = require('mongoose');

const foodGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nhóm món ăn không được để trống'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isStandard: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FoodGroup', foodGroupSchema);
