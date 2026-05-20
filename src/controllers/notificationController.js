// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation des modèles Notification et PushSubscription
const { Notification, PushSubscription } = require('../models');

// Fonction pour récupérer les notifications de l'utilisateur connecté
const getMyNotifications = asyncHandler(async (req, res, next) => {
  // Extraire le numéro de page avec une valeur par défaut de 1
  const page = parseInt(req.query.page) || 1;
  // Extraire la limite par page avec une valeur par défaut de 20
  const limit = parseInt(req.query.limit) || 20;

  // Rechercher les notifications de l'utilisateur avec pagination
  const notifications = await Notification.find({ recipient: req.user._id })
    // Trier par date de création décroissante
    .sort({ createdAt: -1 })
    // Ignorer les résultats des pages précédentes
    .skip((page - 1) * limit)
    // Limiter le nombre de résultats
    .limit(limit);

  // Compter le nombre total de notifications de l'utilisateur
  const total = await Notification.countDocuments({ recipient: req.user._id });
  // Compter le nombre de notifications non lues
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

  // Envoyer la réponse avec les notifications et les informations de pagination
  res.status(200).json({
    status: 'success',
    data: { notifications, total, unreadCount, page, pages: Math.ceil(total / limit) }
  });
});

// Fonction pour marquer une notification comme lue
const markAsRead = asyncHandler(async (req, res, next) => {
  // Mettre à jour la notification en la marquant comme lue
  const notification = await Notification.findOneAndUpdate(
    // Chercher par identifiant et par destinataire pour la sécurité
    { _id: req.params.id, recipient: req.user._id },
    // Définir isRead à true
    { isRead: true },
    // Retourner le document mis à jour
    { new: true }
  );

  // Envoyer la réponse avec la notification mise à jour
  res.status(200).json({
    status: 'success',
    data: { notification }
  });
});

// Fonction pour récupérer la clé publique VAPID pour les notifications push
const getVapidKey = asyncHandler(async (req, res, next) => {
  // Récupérer la clé publique VAPID depuis les variables d'environnement ou utiliser la valeur par défaut
  const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BMqwkM82TLGZAKMZwoabby-SY2JNRGIP6L_lZHYzEtdrCwvZ3YZY0uL1c4CD6udFi47VrZPJAkm6kLU8uShen2U';

  // Envoyer la réponse avec la clé publique
  res.status(200).json({
    status: 'success',
    data: { publicKey: publicVapidKey }
  });
});

// Fonction pour s'abonner aux notifications push
const subscribePush = asyncHandler(async (req, res, next) => {
  // Récupérer les données d'abonnement du corps de la requête
  const subscription = req.body;

  // Vérifier que l'abonnement contient les informations requises
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ status: 'fail', message: "L'abonnement n'est pas valide !" });
  }

  // Vérifier si un abonnement avec ce point de terminaison existe déjà
  const existingSub = await PushSubscription.findOne({ endpoint: subscription.endpoint });

  // Si l'abonnement n'existe pas, en créer un nouveau
  if (!existingSub) {
    await PushSubscription.create({
      user: req.user._id,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    });
  } else if (existingSub.user.toString() !== req.user._id.toString()) {
    // Si le point de terminaison existe pour un autre utilisateur, le réassigner
    existingSub.user = req.user._id;
    await existingSub.save();
  }

  // Envoyer la réponse de confirmation d'abonnement
  res.status(201).json({
    status: 'success',
    message: 'Abonnement aux notifications réussi !'
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  getMyNotifications,
  markAsRead,
  getVapidKey,
  subscribePush
};
