// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();
// Importation du contrôleur de packs
const packController = require('../controllers/packController');

// Route GET pour obtenir la liste de tous les packs publics
router.get('/', packController.getAllPacks);

// Route GET pour obtenir les détails d'un pack par son identifiant
router.get('/:id', packController.getPack || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// Exportation du routeur
module.exports = router;
