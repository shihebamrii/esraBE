// Déclaration de la fonction pour analyser une valeur JSON de manière sécurisée
const safeParseJSON = (value, defaultValue = []) => {
  // Vérification si la valeur est indéfinie, nulle ou une chaîne vide
  if (value === undefined || value === null || value === '') {
    // Retour de la valeur par défaut
    return defaultValue;
  }

  // Si la valeur est déjà un objet ou un tableau, on la retourne directement
  if (typeof value === 'object') {
    return value;
  }

  try {
    // Tentative d'analyse de la chaîne JSON et retour du résultat
    return JSON.parse(value);
  } catch (error) {
    // Si la valeur par défaut est un tableau et que la valeur est une chaîne de caractères
    if (Array.isArray(defaultValue) && typeof value === 'string') {
      // Suppression des espaces au début et à la fin de la chaîne
      const trimmed = value.trim();
      // Si la chaîne ne commence ni par "[" ni par "{", c'est probablement une valeur simple
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
        // Retour de la valeur encapsulée dans un tableau
        return [value];
      }
    }
    
    // Affichage d'un avertissement dans la console en cas d'échec de l'analyse
    console.error(`⚠️ Failed to parse JSON: ${value}. Returning default.`);
    // Retour de la valeur par défaut
    return defaultValue;
  }
};

// Exportation de la fonction safeParseJSON
module.exports = { safeParseJSON };
