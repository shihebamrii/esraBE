// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les listes de lecture (séries, collections et podcasts)
const playlistSchema = new mongoose.Schema(
  {
    // Titre de la liste de lecture, obligatoire
    title: {
      type: String,
      required: [true, 'Le titre est obligatoire !'],
      trim: true,
      maxlength: [200, 'Le titre est trop long'],
    },

    // Description de la liste de lecture
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'La description est trop longue'],
    },

    // Section à laquelle appartient la liste (impact ou tounesna)
    section: {
      type: String,
      enum: ['impact', 'tounesna'],
      default: 'impact',
    },

    // Type de liste de lecture (série, collection ou série de podcasts)
    type: {
      type: String,
      required: [true, 'Le type de playlist est obligatoire !'],
      enum: ['series', 'collection', 'podcast_series'],
      default: 'series',
    },

    // Liste des contenus multimédias inclus avec leur ordre (pour la section impact)
    items: [{
      // Identifiant du contenu, référence vers Content
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
        required: true,
      },
      // Position du contenu dans la liste
      order: {
        type: Number,
        default: 0,
      }
    }],

    // Liste des photos incluses avec leur ordre (pour la section tounesna)
    photoItems: [{
      // Identifiant de la photo, référence vers Photo
      photoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Photo',
        required: true,
      },
      // Position de la photo dans la liste
      order: {
        type: Number,
        default: 0,
      }
    }],

    // Identifiant du fichier miniature de couverture dans GridFS
    thumbnailFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Liste des thèmes ou sujets de la liste de lecture
    themes: [{
      type: String,
      trim: true,
    }],

    // Région ou gouvernorat lié à la liste de lecture
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

    // Indique si la liste de lecture est active et visible
    isActive: {
      type: Boolean,
      default: true,
    },

    // Identifiant de l'utilisateur qui a créé la liste, référence vers User
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Nombre de vues de la liste de lecture
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
  }
);

// Index de recherche textuelle sur le titre, la description et les mots-clés
playlistSchema.index({ title: 'text', description: 'text', tags: 'text' });
// Index pour filtrer par type de liste
playlistSchema.index({ type: 1 });
// Index pour filtrer par section
playlistSchema.index({ section: 1 });
// Index pour filtrer par statut actif
playlistSchema.index({ isActive: 1 });
// Index pour filtrer par créateur
playlistSchema.index({ createdBy: 1 });

// Exportation du modèle Playlist créé à partir du schéma
module.exports = mongoose.model('Playlist', playlistSchema);
