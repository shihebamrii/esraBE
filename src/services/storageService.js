// Importation de la bibliothèque mongoose pour interagir avec MongoDB
const mongoose = require('mongoose');
// Importation de la classe Readable depuis le module stream de Node.js
const { Readable } = require('stream');
// Importation de la fonction pour obtenir le bucket GridFS depuis la configuration de la base de données
const { getGridFSBucket } = require('../config/database');
// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction asynchrone pour téléverser un fichier dans GridFS
const uploadToGridFS = async (buffer, filename, contentType, metadata = {}) => {
  // Récupération de l'instance du bucket GridFS
  const bucket = getGridFSBucket();
  
  // Création et retour d'une nouvelle promesse pour gérer l'opération asynchrone
  return new Promise((resolve, reject) => {
    // Création d'un flux de lecture (stream) à partir du tampon (buffer)
    const readableStream = new Readable();
    // Ajout des données du tampon dans le flux
    readableStream.push(buffer);
    // Signal de fin du flux de lecture
    readableStream.push(null);
    
    // Ouverture d'un flux d'écriture vers GridFS avec le nom du fichier et les options
    const uploadStream = bucket.openUploadStream(filename, {
      // Type de contenu du fichier (par exemple image/jpeg)
      contentType,
      // Métadonnées associées au fichier
      metadata: {
        // Copie des métadonnées fournies
        ...metadata,
        // Ajout de la date de téléversement
        uploadedAt: new Date(),
      },
    });
    
    // Écoute de l'événement d'erreur sur le flux d'écriture
    uploadStream.on('error', (error) => {
      // Rejet de la promesse avec une erreur personnalisée
      reject(new AppError(`Erreur lors du téléchargement : ${error.message}`, 500));
    });
    
    // Écoute de l'événement de fin d'écriture
    uploadStream.on('finish', () => {
      // Résolution de la promesse avec l'identifiant du fichier stocké
      resolve(uploadStream.id);
    });
    
    // Connexion du flux de lecture au flux d'écriture pour transférer les données
    readableStream.pipe(uploadStream);
  });
};

// Déclaration de la fonction pour obtenir un flux de téléchargement depuis GridFS
const getDownloadStream = (fileId) => {
  // Récupération de l'instance du bucket GridFS
  const bucket = getGridFSBucket();
  // Conversion de l'identifiant en ObjectId si c'est une chaîne de caractères
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  // Ouverture et retour du flux de téléchargement
  return bucket.openDownloadStream(objectId);
};

// Déclaration de la fonction pour obtenir un flux de téléchargement partiel (pour les requêtes Range)
const getPartialDownloadStream = (fileId, start, end) => {
  // Récupération de l'instance du bucket GridFS
  const bucket = getGridFSBucket();
  // Conversion de l'identifiant en ObjectId si c'est une chaîne de caractères
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  // Ouverture et retour du flux de téléchargement avec les bornes de début et de fin
  return bucket.openDownloadStream(objectId, { start, end: end + 1 });
};

// Déclaration de la fonction asynchrone pour obtenir les informations d'un fichier dans GridFS
const getFileInfo = async (fileId) => {
  // Récupération de l'instance du bucket GridFS
  const bucket = getGridFSBucket();
  // Conversion de l'identifiant en ObjectId si c'est une chaîne de caractères
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  
  // Recherche du fichier par son identifiant et conversion du résultat en tableau
  const files = await bucket.find({ _id: objectId }).toArray();
  
  // Si aucun fichier n'est trouvé, retour de null
  if (files.length === 0) {
    return null;
  }
  
  // Retour du premier fichier trouvé
  return files[0];
};

// Déclaration de la fonction asynchrone pour supprimer un fichier de GridFS
const deleteFromGridFS = async (fileId) => {
  // Récupération de l'instance du bucket GridFS
  const bucket = getGridFSBucket();
  // Conversion de l'identifiant en ObjectId si c'est une chaîne de caractères
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  
  try {
    // Suppression du fichier de GridFS
    await bucket.delete(objectId);
  } catch (error) {
    // Lancement d'une erreur personnalisée en cas d'échec de suppression
    throw new AppError(`Erreur lors de la suppression du fichier : ${error.message}`, 500);
  }
};

// Déclaration de la fonction pour vérifier si un type de fichier est autorisé
const validateFileType = (mimetype, allowedTypes) => {
  // Retourne vrai si le type MIME est dans la liste des types autorisés
  return allowedTypes.includes(mimetype);
};

// Déclaration de la fonction asynchrone pour obtenir le contenu d'un fichier sous forme de tampon (buffer)
const getFileBuffer = async (fileId) => {
  // Obtention du flux de téléchargement pour le fichier
  const downloadStream = getDownloadStream(fileId);
  // Initialisation d'un tableau pour stocker les morceaux de données
  const chunks = [];
  
  // Création et retour d'une promesse pour gérer la lecture asynchrone
  return new Promise((resolve, reject) => {
    // Écoute de chaque morceau de données reçu et ajout dans le tableau
    downloadStream.on('data', (chunk) => chunks.push(chunk));
    // Rejet de la promesse en cas d'erreur
    downloadStream.on('error', (err) => reject(err));
    // Résolution de la promesse avec la concaténation de tous les morceaux
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

// Exportation de toutes les fonctions du service de stockage
module.exports = {
  uploadToGridFS,
  getDownloadStream,
  getPartialDownloadStream,
  getFileInfo,
  deleteFromGridFS,
  validateFileType,
  getFileBuffer,
};
