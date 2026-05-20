// Importation des modèles Photo, Pack et AuditLog
const { Photo, Pack, AuditLog } = require('../models');
// Importation des fonctions de stockage pour gérer les fichiers
const { uploadToGridFS, getFileInfo, getDownloadStream } = require('../services/storageService');
// Importation des fonctions de traitement d'images
const { createLowResVersion, addTiledWatermark, getImageInfo } = require('../services/imageProcessor');
// Importation de la fonction de traitement vidéo pour la compatibilité des codecs
const { ensureCompatibleCodec } = require('../services/videoProcessor');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la fonction utilitaire pour parser le JSON en toute sécurité
const { safeParseJSON } = require('../utils/safeParser');

// Fonction pour récupérer la liste des photos avec des filtres
const getPhotos = asyncHandler(async (req, res, _next) => {
  // Extraire les paramètres de requête avec des valeurs par défaut
  const {
    page = 1,
    limit = 20,
    governorate,
    landscapeType,
    minPrice,
    maxPrice,
    freeOnly,
    approvalStatus,
    sort = '-createdAt',
    source,
    userId,
  } = req.query;

  // Construire le filtre de recherche
  const query = {};
  // Filtrer par statut d'approbation si spécifié
  if (approvalStatus && approvalStatus !== 'all') {
    query.approvalStatus = approvalStatus;
  } else if (!approvalStatus) {
    // Par défaut, afficher uniquement les photos approuvées
    query.approvalStatus = 'approved';
  }

  // Ajouter le filtre par gouvernorat si spécifié
  if (governorate) query.governorate = governorate;
  // Ajouter le filtre par type de paysage si spécifié
  if (landscapeType) query.landscapeType = landscapeType;
  // Ajouter le filtre par créateur si un identifiant utilisateur est fourni
  if (userId) {
    try {
      const mongoose = require('mongoose');
      query.createdBy = new mongoose.Types.ObjectId(userId);
    } catch(e) {
      console.log('Error parsing objectId:', e);
    }
  }

  // Ajouter le filtre par plage de prix si spécifié
  if (minPrice || maxPrice) {
    query.priceTND = {};
    if (minPrice) query.priceTND.$gte = parseFloat(minPrice);
    if (maxPrice) query.priceTND.$lte = parseFloat(maxPrice);
  }

  // Filtrer uniquement les photos gratuites si demandé
  if (freeOnly === 'true') query.priceTND = 0;

  // Afficher le filtre dans la console pour le débogage
  console.log('Query:', query);

  // Construire le pipeline d'agrégation pour le filtrage par source
  let aggregationPipeline = [{ $match: query }];

  // Ajouter une jointure avec la collection des utilisateurs si un filtre par source est spécifié
  if (source && source !== 'all') {
    aggregationPipeline.push(
      {
        // Joindre la collection des utilisateurs
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      {
        // Filtrer par rôle du créateur (admin = officiel, autre = communautaire)
        $match: {
          'creator.role': source === 'official' ? 'admin' : { $ne: 'admin' },
        },
      }
    );
  }

  // Compter le nombre total de documents correspondants
  const countPipeline = [...aggregationPipeline, { $count: 'total' }];
  const countResult = await Photo.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Ajouter la pagination et la projection au pipeline
  aggregationPipeline.push(
    {
      // Joindre la collection des utilisateurs pour les informations du créateur
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'creator',
      },
    },
    {
      // Ajouter un champ "source" basé sur le rôle du créateur
      $addFields: {
        source: {
          $cond: {
            if: { $eq: [{ $arrayElemAt: ['$creator.role', 0] }, 'admin'] },
            then: 'official',
            else: 'community',
          },
        },
      },
    },
    {
      // Sélectionner les champs à inclure dans les résultats
      $project: {
        title: 1,
        description: 1,
        governorate: 1,
        landscapeType: 1,
        mediaType: 1,
        priceTND: 1,
        pricePersonalTND: 1,
        priceCommercialTND: 1,
        lowResFileId: 1,
        highResFileId: 1,
        imageUrl: 1,
        tags: 1,
        createdAt: 1,
        createdBy: 1,
        source: 1,
        'creator.name': 1,
        'creator.role': 1,
      },
    },
    // Appliquer le tri spécifié
    { $sort: sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 } },
    // Ignorer les résultats des pages précédentes
    { $skip: (page - 1) * limit },
    // Limiter le nombre de résultats
    { $limit: parseInt(limit, 10) }
  );

  // Exécuter le pipeline d'agrégation
  const photos = await Photo.aggregate(aggregationPipeline);

  // Ajouter les URLs d'aperçu et les informations du créateur
  const photosWithUrls = photos.map(photo => {
    const obj = { ...photo };
    // Utiliser l'URL existante ou construire l'URL d'aperçu
    if (photo.imageUrl) {
      obj.previewUrl = photo.imageUrl;
    } else {
      obj.previewUrl = `/api/photos/${photo._id}/preview`;
    }
    // Pour les vidéos, inclure l'URL haute résolution
    if (photo.mediaType === 'video' && photo.highResFileId) {
      obj.highResUrl = `/api/media/${photo.highResFileId}`;
    }
    // Ajouter le nom du créateur si disponible
    if (photo.creator && photo.creator.length > 0) {
      obj.creatorName = photo.creator[0].name;
    }
    return obj;
  });

  // Envoyer la réponse paginée avec les photos
  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos: photosWithUrls },
  });
});

// Fonction pour récupérer les détails d'une seule photo
const getPhoto = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la photo depuis les paramètres
  const { id } = req.params;

  // Rechercher la photo avec les détails du créateur et des packs associés
  const photo = await Photo.findById(id)
    .populate('createdBy', 'name role profilePictureFileId')
    .populate('packs', 'title priceTND');

  // Si la photo n'existe pas, retourner une erreur 404
  if (!photo) {
    return next(new AppError('Photo introuvable !', 404));
  }

  // Convertir le document Mongoose en objet simple
  const obj = photo.toObject();
  // Ajouter l'URL d'aperçu
  if (photo.imageUrl) {
    obj.previewUrl = photo.imageUrl;
  } else {
    obj.previewUrl = `/api/photos/${photo._id}/preview`;
  }
  // Pour les vidéos, ajouter l'URL haute résolution
  if (photo.mediaType === 'video' && photo.highResFileId) {
    obj.highResUrl = `/api/media/${photo.highResFileId}`;
  }

  // Envoyer la réponse avec les détails de la photo
  res.status(200).json({
    status: 'success',
    data: { photo: obj },
  });
});

// Fonction pour servir l'aperçu d'une photo (basse résolution avec filigrane)
const getPhotoPreview = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la photo depuis les paramètres
  const { id } = req.params;

  // Rechercher la photo par son identifiant
  const photo = await Photo.findById(id);

  // Si la photo n'existe pas, retourner une erreur 404
  if (!photo) {
    return next(new AppError('Photo introuvable !', 404));
  }

  // Utiliser la version basse résolution si disponible, sinon la haute résolution
  const fileId = photo.lowResFileId || photo.highResFileId;

  // Récupérer les informations du fichier
  const fileInfo = await getFileInfo(fileId);

  // Si le fichier n'existe pas, retourner une erreur 404
  if (!fileInfo) {
    return next(new AppError('Fichier de la photo introuvable !', 404));
  }

  // Incrémenter le compteur de téléchargements d'aperçu
  photo.previewDownloads += 1;
  // Sauvegarder sans validation pour éviter les erreurs
  await photo.save({ validateBeforeSave: false });

  // Enregistrer l'aperçu dans le journal d'audit
  await AuditLog.log({
    userId: req.user?._id,
    action: 'PHOTO_PREVIEW',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    result: 'success',
  });

  // Définir les en-têtes de la réponse pour l'image
  res.set({
    'Content-Type': fileInfo.contentType || 'image/jpeg',
    'Content-Length': fileInfo.length,
    'Cache-Control': 'public, max-age=86400',
  });

  // Créer un flux de lecture et envoyer l'image
  const downloadStream = getDownloadStream(fileId);
  downloadStream.pipe(res);
});

// Fonction pour récupérer la liste des packs actifs
const getPacks = asyncHandler(async (req, res, _next) => {
  // Extraire les paramètres de pagination et de filtre
  const { page = 1, limit = 20, regionTag, sort = '-createdAt' } = req.query;

  // Construire le filtre pour les packs actifs
  const query = { isActive: true };
  // Ajouter le filtre par tag de région si spécifié
  if (regionTag) query.regionTag = regionTag;

  // Compter le nombre total de packs correspondants
  const total = await Pack.countDocuments(query);

  // Récupérer les packs paginés avec les détails de la photo de couverture
  const packs = await Pack.find(query)
    .populate('coverPhotoId', 'lowResFileId')
    .select('title description priceTND regionTag photoIds purchases')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Ajouter le nombre de photos à chaque pack
  const packsWithInfo = packs.map((pack) => {
    const obj = pack.toObject();
    obj.photoCount = pack.photoIds.length;
    return obj;
  });

  // Envoyer la réponse paginée avec les packs
  res.status(200).json({
    status: 'success',
    results: packs.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { packs: packsWithInfo },
  });
});

// Fonction pour récupérer les détails d'un seul pack
const getPack = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant du pack depuis les paramètres
  const { id } = req.params;

  // Rechercher le pack avec les détails de ses photos
  const pack = await Pack.findById(id)
    .populate('photoIds', 'title lowResFileId priceTND governorate landscapeType');

  // Si le pack n'existe pas ou n'est pas actif, retourner une erreur 404
  if (!pack || !pack.isActive) {
    return next(new AppError('Pack introuvable !', 404));
  }

  // Calculer le prix total des photos individuelles
  const individualTotal = pack.photoIds.reduce((sum, photo) => sum + (photo.priceTND || 0), 0);
  // Calculer l'économie réalisée par rapport à l'achat individuel
  const savings = Math.max(0, individualTotal - pack.priceTND);

  // Convertir en objet et ajouter les informations d'économie
  const obj = pack.toObject();
  obj.savings = savings;
  obj.individualTotal = individualTotal;

  // Envoyer la réponse avec les détails du pack
  res.status(200).json({
    status: 'success',
    data: { pack: obj },
  });
});

// Fonction pour récupérer les gouvernorats disponibles avec le nombre de photos
const getGovernorates = asyncHandler(async (req, res, _next) => {
  // Agréger les photos par gouvernorat et compter le nombre pour chacun
  const governorates = await Photo.aggregate([
    { $group: { _id: '$governorate', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Envoyer la réponse avec la liste des gouvernorats
  res.status(200).json({
    status: 'success',
    data: { governorates },
  });
});

// Fonction pour récupérer les types de paysages disponibles avec le nombre de photos
const getLandscapeTypes = asyncHandler(async (req, res, _next) => {
  // Agréger les photos par type de paysage et compter le nombre pour chacun
  const landscapeTypes = await Photo.aggregate([
    { $group: { _id: '$landscapeType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Envoyer la réponse avec la liste des types de paysages
  res.status(200).json({
    status: 'success',
    data: { landscapeTypes },
  });
});

// Fonction pour téléverser une photo (utilisateur normal)
const uploadPhoto = asyncHandler(async (req, res, next) => {
  // Récupérer le fichier haute résolution depuis la requête
  const highResFile = req.files?.highRes?.[0] || req.file;
  // Récupérer le fichier basse résolution optionnel
  const lowResFile = req.files?.lowRes?.[0];

  // Vérifier que le fichier haute résolution est fourni
  if (!highResFile) {
    return next(new AppError('La photo en haute résolution ou la vidéo est obligatoire !', 400));
  }

  // Vérifier si le fichier est une vidéo
  const isVideo = highResFile.mimetype.startsWith('video/');

  // Initialiser le buffer final pour le fichier haute résolution
  let finalHighResBuffer = highResFile.buffer;
  // Initialiser les métadonnées vidéo
  let videoMetadata = {};

  // Si c'est une vidéo, transcoder si nécessaire
  if (isVideo) {
    const processed = await ensureCompatibleCodec(highResFile.buffer, highResFile.originalname);
    finalHighResBuffer = processed.buffer;
    videoMetadata = processed.info;
  }

  // Pour les vidéos, exiger une miniature séparée
  if (isVideo && !lowResFile) {
    return next(new AppError('Pour la vidéo, veuillez télécharger une miniature (Thumbnail) !', 400));
  }

  // Récupérer les informations du fichier haute résolution
  let highResInfo = isVideo ? videoMetadata : {};
  if (!isVideo) {
    highResInfo = await getImageInfo(highResFile.buffer);
  }

  // Téléverser le fichier haute résolution vers GridFS
  const highResFileId = await uploadToGridFS(
    finalHighResBuffer,
    highResFile.originalname,
    highResFile.mimetype,
    {
      uploadedBy: req.user._id,
      type: isVideo ? 'photo-video' : 'photo-highres',
      codec: videoMetadata.codec,
      ...highResInfo,
    }
  );

  // Initialiser les variables pour la version basse résolution
  let lowResBuffer;
  let lowResInfo;

  // Si un fichier basse résolution est fourni, l'utiliser directement
  if (lowResFile) {
    lowResBuffer = lowResFile.buffer;
    lowResInfo = await getImageInfo(lowResBuffer);
  } else {
    // Sinon, créer une version basse résolution automatiquement
    const lowResResult = await createLowResVersion(highResFile.buffer, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 70,
      format: 'jpeg',
    });
    lowResBuffer = lowResResult.buffer;
    lowResInfo = lowResResult.info;
  }

  // Définir le texte du filigrane
  const watermarkText = req.body.attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable';
  // Ajouter un filigrane en mosaïque sur la version basse résolution
  const watermarkedBuffer = await addTiledWatermark(lowResBuffer, watermarkText, {
    fontSize: 16,
    opacity: 0.3,
    spacing: 200,
  });

  // Téléverser la version basse résolution avec filigrane vers GridFS
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

  // Extraire les métadonnées de la photo depuis le corps de la requête
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

  // Parser les tags fournis par l'utilisateur
  let finalTags = safeParseJSON(tags) || [];

  // Créer la photo dans la base de données
  const photo = await Photo.create({
    // Définir le type de média (photo ou vidéo)
    mediaType: isVideo ? 'video' : 'photo',
    title,
    description,
    governorate,
    landscapeType,
    lowResFileId,
    highResFileId,
    // Définir les prix avec des valeurs par défaut à 0
    priceTND: parseFloat(pricePersonalTND || priceTND) || 0,
    pricePersonalTND: parseFloat(pricePersonalTND || priceTND) || 0,
    priceCommercialTND: parseFloat(priceCommercialTND) || 0,
    // Activer le filigrane sauf si explicitement désactivé
    watermark: watermark !== 'false',
    attributionText: attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable',
    // Enregistrer le créateur
    createdBy: req.user._id,
    // Les photos des utilisateurs sont toujours en attente d'approbation
    approvalStatus: 'pending',
    tags: finalTags,
    // Stocker les informations techniques des fichiers
    fileInfo: {
      highRes: {
        filename: highResFile.originalname,
        contentType: highResFile.mimetype,
        size: finalHighResBuffer.length,
        width: highResInfo.width,
        height: highResInfo.height,
        duration: videoMetadata.duration,
        codec: videoMetadata.codec
      },
      lowRes: { filename: `lowres_${highResFile.originalname}`, contentType: 'image/jpeg', size: watermarkedBuffer.length, width: lowResInfo.width, height: lowResInfo.height },
    },
  });

  // Enregistrer le téléversement dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_USER_UPLOAD',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${photo._id}`,
    result: 'success',
  });

  // Envoyer la réponse avec la photo créée
  res.status(201).json({
    status: 'success',
    message: "Photo téléchargée, en attente d'approbation !",
    data: { photo },
  });
});

// Fonction pour récupérer les photos de l'utilisateur connecté
const getMyPhotos = asyncHandler(async (req, res, _next) => {
  // Extraire les paramètres de pagination, statut et recherche
  const { page = 1, limit = 20, status, search } = req.query;

  // Construire le filtre de base par créateur
  const query = { createdBy: req.user._id };
  // Ajouter un filtre par statut d'approbation si spécifié
  if (status && status !== 'all') query.approvalStatus = status;

  // Construire la requête de recherche avec les champs sélectionnés
  let photosQuery = Photo.find(query)
    .select('title description governorate landscapeType mediaType priceTND pricePersonalTND priceCommercialTND lowResFileId highResFileId tags createdAt approvalStatus')
    .sort({ createdAt: -1 });

  // Ajouter un filtre de recherche textuelle si fourni
  if (search) {
    photosQuery = photosQuery.find({
      ...query,
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ],
    });
  }

  // Compter le nombre total de photos correspondantes
  const total = await Photo.countDocuments(query);

  // Exécuter la requête avec pagination
  const photos = await photosQuery
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Ajouter les URLs d'aperçu à chaque photo
  const photosWithUrls = photos.map(photo => {
    const obj = photo.toObject();
    obj.previewUrl = photo.imageUrl || `/api/photos/${photo._id}/preview`;
    return obj;
  });

  // Envoyer la réponse paginée
  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos: photosWithUrls },
  });
});

// Fonction pour mettre à jour une photo de l'utilisateur
const updateMyPhoto = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la photo depuis les paramètres
  const { id } = req.params;

  // Rechercher la photo appartenant à l'utilisateur connecté
  const photo = await Photo.findOne({ _id: id, createdBy: req.user._id });

  // Si la photo n'existe pas ou n'appartient pas à l'utilisateur, retourner une erreur
  if (!photo) {
    return next(new AppError('Photo introuvable ou non autorisé !', 404));
  }

  // Définir les champs autorisés pour la mise à jour
  const allowedUpdates = ['title', 'description', 'governorate', 'landscapeType', 'pricePersonalTND', 'priceCommercialTND', 'tags', 'attributionText'];

  // Construire l'objet de mises à jour avec les valeurs fournies
  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      // Convertir les prix en nombres décimaux
      if (field === 'pricePersonalTND' || field === 'priceCommercialTND') {
        updates[field] = parseFloat(req.body[field]) || 0;
      } else if (field === 'tags') {
        // Parser les tags depuis une chaîne ou un tableau
        updates[field] = typeof req.body[field] === 'string'
          ? req.body[field].split(',').map(t => t.trim()).filter(Boolean)
          : req.body[field];
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  // Appliquer les mises à jour à la photo
  const updatedPhoto = await Photo.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // Enregistrer la mise à jour dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_USER_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  // Envoyer la réponse avec la photo mise à jour
  res.status(200).json({
    status: 'success',
    message: 'Photo mise à jour avec succès !',
    data: { photo: updatedPhoto },
  });
});

// Fonction pour supprimer une photo de l'utilisateur
const deleteMyPhoto = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la photo depuis les paramètres
  const { id } = req.params;

  // Rechercher la photo appartenant à l'utilisateur connecté
  const photo = await Photo.findOne({ _id: id, createdBy: req.user._id });

  // Si la photo n'existe pas ou n'appartient pas à l'utilisateur, retourner une erreur
  if (!photo) {
    return next(new AppError('Photo introuvable ou non autorisé !', 404));
  }

  // Supprimer le fichier haute résolution de GridFS si existant
  if (photo.highResFileId) await deleteFromGridFS(photo.highResFileId);
  // Supprimer le fichier basse résolution de GridFS si existant
  if (photo.lowResFileId) await deleteFromGridFS(photo.lowResFileId);

  // Supprimer la photo de la base de données
  await Photo.findByIdAndDelete(id);

  // Enregistrer la suppression dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_USER_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    result: 'success',
  });

  // Envoyer la réponse de confirmation
  res.status(200).json({
    status: 'success',
    message: 'Photo supprimée avec succès !',
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  getPhotos,
  getPhoto,
  getPhotoPreview,
  getPacks,
  getPack,
  getGovernorates,
  getLandscapeTypes,
  uploadPhoto,
  getMyPhotos,
  updateMyPhoto,
  deleteMyPhoto,
};
