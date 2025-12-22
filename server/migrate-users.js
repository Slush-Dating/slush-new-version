import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OLD_DB_URI = process.env.OLD_MONGODB_URI || 'mongodb://localhost:27017/slush'; // Update this with your old DB URI
const NEW_DB_URI = process.env.MONGODB_URI; // Atlas connection

async function exportUsers() {
  console.log('🔄 Connecting to old database...');
  const oldConnection = await mongoose.createConnection(OLD_DB_URI);

  try {
    const OldUser = oldConnection.model('User', User.schema);

    console.log('📤 Exporting users from old database...');
    const users = await OldUser.find({}).lean(); // Include passwords for migration

    console.log(`✅ Found ${users.length} users to export`);

    // Save to JSON file
    const exportPath = path.join(__dirname, 'user-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(users, null, 2));
    console.log(`💾 Users exported to: ${exportPath}`);

    await oldConnection.close();
    return users;
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    await oldConnection.close();
    throw error;
  }
}

async function importUsers(users) {
  console.log('🔄 Connecting to new Atlas database...');
  await mongoose.connect(NEW_DB_URI);

  try {
    let imported = 0;
    let skipped = 0;
    let updated = 0;

    for (const userData of users) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        // Update existing user with password and other data
        existingUser.password = userData.password || existingUser.password;
        existingUser.onboardingCompleted = userData.onboardingCompleted ?? existingUser.onboardingCompleted;
        existingUser.isPremium = userData.isPremium ?? existingUser.isPremium;

        await existingUser.save();
        console.log(`🔄 Updated user: ${userData.email}`);
        updated++;
      } else {
        // Create new user
        const newUser = new User({
          ...userData,
          // Ensure all required fields are present
          onboardingCompleted: userData.onboardingCompleted || false,
          isPremium: userData.isPremium || false,
          createdAt: userData.createdAt || new Date()
        });

        await newUser.save();
        console.log(`✅ Imported user: ${userData.name || userData.email}`);
        imported++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`  ✅ Imported: ${imported} users`);
    console.log(`  ⏭️  Skipped: ${skipped} users`);
    console.log(`  🔄 Updated: ${updated} users`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function migrateUsers() {
  try {
    console.log('🚀 Starting user migration from local DB to MongoDB Atlas...\n');

    // Step 1: Export from old database
    const users = await exportUsers();

    if (users.length === 0) {
      console.log('⚠️  No users found in old database. Nothing to migrate.');
      return;
    }

    // Step 2: Import to new database
    await importUsers(users);

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'export':
    console.log('📤 Exporting users only...');
    exportUsers().then(() => {
      console.log('✅ Export completed');
    }).catch(err => {
      console.error('❌ Export failed:', err.message);
      process.exit(1);
    });
    break;

  case 'import':
    console.log('📥 Importing users only...');
    const exportFile = process.argv[3] || path.join(__dirname, 'user-export.json');
    if (!fs.existsSync(exportFile)) {
      console.error('❌ Export file not found:', exportFile);
      console.log('Usage: node migrate-users.js import <path-to-export-file>');
      process.exit(1);
    }

    const users = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    importUsers(users).then(() => {
      console.log('✅ Import completed');
    }).catch(err => {
      console.error('❌ Import failed:', err.message);
      process.exit(1);
    });
    break;

  case 'migrate':
  default:
    migrateUsers();
    break;

  case 'help':
    console.log('Usage:');
    console.log('  node migrate-users.js migrate  # Full migration (export + import)');
    console.log('  node migrate-users.js export   # Export users from old DB to JSON');
    console.log('  node migrate-users.js import [file]  # Import users from JSON to Atlas');
    console.log('');
    console.log('Environment variables:');
    console.log('  OLD_MONGODB_URI  # Your old database connection (default: mongodb://localhost:27017/slush)');
    console.log('  MONGODB_URI      # Your new Atlas database connection');
    break;
}




