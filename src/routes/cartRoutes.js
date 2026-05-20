// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur du panier d'achat
const cartController = require('../controllers/cartController');
// Importation du middleware de protection pour vérifier l'authentification
const { protect } = require('../middlewares/authMiddleware');
// Importation des middlewares de validation
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
// Importation des règles de validation du panier
const { cartValidation } = require('../utils/validators');

// Application du middleware de protection sur toutes les routes du panier
router.use(protect);

// Route GET pour obtenir le contenu du panier de l'utilisateur connecté
router.get('/', cartController.getCart);

// Route POST pour ajouter un article au panier
router.post('/', validate(cartValidation.addItem), cartController.addToCart);

// Route POST pour rafraîchir les prix des articles du panier
router.post('/refresh', cartController.refreshCart);

// Route DELETE pour vider entièrement le panier
router.delete('/', cartController.clearCart);

// Route DELETE pour supprimer un article spécifique du panier
router.delete('/:itemId', cartController.removeFromCart);

// Exportation du routeur
module.exports = router;
