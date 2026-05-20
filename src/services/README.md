# Dossier `services/` — Services Métier

Ce dossier contient les services qui encapsulent la logique d'interaction avec les systèmes externes et les traitements complexes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `aiService.js` | Service d'intelligence artificielle utilisant Google Gemini pour le chat et les recommandations |
| `emailService.js` | Service d'envoi d'emails (réinitialisation de mot de passe, notifications) via Axios |
| `imageProcessor.js` | Traitement d'images avec Sharp (redimensionnement, filigrane, extraction de métadonnées EXIF) |
| `notificationService.js` | Service de notifications push web avec Web Push API |
| `paymentAdapter.js` | Adaptateur de paiement multi-fournisseurs (Stripe, PayTech, Mock) suivant le patron de conception Adaptateur |
| `storageService.js` | Service de stockage de fichiers via MongoDB GridFS (téléchargement, récupération, suppression) |
| `videoProcessor.js` | Traitement vidéo avec FFmpeg (extraction de métadonnées, génération de miniatures) |
