// Importation des modèles de la base de données
const { Pack, Photo, Content, AuditLog } = require('../models');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Fonction pour créer un nouveau pack
const createPack = asyncHandler(async (req, res, next) => {
  // Extraire les données du pack depuis le corps de la requête
  const { title, description, photoIds, contentIds, priceTND, regionTag, type, membershipFeatures } = req.body;

  // Si le pack est de type collection, vérifier que les photos et contenus existent
  if (type === 'collection') {
    // Vérifier l'existence des photos si des identifiants sont fournis
    if (photoIds && photoIds.length > 0) {
      const photos = await Photo.find({ _id: { $in: photoIds } });
      // Si le nombre trouvé ne correspond pas, certaines photos sont manquantes
      if (photos.length !== photoIds.length) {
        return next(new AppError('Certaines photos sont introuvables !', 400));
      }
    }

    // Vérifier l'existence des contenus si des identifiants sont fournis
    if (contentIds && contentIds.length > 0) {
      const contents = await Content.find({ _id: { $in: contentIds } });
      // Si le nombre trouvé ne correspond pas, certains contenus sont manquants
      if (contents.length !== contentIds.length) {
        return next(new AppError('Certains contenus sont introuvables !', 400));
      }
    }
  }

  // Créer le pack dans la base de données
  const pack = await Pack.create({
    title,
    description,
    // Définir le type par défaut à "collection"
    type: type || 'collection',
    membershipFeatures,
    // Ajouter les photos seulement si le type est collection
    photoIds: type === 'collection' ? (photoIds || []) : [],
    // Ajouter les contenus seulement si le type est collection
    contentIds: type === 'collection' ? (contentIds || []) : [],
    // Convertir le prix en nombre décimal
    priceTND: parseFloat(priceTND) || 0,
    regionTag,
    // Utiliser la première photo comme couverture si disponible
    coverPhotoId: (type === 'collection' && photoIds && photoIds.length > 0) ? photoIds[0] : null,
    // Enregistrer l'utilisateur qui a créé le pack
    createdBy: req.user._id,
  });

  // Si le type est collection, mettre à jour les photos et contenus pour les lier au pack
  if (type === 'collection') {
    // Ajouter l'identifiant du pack aux photos associées
    if (photoIds && photoIds.length > 0) {
      await Photo.updateMany(
        { _id: { $in: photoIds } },
        { $addToSet: { packs: pack._id } }
      );
    }
    // Ajouter l'identifiant du pack aux contenus associés
    if (contentIds && contentIds.length > 0) {
      await Content.updateMany(
        { _id: { $in: contentIds } },
        { $addToSet: { packs: pack._id } }
      );
    }
  }

  // Enregistrer l'action dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Pack:${pack._id}`,
    result: 'success',
  });

  // Envoyer la réponse avec le pack créé
  res.status(201).json({
    status: 'success',
    message: 'Pack créé avec succès !',
    data: { pack },
  });
});

// Fonction pour récupérer tous les packs (pour l'administrateur)
const getAllPacks = asyncHandler(async (req, res, _next) => {
  // Extraire les paramètres de pagination, filtre et tri
  const { page = 1, limit = 20, isActive, sort = '-createdAt' } = req.query;

  // Construire le filtre de recherche
  const query = {};
  // Filtrer par statut actif si spécifié
  if (isActive !== undefined) query.isActive = isActive === 'true';

  // Récupérer les packs avec les détails associés
  const packs = await Pack.find(query)
    // Remplir les informations du créateur
    .populate('createdBy', 'name email')
    // Remplir les détails des photos
    .populate('photoIds', 'title imageUrl lowResFileId highResFileId priceTND')
    // Remplir les détails des contenus
    .populate('contentIds', 'title thumbnailFileId price')
    // Trier selon le paramètre spécifié
    .sort(sort)
    // Ignorer les résultats des pages précédentes
    .skip((page - 1) * limit)
    // Limiter le nombre de résultats
    .limit(parseInt(limit, 10));

  // Compter le nombre total de packs correspondants
  const total = await Pack.countDocuments(query);

  // Envoyer la réponse paginée avec les packs
  res.status(200).json({
    status: 'success',
    results: packs.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { packs },
  });
});

// Fonction pour mettre à jour un pack
const updatePack = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant du pack depuis les paramètres
  const { id } = req.params;

  // Rechercher le pack par son identifiant
  const pack = await Pack.findById(id);

  // Si le pack n'existe pas, retourner une erreur 404
  if (!pack) {
    return next(new AppError('Pack introuvable !', 404));
  }

  // Définir les champs autorisés pour la mise à jour
  const allowedUpdates = ['title', 'description', 'photoIds', 'contentIds', 'priceTND', 'regionTag', 'isActive', 'type', 'membershipFeatures'];
  // Construire l'objet de mises à jour
  const updates = {};

  // Parcourir les champs autorisés et récupérer les valeurs fournies
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      // Convertir le prix en nombre décimal
      if (field === 'priceTND') {
        updates[field] = parseFloat(req.body[field]);
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  // Si les photos ou contenus ont changé pour un pack de type collection
  if ((updates.photoIds || updates.contentIds) && (updates.type === 'collection' || pack.type === 'collection')) {
    // Mettre à jour les associations de photos
    if (updates.photoIds) {
      // Retirer le pack des anciennes photos
      await Photo.updateMany({ packs: id }, { $pull: { packs: id } });
      // Ajouter le pack aux nouvelles photos
      await Photo.updateMany({ _id: { $in: updates.photoIds } }, { $addToSet: { packs: id } });
      // Mettre à jour la photo de couverture
      updates.coverPhotoId = updates.photoIds[0] || pack.coverPhotoId;
    }

    // Mettre à jour les associations de contenus
    if (updates.contentIds) {
      // Retirer le pack des anciens contenus
      await Content.updateMany({ packs: id }, { $pull: { packs: id } });
      // Ajouter le pack aux nouveaux contenus
      await Content.updateMany({ _id: { $in: updates.contentIds } }, { $addToSet: { packs: id } });
    }

    // Invalider le fichier ZIP en cache
    updates.cachedZipFileId = null;
    updates.zipGeneratedAt = null;
  }

  // Appliquer les mises à jour au pack
  const updatedPack = await Pack.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // Enregistrer l'action dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Pack:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  // Envoyer la réponse avec le pack mis à jour
  res.status(200).json({
    status: 'success',
    message: 'Pack mis à jour !',
    data: { pack: updatedPack },
  });
});

// Fonction pour supprimer un pack
const deletePack = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant du pack depuis les paramètres
  const { id } = req.params;

  // Rechercher le pack par son identifiant
  const pack = await Pack.findById(id);

  // Si le pack n'existe pas, retourner une erreur 404
  if (!pack) {
    return next(new AppError('Pack introuvable !', 404));
  }

  // Retirer le pack de toutes les photos associées
  await Photo.updateMany(
    { packs: id },
    { $pull: { packs: id } }
  );
  // Retirer le pack de tous les contenus associés
  await Content.updateMany(
    { packs: id },
    { $pull: { packs: id } }
  );

  // Supprimer le pack de la base de données
  await Pack.findByIdAndDelete(id);

  // Enregistrer l'action dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Pack:${id}`,
    result: 'success',
  });

  // Envoyer la réponse de confirmation
  res.status(200).json({
    status: 'success',
    message: 'Pack supprimé !',
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  createPack,
  getAllPacks,
  updatePack,
  deletePack,
};
