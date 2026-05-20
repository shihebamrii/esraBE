// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();
// Importation du contrôleur de listes de lecture
const playlistController = require('../controllers/playlistController');

// Route GET pour obtenir la liste de toutes les listes de lecture publiques
router.get('/', playlistController.getAllPlaylists);

// Route GET pour obtenir les détails d'une liste de lecture par son identifiant
router.get('/:id', playlistController.getPlaylist);

// Exportation du routeur
module.exports = router;
