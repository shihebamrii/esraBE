# 📚 Documentation Complète des APIs — Backend Médiathèque

> **Projet** : Médiathèque — Plateforme média avec sections *Contenus à Impact* et *Tounesna*
> **Stack technique** : Node.js / Express.js / MongoDB (Mongoose) / GridFS
> **URL de base** : `http://localhost:5000/api`
> **Date de génération** : 13 Avril 2026

---

## Table des matières

1. [Vérification de santé (Health Check)](#1--vérification-de-santé)
2. [Authentification (`/api/auth`)](#2--authentification-apiauth)
3. [Contenus publics (`/api/content`)](#3--contenus-publics-apicontent)
4. [Photos Tounesna (`/api/photos`)](#4--photos-tounesna-apiphotos)
5. [Média / Streaming (`/api/media`)](#5--média--streaming-apimedia)
6. [Panier (`/api/cart`)](#6--panier-apicart)
7. [Commandes / Checkout (`/api/checkout`)](#7--commandes--checkout-apicheckout)
8. [Recherche (`/api/search`)](#8--recherche-apisearch)
9. [Demandes de contact (`/api/inquiries`)](#9--demandes-de-contact-apiinquiries)
10. [Tableau de bord (`/api/dashboard`)](#10--tableau-de-bord-apidashboard)
11. [Notifications (`/api/notifications`)](#11--notifications-apinotifications)
12. [Favoris (`/api/favorites`)](#12--favoris-apifavorites)
13. [Packs publics (`/api/packs`)](#13--packs-publics-apipacks)
14. [Paiement (`/api/payments`)](#14--paiement-apipayments)
15. [Playlists publiques (`/api/playlists`)](#15--playlists-publiques-apiplaylists)
16. [Administration (`/api/admin`)](#16--administration-apiadmin)
17. [Middlewares transversaux](#17--middlewares-transversaux)
18. [Modèles de données](#18--modèles-de-données)

---

## Légende

| Icône | Signification |
|-------|---------------|
| 🔓 | Route publique (aucune authentification requise) |
| 🔐 | Route protégée (JWT obligatoire) |
| 🛡️ | Route admin uniquement (JWT + rôle `admin`) |
| 📤 | Upload de fichier(s) via `multipart/form-data` |

---

## 1 — Vérification de santé

### `GET /api/health` 🔓

**Description** : Vérifie que le serveur est opérationnel.

**Fichier** : `src/app.js` (ligne 80)

**Comment ça marche** :
- Retourne un JSON avec le statut `success`, un timestamp ISO et l'environnement actuel (`development`/`production`).

**Réponse** :
```json
{
  "status": "success",
  "message": "السيرفر خدام مليح! 🚀",
  "timestamp": "2026-04-13T20:00:00.000Z",
  "environment": "development"
}
```

---

## 2 — Authentification (`/api/auth`)

**Fichier route** : `src/routes/authRoutes.js`
**Fichier contrôleur** : `src/controllers/authController.js`

---

### `POST /api/auth/register` 🔓

**Description** : Inscription d'un nouvel utilisateur.

**Body** (JSON) :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `name` | string | ✅ | Nom complet |
| `email` | string | ✅ | Adresse e-mail (unique) |
| `password` | string | ✅ | Mot de passe |
| `phone` | string | ❌ | Numéro de téléphone |
| `locale` | string | ❌ | Langue (`ar`, `fr`, `en`) — défaut : `ar` |
| `role` | string | ❌ | Rôle (seul `user` est accepté) |

**Comment ça marche** :
1. Crée l'utilisateur en base — le mot de passe est haché automatiquement par le modèle `User` (bcrypt).
2. Génère un **access token** JWT et un **refresh token** JWT.
3. Stocke le refresh token haché (SHA-256) dans le document utilisateur.
4. Enregistre l'action dans l'**AuditLog**.
5. Attribue automatiquement un **« Welcome Pack »** gratuit (1 vidéo impact) si ce pack existe en base.
6. Retourne les informations de l'utilisateur + les deux tokens.

**Validation** : Middleware `validate(authValidation.register)` via Joi.

---

### `POST /api/auth/login` 🔓

**Description** : Connexion d'un utilisateur existant.

**Body** (JSON) :
| Champ | Type | Obligatoire |
|-------|------|:-----------:|
| `email` | string | ✅ |
| `password` | string | ✅ |

**Comment ça marche** :
1. Recherche l'utilisateur par e-mail via `User.findByEmail()`.
2. Vérifie que le compte est actif (`isActive`).
3. Compare le mot de passe avec `user.comparePassword()` (bcrypt).
4. Génère un access token + refresh token.
5. Stocke le refresh token haché. Limite à **5 refresh tokens** simultanés (les anciens sont supprimés).
6. Met à jour `lastLogin`.
7. Enregistre l'action (succès ou échec) dans l'AuditLog.

---

### `POST /api/auth/refresh-token` 🔓

**Description** : Renouvellement du token d'accès à l'aide du refresh token.

**Body** (JSON) :
| Champ | Type | Obligatoire |
|-------|------|:-----------:|
| `refreshToken` | string | ✅ |

**Comment ça marche** :
1. Décode le refresh token avec `jwt.verify()` et le secret dédié.
2. Vérifie que le type est `refresh` et que l'utilisateur existe et est actif.
3. Vérifie que le token haché existe parmi les refresh tokens stockés.
4. Si le token n'est pas trouvé → **suspicion de réutilisation** : tous les refresh tokens sont révoqués (protection contre le vol de token).
5. Génère de nouveaux access + refresh tokens et remplace l'ancien dans la liste.

---

### `POST /api/auth/forgot-password` 🔓

**Description** : Demande de réinitialisation du mot de passe.

**Body** (JSON) :
| Champ | Type | Obligatoire |
|-------|------|:-----------:|
| `email` | string | ✅ |

**Comment ça marche** :
1. Recherche l'utilisateur par e-mail.
2. Retourne toujours `success` même si l'e-mail n'existe pas (sécurité anti-énumération).
3. Génère un token de réinitialisation via `user.createPasswordResetToken()`.
4. En mode développement, retourne le token dans la réponse (`devToken`).
5. *TODO : envoi d'e-mail non implémenté.*

---

### `POST /api/auth/reset-password` 🔓

**Description** : Réinitialisation effective du mot de passe.

**Body** (JSON) :
| Champ | Type | Obligatoire |
|-------|------|:-----------:|
| `token` | string | ✅ |
| `newPassword` | string | ✅ |

**Comment ça marche** :
1. Hache le token reçu (SHA-256) et cherche un utilisateur avec ce token non expiré.
2. Met à jour le mot de passe (haché automatiquement par le modèle).
3. Supprime le token de réinitialisation et **révoque tous les refresh tokens** existants.
4. Connecte automatiquement l'utilisateur en générant de nouveaux tokens.

---

### `GET /api/auth/me` 🔐

**Description** : Récupère le profil de l'utilisateur connecté.

**Comment ça marche** :
- Retourne les données de `req.user` (injecté par le middleware `protect`) : `id`, `name`, `email`, `phone`, `role`, `locale`, `createdAt`, `lastLogin`.

---

### `POST /api/auth/logout` 🔐

**Description** : Déconnexion — révocation du refresh token.

**Body** (JSON, optionnel) :
| Champ | Type | Obligatoire |
|-------|------|:-----------:|
| `refreshToken` | string | ❌ |

**Comment ça marche** :
1. Si un refresh token est fourni, le supprime de la liste des tokens stockés.
2. Enregistre l'action dans l'AuditLog.

---

## 3 — Contenus publics (`/api/content`)

**Fichier route** : `src/routes/contentRoutes.js`
**Fichier contrôleur** : `src/controllers/contentController.js`

---

### `GET /api/content` 🔓

**Description** : Liste paginée des contenus publics (vidéos, audio, reels…) avec filtres.

**Paramètres query** :
| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `page` | number | 1 | Numéro de page |
| `limit` | number | 20 | Éléments par page |
| `type` | string | — | Type de contenu (`video`, `audio`, `reel`). Supporte les valeurs séparées par virgule. |
| `region` | string | — | Filtre par région |
| `theme` | string | — | Filtre par thème |
| `language` | string | — | Filtre par langue |
| `rights` | string | — | Filtre par droits (`free`, `paid`) |
| `freeOnly` | `"true"` | — | N'afficher que les contenus gratuits |
| `sort` | string | `-createdAt` | Tri (ex: `title`, `-views`) |

**Comment ça marche** :
1. Construit une requête MongoDB avec `visibility: 'public'` et les filtres fournis.
2. Compte le total et retourne la page demandée.
3. Enrichit chaque contenu avec des URLs absolues pour le thumbnail et le fichier média (via `/api/media/:fileId`).

---

### `GET /api/content/:id` 🔓 *(optionalAuth)*

**Description** : Détails d'un contenu spécifique.

**Comment ça marche** :
1. Recherche le contenu par ID et peuple le champ `createdBy` (nom de l'auteur).
2. Si le contenu est **privé** (`visibility: 'private'`), seul l'admin ou le créateur peut y accéder (nécessite authentification).
3. Enrichit la réponse avec les URLs de thumbnail et de média.

---

### `GET /api/content/:id/related` 🔓

**Description** : Contenus similaires (même type, région ou thèmes).

**Paramètres query** :
| Paramètre | Type | Défaut |
|-----------|------|--------|
| `limit` | number | 6 |

**Comment ça marche** :
- Recherche des contenus publics (différents de l'ID courant) partageant le même `type`, `region` ou au moins un `theme` en commun.

---

## 4 — Photos Tounesna (`/api/photos`)

**Fichier route** : `src/routes/photoRoutes.js`
**Fichier contrôleur** : `src/controllers/photoController.js`

---

### `GET /api/photos` 🔓

**Description** : Liste paginée des photos approuvées de la section Tounesna.

**Paramètres query** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Numéro de page (défaut : 1) |
| `limit` | number | Éléments par page (défaut : 20) |
| `governorate` | string | Filtre par gouvernorat |
| `landscapeType` | string | Filtre par type de paysage |
| `minPrice` / `maxPrice` | number | Fourchette de prix |
| `freeOnly` | `"true"` | Photos gratuites uniquement |
| `sort` | string | Tri (défaut : `-createdAt`) |

**Comment ça marche** :
- Filtre `approvalStatus: 'approved'` et applique les filtres query.
- Enrichit chaque photo avec une `previewUrl` (image externe ou endpoint preview).

---

### `POST /api/photos/upload` 🔐 📤

**Description** : Upload d'une photo par un utilisateur standard (soumise à approbation admin).

**FormData** :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `highRes` | file | ✅ | Image haute résolution ou vidéo |
| `lowRes` | file | ❌ | Thumbnail (obligatoire pour les vidéos) |
| `title` | string | ✅ | Titre |
| `description` | string | ❌ | Description |
| `governorate` | string | ❌ | Gouvernorat |
| `landscapeType` | string | ❌ | Type de paysage |
| `priceTND` | number | ❌ | Prix en TND |
| `tags` | JSON string | ❌ | Tags |

**Comment ça marche** :
1. Upload le fichier HD vers **GridFS**.
2. Crée une version basse résolution (800×600, qualité 70) via **Sharp**.
3. Applique un **watermark en mosaïque** sur la version basse résolution.
4. Upload la version watermarkée vers GridFS.
5. Crée le document `Photo` avec `approvalStatus: 'pending'`.
6. Enregistre dans l'AuditLog.

---

### `GET /api/photos/governorates` 🔓

**Description** : Liste des gouvernorats disponibles avec le nombre de photos.

**Comment ça marche** :
- Agrégation MongoDB `$group` sur le champ `governorate` avec comptage.

---

### `GET /api/photos/landscape-types` 🔓

**Description** : Liste des types de paysage avec le nombre de photos.

**Comment ça marche** :
- Agrégation MongoDB `$group` sur le champ `landscapeType` avec comptage.

---

### `GET /api/photos/packs` 🔓

**Description** : Liste paginée des packs de photos actifs.

**Comment ça marche** :
- Filtre `isActive: true`, peuple `coverPhotoId`, enrichit avec `photoCount`.

---

### `GET /api/photos/packs/:id` 🔓

**Description** : Détails d'un pack avec calcul des économies.

**Comment ça marche** :
- Peuple les photos du pack, calcule le total individuel vs le prix du pack, retourne le montant d'économie (`savings`).

---

### `GET /api/photos/:id` 🔓

**Description** : Détails d'une photo.

**Comment ça marche** :
- Recherche par ID, peuple les packs associés, enrichit avec `previewUrl`.

---

### `GET /api/photos/:id/preview` 🔓 *(optionalAuth)*

**Description** : Téléchargement de la version basse résolution (avec watermark) pour aperçu.

**Comment ça marche** :
1. Récupère la photo et prend le `lowResFileId` (ou `highResFileId` en fallback).
2. Récupère les infos du fichier dans GridFS.
3. Incrémente le compteur `previewDownloads`.
4. Enregistre dans l'AuditLog.
5. Stream le fichier image vers le client avec cache 24h.

---

## 5 — Média / Streaming (`/api/media`)

**Fichier route** : `src/routes/mediaRoutes.js`
**Fichier contrôleur** : `src/controllers/mediaController.js`

---

### `GET /api/media/:fileId` 🔓

**Description** : Streaming d'un fichier média avec support des **Range Requests** (HTTP 206).

**Comment ça marche** :
1. Récupère les métadonnées du fichier dans GridFS.
2. Si le header `Range` est présent :
   - Parse le range demandé (`bytes=start-end`).
   - Retourne un **HTTP 206 Partial Content** avec le chunk demandé.
   - Utilise `getPartialDownloadStream()` pour streamer uniquement la portion demandée.
3. Si pas de Range :
   - Retourne le fichier complet (HTTP 200) avec headers de cache (1 an).
4. Gère les erreurs de stream proprement.

---

### `GET /api/media/:fileId/download` 🔓 *(optionalAuth)*

**Description** : Téléchargement direct d'un fichier (mode attachement).

**Comment ça marche** :
1. Récupère les infos du fichier dans GridFS.
2. Si l'utilisateur est authentifié, enregistre le téléchargement dans l'AuditLog.
3. Envoie le fichier avec le header `Content-Disposition: attachment` pour forcer le téléchargement.

---

### `GET /api/media/:fileId/info` 🔓

**Description** : Métadonnées d'un fichier (nom, type MIME, taille, date d'upload).

---

### `POST /api/media/views/:contentId` 🔓 *(optionalAuth)*

**Description** : Enregistre une vue sur un contenu.

**Comment ça marche** :
1. Incrémente le compteur `views` du contenu.
2. Enregistre dans l'AuditLog.
3. *TODO : debouncing par IP via Redis non implémenté.*

---

## 6 — Panier (`/api/cart`)

**Fichier route** : `src/routes/cartRoutes.js`
**Fichier contrôleur** : `src/controllers/cartController.js`

> ⚠️ **Toutes les routes du panier sont protégées** (JWT obligatoire).

---

### `GET /api/cart` 🔐

**Description** : Récupère le panier de l'utilisateur connecté.

**Comment ça marche** :
- Utilise `Cart.getOrCreate(userId)` pour récupérer ou créer un panier.
- Retourne `items`, `total` et `itemCount`.

---

### `POST /api/cart` 🔐

**Description** : Ajoute un élément au panier.

**Body** (JSON) :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `type` | string | ✅ | `photo`, `pack` ou `content` |
| `itemId` | string | ✅ | ID MongoDB de l'élément |
| `licenseType` | string | ❌ | `personal` (défaut) ou `commercial` |

**Comment ça marche** :
1. Vérifie que l'élément existe dans la collection correspondante (`Photo`, `Pack` ou `Content`).
2. Détermine le prix selon le type de licence (personnel / commercial).
3. Refuse les éléments gratuits (`prix === 0`).
4. Ajoute l'élément au panier via `cart.addItem()`.

---

### `POST /api/cart/refresh` 🔐

**Description** : Rafraîchit les prix des éléments du panier.

**Comment ça marche** :
- Appelle `cart.refreshPrices()` qui recalcule les prix depuis la base de données.

---

### `DELETE /api/cart` 🔐

**Description** : Vide entièrement le panier.

---

### `DELETE /api/cart/:itemId` 🔐

**Description** : Supprime un élément spécifique du panier.

---

## 7 — Commandes / Checkout (`/api/checkout`)

**Fichier route** : `src/routes/checkoutRoutes.js`
**Fichier contrôleur** : `src/controllers/checkoutController.js`

---

### `POST /api/checkout` 🔐

**Description** : Crée une commande à partir du panier et initie le processus de paiement.

**Body** (JSON) :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `billingInfo` | object | ✅ | Informations de facturation (`email`, `name`) |
| `notes` | string | ❌ | Notes de commande |

**Comment ça marche** :
1. Récupère le panier et vérifie qu'il n'est pas vide.
2. Rafraîchit les prix (`cart.refreshPrices()`).
3. Crée un document `Order` avec statut `pending`.
4. Appelle le fournisseur de paiement (`getPaymentProvider()`) pour créer une session de paiement.
5. Sauvegarde l'ID de session dans les métadonnées de la commande.
6. Retourne l'URL de paiement au client.

---

### `GET /api/checkout/orders` 🔐

**Description** : Liste paginée des commandes de l'utilisateur connecté.

**Paramètres query** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Numéro de page |
| `limit` | number | Éléments par page (défaut : 10) |
| `status` | string | Filtre par statut de paiement |

---

### `POST /api/checkout/redeem` 🔐

**Description** : Utiliser un quota d'abonnement (membership pack) pour télécharger un élément gratuitement.

**Body** (JSON) :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `itemId` | string | ✅ | ID de l'élément |
| `itemType` | string | ✅ | `photo` ou `content` |

**Comment ça marche** :
1. Détermine le module (`tounesna` pour photos, `impact` pour contenus vidéo).
2. Cherche un `UserPack` actif pour ce module.
3. Identifie le champ de quota approprié (`photosRemaining`, `videosRemaining`, etc.).
4. Décrémente le quota.
5. Crée une commande gratuite (`total: 0`, `paymentStatus: 'paid'`).
6. Génère un token de téléchargement valide 24h.
7. Retourne l'URL de téléchargement.

---

### `GET /api/checkout/orders/:id` 🔐

**Description** : Détails d'une commande spécifique (propriétaire ou admin uniquement).

**Comment ça marche** :
- Si la commande est payée, génère les liens de téléchargement à partir des `downloadTokens`.

---

### `GET /api/checkout/orders/:orderId/download/:token` 🔓

**Description** : Téléchargement d'un fichier acheté via token sécurisé.

**Comment ça marche** :
1. Vérifie que la commande est payée.
2. Vérifie le token de téléchargement (`order.verifyDownloadToken(token)`).
3. Récupère le fichier correspondant (photo HD, contenu, etc.).
4. Consomme une utilisation du token.
5. Redirige vers `/api/media/:fileId/download` ou vers l'URL externe de l'image.

---

### `GET /api/checkout/admin/orders` 🛡️

**Description** : Liste de toutes les commandes (admin uniquement).

**Paramètres query** : `page`, `limit`, `status`.

---

## 8 — Recherche (`/api/search`)

**Fichier route** : `src/routes/searchRoutes.js`
**Fichier contrôleur** : `src/controllers/searchController.js`

---

### `GET /api/search` 🔓

**Description** : Recherche globale par expression régulière dans les contenus, photos et packs.

**Paramètres query** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | string | Terme de recherche (minimum 2 caractères) |
| `type` | string | Filtre par type (`content`, `photo`, `pack`) |
| `page` | number | Pagination |
| `limit` | number | Éléments par page |

**Comment ça marche** :
1. Crée une `RegExp` case-insensitive à partir du terme `q`.
2. Recherche en parallèle dans les collections `Content`, `Photo` et `Pack` (titre, description, tags).
3. Enrichit les résultats avec des URLs de preview.

---

### `GET /api/search/fulltext` 🔓

**Description** : Recherche plein texte utilisant les **index text MongoDB** avec scoring de pertinence.

**Comment ça marche** :
- Utilise l'opérateur `$text` de MongoDB.
- Trie par `textScore` (pertinence décroissante).

---

### `GET /api/search/suggest` 🔓

**Description** : Auto-complétion (suggestions de recherche).

**Comment ça marche** :
- Recherche les titres commençant par le texte saisi (`^query` en regex).
- Retourne jusqu'à 10 suggestions depuis les 3 collections (Content, Photo, Pack).

---

## 9 — Demandes de contact (`/api/inquiries`)

**Fichier route** : `src/routes/inquiryRoutes.js`
**Fichier contrôleur** : `src/controllers/inquiryController.js`

---

### `POST /api/inquiries` 🔓

**Description** : Soumettre une demande de contact / renseignement.

**Body** (JSON) :
| Champ | Type | Obligatoire |
|-------|------|:-----------:|
| `name` | string | ✅ |
| `email` | string | ✅ |
| `subject` | string | ✅ |
| `message` | string | ✅ |

**Comment ça marche** :
- Crée un document `Inquiry` en base de données.

---

## 10 — Tableau de bord (`/api/dashboard`)

**Fichier route** : `src/routes/dashboardRoutes.js`
**Fichier contrôleur** : `src/controllers/dashboardController.js`

> ⚠️ **Toutes les routes du dashboard sont protégées** (JWT obligatoire).

---

### `GET /api/dashboard/stats` 🔐

**Description** : Statistiques d'upload de l'utilisateur connecté.

**Comment ça marche** :
- Agrégation MongoDB sur les collections `Content` et `Photo` filtrées par `createdBy: userId`.
- Retourne : total uploads, vues, téléchargements, nombre de vidéos/audio, ventes de photos, revenus.

---

### `GET /api/dashboard/recent` 🔐

**Description** : Activité récente de l'utilisateur (5 derniers uploads).

**Comment ça marche** :
- Récupère les 5 derniers contenus et photos créés par l'utilisateur.
- Combine et trie par date décroissante.

---

### `GET /api/dashboard/user-stats` 🔐

**Description** : Statistiques d'achat de l'utilisateur.

**Comment ça marche** :
- Récupère toutes les commandes de l'utilisateur.
- Calcule : total dépensé, nombre de téléchargements, 3 commandes récentes.

---

### `GET /api/dashboard/admin-stats` 🔐

**Description** : Statistiques globales pour l'administrateur.

**Comment ça marche** :
- Calcule le revenu total (somme des commandes payées).
- Compte le nombre total d'utilisateurs, de vidéos et de photos.

---

### `GET /api/dashboard/downloads` 🔐

**Description** : Liste des éléments achetés/téléchargeables par l'utilisateur.

**Comment ça marche** :
1. Récupère toutes les commandes payées de l'utilisateur.
2. Déduplique les éléments achetés (par une Map `type_itemId`).
3. Enrichit chaque élément avec ses détails (titre, format, taille, thumbnail).
4. Génère ou récupère les tokens de téléchargement (avec fallback pour les commandes anciennes).
5. Retourne la liste avec les URLs de téléchargement.

---

### `GET /api/dashboard/my-photos` 🔐

**Description** : Photos uploadées par l'utilisateur connecté (paginées).

---

### `GET /api/dashboard/my-content` 🔐

**Description** : Contenus uploadés par l'utilisateur connecté (paginés, filtrage par `type`).

---

### `GET /api/dashboard/packs` 🔐

**Description** : Packs d'abonnement actifs de l'utilisateur avec quotas restants.

**Comment ça marche** :
- Recherche les `UserPack` actifs (`isActive: true`) pour l'utilisateur.
- Peuple les détails du pack (`title`, `description`, `membershipFeatures`).

---

## 11 — Notifications (`/api/notifications`)

**Fichier route** : `src/routes/notificationRoutes.js`
**Fichier contrôleur** : `src/controllers/notificationController.js`

---

### `GET /api/notifications/vapid-key` 🔓

**Description** : Récupère la clé publique VAPID pour les notifications push Web.

---

### `GET /api/notifications` 🔐

**Description** : Liste paginée des notifications de l'utilisateur connecté.

**Comment ça marche** :
- Retourne les notifications triées par date décroissante.
- Inclut le nombre total et le nombre de notifications non lues (`unreadCount`).

---

### `PUT /api/notifications/:id/read` 🔐

**Description** : Marque une notification comme lue.

**Comment ça marche** :
- Met à jour `isRead: true` pour la notification de l'utilisateur connecté uniquement.

---

### `POST /api/notifications/subscribe` 🔐

**Description** : S'abonner aux notifications push.

**Body** (JSON) :
| Champ | Type | Description |
|-------|------|-------------|
| `endpoint` | string | URL de l'endpoint push |
| `keys.p256dh` | string | Clé de chiffrement |
| `keys.auth` | string | Clé d'authentification |

**Comment ça marche** :
1. Vérifie si un abonnement existe déjà pour cet endpoint.
2. Si non → crée un nouveau `PushSubscription`.
3. Si oui mais pour un autre utilisateur → met à jour l'association.

---

## 12 — Favoris (`/api/favorites`)

**Fichier route** : `src/routes/favoriteRoutes.js`
**Fichier contrôleur** : `src/controllers/favoriteController.js`

> ⚠️ **Toutes les routes des favoris sont protégées**.

---

### `GET /api/favorites` 🔐

**Description** : Liste des favoris de l'utilisateur connecté.

**Comment ça marche** :
- Recherche les documents `Favorite` de l'utilisateur, peuple `itemId`.

---

### `POST /api/favorites/toggle` 🔐

**Description** : Ajoute ou retire un élément des favoris (toggle).

**Body** (JSON) :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `itemType` | string | ✅ | `photo`, `pack`, `content` ou `video` |
| `itemId` | string | ✅ | ID de l'élément |

**Comment ça marche** :
1. Normalise le `itemType` (ex: `video` → `Content`).
2. Vérifie que l'élément existe dans la collection correspondante.
3. Si un favori existe déjà → le supprime (`action: 'removed'`).
4. Sinon → le crée (`action: 'added'`).

---

## 13 — Packs publics (`/api/packs`)

**Fichier route** : `src/routes/packRoutes.js`
**Fichier contrôleur** : `src/controllers/packController.js`

---

### `GET /api/packs` 🔓

**Description** : Liste de tous les packs (publics).

**Comment ça marche** :
- Réutilise `packController.getAllPacks` (partagé avec l'admin).
- Retourne tous les packs avec pagination et informations de créateur.

---

### `GET /api/packs/:id` 🔓

**Description** : Détails d'un pack spécifique.

---

## 14 — Paiement (`/api/payments`)

**Fichier route** : `src/routes/paymentRoutes.js`
**Fichier contrôleur** : `src/controllers/paymentController.js`

---

### `POST /api/payments/webhook` 🔓

**Description** : Webhook pour recevoir les notifications de paiement des fournisseurs (Stripe, PayTech, Mock).

> ⚠️ Le body est reçu en `raw` (`express.raw()`) pour permettre la vérification de signature.

**Comment ça marche** :
1. Vérifie la signature du webhook (sauf en mode mock).
2. Extrait l'`orderId` et le statut de paiement selon le fournisseur.
3. Si `paid` :
   - Met à jour la commande (`paymentStatus: 'paid'`, `paidAt`).
   - Génère des **tokens de téléchargement** pour chaque élément (validité 24h).
   - Vide le panier de l'utilisateur.
   - Met à jour les compteurs de ventes (`purchases`, `downloads`).
   - Si un pack membership est acheté → crée un `UserPack` avec les quotas.
4. Si `failed` → met à jour le statut de la commande.
5. Enregistre dans l'AuditLog.

---

### `GET /api/payments/mock-complete` 🔓

**Description** : Simule la complétion d'un paiement (mode développement uniquement).

**Paramètres query** :
| Paramètre | Type |
|-----------|------|
| `sessionId` | string |
| `orderId` | string |

**Comment ça marche** :
- Bloqué en production (`NODE_ENV === 'production'`).
- Construit un faux payload et appelle `handleWebhook` en interne.

---

### `GET /api/payments/status/:orderId` 🔐

**Description** : Vérifie le statut de paiement d'une commande.

**Comment ça marche** :
1. Vérifie que l'utilisateur est propriétaire de la commande (ou admin).
2. Si le statut est `pending` et qu'une session de paiement existe, interroge le fournisseur pour obtenir le statut actuel.
3. Met à jour la commande si le paiement est confirmé.

---

## 15 — Playlists publiques (`/api/playlists`)

**Fichier route** : `src/routes/playlistRoutes.js`
**Fichier contrôleur** : `src/controllers/playlistController.js`

---

### `GET /api/playlists` 🔓

**Description** : Liste des playlists actives.

**Paramètres query** : `type`, `region`, `theme`.

**Comment ça marche** :
- Filtre `isActive: true` et les critères optionnels.
- Peuple les contenus de chaque playlist (`items.contentId`).

---

### `GET /api/playlists/:id` 🔓

**Description** : Détails d'une playlist avec tous ses contenus.

**Comment ça marche** :
- Recherche par ID avec `isActive: true`.
- Peuple complètement les contenus (titre, type, description, fichiers, durée, prix…).
- Incrémente le compteur de vues de la playlist.

---

## 16 — Administration (`/api/admin`)

**Fichier route** : `src/routes/adminRoutes.js`
**Fichiers contrôleurs** : `adminContentController.js`, `adminPhotoController.js`, `adminUserController.js`, `adminPlaylistController.js`, `inquiryController.js`, `packController.js`

> ⚠️ **Toutes les routes admin requièrent JWT + rôle `admin`** (middlewares `protect` + `authorize('admin')`).

---

### Gestion du contenu

#### `POST /api/admin/content/upload` 🛡️ 📤

**Description** : Upload d'un nouveau contenu (vidéo/audio/reel) par l'administrateur.

**FormData** :
| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `file` | file | ✅ | Fichier principal (vidéo/audio) |
| `thumbnail` | file | ❌ | Image miniature |
| `title` | string | ✅ | Titre |
| `description` | string | ❌ | Description |
| `authors` | JSON string | ❌ | Liste d'auteurs |
| `type` | string | ❌ | Type (`video`, `audio`, `reel`) — auto-détecté depuis le MIME |
| `themes` | JSON string | ❌ | Thèmes |
| `region` | string | ❌ | Région |
| `tags` | JSON string | ❌ | Tags |
| `language` | string | ❌ | Langue (défaut : `ar`) |
| `duration` | number | ❌ | Durée en secondes |
| `rights` | string | ❌ | Droits : `free` ou `paid` (défaut : `free`) |
| `price` | number | ❌ | Prix personnel |
| `priceCommercial` | number | ❌ | Prix commercial |
| `visibility` | string | ❌ | `public` ou `private` (défaut : `public`) |

**Comment ça marche** :
1. Upload le fichier principal vers GridFS.
2. Si un thumbnail est fourni, le redimensionne (640×360) via Sharp et l'uploade vers GridFS.
3. Crée le document `Content` avec `approvalStatus: 'approved'` automatiquement.
4. Envoie une **notification push** à tous les utilisateurs.
5. Enregistre dans l'AuditLog.

---

#### `GET /api/admin/content` 🛡️

**Description** : Liste de tous les contenus (avec filtres par type et visibilité), incluant les contenus privés.

---

#### `PUT /api/admin/content/:id` 🛡️ 📤

**Description** : Mise à jour des métadonnées d'un contenu (et éventuellement du thumbnail).

**Comment ça marche** :
- Vérifie les permissions (admin ou propriétaire).
- Met à jour les champs autorisés.
- Si la visibilité passe à `public`, met à jour `publishedAt`.

---

#### `PUT /api/admin/content/:id/approve` 🛡️

**Description** : Approuver ou rejeter un contenu soumis par un utilisateur.

**Body** : `{ "status": "approved" | "rejected" }`

**Comment ça marche** :
- Met à jour `approvalStatus`.
- Envoie une notification à l'auteur du contenu.

---

#### `DELETE /api/admin/content/:id` 🛡️

**Description** : Suppression d'un contenu et de ses fichiers associés dans GridFS.

---

### Gestion des photos

#### `POST /api/admin/photos/upload` 🛡️ 📤

**Description** : Upload d'une photo Tounesna par l'administrateur (approuvée automatiquement).

**Comment ça marche** :
- Même processus que l'upload utilisateur (HD → GridFS, low-res + watermark → GridFS).
- Différence : `approvalStatus: 'approved'` directement.
- Envoie une notification push à tous les utilisateurs.

---

#### `POST /api/admin/photos/upload-single` 🛡️ 📤

**Description** : Upload simplifié d'une seule photo (raccourci).

---

#### `GET /api/admin/photos` 🛡️

**Description** : Liste de toutes les photos (approuvées et en attente).

---

#### `PUT /api/admin/photos/:id` 🛡️ 📤

**Description** : Mise à jour des métadonnées d'une photo.

---

#### `PUT /api/admin/photos/:id/approve` 🛡️

**Description** : Approuver ou rejeter une photo soumise.

**Body** : `{ "status": "approved" | "rejected" }`

**Comment ça marche** :
- Met à jour `approvalStatus`.
- Envoie une notification à l'auteur.

---

#### `DELETE /api/admin/photos/:id` 🛡️

**Description** : Suppression d'une photo et de ses fichiers GridFS (HD + low-res).

---

### Gestion des packs

#### `POST /api/admin/packs` 🛡️

**Description** : Création d'un nouveau pack (collection de photos ou abonnement).

**Body** (JSON) :
| Champ | Type | Description |
|-------|------|-------------|
| `title` | string | Titre du pack |
| `description` | string | Description |
| `type` | string | `collection` ou `membership` |
| `photoIds` | array | IDs des photos (pour collection) |
| `priceTND` | number | Prix en TND |
| `regionTag` | string | Tag de région |
| `membershipFeatures` | object | Fonctionnalités d'abonnement (quotas, module, qualité) |

**Comment ça marche** :
- Pour les collections : vérifie que toutes les photos existent, lie les photos au pack.
- Pour les memberships : stocke les `membershipFeatures` (limites de téléchargement par type).

---

#### `GET /api/admin/packs` 🛡️

**Description** : Liste de tous les packs.

---

#### `PUT /api/admin/packs/:id` 🛡️

**Description** : Mise à jour d'un pack.

**Comment ça marche** :
- Si les photos changent (collection) : met à jour les associations photo↔pack, invalide le ZIP caché.

---

#### `DELETE /api/admin/packs/:id` 🛡️

**Description** : Suppression d'un pack et dissociation des photos.

---

### Gestion des utilisateurs

#### `GET /api/admin/users` 🛡️

**Description** : Liste de tous les utilisateurs avec leurs packs actifs.

**Paramètres query** : `page`, `limit`, `role`, `search`.

**Comment ça marche** :
- Exclut les champs sensibles (`refreshTokens`, `passwordHash`).
- Pour chaque utilisateur, récupère ses `UserPack` actifs.

---

#### `PUT /api/admin/users/:userId/packs/:userPackId` 🛡️

**Description** : Modifier les quotas d'un pack utilisateur.

**Body** : `{ "quotas": { "photosRemaining": 10, ... } }`

---

#### `PUT /api/admin/users/:id/status` 🛡️

**Description** : Activer ou désactiver un compte utilisateur.

**Body** : `{ "isActive": true | false }`

---

### Gestion des playlists

#### `GET /api/admin/playlists` 🛡️

**Description** : Liste de toutes les playlists (incluant inactives).

---

#### `POST /api/admin/playlists` 🛡️

**Description** : Création d'une nouvelle playlist.

**Body** (JSON) : `title`, `description`, `type`, `items`, `themes`, `region`, `tags`, `thumbnailFileId`.

---

#### `PUT /api/admin/playlists/:id` 🛡️

**Description** : Mise à jour d'une playlist.

---

#### `DELETE /api/admin/playlists/:id` 🛡️

**Description** : Suppression d'une playlist.

---

### Gestion des demandes de contact

#### `GET /api/admin/inquiries` 🛡️

**Description** : Liste de toutes les demandes de contact (filtre optionnel par `status`).

---

#### `PATCH /api/admin/inquiries/:id` 🛡️

**Description** : Mise à jour du statut et des notes d'une demande.

**Body** : `{ "status": "...", "adminNotes": "..." }`

---

#### `DELETE /api/admin/inquiries/:id` 🛡️

**Description** : Suppression d'une demande de contact.

---

## 17 — Middlewares transversaux

| Middleware | Fichier | Description |
|------------|---------|-------------|
| `protect` | `src/middlewares/authMiddleware.js` | Vérifie le JWT dans le header `Authorization: Bearer <token>` et injecte `req.user` |
| `optionalAuth` | `src/middlewares/authMiddleware.js` | Comme `protect` mais ne bloque pas si pas de token |
| `authorize(role)` | `src/middlewares/authMiddleware.js` | Vérifie que l'utilisateur a le rôle requis |
| `validate(schema)` | `src/middlewares/validateMiddleware.js` | Validation des données avec **Joi** |
| `validateObjectId(param)` | `src/middlewares/validateMiddleware.js` | Vérifie que le paramètre est un ObjectId MongoDB valide |
| `contentWithThumbnailUpload` | `src/middlewares/uploadMiddleware.js` | Upload Multer pour contenu + thumbnail |
| `mediaWithPreviewUpload` | `src/middlewares/uploadMiddleware.js` | Upload Multer pour photo HD + low-res |
| `singleMediaUpload` | `src/middlewares/uploadMiddleware.js` | Upload Multer pour un seul fichier |
| `handleMulterError` | `src/middlewares/uploadMiddleware.js` | Gestion des erreurs Multer |
| `errorHandler` | `src/middlewares/errorHandler.js` | Gestionnaire d'erreurs global (formatage, logging) |
| `notFound` | `src/middlewares/notFound.js` | Retourne une 404 pour les routes non trouvées |

### Sécurité (configurée dans `src/app.js`)

| Middleware | Description |
|------------|-------------|
| `compression` | Compression gzip des réponses |
| `helmet` | Protection contre les vulnérabilités web courantes |
| `cors` | Cross-Origin Resource Sharing (origines configurées dans `.env`) |
| `rateLimit` | Limitation du nombre de requêtes par IP |
| `hpp` | Protection contre la pollution des paramètres HTTP |
| `mongoSanitize` | Protection contre les injections NoSQL |

---

## 18 — Modèles de données

| Modèle | Fichier | Description |
|--------|---------|-------------|
| `User` | `src/models/User.js` | Utilisateur (auth, profil, refresh tokens) |
| `Content` | `src/models/Content.js` | Contenu média (vidéo, audio, reel) |
| `Photo` | `src/models/Photo.js` | Photo Tounesna (HD + low-res + watermark) |
| `Pack` | `src/models/Pack.js` | Pack (collection de photos ou abonnement membership) |
| `UserPack` | `src/models/UserPack.js` | Pack acheté par un utilisateur (quotas de téléchargement) |
| `Cart` | `src/models/Cart.js` | Panier d'achat |
| `Order` | `src/models/Order.js` | Commande (avec tokens de téléchargement) |
| `Favorite` | `src/models/Favorite.js` | Favori utilisateur (polymorphe : Photo/Pack/Content) |
| `Inquiry` | `src/models/Inquiry.js` | Demande de contact |
| `Notification` | `src/models/Notification.js` | Notification in-app |
| `PushSubscription` | `src/models/PushSubscription.js` | Abonnement aux notifications push |
| `AuditLog` | `src/models/AuditLog.js` | Journal d'audit (traçabilité) |
| `Playlist` | `src/models/Playlist.js` | Playlist de contenus |
| `Subscription` | `src/models/Subscription.js` | Abonnement |
| `Governorate` | `src/models/Governorate.js` | Gouvernorat tunisien |

---

## Récapitulatif — Nombre total d'endpoints

| Module | Nombre d'endpoints |
|--------|:------------------:|
| Health Check | 1 |
| Authentification | 7 |
| Contenus publics | 3 |
| Photos Tounesna | 8 |
| Média / Streaming | 4 |
| Panier | 5 |
| Commandes / Checkout | 6 |
| Recherche | 3 |
| Demandes de contact | 1 |
| Tableau de bord | 8 |
| Notifications | 4 |
| Favoris | 2 |
| Packs publics | 2 |
| Paiement | 3 |
| Playlists publiques | 2 |
| Admin — Contenus | 5 |
| Admin — Photos | 6 |
| Admin — Packs | 4 |
| Admin — Utilisateurs | 3 |
| Admin — Playlists | 4 |
| Admin — Demandes | 3 |
| **TOTAL** | **78** |

---

> 📝 *Ce document a été généré automatiquement à partir de l'analyse complète du code source du backend.*
