// Importation du modèle Playlist
const { Playlist } = require('../models');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');

// Fonction pour récupérer toutes les playlists publiques actives
const getAllPlaylists = asyncHandler(async (req, res, next) => {
  // Extraire les paramètres de filtre de la requête
  const { type, region, theme, section } = req.query;

  // Construire le filtre de recherche pour les playlists actives
  const query = { isActive: true };
  // Ajouter le filtre par type si spécifié
  if (type) query.type = type;
  // Ajouter le filtre par région si spécifié (insensible à la casse)
  if (region) query.region = { $regex: new RegExp('^' + region + '$', 'i') };
  // Ajouter le filtre par thème si spécifié
  if (theme) query.themes = theme;
  // Ajouter le filtre par section si spécifié
  if (section) query.section = section;

  // Récupérer les playlists avec les détails des contenus et photos associés
  const playlists = await Playlist.find(query)
    // Remplir les détails des contenus (vidéos, audios)
    .populate('items.contentId', 'title type thumbnailFileId duration rights price')
    // Remplir les détails des photos
    .populate('photoItems.photoId', 'title mediaType lowResFileId highResFileId governorate landscapeType pricePersonalTND priceCommercialTND')
    // Trier par date de création décroissante
    .sort({ createdAt: -1 });

  // Envoyer la réponse avec les playlists
  res.status(200).json({
    status: 'success',
    results: playlists.length,
    data: { playlists },
  });
});

// Fonction pour récupérer les détails d'une playlist
const getPlaylist = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la playlist depuis les paramètres
  const { id } = req.params;

  // Rechercher la playlist active avec tous les détails
  const playlist = await Playlist.findOne({ _id: id, isActive: true })
    // Remplir les détails complets des contenus
    .populate('items.contentId', 'title type description thumbnailFileId fileFileId duration rights price authors')
    // Remplir les détails complets des photos
    .populate('photoItems.photoId', 'title description mediaType lowResFileId highResFileId governorate landscapeType pricePersonalTND priceCommercialTND tags');

  // Si la playlist n'existe pas, retourner une erreur 404
  if (!playlist) {
    return next(new AppError('Liste de lecture introuvable !', 404));
  }

  // Incrémenter le compteur de vues
  playlist.views += 1;
  // Sauvegarder le nouveau compteur
  await playlist.save();

  // Envoyer la réponse avec les détails de la playlist
  res.status(200).json({
    status: 'success',
    data: { playlist },
  });
});

// Exporter les fonctions du contrôleur
module.exports = {
  getAllPlaylists,
  getPlaylist,
};
