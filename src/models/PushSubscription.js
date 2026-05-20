// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les abonnements aux notifications push
const pushSubscriptionSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur abonné, référence vers User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // URL du point de terminaison du service de notifications push
    endpoint: {
      type: String,
      required: true,
    },
    // Clés de chiffrement nécessaires pour envoyer les notifications
    keys: {
      // Clé publique pour le chiffrement des messages push
      p256dh: {
        type: String,
        required: true,
      },
      // Clé d'authentification pour le service push
      auth: {
        type: String,
        required: true,
      },
    },
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
  }
);

// Index pour chercher rapidement les abonnements par utilisateur
pushSubscriptionSchema.index({ user: 1 });
// Index unique sur le point de terminaison car chaque navigateur a un seul endpoint
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

// Exportation du modèle PushSubscription créé à partir du schéma
module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
