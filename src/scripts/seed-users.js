/**
 * Seed users script
 * Adds a new admin and a new regular user
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config');

const seed = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri);
    console.log('Connected to MongoDB');

    const users = [
      {
        name: 'Esra Ones',
        email: 'esra.ones@beestory.tn',
        passwordHash: '12345678', // This will be hashed by the User model's pre-save middleware
        role: 'admin',
      },
      {
        name: 'Regular User',
        email: 'user@gmail.com',
        passwordHash: '12345678', // This will be hashed by the User model's pre-save middleware
        role: 'user',
      },
    ];

    for (const userData of users) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`User ${userData.email} already exists, skipping.`);
        continue;
      }
      
      const user = new User(userData);
      await user.save();
      console.log(`Successfully created user: ${userData.email} (Role: ${userData.role})`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seed();
