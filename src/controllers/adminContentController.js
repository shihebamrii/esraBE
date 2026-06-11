// Importation des modèles Content et AuditLog depuis le dossier des modèles
const { Content, AuditLog } = require('../models');

// Importation des fonctions de stockage pour GridFS
const { uploadToGridFS, deleteFromGridFS } = require('../services/storageService');
const path = require('path');

// Importation de la fonction de création de miniature pour les images
const { createThumbnail } = require('../services/imageProcessor');

// Importation de la fonction qui assure la compatibilité des codecs vidéo
const { ensureCompatibleCodec } = require('../services/videoProcessor');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation des fonctions pour envoyer des notifications aux utilisateurs
const { notifyAllUsers, notifyUser } = require('../services/notificationService');

// Importation de l'utilitaire de parsing JSON sécurisé
const { safeParseJSON } = require('../utils/safeParser');

// Déclaration de la fonction de téléchargement de contenu
const uploadContent = asyncHandler(async (req, res, next) => {
  // Vérification de la présence des fichiers dans la requête
  if (!req.files || !req.files.file || req.files.file.length === 0) {
    // Si aucun fichier n'est présent, on retourne une erreur 400
    return next(new AppError('Le fichier est obligatoire !', 400));
  }

  // Récupération du fichier principal
  const mainFile = req.files.file[0];
  // Récupération de la miniature si elle existe
  const thumbnailFile = req.files.thumbnail?.[0];

  // Initialisation du type de contenu
  let contentType;
  // Initialisation du buffer vidéo final
  let finalVideoBuffer = mainFile.buffer;
  // Initialisation des métadonnées vidéo vides
  let videoMetadata = {};
  let mainFileMimetype = mainFile.mimetype;
  let mainFileOriginalname = mainFile.originalname;

  // Vérification si le fichier est une vidéo
  if (mainFile.mimetype.startsWith('video/')) {
    // Choix du type de contenu : reel ou vidéo classique
    contentType = mainFile.mimetype.includes('reel') ? 'reel' : 'video';
    
    // Encodage de la vidéo si son codec est HEVC ou conteneur incompatible
    const processed = await ensureCompatibleCodec(mainFile.buffer, mainFile.originalname);
    // Sauvegarde du buffer traité
    finalVideoBuffer = processed.buffer;
    // Sauvegarde des métadonnées de la vidéo
    videoMetadata = processed.info;

    if (processed.transcoded) {
      mainFileMimetype = 'video/mp4';
      const parsedPath = path.parse(mainFile.originalname);
      mainFileOriginalname = `${parsedPath.name}.mp4`;
    }
  } else if (mainFile.mimetype.startsWith('audio/')) {
    // Choix du type de contenu si c'est un fichier audio
    contentType = 'audio';
  } else {
    // Si le type de fichier n'est ni vidéo ni audio, on retourne une erreur
    return next(new AppError("Le type de fichier n'est pas supporté !", 400));
  }

  // Téléchargement du fichier principal dans le stockage GridFS
  const fileFileId = await uploadToGridFS(
    finalVideoBuffer,
    mainFileOriginalname,
    mainFileMimetype,
    {
      uploadedBy: req.user._id,
      type: 'content',
      codec: videoMetadata.codec,
    }
  );

  // Initialisation de l'identifiant de la miniature à nul
  let thumbnailFileId = null;
  // Si une miniature est fournie, on procède au traitement
  if (thumbnailFile) {
    // Redimensionnement de la miniature avec des dimensions spécifiques
    const thumbnailBuffer = await createThumbnail(thumbnailFile.buffer, {
      width: 640,
      height: 360,
      fit: 'cover',
    });

    // Téléchargement de la miniature traitée dans GridFS
    thumbnailFileId = await uploadToGridFS(
      thumbnailBuffer,
      `thumb_${mainFile.originalname}.jpg`,
      'image/jpeg',
      {
        uploadedBy: req.user._id,
        type: 'thumbnail',
      }
    );
  }

  // Récupération des données textuelles depuis le corps de la requête
  const {
    title,
    description,
    authors,
    type,
    themes,
    region,
    tags,
    language,
    duration,
    rights,
    price,
    pricePersonal,
    priceCommercial,
    licenseInfo,
    visibility,
    metadata,
  } = req.body;

  // Création du document Content dans la base de données MongoDB
  const content = await Content.create({
    title,
    description,
    authors: safeParseJSON(authors),
    type: type || contentType,
    themes: safeParseJSON(themes),
    region,
    tags: safeParseJSON(tags),
    language: language || 'ar',
    duration: duration ? parseFloat(duration) : undefined,
    thumbnailFileId,
    fileFileId,
    rights: rights === 'premium' ? 'paid' : (rights || 'free'),
    price: price ? parseFloat(price) : (pricePersonal ? parseFloat(pricePersonal) : 0),
    pricePersonal: pricePersonal ? parseFloat(pricePersonal) : (price ? parseFloat(price) : 0),
    priceCommercial: priceCommercial ? parseFloat(priceCommercial) : 0,
    licenseInfo,
    visibility: visibility || 'public',
    createdBy: req.user._id,
    approvalStatus: 'approved',
    publishedAt: visibility === 'public' ? new Date() : undefined,
    metadata: safeParseJSON(metadata, {}),
    fileInfo: {
      filename: mainFileOriginalname,
      contentType: mainFileMimetype,
      size: finalVideoBuffer.length,
      duration: videoMetadata.duration || duration,
      width: videoMetadata.width,
      height: videoMetadata.height,
      codec: videoMetadata.codec,
    },
  });

  // Enregistrement de l'action de création dans les journaux d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${content._id}`,
    result: 'success',
  });

  // Notification envoyée à tous les utilisateurs enregistrés
  await notifyAllUsers({
    title: 'Nouveau contenu !',
    message: `Nouveau contenu ajouté : ${title}`,
    type: 'new_content',
    link: `/content/${content._id}`
  });

  // Envoi de la réponse HTTP de succès avec statut 201
  res.status(201).json({
    status: 'success',
    message: 'Contenu téléchargé avec succès !',
    data: { content },
  });
});

// Déclaration de la fonction pour obtenir tous les contenus
const getAllContent = asyncHandler(async (req, res, _next) => {
  // Récupération des paramètres de pagination et de tri
  const { page = 1, limit = 20, type, visibility, sort = '-createdAt' } = req.query;

  // Initialisation de l'objet de requête de filtrage
  const query = {};
  // Filtrage par type si spécifié
  if (type) query.type = type;
  // Filtrage par visibilité si spécifié
  if (visibility) query.visibility = visibility;

  // Recherche des contenus correspondants dans la base de données
  const contents = await Content.find(query)
    .populate('createdBy', 'name email role')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Comptage du nombre total de documents correspondants
  const total = await Content.countDocuments(query);

  // Envoi de la liste des contenus trouvés avec les informations de pagination
  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents },
  });
});

// Déclaration de la fonction pour mettre à jour un contenu existant
const updateContent = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant du contenu à mettre à jour
  const { id } = req.params;

  // Recherche du contenu dans la base de données
  const content = await Content.findById(id);

  // Si le contenu n'existe pas, on renvoie une erreur 404
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // Vérification des droits d'accès de l'utilisateur
  if (
    req.user.role !== 'admin' &&
    content.createdBy.toString() !== req.user._id.toString()
  ) {
    // Si l'utilisateur n'est ni admin ni créateur du contenu, on renvoie une erreur 403
    return next(new AppError("Vous n'avez pas la permission de modifier ce contenu !", 403));
  }

  // Liste des champs autorisés à la mise à jour
  const allowedUpdates = [
    'title',
    'description',
    'authors',
    'themes',
    'region',
    'tags',
    'language',
    'rights',
    'price',
    'pricePersonal',
    'priceCommercial',
    'licenseInfo',
    'visibility',
    'type',
    'duration',
    'metadata',
  ];

  // Initialisation de l'objet contenant les mises à jour
  const updates = {};
  // Parcours des champs autorisés pour collecter les nouvelles valeurs
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      // Analyse et conversion sécurisée pour les formats spécifiques
      if (['authors', 'themes', 'tags', 'metadata'].includes(field) && typeof req.body[field] === 'string') {
        updates[field] = safeParseJSON(req.body[field], field === 'metadata' ? {} : []);
      } else if (['price', 'pricePersonal', 'priceCommercial', 'duration'].includes(field)) {
        updates[field] = parseFloat(req.body[field]) || 0;
      } else if (field === 'rights') {
        updates[field] = req.body[field] === 'premium' ? 'paid' : req.body[field];
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  // Keep price and pricePersonal synchronized
  if (updates.pricePersonal !== undefined) {
    updates.price = updates.pricePersonal;
  } else if (updates.price !== undefined) {
    updates.pricePersonal = updates.price;
  }

  // Gestion du téléchargement des nouveaux fichiers
  const mainFile = req.files?.file?.[0];
  const thumbnailFile = req.files?.thumbnail?.[0];

  if (mainFile) {
    let finalVideoBuffer = mainFile.buffer;
    let videoMetadata = {};
    let mainFileMimetype = mainFile.mimetype;
    let mainFileOriginalname = mainFile.originalname;

    if (mainFile.mimetype.startsWith('video/')) {
      const processed = await ensureCompatibleCodec(mainFile.buffer, mainFile.originalname);
      finalVideoBuffer = processed.buffer;
      videoMetadata = processed.info;

      if (processed.transcoded) {
        mainFileMimetype = 'video/mp4';
        const parsedPath = path.parse(mainFile.originalname);
        mainFileOriginalname = `${parsedPath.name}.mp4`;
      }
    }

    // Supprimer l'ancien fichier de GridFS s'il existe
    if (content.fileFileId) {
      try {
        await deleteFromGridFS(content.fileFileId);
      } catch (err) {
        console.error("Failed to delete old file file from GridFS:", err);
      }
    }

    // Télécharger le nouveau fichier dans GridFS
    const fileFileId = await uploadToGridFS(
      finalVideoBuffer,
      mainFileOriginalname,
      mainFileMimetype,
      {
        uploadedBy: req.user._id,
        type: 'content',
        codec: videoMetadata.codec,
      }
    );

    updates.fileFileId = fileFileId;
    updates.fileInfo = {
      filename: mainFileOriginalname,
      contentType: mainFileMimetype,
      size: finalVideoBuffer.length,
      duration: videoMetadata.duration || parseFloat(req.body.duration) || content.duration,
      width: videoMetadata.width,
      height: videoMetadata.height,
      codec: videoMetadata.codec,
    };
    if (videoMetadata.duration) {
      updates.duration = videoMetadata.duration;
    }
  }

  if (thumbnailFile) {
    // Supprimer l'ancienne miniature de GridFS s'il existe
    if (content.thumbnailFileId) {
      try {
        await deleteFromGridFS(content.thumbnailFileId);
      } catch (err) {
        console.error("Failed to delete old thumbnail file from GridFS:", err);
      }
    }

    const thumbnailBuffer = await createThumbnail(thumbnailFile.buffer, {
      width: 640,
      height: 360,
      fit: 'cover',
    });

    const thumbnailFileId = await uploadToGridFS(
      thumbnailBuffer,
      `thumb_${mainFile ? mainFile.originalname : content.title}.jpg`,
      'image/jpeg',
      {
        uploadedBy: req.user._id,
        type: 'thumbnail',
      }
    );

    updates.thumbnailFileId = thumbnailFileId;
  }

  // Mise à jour de la date de publication si la visibilité passe au public
  if (updates.visibility === 'public' && content.visibility !== 'public') {
    updates.publishedAt = new Date();
  }

  // Exécution de la mise à jour dans la base de données MongoDB
  const updatedContent = await Content.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // Enregistrement de l'action de mise à jour dans les journaux d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  // Envoi de la réponse avec le contenu mis à jour
  res.status(200).json({
    status: 'success',
    message: 'Contenu mis à jour !',
    data: { content: updatedContent },
  });
});

// Déclaration de la fonction pour supprimer un contenu
const deleteContent = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant du contenu
  const { id } = req.params;

  // Recherche du contenu à supprimer
  const content = await Content.findById(id);

  // Si le contenu n'existe pas, on renvoie une erreur 404
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // Suppression du fichier principal de GridFS s'il existe
  if (content.fileFileId) {
    await deleteFromGridFS(content.fileFileId);
  }
  // Suppression de la miniature de GridFS si elle existe
  if (content.thumbnailFileId) {
    await deleteFromGridFS(content.thumbnailFileId);
  }

  // Suppression définitive du document de la base de données
  await Content.findByIdAndDelete(id);

  // Enregistrement de la suppression dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${id}`,
    result: 'success',
  });

  // Envoi de la réponse de succès après suppression
  res.status(200).json({
    status: 'success',
    message: 'Contenu supprimé !',
  });
});

// Déclaration de la fonction de validation d'un contenu par l'administrateur
const approveContent = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant du contenu
  const { id } = req.params;
  // Récupération du statut d'approbation désiré
  const { status } = req.body;

  // Vérification de la validité du statut d'approbation
  if (!['approved', 'rejected'].includes(status)) {
    return next(new AppError("Le statut doit être 'approved' ou 'rejected' !", 400));
  }

  // Recherche du contenu dans la base de données
  const content = await Content.findById(id);

  // Si le contenu n'existe pas, on renvoie une erreur 404
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // Mise à jour du statut d'approbation
  content.approvalStatus = status;
  // Sauvegarde des modifications en désactivant la validation automatique
  await content.save({ validateBeforeSave: false });

  // Enregistrement de l'action dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_APPROVE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${id}`,
    details: { status },
    result: 'success',
  });

  // Envoi d'une notification ciblée à l'utilisateur créateur selon le choix d'approbation
  if (status === 'approved') {
    await notifyUser(content.createdBy, {
      title: 'Approuvée !',
      message: `Votre contenu a été approuvé : ${content.title}`,
      type: 'approval_status',
      link: `/content/${content._id}`
    });
  } else if (status === 'rejected') {
    await notifyUser(content.createdBy, {
      title: 'Rejetée !',
      message: `Votre contenu a été rejeté : ${content.title}`,
      type: 'approval_status',
      link: `/profile`
    });
  }

  // Envoi de la réponse HTTP finale indiquant le succès du changement
  res.status(200).json({
    status: 'success',
    message: `Le statut du contenu a été changé en ${status}!`,
    data: { content },
  });
});

// Exportation de l'ensemble des fonctions du contrôleur pour utilisation externe
module.exports = {
  uploadContent,
  getAllContent,
  updateContent,
  deleteContent,
  approveContent,
};
