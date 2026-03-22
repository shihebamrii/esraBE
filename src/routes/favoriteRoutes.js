/**
 * Favorite Routes / راوتز المفضلة
 */

const express = require('express');
const router = express.Router();

const favoriteController = require('../controllers/favoriteController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', favoriteController.getFavorites);
router.post('/toggle', favoriteController.toggleFavorite);

module.exports = router;
