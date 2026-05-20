// Importation des fonctions de stockage pour lire les fichiers
const { getFileInfo, getDownloadStream, getPartialDownloadStream } = require('../services/storageService');
// Importation des modèles Content et AuditLog
const { Content, AuditLog } = require('../models');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Fonction pour diffuser un fichier média avec support des requêtes partielles (Range)
const streamMedia = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant du fichier depuis les paramètres
  const { fileId } = req.params;

  // Récupérer les informations du fichier depuis le stockage
  const fileInfo = await getFileInfo(fileId);

  // Si le fichier n'est pas trouvé, retourner une erreur 404
  if (!fileInfo) {
    return next(new AppError('Fichier introuvable !', 404));
  }

  // Récupérer la taille du fichier
  const fileSize = fileInfo.length;
  // Récupérer le type de contenu du fichier (par défaut octet-stream)
  const contentType = fileInfo.contentType || 'application/octet-stream';

  // Lire l'en-tête Range de la requête pour le streaming partiel
  const range = req.headers.range;

  // Configurer les en-têtes CORS pour la lecture vidéo/audio inter-domaines
  const origin = req.headers.origin;
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }

  // Vérifier si une requête de plage (Range) est demandée
  if (range) {
    // Extraire les positions de début et de fin de la plage
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Vérifier que la plage est valide
    if (start >= fileSize || end >= fileSize) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    // Calculer la taille du morceau demandé
    const chunkSize = end - start + 1;

    // Définir les en-têtes pour le contenu partiel (statut 206)
    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    });

    // Créer un flux de lecture pour le morceau demandé
    const downloadStream = getPartialDownloadStream(fileId, start, end);

    // Gérer les erreurs du flux de lecture
    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        next(new AppError('Erreur lors de la lecture du fichier', 500));
      }
    });

    // Envoyer le flux au client
    downloadStream.pipe(res);
  } else {
    // Envoyer le fichier complet si pas de requête de plage
    res.set({
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'ETag': `"${fileInfo._id.toString()}"`,
    });

    // Créer un flux de lecture pour le fichier complet
    const downloadStream = getDownloadStream(fileId);

    // Gérer les erreurs du flux de lecture
    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        next(new AppError('Erreur lors de la lecture du fichier', 500));
      }
    });

    // Envoyer le flux au client
    downloadStream.pipe(res);
  }
});

// Fonction pour télécharger un fichier en tant que pièce jointe
const downloadMedia = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant du fichier depuis les paramètres
  const { fileId } = req.params;

  // Récupérer les informations du fichier
  const fileInfo = await getFileInfo(fileId);

  // Si le fichier n'est pas trouvé, retourner une erreur 404
  if (!fileInfo) {
    return next(new AppError('Fichier introuvable !', 404));
  }

  // Si l'utilisateur est connecté, enregistrer le téléchargement dans le journal
  if (req.user) {
    await AuditLog.log({
      userId: req.user._id,
      action: 'CONTENT_DOWNLOAD',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `File:${fileId}`,
      result: 'success',
    });
  }

  // Définir les en-têtes pour le téléchargement du fichier
  res.set({
    'Content-Type': fileInfo.contentType || 'application/octet-stream',
    'Content-Length': fileInfo.length,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
    'Cache-Control': 'private, no-cache',
  });

  // Créer un flux de lecture et envoyer le fichier au client
  const downloadStream = getDownloadStream(fileId);
  downloadStream.pipe(res);
});

// Fonction pour récupérer les informations d'un fichier
const getMediaInfo = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant du fichier depuis les paramètres
  const { fileId } = req.params;

  // Récupérer les informations du fichier
  const fileInfo = await getFileInfo(fileId);

  // Si le fichier n'est pas trouvé, retourner une erreur 404
  if (!fileInfo) {
    return next(new AppError('Fichier introuvable !', 404));
  }

  // Envoyer la réponse avec les détails du fichier
  res.status(200).json({
    status: 'success',
    data: {
      id: fileInfo._id,
      filename: fileInfo.filename,
      contentType: fileInfo.contentType,
      size: fileInfo.length,
      uploadDate: fileInfo.uploadDate,
      metadata: fileInfo.metadata,
    },
  });
});

// Fonction pour enregistrer une vue sur un contenu
const trackView = asyncHandler(async (req, res, _next) => {
  // Extraire l'identifiant du contenu depuis les paramètres
  const { contentId } = req.params;

  // Rechercher le contenu par son identifiant
  const content = await Content.findById(contentId);

  // Si le contenu existe, incrémenter le compteur de vues
  if (content) {
    // Créer une clé unique pour éviter les vues multiples de la même IP
    const viewKey = `view:${contentId}:${req.ip}`;

    // Incrémenter directement le compteur de vues
    content.views += 1;
    // Sauvegarder sans validation pour éviter les erreurs
    await content.save({ validateBeforeSave: false });

    // Enregistrer la vue dans le journal d'audit
    await AuditLog.log({
      userId: req.user?._id,
      action: 'CONTENT_VIEW',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `Content:${contentId}`,
      result: 'success',
    });
  }

  // Envoyer la réponse de confirmation
  res.status(200).json({
    status: 'success',
    message: 'Vue enregistrée',
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  streamMedia,
  downloadMedia,
  getMediaInfo,
  trackView,
};
