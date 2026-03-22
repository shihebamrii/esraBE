/**
 * Public Playlist Routes / راوتز قوائم التشغيل العامة
 */

const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');

/**
 * @desc    قائمة قوائم التشغيل العامة
 * @route   GET /api/playlists
 * @access  Public
 */
router.get('/', playlistController.getAllPlaylists);

/**
 * @desc    تفاصيل قائمة تشغيل
 * @route   GET /api/playlists/:id
 * @access  Public
 */
router.get('/:id', playlistController.getPlaylist);

module.exports = router;
