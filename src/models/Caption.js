const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema(
  {
    word: String,
    start: Number,
    end: Number,
    // Optional per-word style overrides (color, fontFamily, fontSize,
    // fontWeight, italic, …) — free-form so the frontend can evolve freely.
    style: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

const segmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    text: { type: String, required: true },
    words: [wordSchema],
  },
  { _id: false }
);

const captionSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    segments: [segmentSchema],
    style: {
      fontFamily: { type: String, default: 'Inter' },
      fontSize: { type: Number, default: 32 },
      fontWeight: { type: String, default: '700' },
      italic: { type: Boolean, default: false },
      color: { type: String, default: '#FFFFFF' },
      bgColor: { type: String, default: 'rgba(0,0,0,0.7)' },
      position: { type: String, enum: ['top', 'center', 'bottom'], default: 'bottom' },
      // Free-drag position ({ x, y } as % of the canvas) — overrides `position`
      // presets when set; null means "follow the preset".
      customPosition: { type: mongoose.Schema.Types.Mixed, default: null },
      alignment: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
      displayMode: {
        type: String,
        enum: ['standard', 'word-by-word', 'bubble', 'karaoke'],
        default: 'standard',
      },
      animation: {
        entrance: { type: String, default: 'fade' },
        exit: { type: String, default: 'fade' },
        easing: { type: String, default: 'ease-in-out' },
      },
      template: { type: String, default: 'none' },
      wordHighlight: {
        enabled: { type: Boolean, default: false },
        color: { type: String, default: '#B721FF' },
      },
      shadow: { type: Boolean, default: false },
      borderRadius: { type: Number, default: 8 },
      padding: { type: Number, default: 12 },
      maxCharsPerLine: { type: Number, default: 40 },
      uppercase: { type: Boolean, default: false },
      letterSpacing: { type: Number, default: 0 },
      stroke: {
        enabled: { type: Boolean, default: false },
        color: { type: String, default: '#000000' },
        width: { type: Number, default: 2 },
      },
      glow: {
        enabled: { type: Boolean, default: false },
        color: { type: String, default: '#B721FF' },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Caption', captionSchema);
