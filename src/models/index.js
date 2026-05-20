// Importation du modèle User (utilisateurs)
const User = require('./User');
// Importation du modèle Content (contenus multimédias)
const Content = require('./Content');
// Importation du modèle Photo (photos)
const Photo = require('./Photo');
// Importation du modèle Pack (packs de photos et contenus)
const Pack = require('./Pack');
// Importation du modèle Order (commandes et achats)
const Order = require('./Order');
// Importation du modèle Subscription (abonnements)
const Subscription = require('./Subscription');
// Importation du modèle AuditLog (journal d'audit)
const AuditLog = require('./AuditLog');
// Importation du modèle Governorate (gouvernorats)
const Governorate = require('./Governorate');
// Importation du modèle Cart (panier d'achat)
const Cart = require('./Cart');
// Importation du modèle Favorite (favoris)
const Favorite = require('./Favorite');
// Importation du modèle UserPack (packs achetés par les utilisateurs)
const UserPack = require('./UserPack');
// Importation du modèle Playlist (listes de lecture)
const Playlist = require('./Playlist');
// Importation du modèle Inquiry (demandes de contact)
const Inquiry = require('./Inquiry');
// Importation du modèle Notification (notifications)
const Notification = require('./Notification');
// Importation du modèle PushSubscription (abonnements aux notifications push)
const PushSubscription = require('./PushSubscription');

// Exportation de tous les modèles depuis un seul point d'entrée
module.exports = {
  User,
  Content,
  Photo,
  Pack,
  Order,
  Subscription,
  AuditLog,
  Governorate,
  Cart,
  Favorite,
  UserPack,
  Playlist,
  Inquiry,
  Notification,
  PushSubscription,
};
