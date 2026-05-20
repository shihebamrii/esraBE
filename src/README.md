# Dossier `src/` — Code Source du Backend

Ce dossier contient tout le code source de l'API backend de la plateforme **Médiathèque**.

## Structure des sous-dossiers

| Dossier | Rôle |
|---|---|
| `config/` | Configuration de la base de données et des variables d'environnement |
| `controllers/` | Logique métier des routes API (traitement des requêtes et envoi des réponses) |
| `middlewares/` | Filtres et fonctions intermédiaires exécutés avant les contrôleurs |
| `models/` | Définition des schémas et modèles de données MongoDB (Mongoose) |
| `routes/` | Définition des chemins URL et association avec les contrôleurs |
| `services/` | Services externes et utilitaires (IA, email, paiement, stockage, traitement d'images/vidéos) |
| `scripts/` | Scripts utilitaires pour le seeding, les tests et la vérification des modèles |
| `utils/` | Fonctions utilitaires partagées (gestion d'erreurs, validation, parsing) |

## Fichier principal

- **`app.js`** : Point d'entrée de l'application Express. Configure les middlewares globaux, les routes et la gestion des erreurs.
