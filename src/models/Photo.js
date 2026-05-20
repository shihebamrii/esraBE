// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les photos (tourisme tunisien)
const photoSchema = new mongoose.Schema(
  {
    // Titre de la photo, obligatoire, avec une longueur maximale de 200 caractères
    title: {
      type: String,
      required: [true, 'Le titre de la photo est obligatoire !'],
      trim: true,
      maxlength: [200, 'Le titre est trop long'],
    },

    // Type de média (photo ou vidéo)
    mediaType: {
      type: String,
      enum: ['photo', 'video'],
      default: 'photo',
    },

    // Description de la photo, avec une longueur maximale de 2000 caractères
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'La description est trop longue'],
    },

    // Gouvernorat où la photo a été prise, obligatoire
    governorate: {
      type: String,
      required: [true, 'Le gouvernorat est obligatoire !'],
      trim: true,
    },

    // Type de paysage représenté sur la photo, obligatoire
    landscapeType: {
      type: String,
      enum: ['sea', 'desert', 'mountain', 'village', 'oasis', 'forest', 'city', 'historical', 'other'],
      required: [true, 'Le type de paysage est obligatoire !'],
    },

    // Identifiant du fichier basse résolution dans GridFS
    lowResFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // URL externe de l'image (pour les liens directs)
    imageUrl: {
      type: String,
      trim: true,
    },

    // Identifiant du fichier haute résolution dans GridFS
    highResFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Prix en dinars tunisiens (utilisé comme prix personnel par défaut)
    priceTND: {
      type: Number,
      min: [0, 'Le prix doit être positif'],
      default: 0,
    },

    // Prix pour une licence personnelle en dinars tunisiens
    pricePersonalTND: {
      type: Number,
      min: [0, 'Le prix doit être positif'],
      default: 0,
    },

    // Prix pour une licence commerciale en dinars tunisiens
    priceCommercialTND: {
      type: Number,
      min: [0, 'Le prix doit être positif'],
      default: 0,
    },

    // Indique si la photo contient un filigrane (watermark)
    watermark: {
      type: Boolean,
      default: true,
    },

    // Texte d'attribution affiché avec la photo
    attributionText: {
      type: String,
      default: 'Photo prise lors de la tournée de CnBees - Tourisme durable',
    },

    // Liste des packs qui contiennent cette photo, références vers Pack
    packs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pack',
    }],

    // Identifiant de l'utilisateur qui a téléchargé la photo, référence vers User
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Mots-clés pour faciliter la recherche, en minuscules
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],

    // Informations techniques sur les fichiers de la photo
    fileInfo: {
      // Informations sur le fichier haute résolution
      highRes: {
        filename: String,
        contentType: String,
        size: Number,
        width: Number,
        height: Number,
        duration: Number,
      },
      // Informations sur le fichier basse résolution
      lowRes: {
        filename: String,
        contentType: String,
        size: Number,
        width: Number,
        height: Number,
      },
    },

    // Nombre de téléchargements de l'aperçu gratuit
    previewDownloads: {
      type: Number,
      default: 0,
    },

    // Nombre total d'achats de cette photo
    purchases: {
      type: Number,
      default: 0,
    },

    // Nombre de téléchargements effectifs de la photo
    downloads: {
      type: Number,
      default: 0,
    },

    // Statut d'approbation de la photo (en attente, approuvée ou rejetée)
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
photoSchema.index(
  {
    title: 'text',
    description: 'text',
    tags: 'text',
  },
  {
    language_override: 'none',
  }
);

// Index pour filtrer par gouvernorat
photoSchema.index({ governorate: 1 });
// Index pour filtrer par type de paysage
photoSchema.index({ landscapeType: 1 });
// Index pour filtrer par prix
photoSchema.index({ priceTND: 1 });
// Index pour trier par date de création décroissante
photoSchema.index({ createdAt: -1 });

// Propriété virtuelle pour obtenir l'URL de l'aperçu (basse résolution)
photoSchema.virtual('previewUrl').get(function () {
  // Si une URL externe existe, on la retourne directement
  if (this.imageUrl) return this.imageUrl;
  // Sélection du fichier basse résolution ou haute résolution comme alternative
  const fileId = this.lowResFileId || this.highResFileId;
  // Construction de l'URL de l'aperçu
  return `/api/photos/${this._id}/preview`;
});

// Propriété virtuelle pour obtenir l'URL de la photo haute résolution
photoSchema.virtual('highResUrl').get(function () {
  // Si une URL externe existe, on la retourne directement
  if (this.imageUrl) return this.imageUrl;
  // Si aucun fichier haute résolution n'existe, on retourne null
  if (!this.highResFileId) return null;
  // Construction de l'URL vers le fichier haute résolution
  return `/api/media/${this.highResFileId}`;
});

// Propriété virtuelle pour vérifier si la photo est gratuite
photoSchema.virtual('isFree').get(function () {
  return (this.pricePersonalTND || this.priceTND || 0) === 0 && (this.priceCommercialTND || 0) === 0;
});

// Méthode d'instance pour augmenter le compteur de téléchargements d'aperçu de 1
photoSchema.methods.incrementPreviewDownloads = async function () {
  this.previewDownloads += 1;
  await this.save();
};

// Méthode d'instance pour augmenter le compteur d'achats de 1
photoSchema.methods.incrementPurchases = async function () {
  this.purchases += 1;
  await this.save();
};

// Création du modèle Photo à partir du schéma défini
const Photo = mongoose.model('Photo', photoSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Photo;
