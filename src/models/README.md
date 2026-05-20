# Dossier `models/` — Modèles de Données Mongoose

Ce dossier contient les schémas et modèles Mongoose pour la base de données MongoDB. Chaque fichier définit la structure d'une collection.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.js` | Fichier central qui exporte tous les modèles pour une importation simplifiée |
| `AuditLog.js` | Journal d'audit : enregistre les actions importantes des utilisateurs (connexion, modification, etc.) |
| `Cart.js` | Panier d'achat : stocke les articles sélectionnés par l'utilisateur avant le paiement |
| `Content.js` | Contenu multimédia : vidéos, podcasts, documentaires de la section « Contenus à impact » |
| `Favorite.js` | Favoris : liens entre un utilisateur et les contenus/photos qu'il a ajoutés en favoris |
| `Governorate.js` | Gouvernorats : données géographiques de la Tunisie (nom, coordonnées, description) |
| `Inquiry.js` | Demandes de renseignements : messages envoyés par les visiteurs via le formulaire de contact |
| `Notification.js` | Notifications : messages envoyés aux utilisateurs (nouvelles, promotions, alertes) |
| `Order.js` | Commandes : enregistrement des achats, statuts de paiement et livraison |
| `Pack.js` | Packs d'abonnement : définition des offres payantes avec quotas et fonctionnalités |
| `Photo.js` | Photos : images de la section « Tounesna » avec métadonnées EXIF et filigranes |
| `Playlist.js` | Listes de lecture : regroupement de contenus sous un même thème |
| `PushSubscription.js` | Abonnements push : données de notification push des navigateurs |
| `Subscription.js` | Abonnements utilisateurs : suivi des abonnements actifs, périodes et renouvellements |
| `User.js` | Utilisateurs : informations de profil, authentification, tokens JWT et rôles |
| `UserPack.js` | Packs utilisateur : liaison entre un utilisateur et ses packs achetés, avec quotas restants |
