/**
 * Pack Routes / راوتز الباكات العامة
 */

const express = require('express');
const router = express.Router();
const packController = require('../controllers/packController');

/**
 * @desc    قائمة الباكات العامة
 * @route   GET /api/packs
 * @access  Public
 */
router.get('/', packController.getAllPacks);

/**
 * @desc    تفاصيل باك
 * @route   GET /api/packs/:id
 * @access  Public
 */
router.get('/:id', packController.getPack || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
