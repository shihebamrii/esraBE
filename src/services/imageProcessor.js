// Importation de la bibliothèque sharp pour le traitement d'images
const sharp = require('sharp');
// Importation du module exif-reader pour lire les métadonnées EXIF des images
const exifReader = require('exif-reader');

// Déclaration de la fonction asynchrone pour extraire les métadonnées EXIF d'un tampon d'image
const getExifMetadata = async (buffer) => {
  try {
    // Récupération des métadonnées de l'image avec sharp
    const metadata = await sharp(buffer).metadata();
    // Initialisation d'un objet vide pour les données EXIF
    let exif = {};
    
    // Vérification si les données EXIF existent dans les métadonnées
    if (metadata.exif) {
      // Lecture et décodage des données EXIF brutes
      exif = exifReader(metadata.exif);
    }

    // Initialisation de la variable de localisation à null
    let location = null;
    // Vérification si les coordonnées GPS sont présentes dans les données EXIF
    if (exif.gps && exif.gps.GPSLatitude && exif.gps.GPSLongitude) {
      // Calcul de la latitude en degrés décimaux à partir des degrés, minutes et secondes
      const lat = exif.gps.GPSLatitude[0] + exif.gps.GPSLatitude[1]/60 + exif.gps.GPSLatitude[2]/3600;
      // Calcul de la longitude en degrés décimaux à partir des degrés, minutes et secondes
      const lon = exif.gps.GPSLongitude[0] + exif.gps.GPSLongitude[1]/60 + exif.gps.GPSLongitude[2]/3600;
      
      // Récupération de la référence de latitude (Nord ou Sud), par défaut Nord
      const latRef = exif.gps.GPSLatitudeRef || 'N';
      // Récupération de la référence de longitude (Est ou Ouest), par défaut Est
      const lonRef = exif.gps.GPSLongitudeRef || 'E';
      
      // Construction de l'objet localisation avec le signe approprié
      location = {
        // La latitude est négative si la référence est Sud
        lat: latRef === 'S' ? -lat : lat,
        // La longitude est négative si la référence est Ouest
        lon: lonRef === 'W' ? -lon : lon
      };
    }

    // Retour de l'objet contenant les métadonnées structurées
    return {
      // Informations sur l'appareil photo si disponibles
      camera: exif.image ? {
        make: exif.image.Make,
        model: exif.image.Model,
        software: exif.image.Software
      } : null,
      // Paramètres de prise de vue si disponibles
      settings: exif.exif ? {
        fNumber: exif.exif.FNumber,
        exposureTime: exif.exif.ExposureTime,
        iso: exif.exif.ISO,
        focalLength: exif.exif.FocalLength,
        dateTimeOriginal: exif.exif.DateTimeOriginal
      } : null,
      // Données de localisation GPS
      location,
      // Informations sur le fichier image
      file: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha
      }
    };
  } catch (error) {
    // Affichage de l'erreur dans la console
    console.error('Error extracting EXIF:', error);
    // Retour de null en cas d'erreur
    return null;
  }
};

// Déclaration de la fonction asynchrone pour créer une version basse résolution de l'image
const createLowResVersion = async (buffer, options = {}) => {
  // Extraction des options avec des valeurs par défaut
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 70,
    format = 'jpeg',
  } = options;

  // Création d'une instance sharp à partir du tampon d'image
  const image = sharp(buffer);
  // Récupération des métadonnées de l'image originale
  const metadata = await image.metadata();

  // Récupération de la largeur originale
  let width = metadata.width;
  // Récupération de la hauteur originale
  let height = metadata.height;

  // Vérification si l'image dépasse les dimensions maximales autorisées
  if (width > maxWidth || height > maxHeight) {
    // Calcul du ratio de redimensionnement pour respecter les limites
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    // Calcul de la nouvelle largeur
    width = Math.round(width * ratio);
    // Calcul de la nouvelle hauteur
    height = Math.round(height * ratio);
  }

  // Redimensionnement de l'image selon les nouvelles dimensions
  let processedImage = image.resize(width, height, {
    // Mode de redimensionnement qui conserve les proportions
    fit: 'inside',
    // Empêche l'agrandissement si l'image est plus petite que les dimensions cibles
    withoutEnlargement: true,
  });

  // Application du format JPEG si demandé
  if (format === 'jpeg' || format === 'jpg') {
    processedImage = processedImage.jpeg({ quality });
  // Application du format WebP si demandé
  } else if (format === 'webp') {
    processedImage = processedImage.webp({ quality });
  // Application du format PNG si demandé
  } else if (format === 'png') {
    processedImage = processedImage.png({ compressionLevel: 9 });
  }

  // Conversion de l'image traitée en tampon (buffer)
  const outputBuffer = await processedImage.toBuffer();
  // Récupération des métadonnées de l'image de sortie
  const outputInfo = await sharp(outputBuffer).metadata();

  // Retour du tampon et des informations de l'image traitée
  return {
    buffer: outputBuffer,
    info: {
      width: outputInfo.width,
      height: outputInfo.height,
      size: outputBuffer.length,
      format: outputInfo.format,
    },
  };
};

// Déclaration de la fonction asynchrone pour créer une miniature (thumbnail)
const createThumbnail = async (buffer, options = {}) => {
  // Extraction des options avec des valeurs par défaut
  const {
    width = 300,
    height = 200,
    fit = 'cover',
    format = 'jpeg',
    quality = 80,
  } = options;

  // Redimensionnement de l'image aux dimensions de la miniature
  let image = sharp(buffer).resize(width, height, {
    // Mode de remplissage (cover remplit toute la zone)
    fit,
    // Position centrée pour le recadrage
    position: 'center',
  });

  // Application du format JPEG si demandé
  if (format === 'jpeg' || format === 'jpg') {
    image = image.jpeg({ quality });
  // Application du format WebP si demandé
  } else if (format === 'webp') {
    image = image.webp({ quality });
  }

  // Retour du tampon de la miniature
  return image.toBuffer();
};

// Déclaration de la fonction asynchrone pour ajouter un filigrane texte sur l'image
const addWatermark = async (buffer, text, options = {}) => {
  // Extraction des options avec des valeurs par défaut
  const {
    fontSize = 48,
    color = 'rgba(255, 255, 255, 0.5)',
    gravity = 'southeast',
  } = options;

  // Création d'une image SVG contenant le texte du filigrane
  const svgImage = `
    <svg width="500" height="100">
      <style>
        .title { fill: ${color}; font-size: ${fontSize}px; font-weight: bold; font-family: 'Arial'; }
      </style>
      <text x="50%" y="50%" text-anchor="middle" class="title">${text}</text>
    </svg>
  `;

  // Superposition du filigrane SVG sur l'image originale et retour du résultat
  return sharp(buffer)
    .composite([
      {
        // Conversion du SVG en tampon pour l'entrée
        input: Buffer.from(svgImage),
        // Position du filigrane sur l'image
        gravity,
      },
    ])
    .toBuffer();
};

// Déclaration de la fonction asynchrone pour ajouter un filigrane image sur l'image
const addImageWatermark = async (buffer, watermarkBuffer, options = {}) => {
  // Extraction des options avec des valeurs par défaut
  const {
    width = 150,
    opacity = 0.5,
    gravity = 'southeast',
  } = options;

  // Redimensionnement du filigrane et application de l'opacité
  const resizedWatermark = await sharp(watermarkBuffer)
    .resize(width)
    .ensureAlpha(opacity)
    .toBuffer();

  // Superposition du filigrane image sur l'image originale et retour du résultat
  return sharp(buffer)
    .composite([
      {
        input: resizedWatermark,
        gravity,
      },
    ])
    .toBuffer();
};

// Déclaration de la fonction asynchrone pour ajouter un filigrane en mosaïque sur toute l'image
const addTiledWatermark = async (buffer, watermarkBuffer, options = {}) => {
  // Extraction des options avec des valeurs par défaut
  const {
    width = 100,
    opacity = 0.3,
  } = options;

  // Redimensionnement du filigrane et application de l'opacité
  const resizedWatermark = await sharp(watermarkBuffer)
    .resize(width)
    .ensureAlpha(opacity)
    .toBuffer();

  // Superposition du filigrane en mode mosaïque (répété) sur toute l'image
  return sharp(buffer)
    .composite([
      {
        input: resizedWatermark,
        // Activation du mode mosaïque pour répéter le filigrane
        tile: true,
      },
    ])
    .toBuffer();
};

// Déclaration de la fonction asynchrone pour obtenir les informations d'une image
const getImageInfo = async (buffer) => {
  // Récupération des métadonnées de l'image avec sharp
  const metadata = await sharp(buffer).metadata();
  // Retour des informations principales de l'image
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
    hasAlpha: metadata.hasAlpha,
    space: metadata.space,
  };
};

// Déclaration de la fonction asynchrone pour convertir le format d'une image
const convertFormat = async (buffer, format, options = {}) => {
  // Extraction de la qualité avec une valeur par défaut de 80
  const { quality = 80 } = options;
  // Création d'une instance sharp à partir du tampon d'image
  let image = sharp(buffer);

  // Conversion en JPEG si demandé
  if (format === 'jpeg' || format === 'jpg') {
    image = image.jpeg({ quality });
  // Conversion en WebP si demandé
  } else if (format === 'webp') {
    image = image.webp({ quality });
  // Conversion en PNG si demandé
  } else if (format === 'png') {
    image = image.png({ compressionLevel: 9 });
  }

  // Retour du tampon de l'image convertie
  return image.toBuffer();
};

// Déclaration de la fonction asynchrone pour ajuster les propriétés visuelles d'une image
const adjustImage = async (buffer, options = {}) => {
  // Extraction des paramètres d'ajustement avec des valeurs par défaut
  const {
    brightness = 1,
    saturation = 1,
    hue = 0,
    lightness = 0,
  } = options;

  // Application des ajustements de luminosité, saturation, teinte et clarté puis retour du résultat
  return sharp(buffer)
    .modulate({
      brightness,
      saturation,
      hue,
      lightness,
    })
    .toBuffer();
};

// Exportation de toutes les fonctions de traitement d'image
module.exports = {
  getExifMetadata,
  createLowResVersion,
  createThumbnail,
  addWatermark,
  addImageWatermark,
  addTiledWatermark,
  getImageInfo,
  convertFormat,
  adjustImage,
};
