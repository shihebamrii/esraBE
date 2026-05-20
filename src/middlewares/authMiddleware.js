// Importation du module JSON Web Token pour vérifier les jetons d'authentification
const jwt = require('jsonwebtoken');
// Importation des modèles User et AuditLog depuis le fichier des modèles
const { User, AuditLog } = require('../models');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');
// Importation de la fonction utilitaire pour gérer les erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la configuration de l'application
const config = require('../config');

// Middleware de protection : vérifie que l'utilisateur est authentifié
const protect = asyncHandler(async (req, _res, next) => {
  // Déclaration de la variable pour stocker le jeton
  let token;

  // Vérification de la présence du jeton dans l'en-tête Authorization au format Bearer
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Extraction du jeton en séparant la chaîne au niveau de l'espace
    token = req.headers.authorization.split(' ')[1];
  }

  // Si aucun jeton n'est trouvé, retourner une erreur 401
  if (!token) {
    return next(new AppError('Non autorisé ! Veuillez vous connecter.', 401));
  }

  try {
    // Vérification et décodage du jeton avec la clé secrète
    const decoded = jwt.verify(token, config.jwt.secret);

    // Recherche de l'utilisateur dans la base de données par son identifiant
    const user = await User.findById(decoded.id);

    // Si l'utilisateur n'existe plus dans la base de données
    if (!user) {
      return next(new AppError('L\'utilisateur n\'existe plus !', 401));
    }

    // Vérification que le compte de l'utilisateur est actif
    if (!user.isActive) {
      return next(new AppError('Le compte est suspendu ! Contactez l\'administration.', 401));
    }

    // Ajout de l'utilisateur à l'objet de la requête pour les middlewares suivants
    req.user = user;
    // Passage au middleware suivant
    next();
  } catch (error) {
    // Gestion de l'erreur si le jeton a expiré
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Le jeton a expiré ! Veuillez vous reconnecter.', 401));
    }
    // Gestion de l'erreur si le jeton est invalide
    return next(new AppError('Jeton invalide !', 401));
  }
});

// Middleware d'autorisation : vérifie que l'utilisateur a le rôle requis
const authorize = (...roles) => {
  return (req, _res, next) => {
    // Vérification que l'utilisateur existe dans la requête
    if (!req.user) {
      return next(new AppError('Non autorisé !', 401));
    }

    // Vérification que le rôle de l'utilisateur est inclus dans les rôles autorisés
    if (!roles.includes(req.user.role)) {
      // Enregistrement de la tentative non autorisée dans le journal d'audit
      AuditLog.log({
        userId: req.user._id,
        action: 'SUSPICIOUS_ACTIVITY',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        resource: req.originalUrl,
        details: { requiredRoles: roles, userRole: req.user.role },
        result: 'failure',
      });

      // Retour d'une erreur 403 (accès interdit)
      return next(new AppError('Vous n\'avez pas la permission pour cette action !', 403));
    }

    // Passage au middleware suivant si le rôle est autorisé
    next();
  };
};

// Middleware d'authentification optionnelle : récupère l'utilisateur si un jeton est présent
const optionalAuth = asyncHandler(async (req, _res, next) => {
  // Déclaration de la variable pour stocker le jeton
  let token;

  // Vérification de la présence du jeton dans l'en-tête Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Extraction du jeton
    token = req.headers.authorization.split(' ')[1];
  }

  // Si un jeton est présent, tentative de vérification
  if (token) {
    try {
      // Vérification et décodage du jeton
      const decoded = jwt.verify(token, config.jwt.secret);
      // Recherche de l'utilisateur dans la base de données
      const user = await User.findById(decoded.id);

      // Si l'utilisateur existe et que son compte est actif, l'ajouter à la requête
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (_error) {
      // Les erreurs sont ignorées car l'authentification est optionnelle
    }
  }

  // Passage au middleware suivant dans tous les cas
  next();
});

// Exportation des middlewares d'authentification
module.exports = {
  protect,
  authorize,
  optionalAuth,
};
