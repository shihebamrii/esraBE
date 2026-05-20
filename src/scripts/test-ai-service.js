// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();
// Importation de la fonction d'analyse d'image depuis le service d'IA
const { analyzeImage } = require('../services/aiService');
// Importation du module de système de fichiers pour lire les fichiers
const fs = require('fs');
// Importation du module path pour manipuler les chemins de fichiers
const path = require('path');

// Fonction asynchrone pour tester le service d'analyse d'image par IA
async function testAnalysis() {
  // Affichage du titre du test
  console.log('--- Testing AI Image Analysis ---');
  // Affichage de la présence ou non de la clé API
  console.log('Using API Key:', process.env.GOOGLE_API_KEY ? 'Present (Hidden)' : 'MISSING');

  // Vérification que la clé API est définie
  if (!process.env.GOOGLE_API_KEY) {
    // Affichage d'un message d'erreur si la clé est manquante
    console.error('Error: GOOGLE_API_KEY is not set in .env file');
    // Arrêt du processus avec un code d'erreur
    process.exit(1);
  }

  // Construction du chemin vers l'image de test
  const imagePath = path.join(__dirname, '../../../frontend/public/images/placeholders/tunis-thumb.png');

  try {
    // Vérification que le fichier image existe
    if (!fs.existsSync(imagePath)) {
      // Message si l'image locale n'est pas trouvée
      console.log('Local test image not found, trying a public URL...');
      // Suggestion d'utiliser l'interface utilisateur pour un test complet
      console.log('Please ensure the server is running and test via the UI for full integration.');
      // Arrêt de la fonction
      return;
    }

    // Lecture du fichier image en tant que buffer
    const buffer = fs.readFileSync(imagePath);
    // Affichage du chemin de l'image en cours d'analyse
    console.log('Analyzing local image:', imagePath);

    // Appel de la fonction d'analyse d'image avec le buffer et le type MIME
    const result = await analyzeImage(buffer, 'image/png');

    // Affichage du résultat de l'analyse
    console.log('\n--- Analysis Result ---');
    // Affichage du résultat au format JSON indenté
    console.log(JSON.stringify(result, null, 2));
    // Message de succès
    console.log('\n✅ AI Service is working correctly!');
  } catch (error) {
    // Affichage du message d'erreur en cas d'échec de l'analyse
    console.error('\n❌ Analysis failed:');
    console.error(error.message);
    // Vérification si l'erreur est liée à une clé API invalide
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('The provided API Key is invalid.');
    }
  }
}

// Exécution de la fonction de test
testAnalysis();
