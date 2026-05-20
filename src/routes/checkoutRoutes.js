// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de commande et paiement
const checkoutController = require('../controllers/checkoutController');
// Importation des middlewares de protection et d'autorisation
const { protect, authorize } = require('../middlewares/authMiddleware');
// Importation des middlewares de validation
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
// Importation des règles de validation des commandes
const { orderValidation } = require('../utils/validators');

// Route POST pour créer une nouvelle commande (utilisateur authentifié)
router.post('/', protect, validate(orderValidation.checkout), checkoutController.createOrder);

// Route GET pour obtenir toutes les commandes (réservé à l'administrateur)
router.get('/admin/orders', protect, authorize('admin'), checkoutController.getAllOrders);

// Route GET pour obtenir les commandes de l'utilisateur connecté
router.get('/orders', protect, checkoutController.getMyOrders);

// Route POST pour utiliser un quota de téléchargement d'un pack
router.post('/redeem', protect, checkoutController.redeemDownload);

// Route GET pour obtenir les détails d'une commande par son identifiant
router.get('/orders/:id', protect, validateObjectId('id'), checkoutController.getOrder);

// Route GET pour télécharger un article acheté en utilisant un jeton public
router.get('/orders/:orderId/download/:token', checkoutController.downloadPurchasedItem);

// Exportation du routeur
module.exports = router;
