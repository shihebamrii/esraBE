// Importation de la configuration de l'application
const config = require('../config');

// Fonction pour gérer les erreurs de type CastError (identifiant MongoDB invalide)
const handleCastErrorDB = (err) => {
  // Importation de la classe d'erreur personnalisée
  const AppError = require('../utils/AppError');
  // Création d'un message d'erreur indiquant la valeur invalide
  const message = `Valeur invalide pour ${err.path}: ${err.value}`;
  // Retour d'une nouvelle erreur avec le code 400 (requête incorrecte)
  return new AppError(message, 400);
};

// Fonction pour gérer les erreurs de clé dupliquée dans MongoDB
const handleDuplicateFieldsDB = (err) => {
  // Importation de la classe d'erreur personnalisée
  const AppError = require('../utils/AppError');
  // Extraction de la valeur dupliquée depuis le message d'erreur
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'unknown';
  // Création d'un message d'erreur indiquant la valeur dupliquée
  const message = `Valeur dupliquée : ${value}. Veuillez utiliser une autre valeur !`;
  // Retour d'une nouvelle erreur avec le code 400
  return new AppError(message, 400);
};

// Fonction pour gérer les erreurs de validation MongoDB
const handleValidationErrorDB = (err) => {
  // Importation de la classe d'erreur personnalisée
  const AppError = require('../utils/AppError');
  // Extraction de tous les messages d'erreur de validation
  const errors = Object.values(err.errors).map((el) => el.message);
  // Création d'un message d'erreur regroupant toutes les erreurs
  const message = `Données invalides : ${errors.join('. ')}`;
  // Retour d'une nouvelle erreur avec le code 400
  return new AppError(message, 400);
};

// Fonction pour gérer les erreurs de jeton JWT invalide
const handleJWTError = () => {
  // Importation de la classe d'erreur personnalisée
  const AppError = require('../utils/AppError');
  // Retour d'une erreur indiquant un jeton invalide avec le code 401
  return new AppError('Jeton invalide. Veuillez vous reconnecter !', 401);
};

// Fonction pour gérer les erreurs de jeton JWT expiré
const handleJWTExpiredError = () => {
  // Importation de la classe d'erreur personnalisée
  const AppError = require('../utils/AppError');
  // Retour d'une erreur indiquant un jeton expiré avec le code 401
  return new AppError('Le jeton a expiré. Veuillez vous reconnecter !', 401);
};

// Fonction pour envoyer la réponse d'erreur en mode développement (avec tous les détails)
const sendErrorDev = (err, res) => {
  // Envoi de la réponse JSON avec le statut, l'objet erreur, le message et la pile d'appels
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Fonction pour envoyer la réponse d'erreur en mode production (sans détails sensibles)
const sendErrorProd = (err, res) => {
  // Si l'erreur est opérationnelle (prévue), envoyer le message au client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Pour les erreurs inattendues, afficher l'erreur dans la console
    console.error('❌ ERROR:', err);
    // Envoyer un message générique au client sans détails sensibles
    res.status(500).json({
      status: 'error',
      message: 'Une erreur est survenue ! Veuillez réessayer.',
    });
  }
};

// Middleware principal de gestion des erreurs
const errorHandler = (err, _req, res, _next) => {
  // Définition du code de statut par défaut à 500 si non défini
  err.statusCode = err.statusCode || 500;
  // Définition du statut par défaut à 'error' si non défini
  err.status = err.status || 'error';

  // En mode développement, envoyer tous les détails de l'erreur
  if (config.server.isDev) {
    sendErrorDev(err, res);
  } else {
    // En mode production, filtrer et transformer les erreurs
    let error = { ...err };
    // Copie du message d'erreur original
    error.message = err.message;

    // Transformation des erreurs CastError de MongoDB
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    // Transformation des erreurs de clé dupliquée
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    // Transformation des erreurs de validation
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    // Transformation des erreurs de jeton JWT invalide
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    // Transformation des erreurs de jeton JWT expiré
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Envoi de la réponse d'erreur filtrée
    sendErrorProd(error, res);
  }
};

// Exportation du middleware de gestion des erreurs
module.exports = errorHandler;
