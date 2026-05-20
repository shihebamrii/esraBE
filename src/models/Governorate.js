// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les gouvernorats (les 24 gouvernorats de Tunisie)
const governorateSchema = new mongoose.Schema(
  {
    // Nom du gouvernorat en arabe, obligatoire
    name_ar: {
      type: String,
      required: [true, 'Le nom en arabe est obligatoire !'],
      trim: true,
    },

    // Nom du gouvernorat en français, obligatoire
    name_fr: {
      type: String,
      required: [true, 'Le nom en français est obligatoire !'],
      trim: true,
    },

    // Nom du gouvernorat en anglais
    name_en: {
      type: String,
      trim: true,
    },

    // Identifiant URL du gouvernorat, unique et en minuscules
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Région géographique (nord, centre ou sud)
    region: {
      type: String,
      enum: ['north', 'center', 'south'],
    },

    // Coordonnées géographiques du centre du gouvernorat
    coordinates: {
      lat: Number,
      lng: Number,
    },

    // Identifiant du fichier image représentatif dans GridFS
    imageFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Description courte du gouvernorat en trois langues
    description: {
      ar: String,
      fr: String,
      en: String,
    },

    // Nombre de photos disponibles pour ce gouvernorat
    photoCount: {
      type: Number,
      default: 0,
    },

    // Nombre de contenus disponibles pour ce gouvernorat
    contentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    // Ajout automatique des champs createdAt et updatedAt
    timestamps: true,
  }
);

// Index pour filtrer rapidement par région
governorateSchema.index({ region: 1 });

// Méthode statique pour récupérer tous les gouvernorats triés par nom arabe
governorateSchema.statics.getAllSorted = function () {
  return this.find().sort({ name_ar: 1 });
};

// Méthode statique pour récupérer les gouvernorats d'une région donnée
governorateSchema.statics.getByRegion = function (region) {
  return this.find({ region }).sort({ name_ar: 1 });
};

// Méthode statique pour mettre à jour le nombre de photos par gouvernorat
governorateSchema.statics.updatePhotoCounts = async function () {
  // Récupération du modèle Photo
  const Photo = mongoose.model('Photo');

  // Agrégation pour compter les photos par gouvernorat
  const counts = await Photo.aggregate([
    { $group: { _id: '$governorate', count: { $sum: 1 } } },
  ]);

  // Mise à jour du compteur de photos pour chaque gouvernorat trouvé
  for (const { _id, count } of counts) {
    await this.updateOne(
      { $or: [{ name_ar: _id }, { name_fr: _id }, { slug: _id }] },
      { photoCount: count }
    );
  }
};

// Création du modèle Governorate à partir du schéma défini
const Governorate = mongoose.model('Governorate', governorateSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Governorate;
