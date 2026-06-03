import mongoose from 'mongoose';
import { CATEGORIES } from '../config/categories.js';

const { Schema } = mongoose;

// One row per canonical category, holding only its on/off state.
// When a category is toggled off, its videos disappear from the customer site.
const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);

// Make sure every canonical category has a row (default: active).
// Safe to call on every startup — never flips an existing row's isActive.
export async function ensureCategories() {
  await Promise.all(
    CATEGORIES.map((name) =>
      Category.updateOne(
        { name },
        { $setOnInsert: { name, isActive: true } },
        { upsert: true }
      )
    )
  );
}

export default Category;
