const ExportHistory = require('../models/ExportHistory');
const Project = require('../models/Project');

// Exports happen entirely on the user's device (the file is downloaded from
// the browser's local store) — this only records THAT an export happened.
// No video URL or content is ever kept.
exports.createExport = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { quality = '1080p', platform = 'download', metadata = {} } = req.body;

    const exportRecord = await ExportHistory.create({
      project: project._id,
      user: req.user._id,
      quality,
      platform,
      metadata,
      status: 'done',
      url: '',
    });

    res.status(201).json({ success: true, data: exportRecord, message: 'Export saved to your device.' });
  } catch (error) {
    next(error);
  }
};

exports.getExportHistory = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const exports = await ExportHistory.find({ project: project._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: exports });
  } catch (error) {
    next(error);
  }
};
