# Dossier `utils/` — Utilitaires

Ce dossier contient des fonctions et classes utilitaires partagées dans toute l'application.

## Fichiers

| Fichier | Rôle |
|---|---|
| `AppError.js` | Classe d'erreur personnalisée qui ajoute un code de statut HTTP et un type (erreur client ou serveur) |
| `asyncHandler.js` | Fonction wrapper qui capture automatiquement les erreurs des fonctions asynchrones Express |
| `safeParser.js` | Fonctions de parsing sécurisé pour convertir des chaînes en nombres, booléens ou tableaux sans erreur |
| `validators.js` | Schémas de validation Joi pour toutes les entrées utilisateur (authentification, contenu, photos, packs, recherche) |
