// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de médias (streaming et téléchargement)
const mediaController = require('../controllers/mediaController');
// Importation du middleware d'authentification optionnelle
const { optionalAuth } = require('../middlewares/authMiddleware');
// Importation du middleware de validation d'identifiant
const { validateObjectId } = require('../middlewares/validateMiddleware');

// Route GET pour diffuser un fichier média en streaming avec support des plages d'octets (Range)
router.get('/:fileId', validateObjectId('fileId'), mediaController.streamMedia);

// Route GET pour télécharger un fichier média (avec authentification optionnelle)
router.get('/:fileId/download', validateObjectId('fileId'), optionalAuth, mediaController.downloadMedia);

// Route GET pour obtenir les informations d'un fichier média
router.get('/:fileId/info', validateObjectId('fileId'), mediaController.getMediaInfo);

// Route POST pour enregistrer une vue sur un contenu (avec authentification optionnelle)
router.post('/views/:contentId', validateObjectId('contentId'), optionalAuth, mediaController.trackView);

// Exportation du routeur
module.exports = router;
