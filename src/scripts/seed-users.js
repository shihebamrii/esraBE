// Importation du module Mongoose pour interagir avec MongoDB
const mongoose = require('mongoose');
// Importation du modèle User
const User = require('../models/User');
// Importation de la configuration de l'application
const config = require('../config');

// Fonction asynchrone pour créer les utilisateurs initiaux dans la base de données
const seed = async () => {
  try {
    // Connexion à la base de données MongoDB
    await mongoose.connect(config.database.uri);
    // Affichage d'un message de connexion réussie
    console.log('Connected to MongoDB');

    // Définition de la liste des utilisateurs à créer
    const users = [
      {
        // Nom de l'administrateur
        name: 'Esra Ones',
        // Adresse email de l'administrateur
        email: 'esra.ones@beestory.tn',
        // Mot de passe qui sera haché par le middleware pre-save du modèle User
        passwordHash: '12345678',
        // Rôle administrateur
        role: 'admin',
      },
      {
        // Nom de l'utilisateur standard
        name: 'Regular User',
        // Adresse email de l'utilisateur standard
        email: 'user@gmail.com',
        // Mot de passe qui sera haché par le middleware pre-save du modèle User
        passwordHash: '12345678',
        // Rôle utilisateur standard
        role: 'user',
      },
    ];

    // Parcours de chaque utilisateur à créer
    for (const userData of users) {
      // Vérification si l'utilisateur existe déjà dans la base de données
      const existing = await User.findOne({ email: userData.email });
      // Si l'utilisateur existe déjà, passer au suivant
      if (existing) {
        console.log(`User ${userData.email} already exists, skipping.`);
        continue;
      }

      // Création d'une nouvelle instance du modèle User
      const user = new User(userData);
      // Sauvegarde de l'utilisateur dans la base de données
      await user.save();
      // Affichage d'un message de succès
      console.log(`Successfully created user: ${userData.email} (Role: ${userData.role})`);
    }

    // Affichage d'un message de fin de la création des utilisateurs
    console.log('Seeding completed successfully!');
    // Arrêt du processus avec un code de succès
    process.exit(0);
  } catch (error) {
    // Affichage de l'erreur en cas d'échec
    console.error('Error seeding users:', error);
    // Arrêt du processus avec un code d'erreur
    process.exit(1);
  }
};

// Exécution de la fonction de création des utilisateurs
seed();
