import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
    {
        uuid: {
            type: String,
            required: true,
            unique: true,
        },

        uploader_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        entity_type: {
            type: String,
            match: /^[a-z0-9_]{2,64}$/,
            default: 'general',
        },
        entity_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },


        file_name: {
            type: String,
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        mime_type: {
            type: String,
            required: true,
        },
        extension: {
            type: String,
            enum: [
                'jpg',
                'jpeg',
                'png',
                'gif',
                'webp',
                'svg',
                'mp3',
                'wav',
                'ogg',
                'm4a',
                'aac',
                'flac',

                'mp4',
                'mov',
                'mkv',
            ],
            required: true,
        },
        size_bytes: {
            type: Number,
            default: null,
        },

        status: {
            type: String,
            enum: ['pending', 'linked', 'orphan'],
            default: 'pending',
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    }
);

// ── Indexes ───────────────────────────────────────────────────────────
mediaSchema.index({ uuid: 1 });
mediaSchema.index({ uploader_id: 1 });
mediaSchema.index({ entity_type: 1, entity_id: 1 });
mediaSchema.index({ status: 1, created_at: 1 });

export default mongoose.model('Media', mediaSchema);
