// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les packs achetés par les utilisateurs (quotas restants)
const userPackSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur propriétaire du pack, référence vers User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Identifiant du pack original acheté, référence vers Pack
    packId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pack',
      required: true,
    },

    // Identifiant de la commande associée à cet achat, référence vers Order
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },

    // Module concerné par le pack (tounesna ou impact)
    module: {
      type: String,
      enum: ['tounesna', 'impact'],
      required: true,
    },

    // Quotas restants pour les différents types de contenu
    quotas: {
      // Nombre de photos restantes à télécharger
      photosRemaining: { type: Number, default: 0 },
      // Nombre de vidéos courtes (reels) restantes
      reelsRemaining: { type: Number, default: 0 },
      // Nombre de vidéos restantes
      videosRemaining: { type: Number, default: 0 },
      // Nombre de documentaires restants
      documentariesRemaining: { type: Number, default: 0 },
      // Nombre de podcasts restants
      podcastsRemaining: { type: Number, default: 0 },
      // Nombre de success stories restantes
      successStoryRemaining: { type: Number, default: 0 },
    },

    // Qualité maximale autorisée pour les téléchargements
    quality: {
      type: String,
      enum: ['standard', 'hd', '4k'],
      default: 'standard',
    },

    // Date d'achat du pack, par défaut la date actuelle
    purchasedAt: {
      type: Date,
      default: Date.now,
    },

    // Indique si le pack est encore actif pour l'utilisateur
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
  }
);

// Index pour chercher rapidement les packs par utilisateur
userPackSchema.index({ userId: 1 });
// Index pour chercher rapidement par identifiant de pack
userPackSchema.index({ packId: 1 });
// Index pour filtrer par statut actif
userPackSchema.index({ isActive: 1 });

// Exportation du modèle UserPack créé à partir du schéma
module.exports = mongoose.model('UserPack', userPackSchema);
