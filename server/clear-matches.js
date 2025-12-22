import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Match from './models/Match.js';

dotenv.config();

async function clearAllMatches() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Match.deleteMany({});
        console.log(`Successfully cleared ${result.deletedCount} match documents`);

        process.exit(0);
    } catch (error) {
        console.error('Error clearing matches:', error);
        process.exit(1);
    }
}

clearAllMatches();











