// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();
// Importation du contrôleur de notifications
const notificationController = require('../controllers/notificationController');
// Importation du middleware de protection pour vérifier l'authentification
const { protect } = require('../middlewares/authMiddleware');

// Route GET publique pour obtenir la clé publique VAPID (notifications push)
router.get('/vapid-key', notificationController.getVapidKey);

// Application du middleware de protection sur les routes suivantes
router.use(protect);

// Route GET pour obtenir les notifications de l'utilisateur connecté
router.get('/', notificationController.getMyNotifications);
// Route PUT pour marquer une notification comme lue par son identifiant
router.put('/:id/read', notificationController.markAsRead);
// Route POST pour s'abonner aux notifications push
router.post('/subscribe', notificationController.subscribePush);

// Exportation du routeur
module.exports = router;
