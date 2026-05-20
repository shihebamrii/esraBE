// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de contenu public
const contentController = require('../controllers/contentController');
// Importation du middleware d'authentification optionnelle
const { optionalAuth } = require('../middlewares/authMiddleware');
// Importation des middlewares de validation
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
// Importation des règles de validation du contenu
const { contentValidation } = require('../utils/validators');

// Route GET pour obtenir la liste des contenus avec filtres
router.get('/', validate(contentValidation.query, 'query'), contentController.getContents);

// Route GET pour obtenir un contenu par son identifiant (avec authentification optionnelle)
router.get('/:id', validateObjectId('id'), optionalAuth, contentController.getContent);

// Route GET pour obtenir les contenus similaires à un contenu donné
router.get('/:id/related', validateObjectId('id'), contentController.getRelatedContent);

// Exportation du routeur
module.exports = router;
