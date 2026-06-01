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

  let field = '';
  let value = '';

  // Extraction de la valeur et de la clé dupliquée depuis keyValue ou le message d'erreur
  if (err.keyValue) {
    const keys = Object.keys(err.keyValue);
    if (keys.length > 0) {
      field = keys[0];
      value = err.keyValue[field];
    }
  } else {
    // Extraction depuis errmsg ou message (fallback)
    const msg = err.errmsg || err.message || '';
    
    // Exemple d'errmsg: index: email_1 dup key: { email: "chihebamri@gmail.com" }
    const indexMatch = msg.match(/index:\s+([a-zA-Z0-9_-]+)/);
    if (indexMatch) {
      field = indexMatch[1].replace(/_\d+$/, ''); // Supprime le _1, _2 à la fin de l'index
    }
    
    const valueMatch = msg.match(/(["'])(\\?.)*?\1/);
    if (valueMatch) {
      value = valueMatch[0].replace(/['"]/g, '');
    } else {
      const dupKeyMatch = msg.match(/dup key:\s*\{\s*([^:]+):\s*"([^"]+)"\s*\}/);
      if (dupKeyMatch) {
        field = dupKeyMatch[1].trim();
        value = dupKeyMatch[2].trim();
      }
    }
  }

  // Si on n'a pas trouvé de champ, on essaie de deviner si le message contient 'email'
  if (!field && (err.errmsg || err.message || '').includes('email')) {
    field = 'email';
  }

  let message = `Valeur dupliquée. Veuillez utiliser une autre valeur !`;
  
  if (field === 'email') {
    message = `Cette adresse e-mail est déjà associée à un compte. Veuillez vous connecter ou utiliser une autre adresse.`;
  } else if (field === 'username' || field === 'pseudo') {
    message = `Ce nom d'utilisateur est déjà pris. Veuillez en choisir un autre.`;
  } else if (field) {
    const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
    message = `La valeur pour le champ "${formattedField}" est déjà utilisée. Veuillez en choisir une autre.`;
  } else if (value && value !== 'unknown') {
    message = `La valeur "${value}" existe déjà. Veuillez utiliser une autre valeur.`;
  }

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

  // Transformation des erreurs connues pour obtenir des messages conviviaux et des codes de statut corrects
  let error = err;

  if (err.name === 'CastError') {
    error = handleCastErrorDB(err);
    error.stack = err.stack;
  } else if (err.code === 11000) {
    error = handleDuplicateFieldsDB(err);
    error.stack = err.stack;
  } else if (err.name === 'ValidationError') {
    error = handleValidationErrorDB(err);
    error.stack = err.stack;
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
    error.stack = err.stack;
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
    error.stack = err.stack;
  }

  // En mode développement, envoyer tous les détails de l'erreur
  if (config.server.isDev) {
    sendErrorDev(error, res);
  } else {
    // En mode production, envoyer uniquement la réponse d'erreur filtrée
    sendErrorProd(error, res);
  }
};

// Exportation du middleware de gestion des erreurs
module.exports = errorHandler;
