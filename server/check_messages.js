
import mongoose from 'mongoose';
import Message from './models/Message.js';
import Match from './models/Match.js';
import User from './models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/slush-dating-app';

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const matches = await Match.find({ isMatch: true });
        console.log(`Found ${matches.length} matches.`);

        for (const match of matches) {
            console.log(`Match ID: ${match._id}`);
            const user1 = await User.findById(match.user1);
            const user2 = await User.findById(match.user2);
            console.log(`  User 1: ${user1?.email} (${match.user1})`);
            console.log(`  User 2: ${user2?.email} (${match.user2})`);
            const messages = await Message.find({ matchId: match._id });
            console.log(`  Messages count: ${messages.length}`);
            if (messages.length > 0) {
                console.log(`  Last message: ${messages[messages.length - 1].content}`);
                console.log(`  Last message matchId: ${messages[messages.length - 1].matchId}`);
                console.log(`  Last message createdAt: ${messages[messages.length - 1].createdAt}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

check();
