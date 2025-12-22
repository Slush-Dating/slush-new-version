import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// Seed test users with TikTok videos and profile data
router.post('/users', async (req, res) => {
    try {
        // Clear existing test users (optional - comment out if you want to keep existing users)
        // await User.deleteMany({ email: { $regex: /^test\d+@/ } });

        const testUsers = [
            {
                email: 'test1@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Sophia',
                dob: new Date('2000-05-15'),
                gender: 'woman',
                interestedIn: 'men',
                bio: 'Finding the magic in everyday moments. ✨ Adventurer | Coffee Addict | Always up for a spontaneous adventure!',
                interests: ['travel', 'photography', 'coffee', 'hiking', 'yoga'],
                photos: [
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
                    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80',
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test2@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Alex',
                dob: new Date('1997-08-22'),
                gender: 'man',
                interestedIn: 'women',
                bio: 'Life is better when you are laughing. Let\'s grab a drink! 🥃 Music lover | Weekend explorer',
                interests: ['music', 'bars', 'sports', 'cooking', 'gaming'],
                photos: [
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test3@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Chloe',
                dob: new Date('2002-03-10'),
                gender: 'woman',
                interestedIn: 'men',
                bio: 'Sunsets and good vibes only. 🌅 Hiking enthusiast | Nature lover | Always chasing the next adventure',
                interests: ['hiking', 'nature', 'photography', 'travel', 'fitness'],
                photos: [
                    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
                    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test4@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Jordan',
                dob: new Date('1999-11-28'),
                gender: 'non-binary',
                interestedIn: 'everyone',
                bio: 'Music lover and weekend explorer. Always up for an adventure! 🎵 Let\'s create memories together',
                interests: ['music', 'concerts', 'art', 'dancing', 'travel'],
                photos: [
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test5@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Taylor',
                dob: new Date('2001-07-04'),
                gender: 'woman',
                interestedIn: 'men',
                bio: 'Foodie at heart. Let\'s discover the best spots in town together! 🍕 Always hungry for new experiences',
                interests: ['food', 'restaurants', 'cooking', 'travel', 'photography'],
                photos: [
                    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
                    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test6@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Morgan',
                dob: new Date('1998-12-19'),
                gender: 'woman',
                interestedIn: 'everyone',
                bio: 'Yoga instructor and mindfulness advocate. Finding balance in everything. 🧘 Let\'s grow together',
                interests: ['yoga', 'meditation', 'wellness', 'reading', 'nature'],
                photos: [
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
                    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
                    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test7@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Riley',
                dob: new Date('1996-04-30'),
                gender: 'man',
                interestedIn: 'women',
                bio: 'Tech enthusiast by day, adventure seeker by weekend. Let\'s build something amazing together! 💻',
                interests: ['technology', 'coding', 'gaming', 'travel', 'photography'],
                photos: [
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            },
            {
                email: 'test8@slush.com',
                password: await bcrypt.hash('password123', 12),
                name: 'Emma',
                dob: new Date('2000-09-12'),
                gender: 'woman',
                interestedIn: 'men',
                bio: 'Bookworm and coffee shop explorer. Let\'s discuss our favourite reads over a latte! 📚☕',
                interests: ['reading', 'coffee', 'writing', 'art', 'museums'],
                photos: [
                    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80',
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
                    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80'
                ],
                videos: [
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4'
                ],
                location: {
                    type: 'Point',
                    coordinates: [-0.1276, 51.5074] // London
                },
                onboardingCompleted: true
            }
        ];

        const createdUsers = [];
        for (const userData of testUsers) {
            // Check if user already exists
            let user = await User.findOne({ email: userData.email });
            if (user) {
                // Update existing user
                await User.findByIdAndUpdate(user._id, userData);
                createdUsers.push(user);
            } else {
                // Create new user
                user = new User(userData);
                await user.save();
                createdUsers.push(user);
            }
        }

        res.json({
            message: `Successfully created/updated ${createdUsers.length} test users`,
            users: createdUsers.map(u => ({
                id: u._id,
                email: u.email,
                name: u.name
            }))
        });
    } catch (err) {
        console.error('Seed error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

export default router;













