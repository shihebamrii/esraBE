// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();

// Objet de configuration principal de l'application
const config = {
  // Configuration du serveur
  server: {
    // Port d'écoute du serveur, par défaut 5000
    port: parseInt(process.env.PORT, 10) || 5000,
    // Environnement d'exécution (développement ou production)
    env: process.env.NODE_ENV || 'development',
    // Indicateur booléen pour savoir si on est en mode développement
    isDev: process.env.NODE_ENV !== 'production',
  },

  // Configuration de la base de données
  database: {
    // URI de connexion à MongoDB
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mediatheque',
    // Nom du bucket GridFS pour le stockage des fichiers
    gridFsBucket: process.env.GRIDFS_BUCKET_NAME || 'mediaFiles',
  },

  // Configuration des jetons JWT
  jwt: {
    // Clé secrète pour signer les jetons d'accès
    secret: process.env.JWT_SECRET || 'change-this-secret',
    // Clé secrète pour signer les jetons de rafraîchissement
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    // Durée de validité du jeton d'accès
    expiresIn: process.env.TOKEN_EXPIRY || '36500d',
    // Durée de validité du jeton de rafraîchissement
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRY || '36500d',
  },

  // Configuration du paiement
  payment: {
    // Fournisseur de paiement utilisé (par défaut : mock)
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    // Configuration spécifique à Stripe
    stripe: {
      // Clé secrète Stripe
      secretKey: process.env.STRIPE_SECRET_KEY,
      // Secret du webhook Stripe
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    // Configuration spécifique à PayTech
    paytech: {
      // Clé API PayTech
      apiKey: process.env.PAYTECH_API_KEY,
      // Clé secrète PayTech
      secretKey: process.env.PAYTECH_SECRET_KEY,
      // Secret du webhook PayTech
      webhookSecret: process.env.PAYTECH_WEBHOOK_SECRET,
    },
  },

  // Configuration du stockage de fichiers
  storage: {
    // Fournisseur de stockage (par défaut : gridfs)
    provider: process.env.STORAGE_PROVIDER || 'gridfs',
    // Configuration spécifique à AWS S3
    aws: {
      // Identifiant de la clé d'accès AWS
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      // Clé secrète d'accès AWS
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      // Région AWS (par défaut : eu-west-1)
      region: process.env.AWS_REGION || 'eu-west-1',
      // Nom du bucket S3
      bucket: process.env.AWS_S3_BUCKET,
    },
    // Configuration spécifique à Cloudflare R2
    r2: {
      // Identifiant du compte Cloudflare
      accountId: process.env.R2_ACCOUNT_ID,
      // Identifiant de la clé d'accès R2
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      // Clé secrète d'accès R2
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      // Nom du bucket R2
      bucket: process.env.R2_BUCKET_NAME,
    },
  },

  // Configuration de la limitation du nombre de requêtes
  rateLimit: {
    // Fenêtre de temps en millisecondes (par défaut : 15 minutes)
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    // Nombre maximum de requêtes autorisées dans la fenêtre de temps
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Limites de taille pour le téléchargement de fichiers (en octets)
  upload: {
    // Taille maximale d'une photo (par défaut : 20 Mo)
    maxPhotoSize: (parseInt(process.env.MAX_PHOTO_SIZE_MB, 10) || 20) * 1024 * 1024,
    // Taille maximale d'une vidéo (par défaut : 500 Mo)
    maxVideoSize: (parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 500) * 1024 * 1024,
    // Taille maximale d'un fichier audio (par défaut : 100 Mo)
    maxAudioSize: (parseInt(process.env.MAX_AUDIO_SIZE_MB, 10) || 100) * 1024 * 1024,
  },

  // Configuration du jeton de téléchargement
  download: {
    // Durée de validité du jeton de téléchargement (par défaut : 24 heures)
    tokenExpiry: process.env.DOWNLOAD_TOKEN_EXPIRY || '24h',
  },

  // Configuration des origines CORS autorisées
  cors: {
    // Liste des origines autorisées, séparées par des virgules dans la variable d'environnement
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
};

// Vérification des variables d'environnement obligatoires en mode production
if (config.server.env === 'production') {
  // Liste des variables d'environnement requises
  const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'];
  // Filtrage des variables manquantes
  const missing = requiredVars.filter((key) => !process.env[key]);

  // Si des variables sont manquantes, lancement d'une erreur
  if (missing.length > 0) {
    throw new Error(`⚠️ Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Exportation de l'objet de configuration
module.exports = config;
