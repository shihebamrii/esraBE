// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de contenu administratif
const adminContentController = require('../controllers/adminContentController');
// Importation du contrôleur de photos administratif
const adminPhotoController = require('../controllers/adminPhotoController');
// Importation du contrôleur d'utilisateurs administratif
const adminUserController = require('../controllers/adminUserController');
// Importation du contrôleur de listes de lecture administratif
const adminPlaylistController = require('../controllers/adminPlaylistController');
// Importation du contrôleur de demandes de renseignements
const inquiryController = require('../controllers/inquiryController');
// Importation du contrôleur de packs
const packController = require('../controllers/packController');
// Importation des middlewares de protection et d'autorisation
const { protect, authorize } = require('../middlewares/authMiddleware');
// Importation des middlewares de téléchargement de fichiers
const { contentWithThumbnailUpload, mediaWithPreviewUpload, singleMediaUpload, handleMulterError } = require('../middlewares/uploadMiddleware');
// Importation des middlewares de validation de données
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
// Importation des schémas de validation
const { contentValidation, photoValidation, packValidation } = require('../utils/validators');

// Middleware pour analyser les champs JSON envoyés via FormData
const parseJsonFields = (fields) => (req, res, next) => {
  // Parcours de chaque nom de champ spécifié
  fields.forEach(field => {
    // Vérification que le champ existe dans le corps de la requête et qu'il est une chaîne de caractères
    if (req.body && req.body[field] && typeof req.body[field] === 'string') {
      try {
        // Tentative de conversion de la chaîne JSON en objet JavaScript
        req.body[field] = JSON.parse(req.body[field]);
      } catch (e) {
      }
    }
  });
  // Passage au middleware suivant
  next();
};

// Application du middleware de protection sur toutes les routes de ce routeur
router.use(protect);

// Route POST pour télécharger un nouveau contenu (réservé à l'administrateur)
router.post(
  '/content/upload',
  authorize('admin'),
  contentWithThumbnailUpload,
  handleMulterError,
  parseJsonFields(['authors', 'themes', 'tags', 'metadata']),
  adminContentController.uploadContent
);

// Route GET pour obtenir la liste de tous les contenus (réservé à l'administrateur)
router.get(
  '/content',
  authorize('admin'),
  validate(contentValidation.query, 'query'),
  adminContentController.getAllContent
);

// Route PUT pour mettre à jour un contenu par son identifiant (réservé à l'administrateur)
router.put(
  '/content/:id',
  authorize('admin'),
  contentWithThumbnailUpload,
  handleMulterError,
  parseJsonFields(['authors', 'themes', 'tags', 'metadata']),
  validateObjectId('id'),
  validate(contentValidation.update),
  adminContentController.updateContent
);

// Route PUT pour approuver un contenu par son identifiant (réservé à l'administrateur)
router.put(
  '/content/:id/approve',
  authorize('admin'),
  validateObjectId('id'),
  adminContentController.approveContent
);

// Route DELETE pour supprimer un contenu par son identifiant (réservé à l'administrateur)
router.delete(
  '/content/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminContentController.deleteContent
);

// Route POST pour télécharger une photo avec son aperçu (réservé à l'administrateur)
router.post(
  '/photos/upload',
  authorize('admin'),
  mediaWithPreviewUpload,
  handleMulterError,
  parseJsonFields(['tags']),
  adminPhotoController.uploadPhoto
);

// Route POST alternative pour télécharger un seul fichier média (réservé à l'administrateur)
router.post(
  '/photos/upload-single',
  authorize('admin'),
  singleMediaUpload,
  handleMulterError,
  parseJsonFields(['tags']),
  adminPhotoController.uploadPhoto
);

// Route GET pour obtenir la liste de toutes les photos (réservé à l'administrateur)
router.get(
  '/photos',
  authorize('admin'),
  validate(photoValidation.query, 'query'),
  adminPhotoController.getAllPhotos
);

// Route PUT pour mettre à jour une photo par son identifiant (réservé à l'administrateur)
router.put(
  '/photos/:id',
  authorize('admin'),
  mediaWithPreviewUpload,
  handleMulterError,
  parseJsonFields(['tags']),
  validateObjectId('id'),
  validate(photoValidation.update),
  adminPhotoController.updatePhoto
);

// Route PUT pour approuver une photo par son identifiant (réservé à l'administrateur)
router.put(
  '/photos/:id/approve',
  authorize('admin'),
  validateObjectId('id'),
  adminPhotoController.approvePhoto
);

// Route DELETE pour supprimer une photo par son identifiant (réservé à l'administrateur)
router.delete(
  '/photos/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminPhotoController.deletePhoto
);

// Route POST pour créer un nouveau pack (réservé à l'administrateur)
router.post(
  '/packs',
  authorize('admin'),
  validate(packValidation.create),
  packController.createPack
);

// Route GET pour obtenir la liste de tous les packs (réservé à l'administrateur)
router.get(
  '/packs',
  authorize('admin'),
  packController.getAllPacks
);

// Route PUT pour mettre à jour un pack par son identifiant (réservé à l'administrateur)
router.put(
  '/packs/:id',
  authorize('admin'),
  validateObjectId('id'),
  validate(packValidation.update),
  packController.updatePack
);

// Route DELETE pour supprimer un pack par son identifiant (réservé à l'administrateur)
router.delete(
  '/packs/:id',
  authorize('admin'),
  validateObjectId('id'),
  packController.deletePack
);

// Route GET pour obtenir la liste de tous les utilisateurs (réservé à l'administrateur)
router.get(
  '/users',
  authorize('admin'),
  adminUserController.getAllUsers
);

// Route PUT pour mettre à jour le quota d'un pack utilisateur (réservé à l'administrateur)
router.put(
  '/users/:userId/packs/:userPackId',
  authorize('admin'),
  validateObjectId('userId'),
  validateObjectId('userPackId'),
  adminUserController.updateUserPackQuota
);

// Route PUT pour mettre à jour le statut d'un utilisateur (réservé à l'administrateur)
router.put(
  '/users/:id/status',
  authorize('admin'),
  validateObjectId('id'),
  adminUserController.updateUserStatus
);

// Route PUT pour mettre à jour les informations d'un utilisateur (réservé à l'administrateur)
router.put(
  '/users/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminUserController.updateUser
);

// Route DELETE pour supprimer un utilisateur par son identifiant (réservé à l'administrateur)
router.delete(
  '/users/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminUserController.deleteUser
);

// Route GET pour obtenir la liste de toutes les listes de lecture (réservé à l'administrateur)
router.get(
  '/playlists',
  authorize('admin'),
  adminPlaylistController.getAllPlaylists
);

// Route POST pour créer une nouvelle liste de lecture (réservé à l'administrateur)
router.post(
  '/playlists',
  authorize('admin'),
  adminPlaylistController.createPlaylist
);

// Route PUT pour mettre à jour une liste de lecture par son identifiant (réservé à l'administrateur)
router.put(
  '/playlists/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminPlaylistController.updatePlaylist
);

// Route DELETE pour supprimer une liste de lecture par son identifiant (réservé à l'administrateur)
router.delete(
  '/playlists/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminPlaylistController.deletePlaylist
);

// Route GET pour obtenir la liste des demandes de renseignements (réservé à l'administrateur)
router.get('/inquiries', authorize('admin'), inquiryController.getAllInquiries);
// Route PATCH pour modifier le statut d'une demande de renseignements (réservé à l'administrateur)
router.patch('/inquiries/:id', authorize('admin'), inquiryController.updateInquiry);
// Route POST pour envoyer une réponse à une demande de renseignements (réservé à l'administrateur)
router.post('/inquiries/:id/respond', authorize('admin'), inquiryController.respondToInquiry);
// Route DELETE pour supprimer une demande de renseignements (réservé à l'administrateur)
router.delete('/inquiries/:id', authorize('admin'), inquiryController.deleteInquiry);

// Exportation du routeur configuré
module.exports = router;
