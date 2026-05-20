// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');

// Middleware de validation des données avec un schéma Joi
const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    // Récupération des données à valider depuis la source spécifiée (body, query ou params)
    const data = req[source];

    // Validation des données avec le schéma Joi
    const { error, value } = schema.validate(data, {
      // Retourner toutes les erreurs au lieu de s'arrêter à la première
      abortEarly: false,
      // Supprimer les champs inconnus non définis dans le schéma
      stripUnknown: true,
    });

    // Si des erreurs de validation sont trouvées
    if (error) {
      // Regroupement de tous les messages d'erreur en une seule chaîne
      const messages = error.details.map((detail) => detail.message).join('. ');
      // Retour d'une erreur 400 avec les messages de validation
      return next(new AppError(messages, 400));
    }

    // Remplacement des données dans la requête par les données nettoyées et validées
    req[source] = value;
    // Passage au middleware suivant
    next();
  };
};

// Middleware de validation d'un identifiant MongoDB dans les paramètres de la route
const validateObjectId = (paramName = 'id') => {
  return (req, _res, next) => {
    // Récupération de l'identifiant depuis les paramètres de la route
    const id = req.params[paramName];

    // Vérification que l'identifiant est un ObjectId MongoDB valide (24 caractères hexadécimaux)
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      // Retour d'une erreur 400 si l'identifiant est invalide
      return next(new AppError(`L'identifiant ${paramName} n'est pas valide !`, 400));
    }

    // Passage au middleware suivant si l'identifiant est valide
    next();
  };
};

// Exportation des middlewares de validation
module.exports = {
  validate,
  validateObjectId,
};
