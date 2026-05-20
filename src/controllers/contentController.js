// Importation du modèle Content depuis le dossier des modèles
const { Content } = require('../models');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction pour obtenir la liste des contenus avec des filtres
const getContents = asyncHandler(async (req, res, _next) => {
  // Construction de l'URL de base à partir du protocole et de l'hôte
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // Extraction des paramètres de filtrage et de pagination depuis la requête
  const {
    page = 1,
    limit = 20,
    type,
    region,
    theme,
    language,
    rights,
    freeOnly,
    visibility,
    sort = '-createdAt',
  } = req.query;

  // Initialisation de l'objet de filtrage
  const query = {};
  // Filtrage par visibilité (public par défaut si non spécifié)
  if (visibility && visibility !== 'all') {
    query.visibility = visibility;
  } else if (!visibility) {
    query.visibility = 'public';
  }

  // Filtrage par type de contenu (support de plusieurs types séparés par des virgules)
  if (type) {
    if (type.includes(',')) {
      query.type = { $in: type.split(',') };
    } else {
      query.type = type;
    }
  }
  // Filtrage par région si spécifié
  if (region) query.region = region;
  // Filtrage par thème si spécifié
  if (theme) query.themes = theme;
  // Filtrage par langue si spécifié
  if (language) query.language = language;
  // Filtrage par droits si spécifié
  if (rights) query.rights = rights;
  // Filtrage pour les contenus gratuits uniquement
  if (freeOnly === 'true') query.price = 0;

  // Comptage du nombre total de résultats correspondant aux filtres
  const total = await Content.countDocuments(query);

  // Recherche des contenus avec sélection de champs, jointure, tri et pagination
  const contents = await Content.find(query)
    .select('title type region themes duration thumbnailFileId fileFileId rights price visibility createdAt metadata authors createdBy')
    .populate('createdBy', 'name')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Ajout des URLs de miniature et de contenu à chaque résultat
  const contentsWithUrls = contents.map((content) => {
    // Conversion du document Mongoose en objet JavaScript simple
    const obj = content.toObject();
    // Ajout de l'URL de la miniature si elle existe
    obj.thumbnailUrl = content.thumbnailFileId ? `/api/media/${content.thumbnailFileId}` : null;
    // Ajout de l'URL du contenu
    obj.contentUrl = `/api/media/${content.fileFileId}`;
    return obj;
  });

  // Envoi de la réponse avec les contenus et les informations de pagination
  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents: contentsWithUrls },
  });
});

// Déclaration de la fonction pour obtenir les détails d'un contenu spécifique
const getContent = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant du contenu depuis les paramètres de la route
  const { id } = req.params;
  // Construction de l'URL de base
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Recherche du contenu par identifiant avec jointure sur le créateur
  const content = await Content.findById(id)
    .populate('createdBy', 'name');

  // Si le contenu n'existe pas, on renvoie une erreur 404
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // Vérification des droits d'accès si le contenu est privé
  if (content.visibility === 'private') {
    // Si l'utilisateur n'est pas connecté, on refuse l'accès
    if (!req.user) {
      return next(new AppError('Le contenu est privé !', 403));
    }
    // Seul l'admin ou le créateur peut accéder au contenu privé
    if (
      req.user.role !== 'admin' &&
      content.createdBy._id.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('Le contenu est privé !', 403));
    }
  }

  // Conversion du document en objet et ajout des URLs
  const obj = content.toObject();
  // Ajout de l'URL de la miniature si elle existe
  obj.thumbnailUrl = content.thumbnailFileId ? `/api/media/${content.thumbnailFileId}` : null;
  // Ajout de l'URL du contenu
  obj.contentUrl = `/api/media/${content.fileFileId}`;

  // Envoi de la réponse avec les détails du contenu
  res.status(200).json({
    status: 'success',
    data: { content: obj },
  });
});

// Déclaration de la fonction pour obtenir les contenus similaires
const getRelatedContent = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant du contenu depuis les paramètres
  const { id } = req.params;
  // Extraction de la limite de résultats depuis la requête
  const { limit = 6 } = req.query;

  // Recherche du contenu de référence
  const content = await Content.findById(id);

  // Si le contenu n'existe pas, on renvoie une erreur 404
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // Recherche de contenus similaires par type, région ou thèmes communs
  const related = await Content.find({
    _id: { $ne: id },
    visibility: 'public',
    $or: [
      { type: content.type },
      { region: content.region },
      { themes: { $in: content.themes } },
    ],
  })
    .select('title type region thumbnailFileId duration rights price')
    .limit(parseInt(limit, 10));

  // Envoi de la réponse avec les contenus similaires
  res.status(200).json({
    status: 'success',
    data: { related },
  });
});

// Exportation des fonctions de gestion des contenus publics pour utilisation dans les routes
module.exports = {
  getContents,
  getContent,
  getRelatedContent,
};
