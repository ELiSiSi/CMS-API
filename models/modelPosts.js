import mongoose from 'mongoose';
import slugify from 'slugify';

const postSchema = new mongoose.Schema(
  {
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    slug: {
      type: String,
      unique: true,
    },
    title_fa: { type: String, default: null },
    title_en: { type: String, default: null },
    title_ar: { type: String, default: null },
    content_fa: { type: String, default: null },
    content_en: { type: String, default: null },
    content_ar: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
    },
    view_count: {
      type: Number,
      default: 0,
    },
    custom_meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// pre ------------------------------------------------------------------------------
postSchema.pre('save', function (next) {
  if (!this.title_fa && !this.title_en && !this.title_ar) {
    return next(new Error('At least one title is required.'));
  }
  next();
});

// slug ------------------------------------------------------------------------------
postSchema.pre('save', function (next) {
  if (this.slug) return next();

  const source = this.title_en || this.title_fa || this.title_ar;
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
postSchema.index({ slug: 1 });
postSchema.index({ status: 1 });
postSchema.index({ created_at: -1 });

export default mongoose.model('Post', postSchema);
