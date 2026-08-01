const fs = require('fs');
const Caption = require('../models/Caption');
const Project = require('../models/Project');
const { transcribeLocal } = require('../services/transcribeLocal');

// The video is NEVER stored on the server. It arrives with this request only
// so Whisper can hear the audio, lives in the OS temp folder for the duration
// of transcription, and is deleted in the `finally` below.
exports.generateCaptions = async (req, res, next) => {
  const tempPath = req.file?.path;
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file received for transcription.' });
    }

    const language = ['english', 'hindi', 'hinglish'].includes(req.body?.language)
      ? req.body.language
      : 'english';

    let segments;
    try {
      segments = await transcribeLocal(tempPath, language);
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `Transcription failed: ${err.message}. Please try again.`,
      });
    }
    if (!segments.length) {
      return res.status(422).json({
        success: false,
        message: 'No speech was detected in this video.',
      });
    }

    const caption = await Caption.findOneAndUpdate(
      { project: project._id },
      { project: project._id, segments },
      { upsert: true, new: true }
    );

    project.status = 'done';
    await project.save();

    res.status(200).json({ success: true, data: caption });
  } catch (error) {
    next(error);
  } finally {
    if (tempPath) fs.unlink(tempPath, () => {});
  }
};

exports.getCaptions = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const caption = await Caption.findOne({ project: project._id });
    if (!caption) {
      return res.status(404).json({ success: false, message: 'No captions generated yet' });
    }
    res.status(200).json({ success: true, data: caption });
  } catch (error) {
    next(error);
  }
};

exports.updateCaptions = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const { segments, style } = req.body;
    const updateData = {};
    if (segments !== undefined) updateData.segments = segments;
    if (style !== undefined) updateData.style = style;

    const caption = await Caption.findOneAndUpdate(
      { project: project._id },
      { $set: updateData },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, data: caption });
  } catch (error) {
    next(error);
  }
};
