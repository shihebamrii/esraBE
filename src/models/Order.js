// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');
// Importation du module crypto pour générer des jetons aléatoires sécurisés
const crypto = require('crypto');

// Définition du schéma pour un élément individuel dans une commande
const orderItemSchema = new mongoose.Schema(
  {
    // Type de l'élément commandé (photo, pack ou contenu)
    type: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },

    // Identifiant de l'élément, référence dynamique selon le type
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'items.type',
    },

    // Prix de l'élément au moment de l'achat
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // Titre de l'élément (copie pour historique)
    title: String,

    // Type de licence choisie (personnelle ou commerciale)
    licenseType: {
      type: String,
      enum: ['personal', 'commercial'],
      default: 'personal',
    },
  },
  // Pas de génération d'identifiant unique pour les éléments de commande
  { _id: false }
);

// Définition du schéma pour un jeton de téléchargement
const downloadTokenSchema = new mongoose.Schema(
  {
    // Valeur du jeton, stockée sous forme hachée
    token: {
      type: String,
      required: true,
    },

    // Type de l'élément associé au jeton (photo, pack ou contenu)
    itemType: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },

    // Identifiant de l'élément associé au jeton
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    }
  },
  // Génération automatique d'un identifiant unique pour chaque jeton
  { _id: true }
);

// Définition du schéma principal pour les commandes
const orderSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur qui a passé la commande, référence vers User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Liste des éléments achetés dans cette commande
    items: [orderItemSchema],

    // Montant total de la commande
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    // Devise utilisée pour le paiement, par défaut le dinar tunisien
    currency: {
      type: String,
      default: 'TND',
      uppercase: true,
    },

    // Statut du paiement (en attente, payé, échoué ou remboursé)
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },

    // Fournisseur de paiement utilisé (mock, stripe ou paytech)
    paymentProvider: {
      type: String,
      enum: ['mock', 'stripe', 'paytech'],
    },

    // Identifiant du paiement chez le fournisseur
    paymentId: String,

    // Liste des jetons de téléchargement générés pour cette commande
    downloadTokens: [downloadTokenSchema],

    // Métadonnées supplémentaires au format libre
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Informations de facturation du client
    billingInfo: {
      name: String,
      email: String,
      address: String,
      country: String,
    },

    // Notes supplémentaires sur la commande
    notes: String,

    // Date et heure du paiement
    paidAt: Date,

    // Date et heure de l'annulation
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

// Index pour chercher rapidement les commandes par utilisateur
orderSchema.index({ userId: 1 });
// Index pour filtrer par statut de paiement
orderSchema.index({ paymentStatus: 1 });
// Index pour trier par date de création décroissante
orderSchema.index({ createdAt: -1 });
// Index pour chercher par identifiant de paiement
orderSchema.index({ paymentId: 1 });
// Index pour chercher par jeton de téléchargement
orderSchema.index({ 'downloadTokens.token': 1 });

// Propriété virtuelle pour obtenir le nombre d'éléments dans la commande
orderSchema.virtual('itemCount').get(function () {
  return this.items ? this.items.length : 0;
});

// Propriété virtuelle pour vérifier si la commande est payée
orderSchema.virtual('isPaid').get(function () {
  return this.paymentStatus === 'paid';
});

// Méthode d'instance pour créer un jeton de téléchargement pour un élément
orderSchema.methods.createDownloadToken = function (itemType, itemId) {
  // Génération d'un jeton aléatoire de 32 octets converti en hexadécimal
  const rawToken = crypto.randomBytes(32).toString('hex');

  // Hachage du jeton avec SHA-256 pour le stockage sécurisé
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  // Ajout du jeton haché dans la liste des jetons de téléchargement
  this.downloadTokens.push({
    token: hashedToken,
    itemType,
    itemId,
  });

  // Retour du jeton brut (non haché) pour l'envoyer à l'utilisateur
  return rawToken;
};

// Méthode d'instance pour vérifier la validité d'un jeton de téléchargement
orderSchema.methods.verifyDownloadToken = function (rawToken) {
  // Hachage du jeton reçu pour le comparer avec celui stocké
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  // Recherche du jeton correspondant dans la liste des jetons
  const tokenDoc = this.downloadTokens.find(
    (t) => t.token === hashedToken
  );

  // Retourne le jeton trouvé ou null si non trouvé
  return tokenDoc || null;
};

// Méthode d'instance pour marquer l'utilisation d'un jeton de téléchargement
orderSchema.methods.useDownloadToken = async function (rawToken) {
  // Pas de limite d'utilisation, la fonction est gardée pour compatibilité
};

// Méthode d'instance pour marquer la commande comme payée
orderSchema.methods.markAsPaid = async function (paymentId) {
  // Mise à jour du statut du paiement à "payé"
  this.paymentStatus = 'paid';
  // Enregistrement de l'identifiant du paiement
  this.paymentId = paymentId;
  // Enregistrement de la date du paiement
  this.paidAt = new Date();
  // Sauvegarde de la commande dans la base de données
  await this.save();
};

// Création du modèle Order à partir du schéma défini
const Order = mongoose.model('Order', orderSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Order;
