// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();
// Importation du module Axios pour effectuer des requêtes HTTP
const axios = require('axios');

// Fonction asynchrone pour lister tous les modèles d'IA disponibles
async function listModels() {
  // Récupération de la clé API Google depuis les variables d'environnement
  const apiKey = process.env.GOOGLE_API_KEY;
  // Construction de l'URL de l'API pour lister les modèles
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    // Envoi d'une requête GET à l'API Google
    const response = await axios.get(url);
    // Affichage du titre de la liste des modèles
    console.log('Available Models:');
    // Parcours et affichage de chaque modèle avec ses méthodes de génération supportées
    response.data.models.forEach(m => {
      console.log(`- ${m.name} (supports: ${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (e) {
    // Affichage de l'erreur en cas d'échec de la requête
    console.log('Error listing models:', e.response ? e.response.data : e.message);
  }
}

// Exécution de la fonction de listage des modèles
listModels();
