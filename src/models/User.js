// Importation de la bibliothèque mongoose pour gérer la base de données MongoDB
const mongoose = require('mongoose');
// Importation de bcryptjs pour le hachage et la comparaison des mots de passe
const bcrypt = require('bcryptjs');
// Importation de jsonwebtoken pour créer et vérifier les jetons JWT
const jwt = require('jsonwebtoken');
// Importation de la configuration de l'application
const config = require('../config');

// Définition du schéma pour les utilisateurs
const userSchema = new mongoose.Schema(
  {
    // Nom complet de l'utilisateur, obligatoire
    name: {
      type: String,
      required: [true, 'Le nom est obligatoire !'],
      trim: true,
      maxlength: [100, 'Le nom est trop long'],
    },

    // Adresse email de l'utilisateur, unique et obligatoire
    email: {
      type: String,
      required: [true, 'L\'e-mail est obligatoire !'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'L\'e-mail n\'est pas valide !',
      ],
    },

    // Numéro de téléphone de l'utilisateur
    phone: {
      type: String,
      trim: true,
    },

    // Adresse postale de l'utilisateur
    address: {
      type: String,
      trim: true,
    },

    // Biographie courte de l'utilisateur
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'La biographie est trop longue'],
    },

    // Identifiant du fichier photo de profil dans GridFS
    profilePictureFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Mot de passe haché, exclu par défaut des résultats de requête
    passwordHash: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire !'],
      select: false,
    },

    // Rôle de l'utilisateur (administrateur, utilisateur ou téléchargeur)
    role: {
      type: String,
      enum: ['admin', 'user', 'uploader'],
      default: 'user',
    },

    // Langue préférée de l'utilisateur (arabe, français ou anglais)
    locale: {
      type: String,
      enum: ['ar', 'fr', 'en'],
      default: 'ar',
    },

    // Indique si le compte utilisateur est actif
    isActive: {
      type: Boolean,
      default: true,
    },

    // Identifiant du client chez Stripe (paiement en ligne)
    stripeCustomerId: {
      type: String,
    },

    // Jeton de réinitialisation du mot de passe (haché)
    passwordResetToken: String,
    // Date d'expiration du jeton de réinitialisation
    passwordResetExpires: Date,

    // Liste des jetons de rafraîchissement stockés (hachés)
    refreshTokens: [{
      // Valeur du jeton de rafraîchissement
      token: String,
      // Date de création du jeton
      createdAt: { type: Date, default: Date.now },
    }],

    // Date de la dernière connexion de l'utilisateur
    lastLogin: Date,
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

// Index pour filtrer rapidement par rôle d'utilisateur
userSchema.index({ role: 1 });

// Middleware exécuté avant chaque sauvegarde pour hacher le mot de passe
userSchema.pre('save', async function (next) {
  // Si le mot de passe n'a pas été modifié, on passe au suivant
  if (!this.isModified('passwordHash')) return next();

  // Hachage du mot de passe avec 12 tours de salage
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  // Passage au middleware suivant
  next();
});

// Méthode d'instance pour comparer un mot de passe candidat avec le mot de passe stocké
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Méthode d'instance pour générer un jeton JWT d'accès
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    {
      // Identifiant de l'utilisateur inclus dans le jeton
      id: this._id,
      // Email de l'utilisateur inclus dans le jeton
      email: this.email,
      // Rôle de l'utilisateur inclus dans le jeton
      role: this.role,
    },
    // Clé secrète pour signer le jeton
    config.jwt.secret,
    // Durée de validité du jeton
    { expiresIn: config.jwt.expiresIn }
  );
};

// Méthode d'instance pour générer un jeton JWT de rafraîchissement
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      // Identifiant de l'utilisateur inclus dans le jeton
      id: this._id,
      // Type du jeton pour le distinguer du jeton d'accès
      type: 'refresh',
    },
    // Clé secrète spécifique pour les jetons de rafraîchissement
    config.jwt.refreshSecret,
    // Durée de validité du jeton de rafraîchissement
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

// Méthode d'instance pour créer un jeton de réinitialisation du mot de passe
userSchema.methods.createPasswordResetToken = function () {
  // Importation du module crypto pour la génération de jetons aléatoires
  const crypto = require('crypto');
  // Génération d'un jeton aléatoire de 32 octets en hexadécimal
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Stockage du jeton sous forme hachée dans la base de données
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Le jeton est valide pendant 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Retour du jeton brut pour l'envoyer par email à l'utilisateur
  return resetToken;
};

// Méthode statique pour trouver un utilisateur par email avec le mot de passe inclus
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email }).select('+passwordHash');
};

// Création du modèle User à partir du schéma défini
const User = mongoose.model('User', userSchema);

// Exportation du modèle pour l'utiliser dans d'autres fichiers
module.exports = User;
