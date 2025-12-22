import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function testFeeds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all users with onboarding completed
        const allUsers = await User.find({})
            .sort({ createdAt: 1 })
            .select('name _id')
            .lean();

        console.log(`\nTotal users in database: ${allUsers.length}`);
        console.log('Users (sorted by creation date):');
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user._id})`);
        });

        console.log('\nEach user should see the same feed:');
        console.log('Total profiles in feed (excluding themselves):', allUsers.length - 1);

        process.exit(0);
    } catch (error) {
        console.error('Error testing feeds:', error);
        process.exit(1);
    }
}

testFeeds();











