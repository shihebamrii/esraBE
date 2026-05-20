// Importation des modèles User, UserPack, Order et AuditLog depuis le dossier des modèles
const { User, UserPack, Order, AuditLog } = require('../models');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction pour obtenir tous les utilisateurs avec leurs packs et quotas
const getAllUsers = asyncHandler(async (req, res, next) => {
  // Extraction des paramètres de pagination, rôle et recherche depuis la requête
  const { page = 1, limit = 20, role, search } = req.query;

  // Initialisation de l'objet de filtrage
  const query = {};
  // Filtrage par rôle si spécifié
  if (role) query.role = role;
  // Recherche textuelle dans le nom ou l'email si un terme est fourni
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  // Comptage du nombre total d'utilisateurs correspondant aux filtres
  const total = await User.countDocuments(query);
  // Recherche des utilisateurs sans les tokens de rafraîchissement ni le mot de passe
  const users = await User.find(query)
    .select('-refreshTokens -passwordHash')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Pour chaque utilisateur, récupération de ses packs actifs
  const usersWithPacks = await Promise.all(users.map(async (user) => {
    // Recherche des packs actifs de l'utilisateur
    const packs = await UserPack.find({ userId: user._id, isActive: true })
      .populate('packId', 'title membershipFeatures');
    
    // Retour de l'utilisateur avec ses packs associés
    return {
      ...user.toObject(),
      packs
    };
  }));

  // Envoi de la réponse avec les utilisateurs et les informations de pagination
  res.status(200).json({
    status: 'success',
    results: users.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { users: usersWithPacks },
  });
});

// Déclaration de la fonction pour mettre à jour les quotas d'un pack utilisateur
const updateUserPackQuota = asyncHandler(async (req, res, next) => {
  // Extraction de l'identifiant utilisateur et de l'identifiant du pack depuis les paramètres
  const { userId, userPackId } = req.params;
  // Extraction des quotas depuis le corps de la requête
  const { quotas } = req.body;

  // Recherche du pack utilisateur par identifiant et identifiant utilisateur
  const userPack = await UserPack.findOne({ _id: userPackId, userId });

  // Si le pack utilisateur n'existe pas, on renvoie une erreur 404
  if (!userPack) {
    return next(new AppError('User pack not found', 404));
  }

  // Mise à jour des quotas en fusionnant les anciens et les nouveaux
  if (quotas) {
    userPack.quotas = {
      ...userPack.quotas,
      ...quotas
    };
  }

  // Sauvegarde des modifications du pack utilisateur
  await userPack.save();

  // Enregistrement de la mise à jour dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'USER_PACK_QUOTA_UPDATE',
    resource: `UserPack:${userPackId}`,
    details: { targetUserId: userId, quotas },
    result: 'success',
  });

  // Envoi de la réponse de succès avec le pack utilisateur mis à jour
  res.status(200).json({
    status: 'success',
    message: 'Quotas updated successfully',
    data: { userPack },
  });
});

// Déclaration de la fonction pour activer ou désactiver un utilisateur
const updateUserStatus = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de l'utilisateur depuis les paramètres
  const { id } = req.params;
  // Extraction du statut actif depuis le corps de la requête
  const { isActive } = req.body;

  // Mise à jour du statut de l'utilisateur dans la base de données
  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });

  // Si l'utilisateur n'existe pas, on renvoie une erreur 404
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Envoi de la réponse de succès avec le message approprié
  res.status(200).json({
    status: 'success',
    message: `User ${isActive ? 'unblocked' : 'blocked'} successfully`,
    data: { user },
  });
});

// Déclaration de la fonction pour mettre à jour les informations d'un utilisateur
const updateUser = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de l'utilisateur depuis les paramètres
  const { id } = req.params;
  // Extraction des champs modifiables depuis le corps de la requête
  const { name, email, role, phone, address, bio } = req.body;

  // Initialisation de l'objet contenant les données à mettre à jour
  const updateData = {};
  // Ajout conditionnel de chaque champ s'il est défini
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (bio !== undefined) updateData.bio = bio;

  // Exécution de la mise à jour avec validation, en excluant les champs sensibles
  const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-passwordHash -refreshTokens');

  // Si l'utilisateur n'existe pas, on renvoie une erreur 404
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Envoi de la réponse de succès avec les données de l'utilisateur mis à jour
  res.status(200).json({
    status: 'success',
    message: 'User updated successfully',
    data: { user },
  });
});

// Déclaration de la fonction pour supprimer un utilisateur
const deleteUser = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de l'utilisateur depuis les paramètres
  const { id } = req.params;

  // Suppression de l'utilisateur de la base de données
  const user = await User.findByIdAndDelete(id);

  // Si l'utilisateur n'existe pas, on renvoie une erreur 404
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Suppression de tous les packs associés à cet utilisateur
  await UserPack.deleteMany({ userId: id });

  // Envoi de la réponse de succès après suppression
  res.status(200).json({
    status: 'success',
    message: 'User deleted successfully',
  });
});

// Exportation des fonctions de gestion des utilisateurs pour utilisation dans les routes
module.exports = {
  getAllUsers,
  updateUserPackQuota,
  updateUserStatus,
  updateUser,
  deleteUser,
};
