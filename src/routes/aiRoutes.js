// Importation du framework Express
const express = require('express');
// Importation des fonctions du contrôleur d'intelligence artificielle
const { analyzePhoto, chatPhoto } = require('../controllers/aiController');

// Création d'un routeur Express
const router = express.Router();

// Route POST pour analyser une photo avec l'intelligence artificielle
router.post('/analyze', analyzePhoto);
// Route POST pour discuter avec l'IA au sujet d'une photo
router.post('/chat', chatPhoto);

// Exportation du routeur
module.exports = router;
