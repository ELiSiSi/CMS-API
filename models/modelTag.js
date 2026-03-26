import mongoose from "mongoose";
import slugify from "slugify";

const tagSchema = new mongoose.Schema(
  {
    name_fa: { type: String, default: null },
    name_en: { type: String, default: null },
    name_ar: { type: String, default: null },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: { createdAt: "created_at" },
  }
);

// slug ------------------------------------------------------------------------------

tagSchema.pre('save', function (next) {
    if (this.slug) {
        return next();
    }
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
})


// Indexes ------------------------------------------------------------------------------
tagSchema.index({ slug: 1 });

export default mongoose.model('Tag', tagSchema);
