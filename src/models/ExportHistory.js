const mongoose = require('mongoose');

const exportHistorySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, default: '' },
    quality: { type: String, enum: ['720p', '1080p', '4K'], default: '1080p' },
    format: { type: String, default: 'mp4' },
    status: { type: String, enum: ['processing', 'done', 'failed'], default: 'processing' },
    platform: { type: String, enum: ['download', 'instagram', 'youtube'], default: 'download' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExportHistory', exportHistorySchema);
