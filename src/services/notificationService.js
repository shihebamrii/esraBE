// Importation de la bibliothèque web-push pour envoyer des notifications push
const webpush = require('web-push');
// Importation des modèles Notification, PushSubscription et User depuis le dossier des modèles
const { Notification, PushSubscription, User } = require('../models');

// Récupération de la clé publique VAPID depuis les variables d'environnement ou valeur par défaut
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BMqwkM82TLGZAKMZwoabby-SY2JNRGIP6L_lZHYzEtdrCwvZ3YZY0uL1c4CD6udFi47VrZPJAkm6kLU8uShen2U';
// Récupération de la clé privée VAPID depuis les variables d'environnement ou valeur par défaut
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'priZ2FOGIJQ6Qkejvnr8DQS5qXUc8i2K7n0O-lnkuk4';
// Récupération de l'adresse e-mail VAPID depuis les variables d'environnement ou valeur par défaut
const email = process.env.VAPID_EMAIL || 'mailto:admin@mediatheque.tn';

// Configuration des détails VAPID pour l'envoi de notifications push
webpush.setVapidDetails(email, publicVapidKey, privateVapidKey);

// Déclaration de la fonction asynchrone pour envoyer une notification push à un utilisateur spécifique
const sendPushToUser = async (userId, payload) => {
  try {
    // Recherche de tous les abonnements push de l'utilisateur dans la base de données
    const subscriptions = await PushSubscription.find({ user: userId });
    
    // Si aucun abonnement n'est trouvé, on arrête la fonction
    if (!subscriptions || subscriptions.length === 0) return;

    // Parcours de chaque abonnement de l'utilisateur
    for (const sub of subscriptions) {
      // Construction de l'objet d'abonnement push au format attendu par web-push
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      try {
        // Envoi de la notification push avec les données sérialisées en JSON
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (err) {
        // Si l'abonnement est expiré (410) ou introuvable (404), on le supprime
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          // Affichage de l'erreur dans la console pour les autres cas
          console.error('Error sending push:', err);
        }
      }
    }
  } catch (error) {
    // Affichage de l'erreur générale dans la console
    console.error('Error in sendPushToUser:', error);
  }
};

// Déclaration de la fonction asynchrone pour notifier un utilisateur et sauvegarder en base de données
const notifyUser = async (userId, { title, message, type = 'system', link = '/' }) => {
  try {
    // Création et sauvegarde de la notification dans la base de données
    const notification = await Notification.create({
      recipient: userId,
      title,
      message,
      type,
      link
    });

    // Envoi de la notification push à l'utilisateur
    await sendPushToUser(userId, {
      title,
      body: message,
      url: link,
      // Icône affichée dans la notification push
      icon: '/icon-192x192.png'
    });

    // Retour de l'objet notification créé
    return notification;
  } catch (error) {
    // Affichage de l'erreur dans la console
    console.error('Failed to notify user:', error);
  }
};

// Déclaration de la fonction asynchrone pour notifier tous les utilisateurs non-administrateurs
const notifyAllUsers = async ({ title, message, type = 'new_content', link = '/' }) => {
  try {
    // Récupération de tous les utilisateurs qui ne sont pas administrateurs
    const users = await User.find({ role: { $ne: 'admin' } }).select('_id');
    
    // Si aucun utilisateur n'est trouvé, on arrête la fonction
    if (users.length === 0) return;

    // Création d'un tableau de notifications pour l'insertion en masse
    const notificationsToInsert = users.map(u => ({
      recipient: u._id,
      title,
      message,
      type,
      link
    }));

    // Insertion de toutes les notifications en une seule opération
    await Notification.insertMany(notificationsToInsert);

    // Préparation des données de la notification push
    const payload = {
      title,
      body: message,
      url: link,
      icon: '/icon-192x192.png'
    };

    // Récupération de tous les abonnements push existants
    const allSubs = await PushSubscription.find({});
    // Parcours de chaque abonnement pour envoyer la notification
    for (const sub of allSubs) {
      // Construction de l'objet d'abonnement au format attendu
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      try {
        // Envoi de la notification push
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (err) {
        // Suppression de l'abonnement si expiré ou introuvable
         if (err.statusCode === 410 || err.statusCode === 404) {
           await PushSubscription.findByIdAndDelete(sub._id);
         }
      }
    }

  } catch (error) {
    // Affichage de l'erreur dans la console
    console.error('Failed to notify all users:', error);
  }
};

// Exportation des fonctions de notification
module.exports = {
  notifyUser,
  notifyAllUsers
};
