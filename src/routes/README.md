# Dossier `routes/` — Routes de l'API

Ce dossier contient la définition de tous les chemins (endpoints) de l'API REST. Chaque fichier associe des URLs à leurs contrôleurs respectifs.

## Fichiers

| Fichier | Rôle |
|---|---|
| `adminRoutes.js` | Routes d'administration (gestion des contenus, photos, utilisateurs, packs, listes de lecture, demandes) |
| `aiRoutes.js` | Routes pour le service d'intelligence artificielle (chat) |
| `authRoutes.js` | Routes d'authentification (inscription, connexion, déconnexion, mot de passe, profil) |
| `cartRoutes.js` | Routes du panier d'achat (consultation, ajout, suppression d'articles) |
| `checkoutRoutes.js` | Routes de validation de commande et de paiement |
| `contentRoutes.js` | Routes publiques de consultation des contenus |
| `dashboardRoutes.js` | Routes du tableau de bord administratif (statistiques) |
| `favoriteRoutes.js` | Routes des favoris (ajout, suppression, consultation) |
| `inquiryRoutes.js` | Routes des demandes de renseignements (envoi par les visiteurs) |
| `mediaRoutes.js` | Routes de diffusion des fichiers média (streaming, téléchargement, images) |
| `notificationRoutes.js` | Routes de gestion des notifications et abonnements push |
| `packRoutes.js` | Routes publiques de consultation des packs d'abonnement |
| `paymentRoutes.js` | Routes de paiement (webhooks, vérification, simulation) |
| `photoRoutes.js` | Routes publiques de consultation et téléchargement des photos |
| `playlistRoutes.js` | Routes publiques de consultation des listes de lecture |
| `searchRoutes.js` | Routes de recherche globale (contenus et photos) |
