// Importation des modèles Playlist, Content et AuditLog depuis le dossier des modèles
const { Playlist, Content, AuditLog } = require('../models');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction pour obtenir toutes les playlists (administration)
const getAllPlaylists = asyncHandler(async (req, res, next) => {
  // Extraction des paramètres de pagination, type et recherche depuis la requête
  const { page = 1, limit = 20, type, search } = req.query;

  // Initialisation de l'objet de filtrage
  const query = {};
  // Filtrage par type si spécifié
  if (type) query.type = type;
  // Filtrage par section si spécifié
  if (req.query.section) query.section = req.query.section;
  // Recherche textuelle dans le titre ou la description si un terme est fourni
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Comptage du nombre total de playlists correspondant aux filtres
  const total = await Playlist.countDocuments(query);
  // Recherche des playlists avec jointure sur les éléments associés, tri et pagination
  const playlists = await Playlist.find(query)
    .populate('items.contentId', 'title type thumbnailFileId')
    .populate('photoItems.photoId', 'title mediaType lowResFileId governorate landscapeType')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Envoi de la réponse avec les playlists et les informations de pagination
  res.status(200).json({
    status: 'success',
    results: playlists.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { playlists },
  });
});

// Déclaration de la fonction pour créer une nouvelle playlist
const createPlaylist = asyncHandler(async (req, res, next) => {
  // Extraction des données de la playlist depuis le corps de la requête
  const { title, description, type, section, items, photoItems, themes, region, tags, thumbnailFileId } = req.body;

  // Création du document Playlist dans la base de données MongoDB
  const playlist = await Playlist.create({
    title,
    description,
    type: type || 'series',
    section: section || 'impact',
    items: items || [],
    photoItems: photoItems || [],
    themes,
    region,
    tags,
    thumbnailFileId,
    createdBy: req.user._id,
  });

  // Enregistrement de la création dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PLAYLIST_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Playlist:${playlist._id}`,
    result: 'success',
  });

  // Envoi de la réponse de création réussie avec le document playlist
  res.status(201).json({
    status: 'success',
    message: 'Liste de lecture créée avec succès !',
    data: { playlist },
  });
});

// Déclaration de la fonction pour mettre à jour une playlist existante
const updatePlaylist = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de la playlist depuis les paramètres de la route
  const { id } = req.params;
  // Liste des champs autorisés à la mise à jour
  const allowedUpdates = ['title', 'description', 'type', 'section', 'items', 'photoItems', 'themes', 'region', 'tags', 'thumbnailFileId', 'isActive'];
  
  // Initialisation de l'objet contenant les mises à jour
  const updates = {};
  // Parcours des champs autorisés pour collecter les nouvelles valeurs
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Exécution de la mise à jour dans la base de données avec validation
  const playlist = await Playlist.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // Si la playlist n'existe pas, on renvoie une erreur 404
  if (!playlist) {
    return next(new AppError('Liste de lecture introuvable !', 404));
  }

  // Enregistrement de la mise à jour dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PLAYLIST_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Playlist:${playlist._id}`,
    result: 'success',
  });

  // Envoi de la réponse de succès avec la playlist mise à jour
  res.status(200).json({
    status: 'success',
    message: 'Liste de lecture mise à jour avec succès !',
    data: { playlist },
  });
});

// Déclaration de la fonction pour supprimer une playlist
const deletePlaylist = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de la playlist
  const { id } = req.params;
  // Suppression de la playlist de la base de données
  const playlist = await Playlist.findByIdAndDelete(id);

  // Si la playlist n'existe pas, on renvoie une erreur 404
  if (!playlist) {
    return next(new AppError('Liste de lecture introuvable !', 404));
  }

  // Enregistrement de la suppression dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PLAYLIST_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Playlist:${id}`,
    result: 'success',
  });

  // Envoi de la réponse de suppression réussie avec statut 204
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Exportation des fonctions de gestion des playlists pour utilisation dans les routes
module.exports = {
  getAllPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
};
