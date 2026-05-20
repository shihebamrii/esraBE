// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();
// Importation du module Multer pour gérer le téléchargement de fichiers
const multer = require('multer');

// Importation du contrôleur d'authentification
const authController = require('../controllers/authController');
// Importation du middleware de protection pour vérifier l'authentification
const { protect } = require('../middlewares/authMiddleware');
// Importation du middleware de validation
const { validate } = require('../middlewares/validateMiddleware');
// Importation des règles de validation pour l'authentification
const { authValidation } = require('../utils/validators');

// Configuration de Multer pour le stockage temporaire en mémoire
const upload = multer({
  // Utilisation de la mémoire vive pour stocker temporairement le fichier
  storage: multer.memoryStorage(),
  // Configuration des limites de taille du fichier
  limits: {
    // Limite de taille fixée à 5 mégaoctets
    fileSize: 5 * 1024 * 1024,
  },
  // Fonction de filtrage pour accepter uniquement les images
  fileFilter: (req, file, cb) => {
    // Vérification que le type MIME commence par 'image/'
    if (file.mimetype.startsWith('image/')) {
      // Acceptation du fichier
      cb(null, true);
    } else {
      // Rejet du fichier avec un message d'erreur
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// Route POST pour l'inscription d'un nouvel utilisateur
router.post(
  '/register',
  validate(authValidation.register),
  authController.register
);

// Route POST pour la connexion d'un utilisateur existant
router.post(
  '/login',
  validate(authValidation.login),
  authController.login
);

// Route POST pour rafraîchir le jeton d'accès expiré
router.post(
  '/refresh-token',
  validate(authValidation.refreshToken),
  authController.refreshToken
);

// Route POST pour demander la réinitialisation du mot de passe oublié
router.post(
  '/forgot-password',
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

// Route POST pour réinitialiser le mot de passe avec un jeton reçu par email
router.post(
  '/reset-password',
  validate(authValidation.resetPassword),
  authController.resetPassword
);

// Route GET pour récupérer les informations publiques d'un utilisateur par son identifiant
router.get('/users/:id', authController.getUser);

// Route GET pour obtenir les informations de l'utilisateur connecté
router.get('/me', protect, authController.getMe);

// Route PUT pour mettre à jour les informations de l'utilisateur connecté
router.put('/me', protect, validate(authValidation.updateMe), authController.updateMe);

// Route DELETE pour supprimer le compte de l'utilisateur connecté
router.delete('/me', protect, authController.deleteMe);

// Route POST pour déconnecter l'utilisateur
router.post('/logout', protect, authController.logout);

// Route POST pour télécharger ou remplacer la photo de profil de l'utilisateur connecté
router.post('/me/picture', protect, upload.single('profilePicture'), authController.uploadProfilePicture);

// Exportation du routeur
module.exports = router;
