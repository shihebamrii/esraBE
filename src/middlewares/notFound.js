// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');

// Middleware pour gérer les requêtes vers des routes inexistantes (erreur 404)
const notFound = (req, _res, next) => {
  // Création d'un message d'erreur indiquant que la route demandée n'existe pas
  const message = `La route ${req.originalUrl} est introuvable !`;
  // Passage de l'erreur au middleware de gestion des erreurs
  next(new AppError(message, 404));
};

// Exportation du middleware
module.exports = { notFound };
