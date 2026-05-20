// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour le journal d'audit (suivi des actions des utilisateurs)
const auditLogSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur qui a fait l'action, référence vers la collection User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Type d'action effectuée, doit être une valeur parmi la liste définie
    action: {
      type: String,
      required: true,
      enum: [
        'AUTH_LOGIN',
        'AUTH_LOGOUT',
        'AUTH_REGISTER',
        'AUTH_PASSWORD_RESET',
        'AUTH_PASSWORD_CHANGE',
        'AUTH_REFRESH_TOKEN',

        'CONTENT_CREATE',
        'CONTENT_UPDATE',
        'CONTENT_DELETE',
        'CONTENT_VIEW',
        'CONTENT_DOWNLOAD',

        'PHOTO_UPLOAD',
        'PHOTO_UPDATE',
        'PHOTO_DELETE',
        'PHOTO_PREVIEW',
        'PHOTO_DOWNLOAD',

        'PACK_CREATE',
        'PACK_UPDATE',
        'PACK_DELETE',

        'PLAYLIST_CREATE',
        'PLAYLIST_UPDATE',
        'PLAYLIST_DELETE',

        'ORDER_CREATE',
        'ORDER_PAID',
        'ORDER_CANCELLED',
        'ORDER_REFUNDED',

        'USER_UPDATE',
        'USER_DELETE',
        'USER_DATA_EXPORT',

        'ADMIN_USER_ROLE_CHANGE',
        'ADMIN_USER_DEACTIVATE',

        'RATE_LIMIT_EXCEEDED',
        'SUSPICIOUS_ACTIVITY',
        'OTHER',
      ],
    },

    // Adresse IP de l'utilisateur qui a fait la requête
    ip: {
      type: String,
    },

    // Informations sur le navigateur ou l'outil utilisé (User-Agent)
    userAgent: {
      type: String,
    },

    // Ressource concernée par l'action (par exemple un identifiant de contenu)
    resource: {
      type: String,
    },

    // Détails supplémentaires sur l'action, format libre
    details: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Résultat de l'action : succès, échec ou avertissement
    result: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      default: 'success',
    },

    // Message d'erreur en cas d'échec de l'action
    errorMessage: String,

    // Date et heure de l'action, par défaut le moment actuel
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Désactivation de la gestion automatique des champs createdAt et updatedAt
    timestamps: false,
  }
);

// Index pour accélérer la recherche par identifiant d'utilisateur
auditLogSchema.index({ userId: 1 });
// Index pour accélérer la recherche par type d'action
auditLogSchema.index({ action: 1 });
// Index pour trier rapidement les logs du plus récent au plus ancien
auditLogSchema.index({ timestamp: -1 });
// Index pour accélérer la recherche par adresse IP
auditLogSchema.index({ ip: 1 });
// Index pour accélérer la recherche par ressource
auditLogSchema.index({ resource: 1 });

// Index TTL qui supprime automatiquement les logs après 90 jours
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Méthode statique pour enregistrer un nouveau log d'audit
auditLogSchema.statics.log = async function (logData) {
  try {
    // Création du log dans la base de données
    await this.create(logData);
  } catch (error) {
    // Affichage de l'erreur dans la console sans arrêter l'application
    console.error('❌ Failed to create audit log:', error.message);
  }
};

// Méthode statique pour chercher les logs d'un utilisateur avec des filtres optionnels
auditLogSchema.statics.findByUser = function (userId, options = {}) {
  // Extraction des options : limite de résultats, type d'action, dates de début et fin
  const { limit = 50, action, startDate, endDate } = options;

  // Construction de la requête avec l'identifiant de l'utilisateur
  const query = { userId };

  // Ajout du filtre par action si elle est fournie
  if (action) query.action = action;
  // Ajout du filtre par intervalle de dates si les dates sont fournies
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  // Exécution de la recherche, triée par date décroissante avec une limite de résultats
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Méthode statique pour trouver les activités suspectes récentes
auditLogSchema.statics.findSuspiciousActivity = function (hours = 24) {
  // Calcul de la date limite selon le nombre d'heures donné
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Recherche des logs suspects ou en échec depuis cette date
  return this.find({
    timestamp: { $gte: since },
    $or: [
      { action: 'SUSPICIOUS_ACTIVITY' },
      { action: 'RATE_LIMIT_EXCEEDED' },
      { result: 'failure' },
    ],
  }).sort({ timestamp: -1 });
};

// Création du modèle AuditLog à partir du schéma défini
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = AuditLog;
