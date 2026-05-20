# Dossier `middlewares/` — Middlewares Express

Ce dossier contient les fonctions intermédiaires (middlewares) qui s'exécutent avant les contrôleurs pour filtrer, valider ou transformer les requêtes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `authMiddleware.js` | Vérification de l'authentification (token JWT) et autorisation par rôle (admin, user, uploader) |
| `errorHandler.js` | Gestion centralisée des erreurs : capture et formate les réponses d'erreur pour le client |
| `notFound.js` | Middleware pour les routes inexistantes : renvoie une erreur 404 |
| `uploadMiddleware.js` | Configuration de Multer pour le téléchargement de fichiers (images, vidéos, miniatures) |
| `validateMiddleware.js` | Validation des données de requête avec Joi et validation des identifiants MongoDB |
