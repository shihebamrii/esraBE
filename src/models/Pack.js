// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les packs (collections de photos ou abonnements)
const packSchema = new mongoose.Schema(
  {
    // Titre du pack, obligatoire, avec une longueur maximale de 200 caractères
    title: {
      type: String,
      required: [true, 'Le titre du pack est obligatoire !'],
      trim: true,
      maxlength: [200, 'Le titre est trop long'],
    },

    // Description du pack, avec une longueur maximale de 2000 caractères
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'La description est trop longue'],
    },

    // Type du pack (collection de photos ou abonnement)
    type: {
      type: String,
      enum: ['collection', 'membership'],
      default: 'collection',
    },

    // Fonctionnalités disponibles pour les packs de type abonnement
    membershipFeatures: {
      // Nombre maximum de photos autorisées
      photosLimit: { type: Number, default: 0 },
      // Nombre maximum de vidéos courtes (reels) autorisées
      reelsLimit: { type: Number, default: 0 },
      // Nombre maximum de vidéos autorisées
      videosLimit: { type: Number, default: 0 },
      // Nombre maximum de documentaires autorisés
      documentariesLimit: { type: Number, default: 0 },
      // Nombre maximum de podcasts autorisés
      podcastsLimit: { type: Number, default: 0 },
      // Nombre maximum de success stories autorisées
      successStoryLimit: { type: Number, default: 0 },
      // Qualité du contenu accessible (standard, HD ou 4K)
      quality: { type: String, enum: ['standard', 'hd', '4k'], default: 'standard' },
      // Module concerné (tounesna, impact ou les deux)
      module: { type: String, enum: ['tounesna', 'impact', 'both'] },
    },

    // Liste des identifiants des photos incluses dans le pack (pour les collections)
    photoIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
    }],

    // Liste des identifiants des contenus inclus dans le pack
    contentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
    }],

    // Prix du pack en dinars tunisiens, obligatoire
    priceTND: {
      type: Number,
      required: [true, 'Le prix est obligatoire !'],
      min: [0, 'Le prix doit être positif'],
    },

    // Étiquette de région liée au pack
    regionTag: {
      type: String,
      trim: true,
    },

    // Identifiant de la photo de couverture du pack, référence vers Photo
    coverPhotoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
    },

    // Indique si le pack est actif et disponible à la vente
    isActive: {
      type: Boolean,
      default: true,
    },

    // Identifiant de l'utilisateur qui a créé le pack, référence vers User
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Nombre total d'achats effectués pour ce pack
    purchases: {
      type: Number,
      default: 0,
    },

    // Identifiant du fichier ZIP pré-généré dans GridFS
    cachedZipFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Date de la dernière génération du fichier ZIP
    zipGeneratedAt: Date,
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
    // Inclusion des propriétés virtuelles lors de la conversion en JSON
    toJSON: { virtuals: true },
    // Inclusion des propriétés virtuelles lors de la conversion en objet
    toObject: { virtuals: true },
  }
);

// Index pour filtrer rapidement par étiquette de région
packSchema.index({ regionTag: 1 });
// Index pour filtrer par statut actif
packSchema.index({ isActive: 1 });
// Index pour trier par date de création décroissante
packSchema.index({ createdAt: -1 });
// Index pour filtrer par prix
packSchema.index({ priceTND: 1 });

// Propriété virtuelle pour obtenir le nombre de photos dans le pack
packSchema.virtual('photoCount').get(function () {
  return this.photoIds ? this.photoIds.length : 0;
});

// Propriété virtuelle pour obtenir le nombre de contenus dans le pack
packSchema.virtual('contentCount').get(function () {
  return this.contentIds ? this.contentIds.length : 0;
});

// Propriété virtuelle pour calculer l'économie par rapport à l'achat individuel
packSchema.virtual('savings').get(function () {
  // Variable pour stocker le total des prix individuels
  let individualTotal = 0;
  // Indicateur pour savoir si le calcul est possible
  let calculationPossible = false;

  // Si les photos sont peuplées, on additionne leurs prix individuels
  if (this.populated('photoIds') && Array.isArray(this.photoIds)) {
    individualTotal += this.photoIds.reduce((sum, photo) => sum + (photo.priceTND || 0), 0);
    calculationPossible = true;
  }

  // Si les contenus sont peuplés, on additionne leurs prix individuels
  if (this.populated('contentIds') && Array.isArray(this.contentIds)) {
    individualTotal += this.contentIds.reduce((sum, content) => sum + (content.price || 0), 0);
    calculationPossible = true;
  }

  // Si le calcul est possible, on retourne la différence (économie réalisée)
  if (calculationPossible) {
    return Math.max(0, individualTotal - this.priceTND);
  }
  // Sinon on retourne null car le calcul n'est pas possible
  return null;
});

// Méthode d'instance pour augmenter le compteur d'achats de 1
packSchema.methods.incrementPurchases = async function () {
  this.purchases += 1;
  await this.save();
};

// Méthode d'instance pour vérifier si le fichier ZIP doit être régénéré
packSchema.methods.needsZipRegeneration = function () {
  // Si aucun fichier ZIP n'existe, il faut le générer
  if (!this.cachedZipFileId) return true;
  // Si aucune date de génération n'est enregistrée, il faut le générer
  if (!this.zipGeneratedAt) return true;

  // Si le pack a été modifié après la génération du ZIP, il faut le régénérer
  return this.updatedAt > this.zipGeneratedAt;
};

// Création du modèle Pack à partir du schéma défini
const Pack = mongoose.model('Pack', packSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Pack;
