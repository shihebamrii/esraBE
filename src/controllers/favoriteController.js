// Importation des modèles de la base de données
const { Photo, Pack, Content, Favorite } = require('../models');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');

// Fonction pour récupérer les favoris de l'utilisateur connecté
const getFavorites = asyncHandler(async (req, res, next) => {
  // Rechercher tous les favoris de l'utilisateur, triés par date décroissante
  const favorites = await Favorite.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    // Remplir les détails de l'élément associé
    .populate('itemId');

  // Envoyer la réponse avec la liste des favoris
  res.status(200).json({
    status: 'success',
    data: favorites
  });
});

// Fonction pour ajouter ou retirer un élément des favoris
const toggleFavorite = asyncHandler(async (req, res, next) => {
  // Extraire le type et l'identifiant de l'élément du corps de la requête
  let { itemType, itemId } = req.body;

  // Normaliser le type d'élément en majuscule
  if (itemType) {
    const lowerType = itemType.toLowerCase();
    if (lowerType === 'photo') itemType = 'Photo';
    if (lowerType === 'pack') itemType = 'Pack';
    if (lowerType === 'content') itemType = 'Content';
    if (lowerType === 'video') itemType = 'Content';
  }

  // Vérifier que le type est valide
  if (!['Photo', 'Pack', 'Content'].includes(itemType)) {
    return next(new AppError('Item type is not valid! (Photo, Pack, Content)', 400));
  }

  // Vérifier que l'élément existe dans la base de données
  let itemExists = null;
  if (itemType === 'Photo') itemExists = await Photo.findById(itemId);
  if (itemType === 'Pack') itemExists = await Pack.findById(itemId);
  if (itemType === 'Content') itemExists = await Content.findById(itemId);

  // Si l'élément n'existe pas, retourner une erreur 404
  if (!itemExists) {
    return next(new AppError('Item not found!', 404));
  }

  // Vérifier si l'élément est déjà en favori pour cet utilisateur
  const existingFavorite = await Favorite.findOne({
    userId: req.user._id,
    itemType,
    itemId
  });

  // Si le favori existe déjà, le supprimer
  if (existingFavorite) {
    await Favorite.findByIdAndDelete(existingFavorite._id);
    return res.status(200).json({ status: 'success', message: 'Removed from favorites', action: 'removed' });
  } else {
    // Sinon, créer un nouveau favori
    await Favorite.create({
      userId: req.user._id,
      itemType,
      itemId
    });
    return res.status(201).json({ status: 'success', message: 'Added to favorites', action: 'added' });
  }
});

// Exporter les fonctions du contrôleur
module.exports = {
  getFavorites,
  toggleFavorite
};
