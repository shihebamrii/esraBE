// Importation du module Multer pour gérer le téléchargement de fichiers
const multer = require('multer');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');
// Importation de la configuration de l'application
const config = require('../config');

// Liste des types MIME autorisés pour les images
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Liste des types MIME autorisés pour les vidéos
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
// Liste des types MIME autorisés pour les fichiers audio
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'];

// Fonction qui crée un filtre de fichiers basé sur les types MIME autorisés
const createFileFilter = (allowedTypes) => {
  return (_req, file, cb) => {
    // Vérification que le type MIME du fichier est dans la liste autorisée
    if (allowedTypes.includes(file.mimetype)) {
      // Acceptation du fichier
      cb(null, true);
    } else {
      // Rejet du fichier avec un message d'erreur détaillé
      cb(
        new AppError(
          `Type de fichier non accepté : ${file.mimetype}. Les types acceptés sont : ${allowedTypes.join(', ')}`,
          400
        ),
        false
      );
    }
  };
};

// Configuration de Multer pour le téléchargement de photos
const photoUpload = multer({
  // Stockage temporaire en mémoire vive
  storage: multer.memoryStorage(),
  // Limite de taille maximale pour les photos
  limits: {
    fileSize: config.upload.maxPhotoSize,
  },
  // Filtre pour n'accepter que les types d'images autorisés
  fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES),
});

// Configuration de Multer pour le téléchargement de vidéos
const videoUpload = multer({
  // Stockage temporaire en mémoire vive
  storage: multer.memoryStorage(),
  // Limite de taille maximale pour les vidéos
  limits: {
    fileSize: config.upload.maxVideoSize,
  },
  // Filtre pour n'accepter que les types de vidéos autorisés
  fileFilter: createFileFilter(ALLOWED_VIDEO_TYPES),
});

// Configuration de Multer pour le téléchargement de fichiers audio
const audioUpload = multer({
  // Stockage temporaire en mémoire vive
  storage: multer.memoryStorage(),
  // Limite de taille maximale pour les fichiers audio
  limits: {
    fileSize: config.upload.maxAudioSize,
  },
  // Filtre pour n'accepter que les types audio autorisés
  fileFilter: createFileFilter(ALLOWED_AUDIO_TYPES),
});

// Configuration de Multer pour le téléchargement de contenu (vidéo, audio et miniature)
const contentUpload = multer({
  // Stockage temporaire en mémoire vive
  storage: multer.memoryStorage(),
  // Limite de taille maximale (utilise la limite vidéo, la plus grande)
  limits: {
    fileSize: config.upload.maxVideoSize,
  },
  // Filtre pour accepter tous les types de médias autorisés
  fileFilter: (_req, file, cb) => {
    // Combinaison de tous les types autorisés (vidéo, audio et image)
    const allAllowed = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_IMAGE_TYPES];
    // Vérification du type MIME du fichier
    if (allAllowed.includes(file.mimetype)) {
      // Acceptation du fichier
      cb(null, true);
    } else {
      // Rejet du fichier avec un message d'erreur
      cb(new AppError(`Type de fichier non accepté : ${file.mimetype}`, 400), false);
    }
  },
});

// Configuration de Multer pour le téléchargement de médias Tounesna (images et vidéos)
const tounesnaMediaUpload = multer({
  // Stockage temporaire en mémoire vive
  storage: multer.memoryStorage(),
  // Limite de taille maximale (utilise la limite vidéo)
  limits: {
    fileSize: config.upload.maxVideoSize,
  },
  // Filtre pour accepter les images et les vidéos uniquement
  fileFilter: (_req, file, cb) => {
    // Combinaison des types d'images et de vidéos autorisés
    const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
    // Vérification du type MIME du fichier
    if (allAllowed.includes(file.mimetype)) {
      // Acceptation du fichier
      cb(null, true);
    } else {
      // Rejet du fichier avec un message d'erreur
      cb(new AppError(`Type de fichier non accepté : ${file.mimetype}. Uniquement les images et vidéos.`, 400), false);
    }
  },
});

// Middleware pour gérer les erreurs spécifiques à Multer
const handleMulterError = (err, _req, _res, next) => {
  // Vérification si l'erreur est une erreur Multer
  if (err instanceof multer.MulterError) {
    // Gestion de l'erreur de dépassement de taille de fichier
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Le fichier est trop volumineux ! Réduisez la taille.', 400));
    }
    // Gestion de l'erreur de champ de fichier inattendu
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Le champ de fichier est incorrect ou introuvable !', 400));
    }
    // Gestion des autres erreurs Multer
    return next(new AppError(`Erreur lors du téléchargement : ${err.message}`, 400));
  }
  // Passage de l'erreur au middleware suivant si ce n'est pas une erreur Multer
  next(err);
};

// Configuration pour le téléchargement d'une seule photo haute résolution
const singlePhotoUpload = photoUpload.single('photo');

// Configuration pour le téléchargement de deux photos (haute résolution et basse résolution)
const photoWithPreviewUpload = photoUpload.fields([
  { name: 'highRes', maxCount: 1 },
  { name: 'lowRes', maxCount: 1 },
]);

// Configuration pour le téléchargement d'un média avec aperçu (haute et basse résolution)
const mediaWithPreviewUpload = tounesnaMediaUpload.fields([
  { name: 'highRes', maxCount: 1 },
  { name: 'lowRes', maxCount: 1 },
]);

// Configuration pour le téléchargement d'un seul média (raccourci)
const singleMediaUpload = tounesnaMediaUpload.single('photo');

// Configuration pour le téléchargement d'un contenu avec une miniature
const contentWithThumbnailUpload = contentUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

// Configuration pour le téléchargement d'une seule vidéo
const singleVideoUpload = videoUpload.single('video');

// Configuration pour le téléchargement d'un seul fichier audio
const singleAudioUpload = audioUpload.single('audio');

// Exportation de toutes les configurations et middlewares de téléchargement
module.exports = {
  photoUpload,
  videoUpload,
  audioUpload,
  contentUpload,
  handleMulterError,
  singlePhotoUpload,
  photoWithPreviewUpload,
  mediaWithPreviewUpload,
  singleMediaUpload,
  contentWithThumbnailUpload,
  singleVideoUpload,
  singleAudioUpload,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
};
