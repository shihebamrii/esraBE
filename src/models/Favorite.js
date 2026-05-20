// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les favoris des utilisateurs
const favoriteSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur qui a ajouté le favori, référence vers User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Type de l'élément mis en favori (Photo, Pack ou Content)
    itemType: {
      type: String,
      enum: ['Photo', 'Pack', 'Content'],
      required: true,
    },
    // Identifiant de l'élément mis en favori, référence dynamique selon le type
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'itemType',
    },
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
  }
);

// Index unique pour empêcher les doublons (un utilisateur ne peut pas ajouter deux fois le même élément)
favoriteSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

// Création du modèle Favorite à partir du schéma défini
const Favorite = mongoose.model('Favorite', favoriteSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Favorite;
