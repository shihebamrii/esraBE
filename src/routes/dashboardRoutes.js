// Importation du framework Express
const express = require('express');
// Importation du contrôleur du tableau de bord
const dashboardController = require('../controllers/dashboardController');
// Importation du contrôleur d'authentification
const authController = require('../controllers/authController');

// Création d'un routeur Express
const router = express.Router();

// Importation du middleware de protection pour vérifier l'authentification
const { protect } = require('../middlewares/authMiddleware');

// Application du middleware de protection sur toutes les routes du tableau de bord
router.use(protect);

// Route GET pour obtenir les statistiques de téléchargement de l'utilisateur
router.get('/stats', dashboardController.getUserUploadStats);
// Route GET pour obtenir l'activité récente
router.get('/recent', dashboardController.getRecentActivity);
// Route GET pour obtenir les statistiques de l'utilisateur
router.get('/user-stats', dashboardController.getUserStats);
// Route GET pour obtenir les statistiques d'administration
router.get('/admin-stats', dashboardController.getAdminStats);
// Route GET pour obtenir la liste des téléchargements de l'utilisateur
router.get('/downloads', dashboardController.getMyDownloads);
// Route GET pour obtenir les photos de l'utilisateur
router.get('/my-photos', dashboardController.getMyPhotos);
// Route GET pour obtenir le contenu de l'utilisateur
router.get('/my-content', dashboardController.getMyContent);
// Route GET pour obtenir les packs de l'utilisateur
router.get('/packs', dashboardController.getUserPacks);
// Route POST pour enregistrer un téléchargement
router.post('/track-download', dashboardController.trackDownload);

// Exportation du routeur
module.exports = router;
