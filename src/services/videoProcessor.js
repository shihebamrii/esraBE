// Importation de la bibliothèque fluent-ffmpeg pour le traitement vidéo
const ffmpeg = require('fluent-ffmpeg');
// Importation du programme FFmpeg installé via npm
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
// Importation du programme FFprobe installé via npm
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

// Configuration du chemin vers l'exécutable FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// Configuration du chemin vers l'exécutable FFprobe
ffmpeg.setFfprobePath(ffprobeInstaller.path);


// Importation du module path pour la gestion des chemins de fichiers
const path = require('path');
// Importation du module os pour accéder au répertoire temporaire du système
const os = require('os');
// Importation du module fs pour les opérations sur le système de fichiers
const fs = require('fs');
// Importation du module crypto pour générer des identifiants uniques
const crypto = require('crypto');
// Importation de la classe d'erreur personnalisée AppError
const AppError = require('../utils/AppError');

// Déclaration de la fonction pour obtenir les métadonnées d'une vidéo
const getVideoMetadata = (buffer) => {
  // Création et retour d'une promesse pour gérer l'opération asynchrone
  return new Promise((resolve, reject) => {
    // Création d'un chemin de fichier temporaire unique pour stocker la vidéo
    const tempInput = path.join(os.tmpdir(), `meta_${crypto.randomBytes(8).toString('hex')}.mp4`);
    // Écriture du tampon vidéo dans le fichier temporaire
    fs.writeFileSync(tempInput, buffer);

    // Analyse des métadonnées de la vidéo avec FFprobe
    ffmpeg(tempInput)
      .ffprobe((err, metadata) => {
        // Suppression du fichier temporaire s'il existe
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        // En cas d'erreur, affichage dans la console et rejet de la promesse
        if (err) {
          console.error('ffprobe error:', err);
          return reject(new AppError("Échec de l'analyse des données vidéo", 500));
        }
        
        // Recherche du flux vidéo parmi les flux disponibles
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        // Résolution de la promesse avec les métadonnées extraites
        resolve({
          codec: videoStream?.codec_name,
          width: videoStream?.width,
          height: videoStream?.height,
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name
        });
      });
  });
};

// Déclaration de la fonction asynchrone pour convertir une vidéo en codec compatible (H.264)
const ensureCompatibleCodec = async (buffer, originalName) => {
  try {
    // Récupération des métadonnées de la vidéo
    const metadata = await getVideoMetadata(buffer);
    
    // Vérification si le codec et le conteneur sont compatibles avec le navigateur
    const ext = path.extname(originalName || '').toLowerCase();
    const codec = (metadata.codec || '').toLowerCase();
    
    const isUnsupportedCodec = codec === 'hevc' || codec === 'h265' || codec === 'h.265';
    const isUnsupportedContainer = ['.mov', '.avi', '.mkv', '.wmv', '.flv'].includes(ext);

    if (!isUnsupportedCodec && !isUnsupportedContainer) {
       // Affichage dans la console que la conversion n'est pas nécessaire
       console.log(`Video ${originalName} uses compatible codec (${codec}) and container (${ext}), no transcoding needed.`);
       // Retour du tampon original sans modification
       return { buffer, info: metadata, transcoded: false };
    }

    // Affichage dans la console que la conversion est en cours
    console.log(`Transcoding ${originalName} from ${codec.toUpperCase()} (${ext}) to H.264 for compatibility...`);

    // Création et retour d'une promesse pour gérer le transcodage
    return new Promise((resolve, reject) => {
      // Génération d'un identifiant unique pour les fichiers temporaires
      const uniqueId = crypto.randomBytes(8).toString('hex');
      // Chemin du fichier temporaire d'entrée
      const tempInput = path.join(os.tmpdir(), `input_${uniqueId}.mp4`);
      // Chemin du fichier temporaire de sortie
      const tempOutput = path.join(os.tmpdir(), `output_${uniqueId}.mp4`);

      // Écriture du tampon vidéo dans le fichier temporaire d'entrée
      fs.writeFileSync(tempInput, buffer);

      // Démarrage du transcodage avec FFmpeg
      ffmpeg(tempInput)
        // Définition du format de sortie en MP4
        .format('mp4')
        // Utilisation du codec vidéo H.264
        .videoCodec('libx264')
        // Utilisation du codec audio AAC
        .audioCodec('aac')
        // Options de sortie pour optimiser la qualité et la compatibilité
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        // Événement déclenché à la fin du transcodage
        .on('end', () => {
          try {
            // Lecture du fichier vidéo transcodé
            const transcodeBuffer = fs.readFileSync(tempOutput);
            // Suppression du fichier temporaire d'entrée
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            // Suppression du fichier temporaire de sortie
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            // Résolution de la promesse avec le tampon transcodé et les métadonnées mises à jour
            resolve({ 
              buffer: transcodeBuffer, 
              info: { ...metadata, codec: 'h264' }, 
              transcoded: true 
            });
          } catch (err) {
            // Affichage de l'erreur de lecture du fichier dans la console
            console.error('File read error:', err);
            // Rejet de la promesse avec une erreur personnalisée
            reject(new AppError('Échec de la lecture du fichier converti', 500));
          }
        })
        // Événement déclenché en cas d'erreur pendant le transcodage
        .on('error', (err) => {
          // Affichage de l'erreur FFmpeg dans la console
          console.error('FFmpeg error:', err);
          // Suppression du fichier temporaire d'entrée
          if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          // Suppression du fichier temporaire de sortie
          if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
          // Rejet de la promesse avec une erreur personnalisée
          reject(new AppError('Erreur lors de la conversion de la vidéo', 500));
        })
        // Sauvegarde de la vidéo transcodée dans le fichier de sortie
        .save(tempOutput);
    });
  } catch (error) {
    // Affichage de l'erreur de traitement vidéo dans la console
    console.error('Video processing error:', error);
    // Relancement de l'erreur pour la propager
    throw error;
  }
};

// Déclaration de la fonction pour créer une miniature à partir d'un tampon vidéo
const createThumbnailFromVideo = (buffer, timestamp = 1) => {
  return new Promise((resolve, reject) => {
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const tempInput = path.join(os.tmpdir(), `input_${uniqueId}.mp4`);
    const tempOutputName = `thumb_${uniqueId}.jpg`;
    const tempOutputDir = os.tmpdir();
    const tempOutputPath = path.join(tempOutputDir, tempOutputName);

    // Écrire le buffer vidéo d'entrée dans un fichier temporaire
    fs.writeFileSync(tempInput, buffer);

    ffmpeg(tempInput)
      .screenshots({
        timestamps: [timestamp],
        folder: tempOutputDir,
        filename: tempOutputName,
        size: '640x360'
      })
      .on('end', () => {
        try {
          if (fs.existsSync(tempOutputPath)) {
            const thumbnailBuffer = fs.readFileSync(tempOutputPath);
            // Suppression des fichiers temporaires
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            resolve(thumbnailBuffer);
          } else {
            reject(new AppError('Fichier de miniature non généré', 500));
          }
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        reject(err);
      });
  });
};

// Exportation des fonctions de traitement vidéo
module.exports = {
  getVideoMetadata,
  ensureCompatibleCodec,
  createThumbnailFromVideo
};
