// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');

// Définition du schéma pour un élément individuel dans le panier
const cartItemSchema = new mongoose.Schema(
  {
    // Type de l'élément ajouté au panier (photo, pack ou contenu)
    type: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },

    // Identifiant unique de l'élément dans sa collection respective
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Prix de l'élément au moment de l'ajout au panier
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // Titre ou nom de l'élément
    title: String,

    // URL de l'image miniature de l'élément
    thumbnail: String,

    // Type de licence sélectionné (personnel ou commercial)
    licenseType: {
      type: String,
      enum: ['personal', 'commercial'],
      default: 'personal',
    },

    // Date et heure d'ajout de l'élément au panier
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  // Activation de la génération automatique d'un identifiant unique pour chaque élément
  { _id: true }
);

// Définition du schéma principal du panier pour chaque utilisateur
const cartSchema = new mongoose.Schema(
  {
    // Identifiant de l'utilisateur propriétaire du panier, référence vers User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Liste des éléments présents dans le panier
    items: [cartItemSchema],

    // Date de la dernière mise à jour des prix des éléments
    lastPriceUpdate: Date,
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

// Propriété virtuelle pour calculer le montant total du panier
cartSchema.virtual('total').get(function () {
  // Si le panier est vide, le total est 0
  if (!this.items || this.items.length === 0) return 0;
  // Addition de tous les prix des éléments du panier
  return this.items.reduce((sum, item) => sum + (item.price || 0), 0);
});

// Propriété virtuelle pour obtenir le nombre d'éléments dans le panier
cartSchema.virtual('itemCount').get(function () {
  // Retourne la taille du tableau d'éléments, ou 0 s'il est vide
  return this.items ? this.items.length : 0;
});

// Méthode d'instance pour ajouter un élément au panier
cartSchema.methods.addItem = async function (itemData) {
  // Vérification si l'élément existe déjà dans le panier (même type et même identifiant)
  const exists = this.items.some(
    (item) => item.type === itemData.type && item.itemId.toString() === itemData.itemId.toString()
  );

  // Si l'élément est déjà présent, on lance une erreur
  if (exists) {
    const AppError = require('../utils/AppError');
    throw new AppError("L'article existe déjà dans le panier !", 400);
  }

  // Ajout de l'élément dans le tableau des éléments du panier
  this.items.push(itemData);
  // Sauvegarde du panier dans la base de données
  await this.save();
};

// Méthode d'instance pour retirer un élément du panier
cartSchema.methods.removeItem = async function (itemId) {
  // Filtrage du tableau pour enlever l'élément avec l'identifiant donné
  this.items = this.items.filter((item) => item._id.toString() !== itemId);
  // Sauvegarde du panier dans la base de données
  await this.save();
};

// Méthode d'instance pour vider complètement le panier
cartSchema.methods.clear = async function () {
  // Réinitialisation de la liste des éléments à un tableau vide
  this.items = [];
  // Sauvegarde du panier dans la base de données
  await this.save();
};

// Méthode d'instance pour rafraîchir les prix des éléments depuis la base de données
cartSchema.methods.refreshPrices = async function () {
  // Importation des modèles nécessaires pour récupérer les données à jour
  const Photo = require('./Photo');
  const Pack = require('./Pack');
  const Content = require('./Content');

  // Parcours de chaque élément du panier
  for (const item of this.items) {
    let Model;
    // Sélection du modèle correspondant au type de l'élément
    switch (item.type) {
      case 'photo':
        Model = Photo;
        break;
      case 'pack':
        Model = Pack;
        break;
      case 'content':
        Model = Content;
        break;
    }

    // Si un modèle correspondant a été trouvé
    if (Model) {
      // Recherche de l'élément dans la base de données par son identifiant
      const doc = await Model.findById(item.itemId);
      // Si le document existe encore dans la base
      if (doc) {
        // Mise à jour du titre de l'élément
        item.title = doc.title;
        
        // Mise à jour du prix selon le type de licence
        if (item.type === 'photo') {
          if (item.licenseType === 'commercial') {
            item.price = doc.priceCommercialTND || 0;
          } else {
            item.price = doc.pricePersonalTND || doc.priceTND || 0;
          }
        } else if (item.type === 'content') {
          if (item.licenseType === 'commercial') {
            item.price = doc.priceCommercial || 0;
          } else {
            item.price = doc.pricePersonal || doc.price || 0;
          }
        } else {
          item.price = doc.priceTND || doc.price || 0;
        }
      }
    }
  }

  // Enregistrement de la date actuelle comme dernière mise à jour des prix
  this.lastPriceUpdate = new Date();
  // Sauvegarde du panier dans la base de données
  await this.save();
};

// Méthode statique pour récupérer le panier d'un utilisateur ou en créer un nouveau
cartSchema.statics.getOrCreate = async function (userId) {
  // Recherche du panier de l'utilisateur dans la base de données
  let cart = await this.findOne({ userId });

  // Si aucun panier n'existe pour cet utilisateur
  if (!cart) {
    // Création d'un nouveau panier vide pour cet utilisateur
    cart = await this.create({ userId, items: [] });
  }

  // Retour du panier trouvé ou nouvellement créé
  return cart;
};

// Création du modèle Cart à partir du schéma défini
const Cart = mongoose.model('Cart', cartSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = Cart;
