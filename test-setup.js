import mongoose from 'mongoose';
import User from './server/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupTestUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the test user
        const user = await User.findOne({ email: 'test@example.com' });
        if (!user) {
            console.log('Test user not found');
            return;
        }

        // Update user with test data including photos and videos
        user.photos = [
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80'
        ];
        user.videos = [
            'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
        ];
        user.onboardingCompleted = true;

        await user.save();
        console.log('Test user updated with photos and videos');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

setupTestUser();

