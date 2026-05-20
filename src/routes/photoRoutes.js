// Importation du framework Express
const express = require('express');
// Création d'un routeur Express
const router = express.Router();

// Importation du contrôleur de photos publiques
const photoController = require('../controllers/photoController');
// Importation des middlewares d'authentification optionnelle et de protection
const { optionalAuth, protect } = require('../middlewares/authMiddleware');
// Importation des middlewares de validation
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
// Importation des règles de validation des photos
const { photoValidation } = require('../utils/validators');
// Importation des middlewares de téléchargement de fichiers
const { mediaWithPreviewUpload, handleMulterError, singleMediaUpload } = require('../middlewares/uploadMiddleware');

// Route GET pour obtenir la liste des photos avec filtres
router.get('/', validate(photoValidation.query, 'query'), photoController.getPhotos);

// Route POST pour télécharger une photo (utilisateur authentifié, nécessite approbation)
router.post('/upload', protect, mediaWithPreviewUpload, handleMulterError, photoController.uploadPhoto);

// Route GET pour obtenir les photos téléchargées par l'utilisateur connecté
router.get('/my-uploads', protect, photoController.getMyPhotos);
// Route PUT pour mettre à jour une photo de l'utilisateur connecté par son identifiant
router.put('/my-uploads/:id', protect, validateObjectId('id'), photoController.updateMyPhoto);
// Route DELETE pour supprimer une photo de l'utilisateur connecté par son identifiant
router.delete('/my-uploads/:id', protect, validateObjectId('id'), photoController.deleteMyPhoto);

// Route GET pour obtenir la liste des gouvernorats disponibles
router.get('/governorates', photoController.getGovernorates);

// Route GET pour obtenir la liste des types de paysages
router.get('/landscape-types', photoController.getLandscapeTypes);

// Route GET pour obtenir la liste des packs de photos
router.get('/packs', photoController.getPacks);

// Route GET pour obtenir les détails d'un pack de photos par son identifiant
router.get('/packs/:id', validateObjectId('id'), photoController.getPack);

// Route GET pour obtenir les détails d'une photo par son identifiant
router.get('/:id', validateObjectId('id'), photoController.getPhoto);

// Route GET pour obtenir l'aperçu d'une photo avec filigrane (accès gratuit, authentification optionnelle)
router.get('/:id/preview', validateObjectId('id'), optionalAuth, photoController.getPhotoPreview);

// Exportation du routeur
module.exports = router;
