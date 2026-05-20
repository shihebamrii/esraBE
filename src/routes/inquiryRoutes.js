// Importation du framework Express
const express = require('express');
// Importation du contrôleur de demandes de renseignements
const inquiryController = require('../controllers/inquiryController');
// Importation des middlewares de protection et d'autorisation
const { protect, authorize } = require('../middlewares/authMiddleware');

// Création d'un routeur Express
const router = express.Router();

// Route POST publique pour soumettre une demande de renseignements
router.post('/', inquiryController.submitInquiry);

// Exportation du routeur
module.exports = router;
