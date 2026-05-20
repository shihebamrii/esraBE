// Importation des fonctions d'analyse et de discussion d'image depuis le service IA
const { analyzeImage, chatAboutImage } = require('../services/aiService');

// Importation de la fonction pour extraire les métadonnées EXIF d'une image
const { getExifMetadata } = require('../services/imageProcessor');

// Importation des fonctions pour lire un fichier depuis le stockage GridFS
const { getFileBuffer, getFileInfo } = require('../services/storageService');

// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Importation du wrapper asyncHandler pour gérer les erreurs dans les fonctions asynchrones
const asyncHandler = require('../utils/asyncHandler');

// Importation de la bibliothèque axios pour effectuer des requêtes HTTP
const axios = require('axios');

// Déclaration de la fonction pour analyser une photo avec l'IA et les métadonnées EXIF
const analyzePhoto = asyncHandler(async (req, res, next) => {
  // Extraction de l'URL de l'image ou de l'identifiant du fichier depuis le corps de la requête
  const { imageUrl, fileId } = req.body;
  // Initialisation du buffer de l'image
  let buffer;
  // Initialisation du type MIME par défaut
  let mimeType = 'image/jpeg';

  // Si un identifiant de fichier est fourni, on récupère le fichier depuis GridFS
  if (fileId) {
    // Récupération des informations du fichier
    const fileInfo = await getFileInfo(fileId);
    // Si le fichier n'existe pas, on renvoie une erreur 404
    if (!fileInfo) return next(new AppError('File not found', 404));
    // Récupération du contenu binaire du fichier
    buffer = await getFileBuffer(fileId);
    // Mise à jour du type MIME avec celui du fichier
    mimeType = fileInfo.contentType;
  } else if (imageUrl) {
    // Si une URL est fournie, on télécharge l'image depuis cette URL
    try {
      // Envoi d'une requête GET pour récupérer l'image en tant que tableau d'octets
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      // Conversion des données reçues en buffer
      buffer = Buffer.from(response.data, 'binary');
      // Récupération du type MIME depuis les en-têtes de la réponse
      mimeType = response.headers['content-type'] || 'image/jpeg';
    } catch (error) {
      // En cas d'erreur de téléchargement, on renvoie une erreur 400
      return next(new AppError('Failed to fetch image from URL', 400));
    }
  } else {
    // Si ni fileId ni imageUrl ne sont fournis, on renvoie une erreur 400
    return next(new AppError('Please provide fileId or imageUrl', 400));
  }

  // Extraction des métadonnées EXIF de l'image
  const metadata = await getExifMetadata(buffer);

  // Analyse de l'image par l'intelligence artificielle
  const aiAnalysis = await analyzeImage(buffer, mimeType);

  // Envoi de la réponse avec les métadonnées et l'analyse IA
  res.status(200).json({
    status: 'success',
    data: {
      metadata,
      aiAnalysis,
    },
  });
});

// Déclaration de la fonction pour discuter à propos d'une image avec l'IA
const chatPhoto = asyncHandler(async (req, res, next) => {
  // Extraction du message, de l'historique, de l'URL et de l'identifiant du fichier
  const { message, history, imageUrl, fileId } = req.body;
  // Initialisation du buffer de l'image
  let buffer;
  // Initialisation du type MIME par défaut
  let mimeType = 'image/jpeg';

  // Si un identifiant de fichier est fourni, on récupère le fichier depuis GridFS
  if (fileId) {
    // Récupération du contenu binaire du fichier
    buffer = await getFileBuffer(fileId);
    // Récupération des informations du fichier pour obtenir le type MIME
    const fileInfo = await getFileInfo(fileId);
    // Mise à jour du type MIME
    mimeType = fileInfo.contentType;
  } else if (imageUrl) {
    // Téléchargement de l'image depuis l'URL fournie
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    // Conversion des données en buffer
    buffer = Buffer.from(response.data, 'binary');
    // Récupération du type MIME depuis les en-têtes
    mimeType = response.headers['content-type'] || 'image/jpeg';
  }

  // Envoi du message et de l'image à l'IA pour obtenir une réponse contextuelle
  const aiResponse = await chatAboutImage(message, buffer, mimeType, history || []);

  // Envoi de la réponse contenant le message de l'IA
  res.status(200).json({
    status: 'success',
    data: {
      message: aiResponse,
    },
  });
});

// Exportation des fonctions d'analyse et de discussion pour utilisation dans les routes
module.exports = {
  analyzePhoto,
  chatPhoto,
};
