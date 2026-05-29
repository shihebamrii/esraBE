// Importation du module GoogleGenerativeAI depuis la bibliothèque officielle de Google
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Création d'une instance de l'API Google Generative AI avec la clé API depuis les variables d'environnement
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Liste ordonnée des modèles Gemini à essayer en cas d'échec ou de surcharge (503/429)
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

/**
 * Exécute une fonction asynchrone avec un mécanisme de retry et de backoff exponentiel
 * pour les erreurs temporaires/transitoires (surcharge 503, limite de taux 429, etc.)
 */
const callWithRetry = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let attempt = 0;
  let delay = initialDelay;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Détermination si l'erreur est temporaire/transitoire (503, 429 ou erreur réseau temporaire)
      const isTransient = 
        error.status === 503 || 
        error.status === 429 || 
        (error.message && (
          error.message.includes('503') || 
          error.message.includes('429') || 
          error.message.includes('high demand') || 
          error.message.includes('rate limit') || 
          error.message.includes('Service Unavailable') || 
          error.message.includes('Too Many Requests')
        ));

      // Si ce n'est pas une erreur temporaire ou si on a dépassé le nombre max d'essais, on propage l'erreur
      if (!isTransient || attempt >= maxRetries) {
        throw error;
      }

      console.warn(`[AI Service] Erreur temporaire rencontrée (tentative ${attempt}/${maxRetries}): ${error.message}. Nouvelle tentative dans ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Backoff exponentiel
    }
  }
};

/**
 * Exécute une opération d'IA en essayant les modèles disponibles du meilleur au plus ancien/surchargé
 */
const generateContentWithFallback = async (operation) => {
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      // Récupération de l'instance du modèle actuel
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Exécution de l'opération avec gestion automatique des retries
      return await callWithRetry(() => operation(model));
    } catch (error) {
      console.warn(`[AI Service] Le modèle ${modelName} a échoué ou est indisponible: ${error.message}. Tentative avec le modèle suivant...`);
      lastError = error;
    }
  }

  // Si tous les modèles ont échoué, on lance la dernière erreur rencontrée
  throw lastError || new Error('Tous les modèles Gemini candidats ont échoué.');
};

// Déclaration de la fonction asynchrone pour analyser une image avec l'intelligence artificielle
const analyzeImage = async (buffer, mimeType = 'image/jpeg') => {
  try {
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

    // Appel à l'API avec sélection dynamique du modèle et gestion de la résilience
    const text = await generateContentWithFallback(async (model) => {
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
      const response = await result.response;
      return response.text();
    });

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

    // Appel à l'API avec sélection dynamique du modèle et gestion de la résilience
    const aiResponseText = await generateContentWithFallback(async (model) => {
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

      const response = await result.response;
      return response.text();
    });

    // Retour de la réponse générée par le modèle
    return aiResponseText;
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

