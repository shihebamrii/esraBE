// Importation des modèles Photo et AuditLog depuis le dossier des modèles
const { Photo, AuditLog } = require('../models');

// Importation des fonctions de téléchargement et de suppression GridFS
const { uploadToGridFS, deleteFromGridFS } = require('../services/storageService');

// Importation des fonctions de traitement d'image : basse résolution, filigrane et informations d'image
const { createLowResVersion, addTiledWatermark, getImageInfo } = require('../services/imageProcessor');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Importation du wrapper asyncHandler pour la gestion des erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation des services de notification pour avertir les utilisateurs
const { notifyAllUsers, notifyUser } = require('../services/notificationService');

// Importation de l'utilitaire de parsing JSON sécurisé
const { safeParseJSON } = require('../utils/safeParser');

// Déclaration de la fonction pour télécharger une photo
const uploadPhoto = asyncHandler(async (req, res, next) => {
  // Récupération du fichier haute résolution ou de l'image unique
  const highResFile = req.files?.highRes?.[0] || req.file;
  // Récupération du fichier basse résolution s'il est fourni
  const lowResFile = req.files?.lowRes?.[0];

  // Si aucun fichier haute résolution n'est fourni, on renvoie une erreur 400
  if (!highResFile) {
    return next(new AppError('La photo en haute résolution ou la vidéo est obligatoire !', 400));
  }

  // Détection si le fichier téléchargé est une vidéo
  const isVideo = highResFile.mimetype.startsWith('video/');

  // Une vidéo nécessite obligatoirement le téléchargement d'une miniature
  if (isVideo && !lowResFile) {
    return next(new AppError('Pour la vidéo, veuillez télécharger une miniature (Thumbnail) !', 400));
  }

  // Récupération des informations géométriques si c'est une image
  let highResInfo = {};
  if (!isVideo) {
    highResInfo = await getImageInfo(highResFile.buffer);
  }

  // Téléchargement du fichier haute résolution original dans GridFS
  const highResFileId = await uploadToGridFS(
    highResFile.buffer,
    highResFile.originalname,
    highResFile.mimetype,
    {
      uploadedBy: req.user._id,
      type: isVideo ? 'photo-video' : 'photo-highres',
      ...highResInfo,
    }
  );

  // Initialisation des variables pour la version basse résolution
  let lowResBuffer;
  let lowResInfo;

  // Traitement pour obtenir la version basse résolution
  if (lowResFile) {
    // Si l'utilisateur fournit lui-même le fichier basse résolution
    lowResBuffer = lowResFile.buffer;
    lowResInfo = await getImageInfo(lowResBuffer);
  } else {
    // Génération automatique d'une copie basse résolution à partir de la version haute résolution
    const lowResResult = await createLowResVersion(highResFile.buffer, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 70,
      format: 'jpeg',
    });
    lowResBuffer = lowResResult.buffer;
    lowResInfo = lowResResult.info;
  }

  // Définition du texte de copyright ou d'attribution pour le filigrane
  const watermarkText = req.body.attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable';
  // Ajout du filigrane répété sur l'image basse résolution
  const watermarkedBuffer = await addTiledWatermark(lowResBuffer, watermarkText, {
    fontSize: 16,
    opacity: 0.3,
    spacing: 200,
  });

  // Téléchargement de la version basse résolution filigranée dans GridFS
  const lowResFileId = await uploadToGridFS(
    watermarkedBuffer,
    `lowres_${highResFile.originalname}`,
    'image/jpeg',
    {
      uploadedBy: req.user._id,
      type: 'photo-lowres',
      watermarked: true,
      ...lowResInfo,
    }
  );

  // Extraction des données associées envoyées dans le corps de la requête
  const {
    title,
    description,
    governorate,
    landscapeType,
    priceTND,
    pricePersonalTND,
    priceCommercialTND,
    watermark,
    attributionText,
    tags,
  } = req.body;

  // Analyse et parsing sécurisé des étiquettes (tags)
  let finalTags = safeParseJSON(tags) || [];

  // Création du document Photo dans la base de données MongoDB
  const photo = await Photo.create({
    mediaType: isVideo ? 'video' : 'photo',
    title,
    description,
    governorate,
    landscapeType,
    lowResFileId,
    highResFileId,
    priceTND: parseFloat(pricePersonalTND || priceTND) || 0,
    pricePersonalTND: parseFloat(pricePersonalTND || priceTND) || 0,
    priceCommercialTND: parseFloat(priceCommercialTND) || 0,
    watermark: watermark !== 'false',
    attributionText: attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable',
    createdBy: req.user._id,
    approvalStatus: 'approved',
    tags: finalTags,
    fileInfo: {
      highRes: {
        filename: highResFile.originalname,
        contentType: highResFile.mimetype,
        size: highResFile.size,
        width: highResInfo.width,
        height: highResInfo.height,
      },
      lowRes: {
        filename: `lowres_${highResFile.originalname}`,
        contentType: 'image/jpeg',
        size: watermarkedBuffer.length,
        width: lowResInfo.width,
        height: lowResInfo.height,
      },
    },
  });

  // Ajout de l'événement de création dans les journaux d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_UPLOAD',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${photo._id}`,
    result: 'success',
  });

  // Notification générale pour tous les utilisateurs
  await notifyAllUsers({
    title: 'Nouvelle photo !',
    message: `Nouvelle photo Tounesna ajoutée : ${title}`,
    type: 'new_content',
    link: `/tounesna/${photo._id}`
  });

  // Réponse HTTP de création réussie avec le document JSON
  res.status(201).json({
    status: 'success',
    message: 'Photo téléchargée avec succès !',
    data: { photo },
  });
});

// Déclaration de la fonction pour lister toutes les photos
const getAllPhotos = asyncHandler(async (req, res, _next) => {
  // Extraction des filtres et paramètres de pagination
  const { page = 1, limit = 20, governorate, landscapeType, sort = '-createdAt' } = req.query;

  // Création de l'objet de filtres
  const query = {};
  // Filtrage facultatif par gouvernorat
  if (governorate) query.governorate = governorate;
  // Filtrage facultatif par type de paysage
  if (landscapeType) query.landscapeType = landscapeType;

  // Recherche dans la base de données avec pagination et tri
  const photos = await Photo.find(query)
    .populate('createdBy', 'name email role')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Comptage total des photos correspondant aux filtres
  const total = await Photo.countDocuments(query);

  // Envoi de la réponse contenant les résultats et la pagination
  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos },
  });
});

// Déclaration de la fonction de mise à jour d'une photo
const updatePhoto = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de la photo
  const { id } = req.params;

  // Recherche de la photo en base de données
  const photo = await Photo.findById(id);

  // Si la photo n'est pas trouvée, retour d'une erreur 404
  if (!photo) {
    return next(new AppError('Photo introuvable !', 404));
  }

  // Vérification de la permission de modification
  if (
    req.user.role !== 'admin' &&
    photo.createdBy.toString() !== req.user._id.toString()
  ) {
    return next(new AppError("Vous n'avez pas la permission de modifier cette photo !", 403));
  }

  // Liste des champs modifiables autorisés
  const allowedUpdates = [
    'title',
    'description',
    'governorate',
    'landscapeType',
    'priceTND',
    'pricePersonalTND',
    'priceCommercialTND',
    'watermark',
    'attributionText',
    'mediaType',
    'tags',
  ];

  // Construction de l'objet de mise à jour
  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      if (field === 'tags' && typeof req.body[field] === 'string') {
        updates[field] = safeParseJSON(req.body[field]);
      } else if (['priceTND', 'pricePersonalTND', 'priceCommercialTND'].includes(field)) {
        updates[field] = parseFloat(req.body[field]) || 0;
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  // Enregistrement des modifications dans la base de données
  const updatedPhoto = await Photo.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // Enregistrement de l'action de modification dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  // Réponse HTTP de succès avec les données de la photo mise à jour
  res.status(200).json({
    status: 'success',
    message: 'Photo mise à jour !',
    data: { photo: updatedPhoto },
  });
});

// Déclaration de la fonction de suppression d'une photo
const deletePhoto = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant
  const { id } = req.params;

  // Recherche de la photo correspondante
  const photo = await Photo.findById(id);

  // Si la photo n'existe pas, retour d'une erreur 404
  if (!photo) {
    return next(new AppError('Photo introuvable !', 404));
  }

  // Suppression du fichier haute résolution dans GridFS
  if (photo.highResFileId) {
    await deleteFromGridFS(photo.highResFileId);
  }
  // Suppression du fichier basse résolution dans GridFS
  if (photo.lowResFileId) {
    await deleteFromGridFS(photo.lowResFileId);
  }

  // Suppression du document de la base de données
  await Photo.findByIdAndDelete(id);

  // Enregistrement de la suppression dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    result: 'success',
  });

  // Réponse de succès de la suppression
  res.status(200).json({
    status: 'success',
    message: 'Photo supprimée !',
  });
});

// Déclaration de la fonction de validation de la photo
const approvePhoto = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant
  const { id } = req.params;
  // Récupération du statut d'approbation
  const { status } = req.body;

  // Vérification de la validité du nouveau statut
  if (!['approved', 'rejected'].includes(status)) {
    return next(new AppError("Le statut doit être 'approved' ou 'rejected' !", 400));
  }

  // Recherche de la photo correspondante
  const photo = await Photo.findById(id);

  // Si la photo n'est pas trouvée, retour d'une erreur 404
  if (!photo) {
    return next(new AppError('Photo introuvable !', 404));
  }

  // Modification et enregistrement du statut
  photo.approvalStatus = status;
  await photo.save({ validateBeforeSave: false });

  // Enregistrement de l'action dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_APPROVE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    details: { status },
    result: 'success',
  });

  // Envoi de notifications ciblées selon le résultat d'approbation
  if (status === 'approved') {
    await notifyUser(photo.createdBy, {
      title: 'Approuvée !',
      message: `Votre photo a été approuvée : ${photo.title}`,
      type: 'approval_status',
      link: `/tounesna/${photo._id}`
    });
  } else if (status === 'rejected') {
    await notifyUser(photo.createdBy, {
      title: 'Rejetée !',
      message: `Votre photo a été rejetée : ${photo.title}`,
      type: 'approval_status',
      link: `/profile`
    });
  }

  // Réponse de succès finale avec les détails de la photo
  res.status(200).json({
    status: 'success',
    message: `Le statut de la photo a été changé en ${status}!`,
    data: { photo },
  });
});

// Exportation des fonctions de gestion de photos pour l'utilisation dans les routes
module.exports = {
  uploadPhoto,
  getAllPhotos,
  updatePhoto,
  deletePhoto,
  approvePhoto,
};
