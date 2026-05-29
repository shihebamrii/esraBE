// Importation des modèles Order, Cart, Photo, Pack, Content, AuditLog et UserPack
const { Order, Cart, Photo, Pack, Content, AuditLog, UserPack } = require('../models');

// Importation de la fonction pour obtenir le fournisseur de paiement
const { getPaymentProvider } = require('../services/paymentAdapter');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction pour utiliser un pack d'abonnement pour télécharger un article
const redeemDownload = asyncHandler(async (req, res, next) => {
  // Extraction de l'identifiant de l'article et de son type depuis le corps de la requête
  const { itemId, itemType } = req.body;

  // Vérification que le type d'article est valide (photo ou contenu)
  if (!['photo', 'content'].includes(itemType)) {
    return next(new AppError('Invalid item type for redemption', 400));
  }

  // Recherche de l'article selon son type
  let item;
  if (itemType === 'photo') {
    // Recherche de la photo par identifiant
    item = await Photo.findById(itemId);
  } else {
    // Recherche du contenu par identifiant
    item = await Content.findById(itemId);
  }

  // Si l'article n'existe pas, on renvoie une erreur 404
  if (!item) {
    return next(new AppError('Item not found', 404));
  }

  // Détermination du module (tounesna pour les photos, impact pour le contenu vidéo)
  const module = itemType === 'photo' ? 'tounesna' : 'impact';

  // Recherche d'un pack actif avec un quota restant pour ce module
  const userPack = await UserPack.findOne({
    userId: req.user._id,
    module,
    isActive: true,
  });

  // Si aucun pack actif n'est trouvé, on renvoie une erreur 403
  if (!userPack) {
    return next(new AppError(`No active ${module} membership pack found.`, 403));
  }

  // Détermination du champ de quota selon le type d'article
  let quotaField;
  if (itemType === 'photo') {
    // Pour les photos, on utilise le quota de photos restantes
    quotaField = 'photosRemaining';
  } else {
    // Pour le contenu, on détermine le quota selon le sous-type
    if (item.type === 'reel') quotaField = 'videosRemaining'; // Unify reels under standard videos quota
    else if (item.type === 'documentary') quotaField = 'documentariesRemaining';
    else quotaField = 'videosRemaining';
  }

  // Support for legacy active packs: if videosRemaining is 0 but they still have reelsRemaining, dynamically migrate them on the fly!
  if (module === 'impact' && quotaField === 'videosRemaining' && userPack.quotas.videosRemaining <= 0 && userPack.quotas.reelsRemaining > 0) {
    userPack.quotas.videosRemaining += userPack.quotas.reelsRemaining;
    userPack.quotas.reelsRemaining = 0;
  }

  // Vérification que le quota n'est pas épuisé
  if (userPack.quotas[quotaField] <= 0) {
    return next(new AppError(`You have reached your limit of ${quotaField.replace('Remaining', '')} for this pack.`, 403));
  }

  // Déduction d'une unité du quota
  userPack.quotas[quotaField] -= 1;
  // Sauvegarde de la mise à jour du pack utilisateur
  await userPack.save();

  // Création d'une commande gratuite pour accorder l'accès au téléchargement
  const order = await Order.create({
    userId: req.user._id,
    items: [{
      type: itemType,
      itemId: item._id,
      price: 0,
      title: item.title,
    }],
    total: 0,
    currency: 'TND',
    paymentStatus: 'paid',
    paymentProvider: 'mock',
    paidAt: new Date(),
    notes: `Redeemed from ${module} pack`,
  });

  // Génération du token de téléchargement valide 24 heures
  const rawToken = order.createDownloadToken(itemType, item._id, 24);
  // Stockage des tokens bruts dans les métadonnées de la commande
  const rawTokens = {};
  rawTokens[`${itemType}_${item._id.toString()}`] = rawToken;
  order.metadata = { ...order.metadata, rawTokens };
  // Sauvegarde de la commande avec les tokens
  await order.save();

  // Enregistrement de l'utilisation du pack dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_REDEEM',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `${itemType}:${item._id}`,
    result: 'success',
  });

  // Construction de l'URL de base pour le lien de téléchargement
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // Envoi de la réponse avec l'identifiant de la commande et le lien de téléchargement
  res.status(200).json({
    status: 'success',
    message: 'Download redeemed successfully!',
    data: {
      orderId: order._id,
      downloadUrl: `${baseUrl}/api/orders/${order._id}/download/${rawToken}`,
    }
  });
});


// Déclaration de la fonction pour créer une nouvelle commande à partir du panier
const createOrder = asyncHandler(async (req, res, next) => {
  // Extraction des informations de facturation et des notes depuis le corps de la requête
  const { billingInfo, notes } = req.body;

  // Recherche du panier de l'utilisateur connecté
  const cart = await Cart.findOne({ userId: req.user._id });

  // Si le panier est vide ou n'existe pas, on renvoie une erreur 400
  if (!cart || cart.items.length === 0) {
    return next(new AppError('Le panier est vide !', 400));
  }

  // Actualisation des prix avant de procéder au paiement
  await cart.refreshPrices();

  // Calcul du montant total du panier
  const total = cart.total;

  // Vérification que le total est supérieur à zéro
  if (total <= 0) {
    return next(new AppError('Le total doit être supérieur à zéro !', 400));
  }

  // Création de la commande dans la base de données
  const order = await Order.create({
    userId: req.user._id,
    items: cart.items.map((item) => ({
      type: item.type,
      itemId: item.itemId,
      price: item.price,
      title: item.title,
      licenseType: item.licenseType || 'personal',
    })),
    total,
    currency: 'TND',
    paymentStatus: 'pending',
    billingInfo,
    notes,
  });

  // Récupération du fournisseur de paiement et lancement du processus de paiement
  const paymentProvider = getPaymentProvider();
  const paymentResult = await paymentProvider.createPayment({
    orderId: order._id.toString(),
    amount: total,
    currency: 'TND',
    customerEmail: billingInfo.email || req.user.email,
    customerName: billingInfo.name || req.user.name,
    description: `Order #${order._id}`,
  });

  // Mise à jour de la commande avec les informations du fournisseur de paiement
  order.paymentProvider = paymentProvider.name;
  order.metadata = {
    ...order.metadata,
    paymentSession: paymentResult.sessionId || paymentResult.paymentId,
  };
  // Sauvegarde de la commande mise à jour
  await order.save();

  // Enregistrement de la création de la commande dans le journal d'audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'ORDER_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Order:${order._id}`,
    result: 'success',
  });

  // Envoi de la réponse avec les détails de la commande et l'URL de paiement
  res.status(201).json({
    status: 'success',
    message: 'Commande créée ! Procédez au paiement.',
    data: {
      order: {
        id: order._id,
        total: order.total,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
      },
      payment: {
        url: paymentResult.paymentUrl,
        sessionId: paymentResult.sessionId,
      },
    },
  });
});

// Déclaration de la fonction pour obtenir les détails d'une commande
const getOrder = asyncHandler(async (req, res, next) => {
  // Récupération de l'identifiant de la commande depuis les paramètres
  const { id } = req.params;

  // Recherche de la commande par identifiant
  const order = await Order.findById(id);

  // Si la commande n'existe pas, on renvoie une erreur 404
  if (!order) {
    return next(new AppError('Commande introuvable !', 404));
  }

  // Vérification que la commande appartient à l'utilisateur connecté ou qu'il est admin
  if (
    order.userId.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new AppError('Non autorisé !', 403));
  }

  // Préparation des liens de téléchargement si la commande est payée
  let downloadLinks = [];
  if (order.paymentStatus === 'paid') {
    // Construction de l'URL de base
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // Génération des liens de téléchargement pour chaque token
    downloadLinks = order.downloadTokens
      .map((t) => ({
        type: t.itemType,
        itemId: t.itemId,
        downloadUrl: `${baseUrl}/api/orders/${order._id}/download/${t.token}`,
      }));
  }

  // Envoi de la réponse avec les détails de la commande et les liens de téléchargement
  res.status(200).json({
    status: 'success',
    data: {
      order: {
        id: order._id,
        items: order.items,
        total: order.total,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        downloadLinks,
      },
    },
  });
});

// Déclaration de la fonction pour obtenir la liste des commandes de l'utilisateur
const getMyOrders = asyncHandler(async (req, res, _next) => {
  // Extraction des paramètres de pagination et de filtrage par statut
  const { page = 1, limit = 10, status } = req.query;

  // Construction de la requête de filtrage pour l'utilisateur connecté
  const query = { userId: req.user._id };
  // Filtrage par statut de paiement si spécifié
  if (status) query.paymentStatus = status;

  // Comptage du nombre total de commandes correspondantes
  const total = await Order.countDocuments(query);

  // Recherche des commandes avec sélection de champs, tri et pagination
  const orders = await Order.find(query)
    .select('items total currency paymentStatus createdAt paidAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Envoi de la réponse avec les commandes et les informations de pagination
  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { orders },
  });
});

// Déclaration de la fonction pour télécharger un article acheté
const downloadPurchasedItem = asyncHandler(async (req, res, next) => {
  // Extraction de l'identifiant de la commande et du token depuis les paramètres
  const { orderId, token } = req.params;

  // Recherche de la commande par identifiant
  const order = await Order.findById(orderId);

  // Si la commande n'existe pas, on renvoie une erreur 404
  if (!order) {
    return next(new AppError('Commande introuvable !', 404));
  }

  // Vérification que la commande est payée
  if (order.paymentStatus !== 'paid') {
    return next(new AppError("La commande n'est pas payée !", 403));
  }

  // Vérification de la validité du token de téléchargement
  const tokenDoc = order.verifyDownloadToken(token);

  // Si le token est invalide ou expiré, on renvoie une erreur 403
  if (!tokenDoc) {
    return next(new AppError('Le lien de téléchargement est expiré ou invalide !', 403));
  }

  // Initialisation des variables pour le fichier à télécharger
  let fileId;
  let filename;
  let externalUrl;

  // Traitement selon le type d'article
  if (tokenDoc.itemType === 'photo') {
    // Recherche de la photo par identifiant
    const photo = await Photo.findById(tokenDoc.itemId);
    // Si la photo n'existe pas, on renvoie une erreur 404
    if (!photo) return next(new AppError('Photo introuvable !', 404));
    
    // Si la photo a un fichier haute résolution dans GridFS
    if (photo.highResFileId) {
      fileId = photo.highResFileId;
      filename = photo.fileInfo?.highRes?.filename || `photo_${photo._id}.jpg`;
    } else if (photo.imageUrl) {
      // Si la photo a une URL externe
      externalUrl = photo.imageUrl;
    } else {
      // Si aucun fichier n'est disponible
      return next(new AppError('Le fichier original de la photo est introuvable !', 404));
    }
  } else if (tokenDoc.itemType === 'pack') {
    // Recherche du pack avec les photos associées
    const pack = await Pack.findById(tokenDoc.itemId).populate('photoIds');
    // Si le pack n'existe pas, on renvoie une erreur 404
    if (!pack) return next(new AppError('Pack introuvable !', 404));

    // Vérification que le pack est de type collection pour le téléchargement
    if (pack.type !== 'collection') {
      return next(new AppError('Ce pack ne supporte pas le téléchargement direct !', 400));
    }

    // Configuration des en-têtes HTTP pour le téléchargement ZIP
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(pack.title)}.zip"`,
    });

    // Importation du module archiver pour créer un fichier ZIP
    const archiver = require('archiver');
    // Création de l'archive ZIP avec compression maximale
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Gestion des erreurs d'archivage
    archive.on('error', (err) => {
      throw err;
    });

    // Envoi de l'archive directement dans la réponse HTTP
    archive.pipe(res);

    // Importation de la fonction pour obtenir un flux de téléchargement GridFS
    const { getDownloadStream } = require('../services/storageService');

    // Parcours de toutes les photos du pack pour les ajouter à l'archive
    for (const photo of pack.photoIds) {
      const fileId = photo.highResFileId;
      if (fileId) {
        // Obtention du flux de lecture du fichier
        const stream = getDownloadStream(fileId);
        // Détermination du nom du fichier dans l'archive
        const filename = photo.fileInfo?.highRes?.filename || `photo_${photo._id}.jpg`;
        // Ajout du fichier à l'archive
        archive.append(stream, { name: filename });
      }
    }

    // Finalisation de l'archive ZIP
    await archive.finalize();
    
    // Enregistrement du téléchargement dans le journal d'audit
    await AuditLog.log({
      userId: order.userId,
      action: 'PACK_DOWNLOAD',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `Pack:${pack._id}`,
      result: 'success',
    });
    
    // Consommation du token de téléchargement et fin de la requête
    await order.useDownloadToken(token);
    return;
  } else if (tokenDoc.itemType === 'content') {
    // Recherche du contenu par identifiant
    const content = await Content.findById(tokenDoc.itemId);
    // Si le contenu n'existe pas, on renvoie une erreur 404
    if (!content) return next(new AppError('Contenu introuvable !', 404));
    // Récupération de l'identifiant du fichier et du nom du fichier
    fileId = content.fileFileId;
    filename = content.fileInfo?.filename || `content_${content._id}`;
  }

  // Consommation d'une utilisation du token de téléchargement
  await order.useDownloadToken(token);

  // Enregistrement du téléchargement dans le journal d'audit
  await AuditLog.log({
    userId: order.userId,
    action: 'PHOTO_DOWNLOAD',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `${tokenDoc.itemType}:${tokenDoc.itemId}`,
    result: 'success',
  });

  // Redirection vers le flux média ou l'URL externe pour le téléchargement
  if (externalUrl) {
    res.redirect(externalUrl);
  } else {
    res.redirect(`/api/media/${fileId}/download`);
  }
});

// Déclaration de la fonction pour obtenir toutes les commandes (administration)
const getAllOrders = asyncHandler(async (req, res, _next) => {
  // Extraction des paramètres de pagination et de filtrage par statut
  const { page = 1, limit = 20, status } = req.query;

  // Construction de la requête de filtrage
  const query = {};
  // Filtrage par statut de paiement si spécifié
  if (status) query.paymentStatus = status;

  // Comptage du nombre total de commandes correspondantes
  const total = await Order.countDocuments(query);

  // Recherche des commandes avec jointure sur l'utilisateur, tri et pagination
  const orders = await Order.find(query)
    .populate('userId', 'name email')
    .select('items total currency paymentStatus createdAt paidAt userId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Envoi de la réponse avec les commandes et les informations de pagination
  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { orders },
  });
});

// Exportation des fonctions de gestion des commandes et du paiement pour utilisation dans les routes
module.exports = {
  createOrder,
  getOrder,
  getMyOrders,
  getAllOrders,
  downloadPurchasedItem,
  redeemDownload,
};
