// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de paiement
const paymentController = require('../controllers/paymentController');
// Importation du middleware de protection pour vérifier l'authentification
const { protect } = require('../middlewares/authMiddleware');
// Importation du middleware de validation d'identifiant
const { validateObjectId } = require('../middlewares/validateMiddleware');

// Route POST pour recevoir les webhooks des fournisseurs de paiement (route publique avec vérification interne de la signature)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Route GET pour simuler la complétion d'un paiement (uniquement en mode développement)
router.get('/mock-complete', paymentController.mockComplete);

// Route GET pour vérifier le statut d'un paiement par identifiant de commande (utilisateur authentifié)
router.get('/status/:orderId', protect, validateObjectId('orderId'), paymentController.getPaymentStatus);

// Exportation du routeur
module.exports = router;
