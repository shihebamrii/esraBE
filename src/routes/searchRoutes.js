/**
 * Search Routes / راوتز البحث
 */

const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController');

// بحث شامل
router.get('/', searchController.search);

// بحث بالنص الكامل
router.get('/fulltext', searchController.fulltextSearch);

// اقتراحات البحث
router.get('/suggest', searchController.searchSuggestions);

module.exports = router;
