// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les demandes de contact (formulaire "Contactez-nous")
const inquirySchema = new mongoose.Schema(
  {
    // Nom de la personne qui envoie le message, obligatoire
    name: {
      type: String,
      required: [true, 'Le nom est obligatoire !'],
      trim: true,
      maxlength: [100, 'Le nom est trop long'],
    },

    // Adresse email de l'expéditeur, obligatoire et en minuscules
    email: {
      type: String,
      required: [true, "L'e-mail est obligatoire !"],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "L'e-mail n'est pas valide !",
      ],
    },

    // Sujet du message, obligatoire
    subject: {
      type: String,
      required: [true, 'Le sujet est obligatoire !'],
      trim: true,
      maxlength: [200, 'Le sujet est trop long'],
    },

    // Contenu du message, obligatoire
    message: {
      type: String,
      required: [true, 'Le message est obligatoire !'],
      trim: true,
      maxlength: [2000, 'Le message est trop long'],
    },

    // Statut du message (en attente, lu, répondu ou archivé)
    status: {
      type: String,
      enum: ['pending', 'read', 'replied', 'archived'],
      default: 'pending',
    },

    // Notes de l'administrateur sur ce message
    adminNotes: {
      type: String,
      trim: true,
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

// Index pour filtrer rapidement par statut
inquirySchema.index({ status: 1 });
// Index pour chercher rapidement par adresse email
inquirySchema.index({ email: 1 });
// Index pour trier par date de création décroissante
inquirySchema.index({ createdAt: -1 });

// Création du modèle Inquiry à partir du schéma défini
const Inquiry = mongoose.model('Inquiry', inquirySchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Inquiry;
