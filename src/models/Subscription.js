// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour les abonnements des utilisateurs
const subscriptionSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur abonné, référence vers User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Type de plan d'abonnement (gratuit, professionnel ou institutionnel)
    plan: {
      type: String,
      enum: ['free', 'pro', 'institutional'],
      required: true,
      default: 'free',
    },

    // Date de début de l'abonnement, par défaut la date actuelle
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Date de fin de l'abonnement
    endDate: {
      type: Date,
    },

    // Statut de l'abonnement (actif, annulé, expiré ou en attente)
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'pending'],
      default: 'active',
    },

    // Identifiant de l'abonnement chez le fournisseur de paiement externe
    externalSubscriptionId: String,

    // Informations sur le paiement de l'abonnement
    paymentInfo: {
      // Nom du fournisseur de paiement
      provider: String,
      // Date du dernier paiement effectué
      lastPaymentDate: Date,
      // Date du prochain paiement prévu
      nextBillingDate: Date,
      // Montant du paiement
      amount: Number,
      // Devise utilisée
      currency: String,
    },

    // Fonctionnalités incluses dans le plan d'abonnement
    features: {
      // Nombre maximum de téléchargements (0 signifie illimité)
      maxDownloads: { type: Number, default: 0 },
      // Accès à la qualité HD
      hdQuality: { type: Boolean, default: false },
      // Autorisation d'utilisation commerciale
      commercialUse: { type: Boolean, default: false },
      // Support technique prioritaire
      prioritySupport: { type: Boolean, default: false },
    },

    // Raison de l'annulation de l'abonnement
    cancellationReason: String,
    // Date de l'annulation de l'abonnement
    cancelledAt: Date,
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

// Index pour chercher rapidement les abonnements par utilisateur
subscriptionSchema.index({ userId: 1 });
// Index pour filtrer par statut d'abonnement
subscriptionSchema.index({ status: 1 });
// Index pour filtrer par date de fin
subscriptionSchema.index({ endDate: 1 });

// Propriété virtuelle pour vérifier si l'abonnement est actuellement actif
subscriptionSchema.virtual('isActive').get(function () {
  // L'abonnement n'est pas actif si le statut n'est pas "active"
  if (this.status !== 'active') return false;
  // L'abonnement n'est pas actif si la date de fin est passée
  if (this.endDate && this.endDate < new Date()) return false;
  // Sinon l'abonnement est actif
  return true;
});

// Propriété virtuelle pour calculer le nombre de jours restants
subscriptionSchema.virtual('daysRemaining').get(function () {
  // Si aucune date de fin n'est définie, on retourne null
  if (!this.endDate) return null;
  // Calcul de la différence en millisecondes entre la date de fin et maintenant
  const diff = this.endDate - new Date();
  // Conversion en jours et retour de la valeur (minimum 0)
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Méthode d'instance pour annuler l'abonnement
subscriptionSchema.methods.cancel = async function (reason = '') {
  // Mise à jour du statut à "annulé"
  this.status = 'cancelled';
  // Enregistrement de la raison de l'annulation
  this.cancellationReason = reason;
  // Enregistrement de la date d'annulation
  this.cancelledAt = new Date();
  // Sauvegarde dans la base de données
  await this.save();
};

// Méthode d'instance pour renouveler l'abonnement
subscriptionSchema.methods.renew = async function (newEndDate) {
  // Remise du statut à "actif"
  this.status = 'active';
  // Mise à jour de la nouvelle date de fin
  this.endDate = newEndDate;
  // Suppression de la raison d'annulation
  this.cancellationReason = undefined;
  // Suppression de la date d'annulation
  this.cancelledAt = undefined;
  // Sauvegarde dans la base de données
  await this.save();
};

// Méthode statique pour trouver l'abonnement actif d'un utilisateur
subscriptionSchema.statics.findActiveByUser = function (userId) {
  return this.findOne({
    userId,
    status: 'active',
    // L'abonnement doit soit ne pas avoir de date de fin, soit avoir une date future
    $or: [
      { endDate: { $gt: new Date() } },
      { endDate: null },
    ],
  });
};

// Création du modèle Subscription à partir du schéma défini
const Subscription = mongoose.model('Subscription', subscriptionSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Subscription;
