import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables');
    process.exit(1);
}

async function createAdmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get admin credentials from command line arguments or use defaults
        const email = process.argv[2] || 'admin@slush.com';
        const password = process.argv[3] || 'admin123';

        console.log(`\nCreating admin user with email: ${email}`);

        // Check if user already exists
        let user = await User.findOne({ email });
        
        if (user) {
            // Update existing user to be admin
            user.isAdmin = true;
            const hashedPassword = await bcrypt.hash(password, 12);
            user.password = hashedPassword;
            await user.save();
            console.log('✅ Updated existing user to admin');
        } else {
            // Create new admin user
            const hashedPassword = await bcrypt.hash(password, 12);
            user = new User({
                email,
                password: hashedPassword,
                isAdmin: true,
                onboardingCompleted: true,
                name: 'Admin User'
            });
            await user.save();
            console.log('✅ Created new admin user');
        }

        console.log(`\n✅ Admin user created/updated successfully!`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`\n⚠️  Please change the password after first login!`);
        console.log(`\nYou can now log in to the admin panel at: /admin`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

createAdmin();


