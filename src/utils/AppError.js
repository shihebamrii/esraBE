// Définition de la classe AppError qui hérite de la classe native Error de JavaScript
class AppError extends Error {
  // Le constructeur prend un message d'erreur et un code de statut HTTP en paramètres
  constructor(message, statusCode) {
    // Appel du constructeur de la classe parente Error avec le message d'erreur
    super(message);

    // Stockage du code de statut HTTP (par exemple 404, 500)
    this.statusCode = statusCode;
    // Détermination du type de statut : "fail" si le code commence par 4 (erreur client), sinon "error" (erreur serveur)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // Marquage de cette erreur comme opérationnelle (erreur prévue et non un bug)
    this.isOperational = true;

    // Capture de la trace de la pile d'appels sans inclure le constructeur dans la trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Exportation de la classe AppError pour l'utiliser dans d'autres fichiers
module.exports = AppError;
