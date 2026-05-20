// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de recherche
const searchController = require('../controllers/searchController');

// Route GET pour effectuer une recherche globale
router.get('/', searchController.search);

// Route GET pour effectuer une recherche en texte intégral
router.get('/fulltext', searchController.fulltextSearch);

// Route GET pour obtenir des suggestions de recherche
router.get('/suggest', searchController.searchSuggestions);

// Exportation du routeur
module.exports = router;
