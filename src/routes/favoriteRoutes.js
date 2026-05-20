// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur des favoris
const favoriteController = require('../controllers/favoriteController');
// Importation du middleware de protection pour vérifier l'authentification
const { protect } = require('../middlewares/authMiddleware');

// Application du middleware de protection sur toutes les routes des favoris
router.use(protect);

// Route GET pour obtenir la liste des favoris de l'utilisateur connecté
router.get('/', favoriteController.getFavorites);
// Route POST pour ajouter ou retirer un élément des favoris
router.post('/toggle', favoriteController.toggleFavorite);

// Exportation du routeur
module.exports = router;
