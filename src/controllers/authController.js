// Importation du module crypto pour le hachage des tokens
const crypto = require('crypto');

// Importation des modèles User, AuditLog, Pack et UserPack depuis le dossier des modèles
const { User, AuditLog, Pack, UserPack } = require('../models');

// Importation des fonctions de téléchargement et de suppression dans GridFS
const { uploadToGridFS, deleteFromGridFS } = require('../services/storageService');

// Importation de la fonction d'envoi d'email de réinitialisation de mot de passe
const { sendPasswordResetEmail } = require('../services/emailService');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la configuration de l'application
const config = require('../config');

// Déclaration de la fonction d'inscription d'un nouvel utilisateur
const register = asyncHandler(async (req, res, _next) => {
  // Extraction des données d'inscription depuis le corps de la requête
  const { name, email, password, phone, address, bio, locale, role } = req.body;

  // Initialisation du rôle par défaut à 'user'
  let userRole = 'user';
  // Validation du rôle s'il est fourni et autorisé
  if (role && ['user'].includes(role)) {
    userRole = role;
  }

  // Création du nouvel utilisateur dans la base de données (le mot de passe est chiffré dans le modèle)
  const user = await User.create({
    name,
    email,
    passwordHash: password,
    phone,
    address,
    bio,
    role: userRole,
    locale: locale || 'ar',
  });

  // Génération du token d'accès JWT
  const accessToken = user.generateJWT();
  // Génération du token de rafraîchissement
  const refreshToken = user.generateRefreshToken();

  // Stockage du token de rafraîchissement sous forme hachée dans la base de données
  user.refreshTokens.push({
    token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
  });
  // Sauvegarde de l'utilisateur sans validation préalable
  await user.save({ validateBeforeSave: false });

  // Enregistrement de l'inscription dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_REGISTER',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });



  // Envoi de la réponse de succès avec les données de l'utilisateur et les tokens
  res.status(201).json({
    status: 'success',
    message: 'Inscription réussie ! Bienvenue.',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        role: user.role,
        locale: user.locale,
        profilePictureFileId: user.profilePictureFileId,
      },
      accessToken,
      refreshToken,
    },
  });
});

// Déclaration de la fonction de connexion d'un utilisateur
const login = asyncHandler(async (req, res, next) => {
  // Extraction de l'email et du mot de passe depuis le corps de la requête
  const { email, password } = req.body;

  // Recherche de l'utilisateur par email avec le mot de passe inclus
  const user = await User.findByEmail(email);

  // Si l'utilisateur n'existe pas, on enregistre la tentative et on renvoie une erreur
  if (!user) {
    // Enregistrement de la tentative échouée dans le journal d'audit
    await AuditLog.log({
      action: 'AUTH_LOGIN',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: { email },
      result: 'failure',
      errorMessage: 'User not found',
    });
    return next(new AppError('Aucun compte trouvé avec cet e-mail !', 401));
  }

  // Vérification que le compte est actif
  if (!user.isActive) {
    return next(new AppError('Le compte est suspendu ! Contactez l\'administration.', 401));
  }

  // Comparaison du mot de passe fourni avec le mot de passe stocké
  const isMatch = await user.comparePassword(password);

  // Si le mot de passe ne correspond pas, on enregistre la tentative et on renvoie une erreur
  if (!isMatch) {
    await AuditLog.log({
      userId: user._id,
      action: 'AUTH_LOGIN',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'failure',
      errorMessage: 'Wrong password',
    });
    return next(new AppError('Mot de passe incorrect !', 401));
  }

  // Génération du token d'accès JWT
  const accessToken = user.generateJWT();
  // Génération du token de rafraîchissement
  const refreshToken = user.generateRefreshToken();

  // Stockage du token de rafraîchissement haché (maximum 5 tokens conservés)
  user.refreshTokens.push({
    token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
  });
  // Limitation à 5 tokens de rafraîchissement maximum
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  // Mise à jour de la date de dernière connexion
  user.lastLogin = new Date();
  // Sauvegarde sans validation préalable
  await user.save({ validateBeforeSave: false });

  // Enregistrement de la connexion réussie dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_LOGIN',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  // Envoi de la réponse de succès avec les données utilisateur et les tokens
  res.status(200).json({
    status: 'success',
    message: 'Connexion réussie !',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        role: user.role,
        locale: user.locale,
        profilePictureFileId: user.profilePictureFileId,
      },
      accessToken,
      refreshToken,
    },
  });
});

// Déclaration de la fonction pour rafraîchir le token d'accès avec le token de rafraîchissement
const refreshToken = asyncHandler(async (req, res, next) => {
  // Extraction du token de rafraîchissement depuis le corps de la requête
  const { refreshToken: token } = req.body;

  // Si aucun token n'est fourni, on renvoie une erreur 400
  if (!token) {
    return next(new AppError('Le jeton de rafraîchissement est obligatoire !', 400));
  }

  try {
    // Importation du module jsonwebtoken pour vérifier le token
    const jwt = require('jsonwebtoken');
    // Vérification et décodage du token de rafraîchissement
    const decoded = jwt.verify(token, config.jwt.refreshSecret);

    // Vérification que le type du token est bien 'refresh'
    if (decoded.type !== 'refresh') {
      return next(new AppError('Jeton invalide !', 401));
    }

    // Recherche de l'utilisateur par l'identifiant décodé
    const user = await User.findById(decoded.id);

    // Si l'utilisateur n'existe pas ou n'est pas actif, on renvoie une erreur
    if (!user || !user.isActive) {
      return next(new AppError('Le jeton n\'est plus valide !', 401));
    }

    // Hachage du token pour comparaison avec les tokens stockés
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Vérification que le token existe dans la liste des tokens de l'utilisateur
    const tokenExists = user.refreshTokens.some((t) => t.token === hashedToken);

    // Si le token n'est pas trouvé, possible tentative d'intrusion
    if (!tokenExists) {
      // Suppression de tous les tokens de rafraîchissement par mesure de sécurité
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });

      // Enregistrement de l'activité suspecte dans le journal d'audit
      await AuditLog.log({
        userId: user._id,
        action: 'SUSPICIOUS_ACTIVITY',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: { reason: 'Refresh token reuse attempt' },
        result: 'failure',
      });

      return next(new AppError('Le jeton n\'est plus valide !', 401));
    }

    // Génération de nouveaux tokens d'accès et de rafraîchissement
    const newAccessToken = user.generateJWT();
    const newRefreshToken = user.generateRefreshToken();

    // Remplacement de l'ancien token par le nouveau dans la liste
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== hashedToken);
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
    });
    // Sauvegarde des modifications
    await user.save({ validateBeforeSave: false });

    // Enregistrement du rafraîchissement de token dans le journal d'audit
    await AuditLog.log({
      userId: user._id,
      action: 'AUTH_REFRESH_TOKEN',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'success',
    });

    // Envoi de la réponse avec les nouveaux tokens
    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    // En cas d'erreur de vérification du token, on renvoie une erreur 401
    return next(new AppError('Jeton invalide ou expiré !', 401));
  }
});

// Déclaration de la fonction pour demander la réinitialisation du mot de passe
const forgotPassword = asyncHandler(async (req, res, next) => {
  // Extraction de l'email depuis le corps de la requête
  const { email } = req.body;

  // Recherche de l'utilisateur par email
  const user = await User.findOne({ email });

  // Si l'utilisateur n'existe pas, on renvoie quand même un succès pour des raisons de sécurité
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: 'Si l\'e-mail existe, vous recevrez un message.',
    });
  }

  // Génération du token de réinitialisation du mot de passe
  const resetToken = user.createPasswordResetToken();
  // Sauvegarde du token sans validation préalable
  await user.save({ validateBeforeSave: false });

  // Envoi de l'email de réinitialisation avec le lien
  try {
    await sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    // En cas d'échec d'envoi, on affiche l'erreur mais on continue
    console.error('Email failed to send:', error);
  }

  // Enregistrement de la demande de réinitialisation dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_PASSWORD_RESET',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details: { step: 'request' },
    result: 'success',
  });

  // Préparation de la réponse
  const response = {
    status: 'success',
    message: 'Si l\'e-mail existe, vous recevrez un message.',
  };

  // En mode développement, on inclut le token dans la réponse pour faciliter les tests
  if (config.server.isDev) {
    response.devToken = resetToken;
  }

  // Envoi de la réponse
  res.status(200).json(response);
});

// Déclaration de la fonction pour réinitialiser le mot de passe
const resetPassword = asyncHandler(async (req, res, next) => {
  // Extraction du token et du nouveau mot de passe depuis le corps de la requête
  const { token, newPassword } = req.body;

  // Hachage du token pour comparaison avec celui stocké en base
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Recherche de l'utilisateur avec un token valide et non expiré
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // Si aucun utilisateur n'est trouvé, le token est invalide ou expiré
  if (!user) {
    return next(new AppError('Jeton invalide ou expiré !', 400));
  }

  // Mise à jour du mot de passe
  user.passwordHash = newPassword;
  // Suppression du token de réinitialisation
  user.passwordResetToken = undefined;
  // Suppression de la date d'expiration du token
  user.passwordResetExpires = undefined;
  // Suppression de tous les tokens de rafraîchissement existants
  user.refreshTokens = [];
  // Sauvegarde des modifications
  await user.save();

  // Enregistrement de la réinitialisation dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_PASSWORD_RESET',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details: { step: 'complete' },
    result: 'success',
  });

  // Connexion automatique de l'utilisateur après réinitialisation
  const accessToken = user.generateJWT();
  const newRefreshToken = user.generateRefreshToken();

  // Stockage du nouveau token de rafraîchissement
  user.refreshTokens.push({
    token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
  });
  // Sauvegarde sans validation préalable
  await user.save({ validateBeforeSave: false });

  // Envoi de la réponse avec les nouveaux tokens
  res.status(200).json({
    status: 'success',
    message: 'Mot de passe modifié avec succès !',
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// Déclaration de la fonction pour obtenir les informations de l'utilisateur connecté
const getMe = asyncHandler(async (req, res, _next) => {
  // Envoi de la réponse avec les données du profil de l'utilisateur courant
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        address: req.user.address,
        bio: req.user.bio,
        role: req.user.role,
        locale: req.user.locale,
        profilePictureFileId: req.user.profilePictureFileId,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin,
      },
    },
  });
});

// Déclaration de la fonction pour mettre à jour les données de l'utilisateur connecté
const updateMe = asyncHandler(async (req, res, next) => {
  // Extraction des champs modifiables depuis le corps de la requête
  const { name, email, phone, address, bio, locale, password, newPassword } = req.body;

  // Récupération de l'utilisateur avec le mot de passe haché pour vérification
  const user = await User.findById(req.user._id).select('+passwordHash');

  // Vérification et mise à jour du mot de passe si demandé
  if (password && newPassword) {
    // Vérification du mot de passe actuel
    const isMatch = await user.comparePassword(password);
    // Si le mot de passe actuel est incorrect, on renvoie une erreur
    if (!isMatch) {
      return next(new AppError('Le mot de passe actuel est incorrect !', 401));
    }
    // Mise à jour du mot de passe avec le nouveau
    user.passwordHash = newPassword;
  }

  // Mise à jour des autres champs si fournis
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  if (bio !== undefined) user.bio = bio;
  if (locale) user.locale = locale;

  // Sauvegarde des modifications
  await user.save();

  // Enregistrement de la mise à jour du profil dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_UPDATE_PROFILE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  // Envoi de la réponse avec les données mises à jour
  res.status(200).json({
    status: 'success',
    message: 'Données mises à jour avec succès !',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        role: user.role,
        locale: user.locale,
        profilePictureFileId: user.profilePictureFileId,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    },
  });
});

// Déclaration de la fonction pour désactiver le compte de l'utilisateur connecté (suppression douce)
const deleteMe = asyncHandler(async (req, res, next) => {
  // Recherche de l'utilisateur par son identifiant
  const user = await User.findById(req.user._id);

  // Si l'utilisateur n'existe pas, on renvoie une erreur 404
  if (!user) {
    return next(new AppError('Utilisateur introuvable !', 404));
  }

  // Désactivation du compte (suppression douce)
  user.isActive = false;
  // Invalidation de toutes les sessions en supprimant les tokens de rafraîchissement
  user.refreshTokens = [];
  // Sauvegarde sans validation préalable
  await user.save({ validateBeforeSave: false });

  // Enregistrement de la suppression du compte dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_DELETE_ACCOUNT',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  // Envoi de la réponse de succès
  res.status(200).json({
    status: 'success',
    message: 'Compte supprimé avec succès !',
  });
});

// Déclaration de la fonction de déconnexion (suppression du token de rafraîchissement)
const logout = asyncHandler(async (req, res, _next) => {
  // Extraction du token de rafraîchissement depuis le corps de la requête
  const { refreshToken: token } = req.body;

  // Si un token est fourni, on le supprime de la liste des tokens de l'utilisateur
  if (token) {
    // Hachage du token pour comparaison
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Filtrage pour supprimer le token correspondant
    req.user.refreshTokens = req.user.refreshTokens.filter(
      (t) => t.token !== hashedToken
    );
    // Sauvegarde sans validation préalable
    await req.user.save({ validateBeforeSave: false });
  }

  // Enregistrement de la déconnexion dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'AUTH_LOGOUT',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  // Envoi de la réponse de succès
  res.status(200).json({
    status: 'success',
    message: 'Déconnexion réussie !',
  });
});

// Déclaration de la fonction pour télécharger une photo de profil
const uploadProfilePicture = asyncHandler(async (req, res, next) => {
  // Vérification de la présence du fichier dans la requête
  if (!req.file) {
    return next(new AppError('La photo est obligatoire !', 400));
  }

  // Recherche de l'utilisateur par son identifiant
  const user = await User.findById(req.user._id);

  // Suppression de l'ancienne photo de profil si elle existe
  if (user.profilePictureFileId) {
    await deleteFromGridFS(user.profilePictureFileId);
  }

  // Téléchargement de la nouvelle photo de profil dans GridFS
  const fileId = await uploadToGridFS(
    req.file.buffer,
    `profile_${user._id}_${Date.now()}.jpg`,
    req.file.mimetype,
    {
      uploadedBy: user._id,
      type: 'profile',
    }
  );

  // Mise à jour de l'identifiant de la photo de profil
  user.profilePictureFileId = fileId;
  // Sauvegarde sans validation préalable
  await user.save({ validateBeforeSave: false });

  // Enregistrement du téléchargement dans le journal d'audit
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_UPLOAD_PROFILE_PICTURE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  // Envoi de la réponse avec l'identifiant de la nouvelle photo
  res.status(200).json({
    status: 'success',
    message: 'Photo téléchargée avec succès !',
    data: {
      profilePictureFileId: fileId,
    },
  });
});

// Déclaration de la fonction pour obtenir les données publiques d'un utilisateur
const getUser = asyncHandler(async (req, res, next) => {
  // Recherche de l'utilisateur par son identifiant depuis les paramètres de la route
  const user = await User.findById(req.params.id);

  // Si l'utilisateur n'existe pas ou n'est pas actif, on renvoie une erreur 404
  if (!user || !user.isActive) {
    return next(new AppError('Utilisateur introuvable !', 404));
  }

  // Envoi de la réponse avec les données publiques de l'utilisateur
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        name: user.name,
        bio: user.bio,
        role: user.role,
        profilePictureFileId: user.profilePictureFileId,
        createdAt: user.createdAt,
      },
    },
  });
});

// Exportation de toutes les fonctions d'authentification pour utilisation dans les routes
module.exports = {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  deleteMe,
  logout,
  uploadProfilePicture,
  getUser,
};
