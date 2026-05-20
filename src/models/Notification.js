// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les notifications envoyées aux utilisateurs
const notificationSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur destinataire, référence vers User
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Titre de la notification, obligatoire
    title: {
      type: String,
      required: true,
    },
    // Message de la notification, obligatoire
    message: {
      type: String,
      required: true,
    },
    // Type de notification (nouveau contenu, statut d'approbation ou système)
    type: {
      type: String,
      enum: ['new_content', 'approval_status', 'system'],
      default: 'system',
    },
    // Indique si la notification a été lue ou non
    isRead: {
      type: Boolean,
      default: false,
    },
    // Lien optionnel associé à la notification
    link: {
      type: String,
    },
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
  }
);

// Index pour chercher rapidement les notifications d'un utilisateur par statut de lecture
notificationSchema.index({ recipient: 1, isRead: 1 });
// Index pour trier les notifications par date de création décroissante
notificationSchema.index({ createdAt: -1 });

// Exportation du modèle Notification créé à partir du schéma
module.exports = mongoose.model('Notification', notificationSchema);
