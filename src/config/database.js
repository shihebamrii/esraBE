// Importation du module Mongoose pour interagir avec MongoDB
const mongoose = require('mongoose');

// Variable pour stocker l'instance GridFSBucket (initialement nulle)
let gridFSBucket = null;

// Fonction asynchrone pour se connecter à la base de données MongoDB
const connectDB = async () => {
  try {
    // Tentative de connexion à MongoDB en utilisant l'URI défini dans les variables d'environnement
    const conn = await mongoose.connect(process.env.MONGO_URI, {
    });

    // Affichage d'un message de succès avec le nom de l'hôte de la connexion
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Récupération de l'objet base de données native depuis la connexion Mongoose
    const db = conn.connection.db;
    // Importation de la classe GridFSBucket depuis le module MongoDB natif
    const { GridFSBucket } = require('mongodb');

    // Création d'une nouvelle instance GridFSBucket pour stocker les fichiers volumineux
    gridFSBucket = new GridFSBucket(db, {
      // Nom du bucket GridFS, avec une valeur par défaut de 'mediaFiles'
      bucketName: process.env.GRIDFS_BUCKET_NAME || 'mediaFiles',
    });

    // Affichage d'un message confirmant l'initialisation du bucket GridFS
    console.log(`📦 GridFS Bucket initialized: ${process.env.GRIDFS_BUCKET_NAME || 'mediaFiles'}`);

    // Retour de l'objet de connexion
    return conn;
  } catch (error) {
    // Affichage du message d'erreur en cas d'échec de la connexion
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    // Arrêt du processus avec un code d'erreur
    process.exit(1);
  }
};

// Fonction pour récupérer l'instance GridFSBucket
const getGridFSBucket = () => {
  // Vérification que le bucket GridFS a été initialisé
  if (!gridFSBucket) {
    // Lancement d'une erreur si le bucket n'est pas encore prêt
    throw new Error("GridFS n'est pas encore initialisé. Veuillez d'abord vous connecter à la base de données");
  }
  // Retour de l'instance GridFSBucket
  return gridFSBucket;
};

// Fonction asynchrone pour se déconnecter de la base de données
const disconnectDB = async () => {
  try {
    // Fermeture de la connexion MongoDB
    await mongoose.connection.close();
    // Affichage d'un message de déconnexion réussie
    console.log('👋 MongoDB Disconnected');
  } catch (error) {
    // Affichage du message d'erreur en cas d'échec de la déconnexion
    console.error(`❌ Error disconnecting from MongoDB: ${error.message}`);
  }
};

// Exportation des fonctions pour les utiliser dans d'autres fichiers
module.exports = {
  connectDB,
  getGridFSBucket,
  disconnectDB,
};
