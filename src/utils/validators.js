// Importation de la bibliothèque Joi pour la validation des données
const Joi = require('joi');

// Définition des schémas de validation pour l'authentification
const authValidation = {
  // Schéma de validation pour l'inscription d'un utilisateur
  register: Joi.object({
    // Le nom est obligatoire, entre 2 et 100 caractères
    name: Joi.string().min(2).max(100).required().messages({
      'string.empty': 'Le nom est obligatoire !',
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'string.max': 'Le nom est trop long',
    }),
    // L'e-mail est obligatoire et doit être valide
    email: Joi.string().email().required().messages({
      'string.empty': 'L\'e-mail est obligatoire !',
      'string.email': 'L\'e-mail n\'est pas valide !',
    }),
    // Le mot de passe est obligatoire, entre 8 et 128 caractères
    password: Joi.string().min(8).max(128).required().messages({
      'string.empty': 'Le mot de passe est obligatoire !',
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
    }),
    // Le téléphone est obligatoire
    phone: Joi.string().min(8).required().messages({
      'string.empty': 'Le numéro de téléphone est obligatoire !',
      'string.min': 'Le numéro de téléphone doit contenir au moins 8 caractères',
    }),
    // L'adresse est optionnelle
    address: Joi.string().allow('').optional(),
    // La biographie est optionnelle
    bio: Joi.string().max(500).allow('').optional().messages({
      'string.max': 'La biographie est trop longue (maximum 500 caractères)',
    }),
    // La langue est optionnelle avec une valeur par défaut "ar"
    locale: Joi.string().valid('ar', 'fr', 'en').default('ar'),
    // Le rôle est optionnel et ne peut être que "user"
    role: Joi.string().valid('user').optional(),
  }),

  // Schéma de validation pour la mise à jour du profil utilisateur
  updateMe: Joi.object({
    // Le nom est optionnel, entre 2 et 100 caractères
    name: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'string.max': 'Le nom est trop long',
    }),
    // L'e-mail est optionnel et doit être valide
    email: Joi.string().email().optional().messages({
      'string.email': 'L\'e-mail n\'est pas valide !',
    }),
    // Le téléphone est optionnel et peut être vide
    phone: Joi.string().allow('').optional(),
    // L'adresse est optionnelle
    address: Joi.string().allow('').optional(),
    // La biographie est optionnelle
    bio: Joi.string().max(500).allow('').optional().messages({
      'string.max': 'La biographie est trop longue (maximum 500 caractères)',
    }),
    // La langue est optionnelle
    locale: Joi.string().valid('ar', 'fr', 'en').optional(),
    // Le mot de passe actuel est optionnel
    password: Joi.string().optional(),
    // Le nouveau mot de passe est optionnel, entre 8 et 128 caractères
    newPassword: Joi.string().min(8).max(128).optional().messages({
      'string.min': 'Le nouveau mot de passe doit contenir au moins 8 caractères',
    }),
  // Si un nouveau mot de passe est fourni, le mot de passe actuel est obligatoire
  }).with('newPassword', 'password'),

  // Schéma de validation pour la connexion
  login: Joi.object({
    // L'e-mail est obligatoire et doit être valide
    email: Joi.string().email().required().messages({
      'string.empty': 'L\'e-mail est obligatoire !',
      'string.email': 'L\'e-mail n\'est pas valide !',
    }),
    // Le mot de passe est obligatoire
    password: Joi.string().required().messages({
      'string.empty': 'Le mot de passe est obligatoire !',
    }),
  }),

  // Schéma de validation pour le jeton de rafraîchissement
  refreshToken: Joi.object({
    // Le jeton de rafraîchissement est obligatoire
    refreshToken: Joi.string().required().messages({
      'string.empty': 'Le jeton de rafraîchissement est obligatoire !',
    }),
  }),

  // Schéma de validation pour la demande de réinitialisation du mot de passe
  forgotPassword: Joi.object({
    // L'e-mail est obligatoire
    email: Joi.string().email().required().messages({
      'string.empty': 'L\'e-mail est obligatoire !',
    }),
  }),

  // Schéma de validation pour la réinitialisation du mot de passe
  resetPassword: Joi.object({
    // Le jeton de réinitialisation est obligatoire
    token: Joi.string().required(),
    // Le nouveau mot de passe est obligatoire, entre 8 et 128 caractères
    newPassword: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Le nouveau mot de passe doit contenir au moins 8 caractères',
    }),
  }),
};

// Définition des schémas de validation pour le contenu multimédia
const contentValidation = {
  // Schéma de validation pour la création de contenu
  create: Joi.object({
    // Le titre est obligatoire, entre 2 et 200 caractères
    title: Joi.string().min(2).max(200).required(),
    // La description est optionnelle, maximum 5000 caractères
    description: Joi.string().max(5000).allow(''),
    // Les auteurs sont un tableau optionnel de chaînes de caractères
    authors: Joi.array().items(Joi.string()),
    // Le type de contenu est obligatoire parmi les valeurs autorisées
    type: Joi.string().valid('video', 'audio', 'reel', 'documentary', 'podcast').required(),
    // Les thèmes sont un tableau optionnel de chaînes de caractères
    themes: Joi.array().items(Joi.string()),
    // La région est une chaîne optionnelle
    region: Joi.string(),
    // Les étiquettes sont un tableau optionnel de chaînes de caractères
    tags: Joi.array().items(Joi.string()),
    // La langue par défaut est "ar"
    language: Joi.string().valid('ar', 'fr', 'en', 'other').default('ar'),
    // La durée doit être un nombre positif ou nul
    duration: Joi.number().min(0),
    // Les droits par défaut sont "free"
    rights: Joi.string().valid('free', 'paid', 'license').default('free'),
    // Le prix par défaut est 0
    price: Joi.number().min(0).default(0),
    // Le prix personnel par défaut est 0
    pricePersonal: Joi.number().min(0).default(0),
    // Le prix commercial par défaut est 0
    priceCommercial: Joi.number().min(0).default(0),
    // Les informations de licence sont optionnelles
    licenseInfo: Joi.string().allow(''),
    // La visibilité par défaut est "public"
    visibility: Joi.string().valid('public', 'private').default('public'),
    // Les métadonnées sont un objet optionnel
    metadata: Joi.object(),
  }),

  // Schéma de validation pour la mise à jour de contenu
  update: Joi.object({
    // Le titre est optionnel, entre 2 et 200 caractères
    title: Joi.string().min(2).max(200),
    // La description est optionnelle
    description: Joi.string().max(5000).allow(''),
    // Les auteurs sont optionnels
    authors: Joi.array().items(Joi.string()),
    // Les thèmes sont optionnels
    themes: Joi.array().items(Joi.string()),
    // La région est optionnelle
    region: Joi.string(),
    // Les étiquettes sont optionnelles
    tags: Joi.array().items(Joi.string()),
    // La langue est optionnelle
    language: Joi.string().valid('ar', 'fr', 'en', 'other'),
    // Les droits sont optionnels
    rights: Joi.string().valid('free', 'paid', 'license'),
    // Le type est optionnel
    type: Joi.string().valid('video', 'audio', 'reel', 'documentary', 'podcast'),
    // Le prix est optionnel
    price: Joi.number().min(0),
    // Le prix personnel est optionnel
    pricePersonal: Joi.number().min(0),
    // Le prix commercial est optionnel
    priceCommercial: Joi.number().min(0),
    // Les informations de licence sont optionnelles
    licenseInfo: Joi.string().allow(''),
    // La visibilité est optionnelle
    visibility: Joi.string().valid('public', 'private'),
    // Les métadonnées sont optionnelles
    metadata: Joi.object(),
  }),

  // Schéma de validation pour les paramètres de requête (filtrage et pagination)
  query: Joi.object({
    // Numéro de page, minimum 1, par défaut 1
    page: Joi.number().min(1).default(1),
    // Nombre d'éléments par page, entre 1 et 5000, par défaut 20
    limit: Joi.number().min(1).max(5000).default(20),
    // Filtre par type
    type: Joi.string(),
    // Filtre par région
    region: Joi.string(),
    // Filtre par thème
    theme: Joi.string(),
    // Filtre par langue
    language: Joi.string(),
    // Filtre par droits
    rights: Joi.string().valid('free', 'paid', 'license'),
    // Filtre pour les contenus gratuits uniquement
    freeOnly: Joi.boolean(),
    // Filtre par visibilité
    visibility: Joi.string().valid('public', 'private', 'all'),
    // Critère de tri
    sort: Joi.string().valid('createdAt', '-createdAt', 'views', '-views', 'title'),
  }),
};

// Définition des schémas de validation pour les photos
const photoValidation = {
  // Schéma de validation pour la création d'une photo
  create: Joi.object({
    // Le titre est obligatoire, entre 2 et 200 caractères
    title: Joi.string().min(2).max(200).required(),
    // La description est optionnelle, maximum 2000 caractères
    description: Joi.string().max(2000).allow(''),
    // Le gouvernorat est obligatoire
    governorate: Joi.string().required(),
    // Le type de paysage est obligatoire parmi les valeurs autorisées
    landscapeType: Joi.string().valid('sea', 'desert', 'mountain', 'village', 'oasis', 'forest', 'city', 'historical', 'other').required(),
    // Le prix en dinars tunisiens est obligatoire et positif ou nul
    priceTND: Joi.number().min(0).required(),
    // Le prix personnel en dinars tunisiens est optionnel
    pricePersonalTND: Joi.number().min(0),
    // Le prix commercial en dinars tunisiens est optionnel
    priceCommercialTND: Joi.number().min(0),
    // Le filigrane est activé par défaut
    watermark: Joi.boolean().default(true),
    // Le texte d'attribution par défaut
    attributionText: Joi.string().default('Photo prise lors de la tournée de CnBees - Tourisme durable'),
    // Les étiquettes sont optionnelles
    tags: Joi.array().items(Joi.string()),
  }),

  // Schéma de validation pour la mise à jour d'une photo
  update: Joi.object({
    // Le titre est optionnel
    title: Joi.string().min(2).max(200),
    // La description est optionnelle
    description: Joi.string().max(2000).allow(''),
    // Le gouvernorat est optionnel
    governorate: Joi.string(),
    // Le type de paysage est optionnel
    landscapeType: Joi.string().valid('sea', 'desert', 'mountain', 'village', 'oasis', 'forest', 'city', 'historical', 'other'),
    // Le prix est optionnel
    priceTND: Joi.number().min(0),
    // Le prix personnel est optionnel
    pricePersonalTND: Joi.number().min(0),
    // Le prix commercial est optionnel
    priceCommercialTND: Joi.number().min(0),
    // Le filigrane est optionnel
    watermark: Joi.boolean(),
    // Le texte d'attribution est optionnel
    attributionText: Joi.string(),
    // Les étiquettes sont optionnelles
    tags: Joi.array().items(Joi.string()),
  }),

  // Schéma de validation pour les paramètres de requête des photos
  query: Joi.object({
    // Numéro de page, minimum 1, par défaut 1
    page: Joi.number().min(1).default(1),
    // Nombre d'éléments par page, entre 1 et 5000, par défaut 20
    limit: Joi.number().min(1).max(5000).default(20),
    // Filtre par gouvernorat
    governorate: Joi.string(),
    // Filtre par type de paysage
    landscapeType: Joi.string(),
    // Filtre par prix minimum
    minPrice: Joi.number().min(0),
    // Filtre par prix maximum
    maxPrice: Joi.number().min(0),
    // Filtre pour les photos gratuites uniquement
    freeOnly: Joi.boolean(),
    // Filtre par statut d'approbation
    approvalStatus: Joi.string().valid('pending', 'approved', 'rejected', 'all'),
    // Critère de tri
    sort: Joi.string().valid('createdAt', '-createdAt', 'priceTND', '-priceTND', 'title'),
    // Filtre par identifiant d'utilisateur
    userId: Joi.string(),
    // Filtre par source de la photo
    source: Joi.string().valid('official', 'community', 'all'),
  }),
};

// Définition des schémas de validation pour les packs
const packValidation = {
  // Schéma de validation pour la création d'un pack
  create: Joi.object({
    // Le titre est obligatoire, entre 2 et 200 caractères
    title: Joi.string().min(2).max(200).required(),
    // La description est optionnelle, maximum 2000 caractères
    description: Joi.string().max(2000).allow(''),
    // Le type de pack par défaut est "collection"
    type: Joi.string().valid('collection', 'membership').default('collection'),
    // Fonctionnalités de l'abonnement (optionnelles)
    membershipFeatures: Joi.object({
      // Limite de photos
      photosLimit: Joi.number().min(0),
      // Limite de reels
      reelsLimit: Joi.number().min(0),
      // Limite de vidéos
      videosLimit: Joi.number().min(0),
      // Limite de documentaires
      documentariesLimit: Joi.number().min(0),
      // Limite de podcasts
      podcastsLimit: Joi.number().min(0),
      // Limite de success stories
      successStoryLimit: Joi.number().min(0),
      // Qualité du contenu
      quality: Joi.string().valid('standard', 'hd', '4k'),
      // Module associé
      module: Joi.string().valid('tounesna', 'impact', 'both'),
    }),
    // Identifiants des photos incluses (format hexadécimal, 24 caractères)
    photoIds: Joi.array().items(Joi.string().hex().length(24)),
    // Identifiants des contenus inclus (format hexadécimal, 24 caractères)
    contentIds: Joi.array().items(Joi.string().hex().length(24)),
    // Le prix en dinars tunisiens est obligatoire
    priceTND: Joi.number().min(0).required(),
    // Étiquette de région optionnelle
    regionTag: Joi.string(),
    // Indicateur d'activation optionnel
    isActive: Joi.boolean(),
  }),

  // Schéma de validation pour la mise à jour d'un pack
  update: Joi.object({
    // Le titre est optionnel
    title: Joi.string().min(2).max(200),
    // La description est optionnelle
    description: Joi.string().max(2000).allow(''),
    // Le type est optionnel
    type: Joi.string().valid('collection', 'membership'),
    // Les fonctionnalités d'abonnement sont optionnelles
    membershipFeatures: Joi.object({
      photosLimit: Joi.number().min(0),
      reelsLimit: Joi.number().min(0),
      videosLimit: Joi.number().min(0),
      documentariesLimit: Joi.number().min(0),
      podcastsLimit: Joi.number().min(0),
      successStoryLimit: Joi.number().min(0),
      quality: Joi.string().valid('standard', 'hd', '4k'),
      module: Joi.string().valid('tounesna', 'impact', 'both'),
    }),
    // Les identifiants de photos sont optionnels
    photoIds: Joi.array().items(Joi.string().hex().length(24)),
    // Les identifiants de contenus sont optionnels
    contentIds: Joi.array().items(Joi.string().hex().length(24)),
    // Le prix est optionnel
    priceTND: Joi.number().min(0),
    // L'étiquette de région est optionnelle
    regionTag: Joi.string(),
    // L'indicateur d'activation est optionnel
    isActive: Joi.boolean(),
  }),
};

// Définition des schémas de validation pour le panier d'achat
const cartValidation = {
  // Schéma de validation pour l'ajout d'un article au panier
  addItem: Joi.object({
    // Le type d'article est obligatoire parmi les valeurs autorisées
    type: Joi.string().valid('photo', 'pack', 'content').required(),
    // L'identifiant de l'article est obligatoire (format hexadécimal, 24 caractères)
    itemId: Joi.string().hex().length(24).required(),
  }),
};

// Définition des schémas de validation pour les commandes
const orderValidation = {
  // Schéma de validation pour le processus de paiement (checkout)
  checkout: Joi.object({
    // Les informations de facturation sont obligatoires
    billingInfo: Joi.object({
      // Le nom est obligatoire
      name: Joi.string().required(),
      // L'e-mail est obligatoire et doit être valide
      email: Joi.string().email().required(),
      // L'adresse est optionnelle
      address: Joi.string().allow(''),
      // Le pays par défaut est "TN" (Tunisie)
      country: Joi.string().default('TN'),
    }).required(),
    // Les notes sont optionnelles
    notes: Joi.string().allow(''),
  }),
};

// Définition du schéma de validation pour un identifiant ObjectId MongoDB
const objectIdValidation = Joi.object({
  // L'identifiant est obligatoire, en hexadécimal et de 24 caractères
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'L\'identifiant n\'est pas valide',
    'string.length': 'L\'identifiant doit contenir 24 caractères',
  }),
});

// Exportation de tous les schémas de validation
module.exports = {
  authValidation,
  contentValidation,
  photoValidation,
  packValidation,
  cartValidation,
  orderValidation,
  objectIdValidation,
};
