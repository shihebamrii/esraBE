// Importation des modèles Content, Photo et Pack
const { Content, Photo, Pack } = require('../models');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Fonction de recherche globale dans les contenus, photos et packs
const search = asyncHandler(async (req, res, _next) => {
  // Extraire les paramètres de recherche avec des valeurs par défaut
  const { q, type, page = 1, limit = 20 } = req.query;
  // Construire l'URL de base du serveur
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Si la requête est vide ou trop courte, retourner des résultats vides
  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      status: 'success',
      data: {
        contents: [],
        photos: [],
        packs: [],
        total: 0,
      },
    });
  }

  // Créer une expression régulière insensible à la casse pour la recherche
  const searchRegex = new RegExp(q, 'i');
  // Calculer le nombre de résultats à ignorer pour la pagination
  const skip = (page - 1) * limit;
  // Convertir la limite en nombre entier
  const limitNum = parseInt(limit, 10);

  // Initialiser les tableaux de résultats
  let contents = [];
  let photos = [];
  let packs = [];

  // Déterminer les types à rechercher (tous par défaut)
  const searchTypes = type ? [type] : ['content', 'photo', 'pack'];

  // Rechercher dans les contenus si le type est inclus
  if (searchTypes.includes('content')) {
    contents = await Content.find({
      // Filtrer les contenus publics uniquement
      visibility: 'public',
      // Rechercher dans le titre, la description ou les tags
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ],
    })
      .select('title description type region thumbnailFileId rights price duration')
      .skip(skip)
      .limit(limitNum);
  }

  // Rechercher dans les photos si le type est inclus
  if (searchTypes.includes('photo')) {
    photos = await Photo.find({
      // Rechercher dans le titre, la description, les tags ou le gouvernorat
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { governorate: searchRegex },
      ],
    })
      .select('title description governorate landscapeType priceTND lowResFileId')
      .skip(skip)
      .limit(limitNum);
  }

  // Rechercher dans les packs si le type est inclus
  if (searchTypes.includes('pack')) {
    packs = await Pack.find({
      // Rechercher uniquement dans les packs actifs
      isActive: true,
      // Rechercher dans le titre, la description ou le tag de région
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { regionTag: searchRegex },
      ],
    })
      .select('title description priceTND regionTag photoIds')
      .skip(skip)
      .limit(limitNum);
  }

  // Ajouter le nombre de photos à chaque pack
  packs = packs.map((pack) => {
    const obj = pack.toObject();
    obj.photoCount = pack.photoIds?.length || 0;
    return obj;
  });

  // Ajouter les URLs d'aperçu aux photos
  photos = photos.map((photo) => {
    const obj = photo.toObject();
    obj.previewUrl = `${baseUrl}/api/photos/${photo._id}/preview`;
    return obj;
  });

  // Envoyer la réponse avec tous les résultats de recherche
  res.status(200).json({
    status: 'success',
    data: {
      contents,
      photos,
      packs,
      total: contents.length + photos.length + packs.length,
    },
  });
});

// Fonction de recherche en texte intégral utilisant l'index texte de MongoDB
const fulltextSearch = asyncHandler(async (req, res, _next) => {
  // Extraire les paramètres de recherche
  const { q, type = 'all', page = 1, limit = 20 } = req.query;
  // Construire l'URL de base du serveur
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Si la requête est vide ou trop courte, retourner des résultats vides
  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      status: 'success',
      data: { results: [], total: 0 },
    });
  }

  // Calculer le nombre de résultats à ignorer
  const skip = (page - 1) * limit;
  // Convertir la limite en nombre entier
  const limitNum = parseInt(limit, 10);

  // Initialiser le tableau de résultats
  let results = [];

  // Rechercher dans les contenus si le type est "content" ou "all"
  if (type === 'content' || type === 'all') {
    const contents = await Content.find(
      // Utiliser la recherche textuelle de MongoDB sur les contenus publics
      { $text: { $search: q }, visibility: 'public' },
      // Inclure le score de pertinence
      { score: { $meta: 'textScore' } }
    )
      // Trier par score de pertinence décroissant
      .sort({ score: { $meta: 'textScore' } })
      .select('title description type region rights price')
      .skip(skip)
      .limit(limitNum);

    // Ajouter les contenus aux résultats avec le type de résultat
    results = results.concat(
      contents.map((c) => ({ ...c.toObject(), resultType: 'content' }))
    );
  }

  // Rechercher dans les photos si le type est "photo" ou "all"
  if (type === 'photo' || type === 'all') {
    const photos = await Photo.find(
      // Utiliser la recherche textuelle de MongoDB
      { $text: { $search: q } },
      // Inclure le score de pertinence
      { score: { $meta: 'textScore' } }
    )
      // Trier par score de pertinence décroissant
      .sort({ score: { $meta: 'textScore' } })
      .select('title description governorate landscapeType priceTND')
      .skip(skip)
      .limit(limitNum);

    // Ajouter les photos aux résultats avec le type et l'URL d'aperçu
    results = results.concat(
      photos.map((p) => ({
        ...p.toObject(),
        resultType: 'photo',
        previewUrl: `${baseUrl}/api/photos/${p._id}/preview`,
      }))
    );
  }

  // Envoyer la réponse avec les résultats de la recherche en texte intégral
  res.status(200).json({
    status: 'success',
    data: {
      results,
      total: results.length,
      page: parseInt(page, 10),
    },
  });
});

// Fonction pour les suggestions de recherche (autocomplétion)
const searchSuggestions = asyncHandler(async (req, res, _next) => {
  // Extraire le texte de recherche
  const { q } = req.query;

  // Si la requête est vide ou trop courte, retourner un tableau vide
  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      status: 'success',
      data: { suggestions: [] },
    });
  }

  // Créer une expression régulière qui commence par le texte saisi
  const searchRegex = new RegExp(`^${q}`, 'i');

  // Chercher les titres correspondants dans les trois collections en parallèle
  const [contentTitles, photoTitles, packTitles] = await Promise.all([
    // Chercher dans les contenus publics (limité à 5 résultats)
    Content.find({ title: searchRegex, visibility: 'public' })
      .select('title')
      .limit(5),
    // Chercher dans les photos (limité à 5 résultats)
    Photo.find({ title: searchRegex })
      .select('title')
      .limit(5),
    // Chercher dans les packs actifs (limité à 5 résultats)
    Pack.find({ title: searchRegex, isActive: true })
      .select('title')
      .limit(5),
  ]);

  // Combiner les suggestions de toutes les collections (limité à 10 total)
  const suggestions = [
    ...contentTitles.map((c) => ({ text: c.title, type: 'content' })),
    ...photoTitles.map((p) => ({ text: p.title, type: 'photo' })),
    ...packTitles.map((p) => ({ text: p.title, type: 'pack' })),
  ].slice(0, 10);

  // Envoyer la réponse avec les suggestions
  res.status(200).json({
    status: 'success',
    data: { suggestions },
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  search,
  fulltextSearch,
  searchSuggestions,
};
