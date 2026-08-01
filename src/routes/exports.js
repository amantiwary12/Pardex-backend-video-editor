const express = require('express');
const { createExport, getExportHistory } = require('../controllers/exportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.route('/:projectId').get(getExportHistory).post(createExport);

module.exports = router;
