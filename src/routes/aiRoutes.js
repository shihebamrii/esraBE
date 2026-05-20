const express = require('express');
const { analyzePhoto, chatPhoto } = require('../controllers/aiController');
// const { protect } = require('../middlewares/authMiddleware'); // Optional: protect if needed

const router = express.Router();

router.post('/analyze', analyzePhoto);
router.post('/chat', chatPhoto);

module.exports = router;
