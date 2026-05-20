// Déclaration de la fonction asyncHandler qui enveloppe les fonctions asynchrones pour gérer les erreurs
const asyncHandler = (fn) => {
  // Retour d'une nouvelle fonction middleware Express avec les paramètres req, res, next
  return (req, res, next) => {
    // Exécution de la fonction asynchrone et capture des erreurs via catch pour les transmettre au middleware d'erreur
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Exportation de la fonction asyncHandler pour l'utiliser dans d'autres fichiers
module.exports = asyncHandler;
