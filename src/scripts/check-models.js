// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();
// Importation du module Google Generative AI
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Fonction asynchrone pour tester les modèles d'IA disponibles
async function listModels() {
  // Création d'une instance du client Google Generative AI avec la clé API
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  try {
    // Récupération du modèle gemini-1.5-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    // Affichage d'un message indiquant le test en cours
    console.log('Testing gemini-1.5-flash...');
    // Envoi d'une requête de test au modèle
    const result = await model.generateContent('Hello');
    // Affichage d'un message de succès
    console.log('Success with gemini-1.5-flash');
  } catch (e) {
    // Affichage de l'erreur si le premier modèle échoue
    console.log('Failed with gemini-1.5-flash:', e.message);

    try {
      // Affichage d'un message indiquant le test du deuxième modèle
      console.log('Testing gemini-1.5-flash-latest...');
      // Récupération du modèle gemini-1.5-flash-latest
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      // Envoi d'une requête de test au modèle
      const result = await model.generateContent('Hello');
      // Affichage d'un message de succès
      console.log('Success with gemini-1.5-flash-latest');
    } catch (e2) {
      // Affichage de l'erreur si le deuxième modèle échoue
      console.log('Failed with gemini-1.5-flash-latest:', e2.message);

      try {
        // Affichage d'un message indiquant le test du troisième modèle
        console.log('Testing gemini-pro-vision...');
        // Récupération du modèle gemini-pro-vision
        const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
        // Envoi d'une requête de test au modèle
        const result = await model.generateContent('Hello');
        // Affichage d'un message de succès
        console.log('Success with gemini-pro-vision');
      } catch (e3) {
        // Affichage d'un message si tous les modèles ont échoué
        console.log('All standard models failed.');
      }
    }
  }
}

// Exécution de la fonction de test des modèles
listModels();
