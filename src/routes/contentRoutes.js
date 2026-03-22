/**
 * Content Routes / راوتز المحتوى العام
 */

const express = require('express');
const router = express.Router();

const contentController = require('../controllers/contentController');
const { optionalAuth } = require('../middlewares/authMiddleware');
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
const { contentValidation } = require('../utils/validators');

// قائمة المحتويات
router.get('/', validate(contentValidation.query, 'query'), contentController.getContents);

// محتوى واحد
router.get('/:id', validateObjectId('id'), optionalAuth, contentController.getContent);

// محتويات مشابهة
router.get('/:id/related', validateObjectId('id'), contentController.getRelatedContent);

module.exports = router;
