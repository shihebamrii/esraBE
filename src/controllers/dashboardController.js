// Importation des modèles de la base de données
const { Content, Photo, User, Order, Pack, UserPack } = require('../models');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');

// Fonction pour récupérer les packs achetés et actifs de l'utilisateur
const getUserPacks = asyncHandler(async (req, res, next) => {
  // Recherche des packs liés à l'utilisateur connecté qui sont encore actifs
  const packs = await UserPack.find({ userId: req.user._id, isActive: true })
    // Remplir les détails du pack avec le titre, la description et les fonctionnalités
    .populate('packId', 'title description membershipFeatures')
    // Trier par date de création décroissante (plus récent en premier)
    .sort({ createdAt: -1 });

  // Envoyer la réponse avec le statut 200 et la liste des packs
  res.status(200).json({
    status: 'success',
    results: packs.length,
    data: { packs },
  });
});

// Fonction pour récupérer les statistiques de téléversement de l'utilisateur
const getUserUploadStats = asyncHandler(async (req, res, next) => {
  // Récupérer l'identifiant de l'utilisateur connecté
  const userId = req.user._id;

  // Calculer les statistiques des contenus avec une agrégation MongoDB
  const contentStats = await Content.aggregate([
    // Filtrer les contenus créés par cet utilisateur
    { $match: { createdBy: userId } },
    {
      // Grouper tous les résultats pour calculer les totaux
      $group: {
        _id: null,
        // Compter le nombre total de contenus
        total: { $sum: 1 },
        // Sommer toutes les vues
        totalViews: { $sum: "$views" },
        // Sommer tous les téléchargements
        totalDownloads: { $sum: "$downloads" },
        // Compter les contenus publiés
        published: {
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] }
        },
        // Compter les vidéos
        videos: {
            $sum: { $cond: [{ $eq: ["$type", "video"] }, 1, 0] }
        },
        // Compter les audios
        audio: {
            $sum: { $cond: [{ $eq: ["$type", "audio"] }, 1, 0] }
        }
      }
    }
  ]);

  // Calculer les statistiques des photos avec une agrégation MongoDB
  const photoStats = await Photo.aggregate([
    // Filtrer les photos créées par cet utilisateur
    { $match: { createdBy: userId } },
    {
      // Grouper tous les résultats pour calculer les totaux
      $group: {
        _id: null,
        // Compter le nombre total de photos
        total: { $sum: 1 },
        // Sommer les téléchargements d'aperçus
        totalDownloads: { $sum: "$previewDownloads" },
        // Sommer le nombre de ventes
        totalSales: { $sum: "$purchases" },
        // Calculer le montant total des ventes (achats multipliés par le prix)
        totalSalesAmount: { $sum: { $multiply: ["$purchases", "$priceTND"] } }
      }
    }
  ]);

  // Construire l'objet de statistiques avec des valeurs par défaut à 0
  const stats = {
    // Statistiques des contenus
    content: {
      total: contentStats[0]?.total || 0,
      views: contentStats[0]?.totalViews || 0,
      downloads: contentStats[0]?.totalDownloads || 0,
      videoCount: contentStats[0]?.videos || 0,
      audioCount: contentStats[0]?.audio || 0
    },
    // Statistiques des photos
    photos: {
      total: photoStats[0]?.total || 0,
      downloads: photoStats[0]?.totalDownloads || 0,
      sales: photoStats[0]?.totalSales || 0,
      earnings: photoStats[0]?.totalSalesAmount || 0
    },
    // Total combiné des téléversements
    totalUploads: (contentStats[0]?.total || 0) + (photoStats[0]?.total || 0),
    // Total global des vues
    totalViews: (contentStats[0]?.totalViews || 0)
  };

  // Envoyer la réponse avec les statistiques
  res.status(200).json({
    status: 'success',
    data: stats
  });
});

// Fonction pour récupérer l'activité récente de l'utilisateur
const getRecentActivity = asyncHandler(async (req, res, next) => {
  // Récupérer l'identifiant de l'utilisateur connecté
  const userId = req.user._id;
  // Définir la limite de résultats à afficher
  const limit = 5;

  // Récupérer les contenus récents créés par l'utilisateur
  const recentContent = await Content.find({ createdBy: userId })
    // Trier par date de création décroissante
    .sort({ createdAt: -1 })
    // Limiter le nombre de résultats
    .limit(limit)
    // Sélectionner uniquement les champs nécessaires
    .select('title type createdAt views status');

  // Récupérer les photos récentes créées par l'utilisateur
  const recentPhotos = await Photo.find({ createdBy: userId })
    // Trier par date de création décroissante
    .sort({ createdAt: -1 })
    // Limiter le nombre de résultats
    .limit(limit)
    // Sélectionner uniquement les champs nécessaires
    .select('title type createdAt previewDownloads status');

  // Combiner les contenus et photos dans une seule liste formatée
  let combined = [
    // Transformer chaque contenu en objet formaté
    ...recentContent.map(c => ({
      _id: c._id,
      title: c.title,
      type: c.type,
      category: 'content',
      createdAt: c.createdAt,
      metric: c.views,
      metricLabel: 'Views',
      status: 'published'
    })),
    // Transformer chaque photo en objet formaté
    ...recentPhotos.map(p => ({
      _id: p._id,
      title: p.title,
      type: 'photo',
      category: 'photo',
      createdAt: p.createdAt,
      metric: p.previewDownloads,
      metricLabel: 'Downloads',
      status: 'published'
    }))
  ];

  // Trier la liste combinée par date décroissante
  combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Garder seulement les premiers éléments selon la limite
  const recentActivity = combined.slice(0, limit);

  // Envoyer la réponse avec l'activité récente
  res.status(200).json({
    status: 'success',
    data: recentActivity
  });
});

// Fonction pour récupérer les statistiques globales d'un utilisateur (achats, dépenses)
const getUserStats = asyncHandler(async (req, res, next) => {
  // Récupérer l'identifiant de l'utilisateur connecté
  const userId = req.user._id;

  // Récupérer toutes les commandes de l'utilisateur triées par date décroissante
  const orders = await Order.find({ userId: userId }).sort({ createdAt: -1 });

  // Calculer le montant total dépensé
  const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Initialiser le compteur de téléchargements
  let downloadCount = 0;
  // Parcourir chaque commande pour compter les éléments téléchargés
  orders.forEach(order => {
    // Compter seulement si la commande est terminée ou payée
    if (order.status === 'completed' || order.paymentStatus === 'paid') {
      downloadCount += order.items?.length || 0;
    }
  });

  // Formater les 3 commandes les plus récentes pour l'affichage
  const recentOrders = orders.slice(0, 3).map(order => ({
    id: order._id,
    // Créer un numéro de commande court à partir de l'identifiant
    orderNumber: order._id.toString().substring(0, 8).toUpperCase(),
    items: order.items?.length || 0,
    // Formater le montant avec deux décimales et la devise
    total: `${(order.total || 0).toFixed(2)} ${order.currency || 'TND'}`,
    status: order.paymentStatus || 'pending',
    date: order.createdAt
  }));

  // Envoyer la réponse avec les statistiques de l'utilisateur
  res.status(200).json({
    status: 'success',
    data: {
      totalOrders: orders.length,
      totalSpent: `${totalSpent.toFixed(2)} TND`,
      downloadCount,
      recentOrders
    }
  });
});

// Fonction pour récupérer les statistiques globales pour l'administrateur
const getAdminStats = asyncHandler(async (req, res, next) => {
  // Récupérer toutes les commandes payées
  const orders = await Order.find({ paymentStatus: 'paid' });
  // Calculer le revenu total en sommant les montants
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Compter le nombre total d'utilisateurs
  const totalUsers = await User.countDocuments();

  // Compter le nombre total de vidéos
  const videoCount = await Content.countDocuments({ type: 'video' });
  // Compter le nombre total de photos
  const photoCount = await Photo.countDocuments();

  // Calculer le total des téléchargements de contenus
  const contentDownloads = await Content.aggregate([
    { $group: { _id: null, total: { $sum: { $ifNull: ['$downloads', 0] } } } }
  ]);
  // Calculer le total des téléchargements de photos
  const photoDownloads = await Photo.aggregate([
    { $group: { _id: null, total: { $sum: { $ifNull: ['$downloads', 0] } } } }
  ]);
  // Calculer les téléchargements via les commandes
  const orderDownloads = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
  // Additionner tous les téléchargements
  const totalDownloads =
    (contentDownloads[0]?.total || 0) +
    (photoDownloads[0]?.total || 0) +
    orderDownloads;

  // Définir la date d'il y a 6 mois pour les graphiques
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // Récupérer les revenus mensuels groupés par année et mois
  const monthlyRevenue = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      revenue: { $sum: '$total' },
      orders: { $sum: 1 }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Liste des noms de mois abrégés en anglais
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Construire le tableau pour le graphique des revenus
  const revenueChart = [];
  for (let i = 5; i >= 0; i--) {
    // Calculer la date pour chaque mois
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    // Chercher les données existantes pour ce mois
    const found = monthlyRevenue.find(m => m._id.year === year && m._id.month === month);
    // Ajouter les données au graphique (0 par défaut si pas de données)
    revenueChart.push({
      month: monthNames[month - 1],
      revenue: found ? Math.round(found.revenue) : 0,
      orders: found ? found.orders : 0,
    });
  }

  // Récupérer les téléchargements mensuels sur les 6 derniers mois
  const monthlyDownloads = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      downloads: { $sum: { $size: { $ifNull: ['$items', []] } } }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Construire le tableau pour le graphique des téléchargements
  const downloadsChart = [];
  for (let i = 5; i >= 0; i--) {
    // Calculer la date pour chaque mois
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    // Chercher les données existantes pour ce mois
    const found = monthlyDownloads.find(m => m._id.year === year && m._id.month === month);
    // Ajouter les données au graphique
    downloadsChart.push({
      month: monthNames[month - 1],
      downloads: found ? found.downloads : 0,
    });
  }

  // Obtenir la répartition par type de contenu
  const contentBreakdown = await Content.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  // Formater les types de contenu pour le frontend
  const contentTypes = contentBreakdown.map(c => ({ name: c._id, value: c.count }));
  // Ajouter les photos à la répartition si elles existent
  if (photoCount > 0) contentTypes.push({ name: 'photo', value: photoCount });

  // Récupérer les 5 commandes récentes payées avec les infos utilisateur
  const recentOrders = await Order.find({ paymentStatus: 'paid' })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name email')
    .lean();

  // Formater les commandes récentes pour l'administration
  const recentOrdersFormatted = recentOrders.map(o => ({
    id: o._id,
    customer: o.userId?.name || o.userId?.email || 'Unknown',
    email: o.userId?.email || '',
    total: o.total || 0,
    items: o.items?.length || 0,
    date: o.createdAt,
    status: o.paymentStatus,
  }));

  // Récupérer les 5 contenus les plus téléchargés
  const topContent = await Content.find()
    .sort({ downloads: -1 })
    .limit(5)
    .select('title type downloads views')
    .lean();

  // Récupérer les 3 photos les plus téléchargées
  const topPhotos = await Photo.find()
    .sort({ downloads: -1 })
    .limit(3)
    .select('title downloads purchases')
    .lean();

  // Récupérer le nombre de nouveaux utilisateurs par mois
  const monthlyUsers = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      users: { $sum: 1 }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Construire le tableau pour le graphique des utilisateurs
  const usersChart = [];
  for (let i = 5; i >= 0; i--) {
    // Calculer la date pour chaque mois
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    // Chercher les données existantes pour ce mois
    const found = monthlyUsers.find(m => m._id.year === year && m._id.month === month);
    // Ajouter les données au graphique
    usersChart.push({
      month: monthNames[month - 1],
      users: found ? found.users : 0,
    });
  }

  // Envoyer la réponse complète avec toutes les données d'administration
  res.status(200).json({
    status: 'success',
    data: {
      totalRevenue: `${totalRevenue.toLocaleString()} TND`,
      activeUsers: totalUsers,
      videoCount,
      photoCount,
      totalDownloads,
      revenueChart,
      downloadsChart,
      usersChart,
      contentTypes,
      recentOrders: recentOrdersFormatted,
      topContent,
      topPhotos,
    }
  });
});

// Fonction pour récupérer les éléments achetés et téléchargeables par l'utilisateur
const getMyDownloads = asyncHandler(async (req, res, next) => {
  // Récupérer l'identifiant de l'utilisateur connecté
  const userId = req.user._id;
  // Construire l'URL de base du serveur
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Récupérer toutes les commandes payées de cet utilisateur
  const orders = await Order.find({ userId, paymentStatus: 'paid' });

  // Créer une Map pour stocker les éléments achetés de façon unique
  let itemsMap = new Map();

  // Parcourir toutes les commandes
  for (const order of orders) {
    // Traiter les articles directs de chaque commande
    for (const item of order.items) {
      // Créer une clé unique basée sur le type et l'identifiant
      const key = `${item.type}_${item.itemId.toString()}`;
      // Ajouter l'élément s'il n'existe pas déjà
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          type: item.type,
          itemId: item.itemId,
          title: item.title,
          orderId: order._id,
          purchaseDate: order.paidAt || order.createdAt
        });
      }
    }

    // Traiter les éléments associés à des jetons de téléchargement
    if (order.downloadTokens && order.downloadTokens.length > 0) {
      for (const token of order.downloadTokens) {
        // Créer une clé unique pour chaque jeton
        const key = `${token.itemType}_${token.itemId.toString()}`;
        // Ajouter l'élément s'il n'existe pas déjà
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            type: token.itemType,
            itemId: token.itemId,
            orderId: order._id,
            purchaseDate: order.paidAt || order.createdAt
          });
        }
      }
    }
  }

  // Convertir la Map en tableau
  const downloads = Array.from(itemsMap.values());

  // Séparer les identifiants par type d'élément
  const photoIds = downloads.filter(d => d.type === 'photo').map(d => d.itemId);
  const packIds = downloads.filter(d => d.type === 'pack').map(d => d.itemId);
  const contentIds = downloads.filter(d => d.type === 'content').map(d => d.itemId);

  // Charger les détails de chaque type depuis la base de données
  const photos = await Photo.find({ _id: { $in: photoIds } }).lean();
  const packs = await Pack.find({ _id: { $in: packIds } }).lean();
  const contents = await Content.find({ _id: { $in: contentIds } }).lean();

  // Créer des Maps pour accéder rapidement aux détails par identifiant
  const photoMap = new Map(photos.map(p => [p._id.toString(), p]));
  const packMap = new Map(packs.map(p => [p._id.toString(), p]));
  const contentMap = new Map(contents.map(p => [p._id.toString(), p]));

  // Enrichir chaque téléchargement avec les détails du produit
  const enrichedDownloads = downloads.map(d => {
    // Initialiser les variables pour les détails du produit
    let itemData = null;
    let format = '';
    let size = '';

    // Associer les détails selon le type de produit
    if (d.type === 'photo') {
      itemData = photoMap.get(d.itemId.toString());
      format = 'JPEG';
      size = 'High Res';
    } else if (d.type === 'pack') {
      itemData = packMap.get(d.itemId.toString());
      format = 'ZIP';
      size = 'Pack';
    } else if (d.type === 'content') {
      itemData = contentMap.get(d.itemId.toString());
      format = itemData?.type === 'video' ? 'MP4' : 'File';
      size = 'Original';
    }

    // Retrouver la commande pour obtenir le jeton de téléchargement
    const order = orders.find(o => o._id.toString() === d.orderId.toString());
    // Initialiser le jeton à null
    let tokenStr = null;
    if (order) {
       // Chercher le jeton de téléchargement pour cet élément
       const tokenDoc = order.downloadTokens.find(t => t.itemId.toString() === d.itemId.toString());
       // Récupérer le jeton brut depuis les métadonnées si disponible
       if (tokenDoc && order.metadata?.rawTokens) {
         tokenStr = order.metadata.rawTokens[`${d.type}_${d.itemId.toString()}`];
       }

       // Créer un nouveau jeton si aucun n'existe et que la commande est payée
       if (!tokenStr && order.paymentStatus === 'paid') {
         tokenStr = order.createDownloadToken(d.type, d.itemId, 24);
         // Sauvegarder le nouveau jeton dans les métadonnées
         const rawTokens = order.metadata?.rawTokens || {};
         rawTokens[`${d.type}_${d.itemId.toString()}`] = tokenStr;
         order.metadata = { ...order.metadata, rawTokens };
         // Sauvegarder la commande en arrière-plan
         order.save().catch(err => console.error('Failed to save legacy token:', err));
       }
    }

    // Retourner l'objet de téléchargement enrichi
    return {
      id: d.itemId.toString() + '_' + d.orderId.toString(),
      itemId: d.itemId,
      title: itemData?.title || d.title || 'Unknown Item',
      type: d.type === 'photo' ? 'Photo' : d.type === 'pack' ? (itemData?.type === 'membership' ? 'Membership' : 'Pack') : 'Video',
      packType: itemData?.type,
      purchaseDate: d.purchaseDate,
      size,
      format,
      orderId: d.orderId,
      downloadToken: tokenStr,
      thumbnail: itemData?.thumbnailFileId ? `${baseUrl}/api/media/${itemData.thumbnailFileId}` : (itemData?.lowResFileId ? `${baseUrl}/api/photos/${itemData._id}/preview` : (itemData?.imageUrl || null))
    };
  });

  // Filtrer les éléments dont les détails n'ont pas été trouvés
  const validDownloads = enrichedDownloads.filter(d => d.title !== 'Unknown Item');

  // Envoyer la réponse avec la liste des éléments téléchargeables
  res.status(200).json({
    status: 'success',
    data: validDownloads
  });
});

// Fonction pour récupérer les photos de l'utilisateur connecté avec pagination
const getMyPhotos = asyncHandler(async (req, res, _next) => {
  // Récupérer l'identifiant de l'utilisateur connecté
  const userId = req.user._id;
  // Extraire les paramètres de pagination et de tri de la requête
  const {
    page = 1,
    limit = 20,
    sort = '-createdAt',
  } = req.query;

  // Définir le filtre de recherche pour les photos de l'utilisateur
  const query = { createdBy: userId };
  // Compter le nombre total de photos correspondantes
  const total = await Photo.countDocuments(query);

  // Récupérer les photos paginées et triées
  const photos = await Photo.find(query)
    .select('title description governorate landscapeType priceTND lowResFileId imageUrl tags createdAt previewDownloads')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Construire l'URL de base pour les aperçus d'images
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  // Ajouter les liens d'aperçu à chaque photo
  const photosWithUrls = photos.map(photo => {
    // Convertir le document Mongoose en objet simple
    const obj = photo.toObject();
    // Utiliser l'URL existante ou construire l'URL d'aperçu
    if (photo.imageUrl) {
      obj.previewUrl = photo.imageUrl;
    } else {
      obj.previewUrl = `${baseUrl}/api/photos/${photo._id}/preview`;
    }
    return obj;
  });

  // Envoyer la réponse paginée avec les photos
  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos: photosWithUrls },
  });
});

// Fonction pour récupérer les contenus de l'utilisateur connecté avec pagination
const getMyContent = asyncHandler(async (req, res, _next) => {
  // Récupérer l'identifiant de l'utilisateur connecté
  const userId = req.user._id;
  // Construire l'URL de base du serveur
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // Extraire les paramètres de pagination, type et tri
  const {
    page = 1,
    limit = 20,
    type,
    sort = '-createdAt',
  } = req.query;

  // Définir le filtre de base par créateur
  const query = { createdBy: userId };
  // Ajouter un filtre par type si spécifié
  if (type) query.type = type;

  // Compter le nombre total de contenus correspondants
  const total = await Content.countDocuments(query);

  // Récupérer les contenus paginés et triés
  const contents = await Content.find(query)
    .select('-__v')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Ajouter les URLs pour la miniature et le fichier média
  const contentsWithUrls = contents.map(content => {
    // Convertir le document Mongoose en objet simple
    const obj = content.toObject();
    // Construire l'URL de la miniature si elle existe
    obj.thumbnailUrl = content.thumbnailFileId ? `${baseUrl}/api/media/${content.thumbnailFileId}` : null;
    // Construire l'URL du contenu média
    obj.contentUrl = `${baseUrl}/api/media/${content.fileFileId}`;
    return obj;
  });

  // Envoyer la réponse paginée avec les contenus enrichis
  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents: contentsWithUrls },
  });
});

// Fonction pour enregistrer un téléchargement et incrémenter le compteur
const trackDownload = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant et le type d'élément du corps de la requête
  const { itemId, itemType } = req.body;

  // Vérifier que les deux champs obligatoires sont fournis
  if (!itemId || !itemType) {
    return res.status(400).json({ status: 'error', message: 'itemId and itemType are required' });
  }

  // Incrémenter le compteur de téléchargements selon le type
  if (itemType === 'photo') {
    await Photo.findByIdAndUpdate(itemId, { $inc: { downloads: 1 } });
  } else if (itemType === 'content') {
    await Content.findByIdAndUpdate(itemId, { $inc: { downloads: 1 } });
  }

  // Envoyer la réponse de confirmation
  res.status(200).json({ status: 'success', message: 'Download tracked' });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  getUserUploadStats,
  getRecentActivity,
  getUserPacks,
  getUserStats,
  getAdminStats,
  getMyDownloads,
  getMyPhotos,
  getMyContent,
  trackDownload,
};
