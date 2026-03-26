import mongoose from 'mongoose';
import slugify from 'slugify';


const categorySchema = new mongoose.Schema({
  name_fa: { type: String, default: null },
  name_en: { type: String, default: null },
  name_ar: { type: String, default: null },
  slug: {
    type: String,
    unique: true,
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
});

// slug ------------------------------------------------------------------------------

categorySchema.pre('save', function (next) {
  if (this.slug) return next();

  const source = this.name_en || this.name_fa || this.name_ar;
  const generated = slugify(source || '', {
    lower: true,
    strict: true,
  });

  if (!generated || generated === '') {
    return next(new Error('slug is required or provide an  title.'));
  }

  this.slug = generated;
  next();
});


// Indexes ------------------------------------------------------------------------------
categorySchema.index({ slug: 1 });
categorySchema.index({ parent_id: 1 });

export default mongoose.model('Category', categorySchema);
