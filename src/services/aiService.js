// Importation du module GoogleGenerativeAI depuis la bibliothèque officielle de Google
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Création d'une instance de l'API Google Generative AI avec la clé API depuis les variables d'environnement
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Déclaration de la fonction asynchrone pour analyser une image avec l'intelligence artificielle
const analyzeImage = async (buffer, mimeType = 'image/jpeg') => {
  try {
    // Sélection du modèle Gemini Flash pour la génération de contenu
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Définition de la consigne (prompt) demandant une analyse détaillée au format JSON
    const prompt = `
      Analyze this image comprehensively. Provide:
      1. A detailed visual description.
      2. Identify the likely location (city, country, landmarks).
      3. Identify key objects, people, or activities.
      4. Suggest 3 relevant follow-up questions a user might ask.
      
      Format the response as a JSON object:
      {
        "description": "...",
        "location": {
          "likely": "...",
          "confidence": "high|medium|low",
          "landmarks": ["..."]
        },
        "tags": ["..."],
        "suggestedQuestions": ["..."]
      }
    `;

    // Appel à l'API Gemini en envoyant la consigne et l'image encodée en base64
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          // Conversion du tampon (buffer) de l'image en chaîne de caractères Base64
          data: buffer.toString('base64'),
          // Type MIME de l'image (par exemple image/jpeg)
          mimeType,
        },
      },
    ]);

    // Récupération de la réponse du modèle
    const response = await result.response;
    // Extraction du texte brut de la réponse
    const text = response.text();
    
    // Utilisation d'une expression régulière pour extraire le bloc JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    // Vérification si un bloc JSON valide a été trouvé
    if (jsonMatch) {
      // Conversion du texte JSON en objet JavaScript et retour du résultat
      return JSON.parse(jsonMatch[0]);
    }
    
    // Si aucun JSON n'est trouvé, retour du texte brut sous forme de description
    return { description: text };
  } catch (error) {
    // Affichage de l'erreur dans la console pour le débogage
    console.error('AI Analysis error:', error);
    // Lancement d'une erreur explicite indiquant l'échec de l'analyse
    throw new Error('Failed to analyze image with AI');
  }
};

// Déclaration de la fonction asynchrone pour discuter à propos d'une image avec l'IA
const chatAboutImage = async (userMessage, buffer, mimeType = 'image/jpeg', history = []) => {
  try {
    // Sélection du modèle Gemini Flash pour le chat
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Formatage de l'historique de conversation au format attendu par l'API Gemini
    let formattedHistory = history.map(h => ({
      // Traduction du rôle : "user" reste "user", tout autre rôle devient "model"
      role: h.role === 'user' ? 'user' : 'model',
      // Structure du contenu du message sous forme de parties (parts)
      parts: [{ text: h.content }],
    }));

    // Si le premier message provient du modèle, ajout d'un message utilisateur initial
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      // Insertion d'un message utilisateur au début pour respecter les règles de l'API Gemini
      formattedHistory.unshift({
        role: 'user',
        parts: [{ text: 'Please act as an AI Assistant and analyze the image I provide.' }],
      });
    }

    // Démarrage d'une session de chat avec l'historique formaté
    const chat = model.startChat({
      history: formattedHistory,
    });

    // Envoi du nouveau message utilisateur accompagné de l'image
    const result = await chat.sendMessage([
      userMessage,
      {
        inlineData: {
          // Encodage de l'image en Base64
          data: buffer.toString('base64'),
          // Type MIME de l'image
          mimeType,
        },
      },
    ]);

    // Récupération de la réponse générée par le modèle
    const response = await result.response;
    // Retour du texte de la réponse
    return response.text();
  } catch (error) {
    // Affichage de l'erreur dans la console
    console.error('AI Chat error:', error);
    // Lancement d'une erreur descriptive
    throw new Error('Failed to get response from AI');
  }
};

// Exportation des fonctions pour les utiliser dans d'autres fichiers
module.exports = {
  analyzeImage,
  chatAboutImage,
};
