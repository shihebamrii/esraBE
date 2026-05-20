// Importation du framework Express
const express = require('express');
// Importation du module de compression des réponses HTTP
const compression = require('compression');
// Importation du module Helmet pour la sécurité des en-têtes HTTP
const helmet = require('helmet');
// Importation du module CORS pour autoriser les requêtes entre domaines
const cors = require('cors');
// Importation du module de limitation du nombre de requêtes
const rateLimit = require('express-rate-limit');
// Importation du module de protection contre la pollution des paramètres HTTP
const hpp = require('hpp');
// Importation du module de protection contre les injections NoSQL MongoDB
const mongoSanitize = require('express-mongo-sanitize');

// Importation de la configuration de l'application
const config = require('./config');
// Importation du middleware de gestion globale des erreurs
const errorHandler = require('./middlewares/errorHandler');
// Importation du middleware pour les routes non trouvées (404)
const { notFound } = require('./middlewares/notFound');

// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();

// Création de l'application Express
const app = express();

// Activation de la compression des réponses pour améliorer les performances
app.use(compression());

// Activation de Helmet pour protéger l'application contre les vulnérabilités connues
app.use(helmet({
  // Autoriser le chargement de ressources depuis d'autres origines
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Configuration du CORS pour autoriser le frontend à communiquer avec le backend
app.use(cors({
  // Liste des origines autorisées définie dans la configuration
  origin: config.cors.origins,
  // Autoriser l'envoi de cookies et d'informations d'authentification
  credentials: true,
  // Méthodes HTTP autorisées
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  // En-têtes autorisés dans les requêtes
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'Range'],
  // En-têtes exposés dans les réponses
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
}));

// Activation de la protection contre la pollution des paramètres HTTP
app.use(hpp());

// Activation de la protection contre les injections NoSQL
app.use(mongoSanitize());

// Analyse du corps des requêtes au format JSON avec une limite de taille de 10 Ko
app.use(express.json({ limit: '10kb' }));

// Analyse du corps des requêtes au format URL-encoded avec une limite de taille de 10 Ko
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Route de vérification de l'état de santé du serveur
app.get('/api/health', (_req, res) => {
  // Envoi d'une réponse JSON avec le statut du serveur
  res.status(200).json({
    // Statut de la réponse
    status: 'success',
    // Message indiquant que le serveur fonctionne correctement
    message: 'Le serveur fonctionne correctement ! 🚀',
    // Horodatage actuel au format ISO
    timestamp: new Date().toISOString(),
    // Environnement actuel du serveur (développement ou production)
    environment: config.server.env,
  });
});

// Importation des routes d'authentification
const authRoutes = require('./routes/authRoutes');
// Importation des routes de contenu
const contentRoutes = require('./routes/contentRoutes');
// Importation des routes de photos
const photoRoutes = require('./routes/photoRoutes');
// Importation des routes de médias (streaming et téléchargement)
const mediaRoutes = require('./routes/mediaRoutes');
// Importation des routes d'intelligence artificielle
const aiRoutes = require('./routes/aiRoutes');
// Importation des routes du panier d'achat
const cartRoutes = require('./routes/cartRoutes');
// Importation des routes de commande et paiement
const checkoutRoutes = require('./routes/checkoutRoutes');
// Importation des routes de recherche
const searchRoutes = require('./routes/searchRoutes');
// Importation des routes de demandes de renseignements
const inquiryRoutes = require('./routes/inquiryRoutes');
// Importation des routes du tableau de bord
const dashboardRoutes = require('./routes/dashboardRoutes');
// Importation des routes d'administration
const adminRoutes = require('./routes/adminRoutes');
// Importation des routes de notifications
const notificationRoutes = require('./routes/notificationRoutes');
// Importation des routes des favoris
const favoriteRoutes = require('./routes/favoriteRoutes');
// Importation des routes des packs
const packRoutes = require('./routes/packRoutes');
// Importation des routes de paiement
const paymentRoutes = require('./routes/paymentRoutes');
// Importation des routes des listes de lecture
const playlistRoutes = require('./routes/playlistRoutes');

// Association des routes d'authentification au chemin /api/auth
app.use('/api/auth', authRoutes);
// Association des routes de contenu au chemin /api/contents
app.use('/api/contents', contentRoutes);
// Association des routes de photos au chemin /api/photos
app.use('/api/photos', photoRoutes);
// Association des routes de médias au chemin /api/media
app.use('/api/media', mediaRoutes);
// Association des routes d'IA au chemin /api/ai
app.use('/api/ai', aiRoutes);
// Association des routes du panier au chemin /api/cart
app.use('/api/cart', cartRoutes);
// Association des routes de commande au chemin /api/checkout
app.use('/api/checkout', checkoutRoutes);
// Association des routes de recherche au chemin /api/search
app.use('/api/search', searchRoutes);
// Association des routes de demandes au chemin /api/inquiries
app.use('/api/inquiries', inquiryRoutes);
// Association des routes du tableau de bord au chemin /api/dashboard
app.use('/api/dashboard', dashboardRoutes);
// Association des routes d'administration au chemin /api/admin
app.use('/api/admin', adminRoutes);
// Association des routes de notifications au chemin /api/notifications
app.use('/api/notifications', notificationRoutes);
// Association des routes des favoris au chemin /api/favorites
app.use('/api/favorites', favoriteRoutes);
// Association des routes des packs au chemin /api/packs
app.use('/api/packs', packRoutes);
// Association des routes de paiement au chemin /api/payments
app.use('/api/payments', paymentRoutes);
// Association des routes des listes de lecture au chemin /api/playlists
app.use('/api/playlists', playlistRoutes);

// Middleware pour gérer les requêtes vers des routes inexistantes (erreur 404)
app.use(notFound);

// Middleware global de gestion des erreurs
app.use(errorHandler);

// Exportation de l'application Express pour utilisation dans le serveur
module.exports = app;
