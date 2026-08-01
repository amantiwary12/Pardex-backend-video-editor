const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, default: 'Untitled Project', trim: true },
    aspectRatio: { type: String, enum: ['9:16', '16:9', '1:1', '4:5'], default: '9:16' },
    status: { type: String, enum: ['draft', 'processing', 'done'], default: 'draft' },
    autoSaveData: { type: mongoose.Schema.Types.Mixed, default: {} },
    undoStack: { type: [mongoose.Schema.Types.Mixed], default: [] },
    redoStack: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
