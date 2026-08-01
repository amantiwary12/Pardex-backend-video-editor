const Project = require('../models/Project');
const Caption = require('../models/Caption');
const ExportHistory = require('../models/ExportHistory');

exports.getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ owner: req.user._id }).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const { title, aspectRatio } = req.body;
    const project = await Project.create({ owner: req.user._id, title: title || 'Untitled Project', aspectRatio: aspectRatio || '9:16' });
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    // Media (video/audio) is never stored server-side — the frontend loads it
    // from the device's local IndexedDB store. Only caption text lives here.
    const caption = await Caption.findOne({ project: project._id });
    res.status(200).json({ success: true, data: { project, caption } });
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const { title, aspectRatio, autoSaveData, undoStack, redoStack, status } = req.body;
    if (title !== undefined) project.title = title;
    if (aspectRatio !== undefined) project.aspectRatio = aspectRatio;
    if (autoSaveData !== undefined) project.autoSaveData = autoSaveData;
    if (undoStack !== undefined) project.undoStack = undoStack;
    if (redoStack !== undefined) project.redoStack = redoStack;
    if (status !== undefined) project.status = status;
    await project.save();
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    await Caption.deleteMany({ project: project._id });
    await ExportHistory.deleteMany({ project: project._id });
    await project.deleteOne();
    res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};
