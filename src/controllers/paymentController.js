// Importation des modèles de la base de données
const { Order, Cart, Photo, Pack, Content, AuditLog, UserPack } = require('../models');
// Importation de la fonction pour obtenir le fournisseur de paiement
const { getPaymentProvider } = require('../services/paymentAdapter');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');

// Fonction pour traiter les webhooks du fournisseur de paiement
const handleWebhook = asyncHandler(async (req, res, next) => {
  // Récupérer la signature du webhook depuis les en-têtes
  const signature = req.headers['stripe-signature'] || req.headers['x-paytech-signature'] || '';
  // Garder le corps brut de la requête
  const rawBody = req.body;
  // Initialiser le payload avec le corps de la requête
  let payload = req.body;

  // Convertir le corps en JSON s'il est sous forme de Buffer
  if (Buffer.isBuffer(payload)) {
    try {
      payload = JSON.parse(payload.toString());
    } catch (e) {
      // Garder le payload tel quel si ce n'est pas du JSON
    }
  }

  // Obtenir le fournisseur de paiement configuré
  const paymentProvider = getPaymentProvider();

  // Préparer le payload pour la vérification de la signature
  const webhookPayload = paymentProvider.name === 'stripe' ? rawBody : payload;
  // Vérifier la signature du webhook (sauf en mode mock)
  if (paymentProvider.name !== 'mock' && !paymentProvider.verifyWebhook(webhookPayload, signature)) {
    // Enregistrer l'activité suspecte dans le journal
    await AuditLog.log({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: { reason: 'Invalid payment webhook signature' },
      result: 'failure',
    });
    return next(new AppError('Webhook signature verification failed', 400));
  }

  // Déterminer l'identifiant de la commande selon le fournisseur
  let orderId;
  // Déterminer le statut du paiement
  let paymentStatus;

  // Traitement pour Stripe
  if (paymentProvider.name === 'stripe') {
    const event = payload;
    // Vérifier si c'est un événement de session de paiement complété
    if (event.type === 'checkout.session.completed') {
      orderId = event.data.object.metadata.orderId;
      paymentStatus = 'paid';
    }
  } else if (paymentProvider.name === 'paytech') {
    // Traitement pour PayTech
    orderId = payload.order_id;
    paymentStatus = payload.status === 'success' ? 'paid' : 'failed';
  } else {
    // Traitement pour le mode mock (développement)
    orderId = payload.orderId || payload.order_id || payload.payment_id || payload.id || req.query.orderId;
    paymentStatus = 'paid';
  }

  // Si aucun identifiant de commande n'est trouvé, confirmer la réception
  if (!orderId) {
    return res.status(200).json({ received: true, message: 'No order to process' });
  }

  // Rechercher la commande dans la base de données
  const order = await Order.findById(orderId);

  // Si la commande n'existe pas, afficher une erreur et confirmer la réception
  if (!order) {
    console.error(`Order not found: ${orderId}`);
    return res.status(200).json({ received: true, error: 'Order not found' });
  }

  // Si la commande est déjà payée, ne rien faire
  if (order.paymentStatus === 'paid') {
    return res.status(200).json({ received: true, message: 'Already processed' });
  }

  // Si le paiement est confirmé comme payé
  if (paymentStatus === 'paid') {
    // Mettre à jour le statut de la commande
    order.paymentStatus = 'paid';
    // Enregistrer la date de paiement
    order.paidAt = new Date();
    // Enregistrer l'identifiant du paiement
    order.paymentId = payload.id || payload.payment_id;

    // Créer des jetons de téléchargement pour chaque article
    const rawTokens = {};
    for (const item of order.items) {
      // Créer un jeton valide 24 heures pour chaque article
      const rawToken = order.createDownloadToken(item.type, item.itemId, 24);
      rawTokens[`${item.type}_${item.itemId.toString()}`] = rawToken;

      // Si l'article est un pack de type collection, créer des jetons pour chaque photo
      if (item.type === 'pack') {
        const pack = await Pack.findById(item.itemId);
        if (pack && pack.type === 'collection' && pack.photoIds?.length > 0) {
          for (const photoId of pack.photoIds) {
            // Créer un jeton pour chaque photo du pack
            const photoToken = order.createDownloadToken('photo', photoId, 24);
            rawTokens[`photo_${photoId.toString()}`] = photoToken;
          }
        }
      }
    }

    // Sauvegarder les jetons bruts dans les métadonnées de la commande
    order.metadata = { ...order.metadata, rawTokens };

    // Sauvegarder la commande mise à jour
    await order.save();

    // Vider le panier de l'utilisateur
    await Cart.findOneAndUpdate(
      { userId: order.userId },
      { items: [], lastPriceUpdate: null }
    );

    // Mettre à jour les compteurs de ventes pour chaque article
    for (const item of order.items) {
      if (item.type === 'photo') {
        // Incrémenter le compteur d'achats pour les photos
        await Photo.findByIdAndUpdate(item.itemId, { $inc: { purchases: 1 } });
      } else if (item.type === 'pack') {
        // Incrémenter le compteur d'achats pour les packs
        const pack = await Pack.findById(item.itemId);
        if (pack) {
          pack.purchases += 1;
          await pack.save();

          // Si le pack est de type abonnement, l'activer pour l'utilisateur
          if (pack.type === 'membership' && pack.membershipFeatures) {
            await UserPack.create({
              userId: order.userId,
              packId: pack._id,
              orderId: order._id,
              module: pack.membershipFeatures.module,
              quotas: {
                photosRemaining: pack.membershipFeatures.photosLimit || 0,
                reelsRemaining: pack.membershipFeatures.module === 'impact' ? 0 : (pack.membershipFeatures.reelsLimit || 0),
                videosRemaining: pack.membershipFeatures.module === 'impact'
                  ? (pack.membershipFeatures.videosLimit || 0) + (pack.membershipFeatures.reelsLimit || 0)
                  : (pack.membershipFeatures.videosLimit || 0),
                documentariesRemaining: pack.membershipFeatures.documentariesLimit || 0,
                podcastsRemaining: pack.membershipFeatures.podcastsLimit || 0,
                successStoryRemaining: pack.membershipFeatures.successStoryLimit || 0,
              },
              quality: pack.membershipFeatures.quality,
              isActive: true,
            });
          }
        }
      } else if (item.type === 'content') {
        // Incrémenter le compteur de téléchargements pour les contenus
        await Content.findByIdAndUpdate(item.itemId, { $inc: { downloads: 1 } });
      }
    }

    // Enregistrer la commande payée dans le journal d'audit
    await AuditLog.log({
      userId: order.userId,
      action: 'ORDER_PAID',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `Order:${orderId}`,
      result: 'success',
    });
  } else if (paymentStatus === 'failed') {
    // Si le paiement a échoué, mettre à jour le statut
    order.paymentStatus = 'failed';
    await order.save();
  }

  // Confirmer la réception du webhook
  res.status(200).json({ received: true });
});

// Fonction pour simuler un paiement complet (développement uniquement)
const mockComplete = asyncHandler(async (req, res, next) => {
  // Extraire les paramètres de la requête
  const { sessionId, orderId } = req.query;

  // Vérifier que l'environnement n'est pas en production
  if (process.env.NODE_ENV === 'production') {
    return next(new AppError('Not available in production', 403));
  }

  // Créer un faux payload pour simuler le webhook
  const fakePayload = {
    orderId,
    sessionId,
    id: sessionId,
    status: 'success',
  };

  // Créer une fausse réponse pour capturer le résultat
  const fakeRes = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    }
  };

  // Remplacer le corps de la requête par le faux payload
  req.body = fakePayload;
  // Appeler la fonction de traitement du webhook
  await handleWebhook(req, fakeRes, next);

  // Construire l'URL du frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Rediriger l'utilisateur vers la page des commandes avec le statut 303
  res.redirect(303, `${frontendUrl}/orders?session_id=${sessionId}&success=true`);
});

// Fonction pour vérifier le statut d'un paiement
const getPaymentStatus = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la commande depuis les paramètres
  const { orderId } = req.params;

  // Rechercher la commande dans la base de données
  const order = await Order.findById(orderId);

  // Si la commande n'existe pas, retourner une erreur 404
  if (!order) {
    return next(new AppError('Commande introuvable !', 404));
  }

  // Vérifier que l'utilisateur a accès à cette commande
  if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Non autorisé !', 403));
  }

  // Si la commande est en attente et a une session de paiement, vérifier le statut
  if (order.paymentStatus === 'pending' && order.metadata?.paymentSession) {
    try {
      // Obtenir le fournisseur de paiement
      const paymentProvider = getPaymentProvider();
      // Vérifier le statut du paiement auprès du fournisseur
      const status = await paymentProvider.getPaymentStatus(order.metadata.paymentSession);

      // Si le paiement est confirmé comme payé
      if (status.status === 'paid') {
        // Créer une fausse requête pour réutiliser la logique du webhook
        const fakeReq = {
          body: { orderId: order._id, id: order.metadata.paymentSession },
          ip: req.ip,
          get: (header) => req.get(header),
        };

        // Créer une fausse réponse pour ne pas envoyer de données en double
        const fakeRes = {
          status: () => ({ json: () => {} }),
        };

        // Appeler le webhook pour traiter le paiement
        await handleWebhook(fakeReq, fakeRes, next);

        // Récupérer la commande mise à jour
        const updatedOrder = await Order.findById(orderId);
        // Envoyer la réponse avec les nouvelles informations
        return res.status(200).json({
          status: 'success',
          data: {
            orderId: updatedOrder._id,
            paymentStatus: updatedOrder.paymentStatus,
            paidAt: updatedOrder.paidAt,
          },
        });
      }
    } catch (error) {
      // Afficher l'erreur dans la console
      console.error('Error checking payment status:', error);
    }
  }

  // Envoyer la réponse avec le statut actuel de la commande
  res.status(200).json({
    status: 'success',
    data: {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt,
    },
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  handleWebhook,
  mockComplete,
  getPaymentStatus,
};
