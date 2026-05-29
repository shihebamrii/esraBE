// Importation des modèles Cart, Photo, Pack et Content depuis le dossier des modèles
const { Cart, Photo, Pack, Content } = require('../models');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction pour obtenir le contenu du panier de l'utilisateur
const getCart = asyncHandler(async (req, res, _next) => {
  // Récupération ou création du panier pour l'utilisateur connecté
  const cart = await Cart.getOrCreate(req.user._id);

  // Envoi de la réponse avec les articles, le total et le nombre d'articles
  res.status(200).json({
    status: 'success',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

// Déclaration de la fonction pour ajouter un article au panier
const addToCart = asyncHandler(async (req, res, next) => {
  // Extraction du type, de l'identifiant de l'article et du type de licence depuis le corps de la requête
  const { type, itemId, licenseType = 'personal' } = req.body;
  // Construction de l'URL de base à partir du protocole et de l'hôte
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Vérification que le type de licence est valide
  if (!['personal', 'commercial'].includes(licenseType)) {
    return next(new AppError("Le type de licence n'est pas valide !", 400));
  }

  // Initialisation des variables pour l'article, le prix, le titre et la miniature
  let item;
  let price;
  let title;
  let thumbnail;

  // Traitement selon le type d'article
  switch (type) {
    // Cas d'une photo
    case 'photo':
      // Recherche de la photo par identifiant
      item = await Photo.findById(itemId);
      // Si la photo n'existe pas, on renvoie une erreur 404
      if (!item) return next(new AppError('Photo introuvable !', 404));
      // Détermination du prix selon le type de licence
      if (licenseType === 'commercial') {
        price = item.priceCommercialTND || item.priceTND;
      } else {
        price = item.pricePersonalTND || item.priceTND;
      }
      // Récupération du titre de la photo
      title = item.title;
      // Construction de l'URL de la miniature
      thumbnail = `${baseUrl}/api/photos/${itemId}/preview`;
      break;

    // Cas d'un pack
    case 'pack':
      // Recherche du pack par identifiant
      item = await Pack.findById(itemId);
      // Si le pack n'existe pas ou n'est pas actif, on renvoie une erreur 404
      if (!item || !item.isActive) return next(new AppError('Pack introuvable !', 404));
      // Récupération du prix du pack
      price = item.priceTND;
      // Récupération du titre du pack
      title = item.title;
      break;

    // Cas d'un contenu
    case 'content':
      // Recherche du contenu par identifiant
      item = await Content.findById(itemId);
      // Si le contenu n'existe pas, on renvoie une erreur 404
      if (!item) return next(new AppError('Contenu introuvable !', 404));
      // Si le contenu est gratuit, on ne peut pas l'ajouter au panier
      if (item.isFree) return next(new AppError('Le contenu est gratuit !', 400));
      // Détermination du prix selon le type de licence
      if (licenseType === 'commercial') {
        price = item.priceCommercial || item.price;
      } else {
        price = item.pricePersonal || item.price;
      }
      // Récupération du titre du contenu
      title = item.title;
      // Construction de l'URL de la miniature si elle existe
      thumbnail = item.thumbnailFileId ? `${baseUrl}/api/media/${item.thumbnailFileId}` : null;
      break;

    // Type d'article non reconnu
    default:
      return next(new AppError("Le type d'article n'est pas valide !", 400));
  }

  // Si le prix est zéro, l'article est gratuit et ne peut pas être ajouté au panier
  if (price === 0) {
    return next(new AppError("L'article est gratuit, pas besoin de l'acheter !", 400));
  }

  // Récupération ou création du panier de l'utilisateur
  const cart = await Cart.getOrCreate(req.user._id);

  // Ajout de l'article au panier avec toutes ses informations
  await cart.addItem({
    type,
    itemId,
    price,
    title,
    thumbnail,
    licenseType,
  });

  // Envoi de la réponse de succès avec le panier mis à jour
  res.status(200).json({
    status: 'success',
    message: 'Ajouté au panier !',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

// Déclaration de la fonction pour supprimer un article du panier
const removeFromCart = asyncHandler(async (req, res, next) => {
  // Extraction de l'identifiant de l'article depuis les paramètres de la route
  const { itemId } = req.params;

  // Récupération ou création du panier de l'utilisateur
  const cart = await Cart.getOrCreate(req.user._id);

  // Vérification que l'article existe dans le panier
  const itemExists = cart.items.some((item) => item._id.toString() === itemId);
  // Si l'article n'est pas dans le panier, on renvoie une erreur 404
  if (!itemExists) {
    return next(new AppError("L'article n'est pas dans le panier !", 404));
  }

  // Suppression de l'article du panier
  await cart.removeItem(itemId);

  // Envoi de la réponse de succès avec le panier mis à jour
  res.status(200).json({
    status: 'success',
    message: 'Supprimé du panier !',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

// Déclaration de la fonction pour vider le panier
const clearCart = asyncHandler(async (req, res, _next) => {
  // Récupération ou création du panier de l'utilisateur
  const cart = await Cart.getOrCreate(req.user._id);
  // Vidage complet du panier
  await cart.clear();

  // Envoi de la réponse de succès avec un panier vide
  res.status(200).json({
    status: 'success',
    message: 'Panier vidé !',
    data: {
      cart: {
        items: [],
        total: 0,
        itemCount: 0,
      },
    },
  });
});

// Déclaration de la fonction pour actualiser les prix du panier
const refreshCart = asyncHandler(async (req, res, _next) => {
  // Récupération ou création du panier de l'utilisateur
  const cart = await Cart.getOrCreate(req.user._id);
  // Actualisation des prix de tous les articles du panier
  await cart.refreshPrices();

  // Envoi de la réponse de succès avec les prix actualisés
  res.status(200).json({
    status: 'success',
    message: 'Prix mis à jour !',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

// Exportation des fonctions de gestion du panier pour utilisation dans les routes
module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  refreshCart,
};
