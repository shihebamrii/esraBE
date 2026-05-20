// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour le contenu (vidéos, podcasts, documentaires, etc.)
const contentSchema = new mongoose.Schema(
  {
    // Titre du contenu, obligatoire, avec une longueur maximale de 200 caractères
    title: {
      type: String,
      required: [true, 'Le titre est obligatoire !'],
      trim: true,
      maxlength: [200, 'Le titre est trop long'],
    },

    // Description du contenu, avec une longueur maximale de 5000 caractères
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'La description est trop longue'],
    },

    // Liste des auteurs ou producteurs du contenu
    authors: [{
      type: String,
      trim: true,
    }],

    // Type de contenu (vidéo, podcast, documentaire, etc.)
    type: {
      type: String,
      required: [true, 'Le type de contenu est obligatoire !'],
      trim: true,
    },

    // Liste des thèmes ou sujets du contenu
    themes: [{
      type: String,
      trim: true,
    }],

    // Région ou gouvernorat lié au contenu
    region: {
      type: String,
      trim: true,
    },

    // Mots-clés pour faciliter la recherche, en minuscules
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],

    // Langue du contenu (arabe, français, anglais ou autre)
    language: {
      type: String,
      enum: ['ar', 'fr', 'en', 'other'],
      default: 'ar',
    },

    // Durée du contenu en secondes
    duration: {
      type: Number,
      min: 0,
    },

    // Identifiant du fichier miniature stocké dans GridFS
    thumbnailFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Identifiant du fichier principal stocké dans GridFS, obligatoire
    fileFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Le fichier du contenu est obligatoire !'],
    },

    // Droits d'utilisation du contenu (gratuit, payant ou sous licence)
    rights: {
      type: String,
      enum: ['free', 'paid', 'license'],
      default: 'free',
    },

    // Prix du contenu en dinars, valeur par défaut 0
    price: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Prix pour une licence personnelle
    pricePersonal: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Prix pour une licence commerciale
    priceCommercial: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Informations sur la licence du contenu
    licenseInfo: {
      type: String,
      trim: true,
    },

    // Visibilité du contenu : public ou privé
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    // Identifiant de l'utilisateur qui a créé le contenu, référence vers User
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Date de publication du contenu
    publishedAt: {
      type: Date,
    },

    // Métadonnées supplémentaires au format libre
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Nombre de vues du contenu
    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Nombre de téléchargements du contenu
    downloads: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Informations sur le fichier (nom, type MIME et taille en octets)
    fileInfo: {
      filename: String,
      contentType: String,
      size: Number,
    },

    // Statut d'approbation du contenu (en attente, approuvé ou rejeté)
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
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

// Index de recherche textuelle sur le titre, la description et les mots-clés
contentSchema.index(
  {
    title: 'text',
    description: 'text',
    tags: 'text',
  },
  {
    language_override: 'none',
  }
);

// Index pour filtrer par type de contenu
contentSchema.index({ type: 1 });
// Index pour filtrer par région
contentSchema.index({ region: 1 });
// Index pour filtrer par droits d'utilisation
contentSchema.index({ rights: 1 });
// Index pour filtrer par visibilité
contentSchema.index({ visibility: 1 });
// Index pour trier par date de création décroissante
contentSchema.index({ createdAt: -1 });
// Index pour trier par nombre de vues décroissant
contentSchema.index({ views: -1 });

// Propriété virtuelle pour vérifier si le contenu est gratuit
contentSchema.virtual('isFree').get(function () {
  return this.rights === 'free' || ((this.pricePersonal || this.price || 0) === 0 && (this.priceCommercial || 0) === 0);
});

// Propriété virtuelle pour obtenir l'URL de la miniature
contentSchema.virtual('thumbnailUrl').get(function () {
  // Retourne null si aucune miniature n'est définie
  if (!this.thumbnailFileId) return null;
  // Construction de l'URL vers le fichier miniature
  return `/api/media/${this.thumbnailFileId}`;
});

// Propriété virtuelle pour obtenir l'URL du contenu
contentSchema.virtual('contentUrl').get(function () {
  // Construction de l'URL vers le fichier principal
  return `/api/media/${this.fileFileId}`;
});

// Méthode d'instance pour augmenter le compteur de vues de 1
contentSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
};

// Méthode d'instance pour augmenter le compteur de téléchargements de 1
contentSchema.methods.incrementDownloads = async function () {
  this.downloads += 1;
  await this.save();
};

// Création du modèle Content à partir du schéma défini
const Content = mongoose.model('Content', contentSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Content;
