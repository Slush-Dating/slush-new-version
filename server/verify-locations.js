import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const SHEFFIELD_COORDINATES = [-1.4701, 53.3811];
const TOLERANCE = 0.01; // Allow small differences

async function verifyLocations() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');

        const users = await User.find({}).select('name location').lean();
        
        console.log(`Total users: ${users.length}\n`);
        console.log('Location verification:');
        console.log('='.repeat(60));
        
        let correctCount = 0;
        let incorrectCount = 0;
        
        users.forEach((user, index) => {
            const hasLocation = user.location && user.location.coordinates;
            const [lon, lat] = hasLocation ? user.location.coordinates : [null, null];
            
            const isCorrect = hasLocation && 
                Math.abs(lon - SHEFFIELD_COORDINATES[0]) < TOLERANCE &&
                Math.abs(lat - SHEFFIELD_COORDINATES[1]) < TOLERANCE;
            
            if (isCorrect) {
                correctCount++;
                console.log(`✓ ${user.name || 'Unnamed'} - Sheffield, UK`);
            } else {
                incorrectCount++;
                console.log(`✗ ${user.name || 'Unnamed'} - ${hasLocation ? `[${lon}, ${lat}]` : 'No location'}`);
            }
        });
        
        console.log('='.repeat(60));
        console.log(`\nSummary: ${correctCount} correct, ${incorrectCount} incorrect`);
        
        if (incorrectCount > 0) {
            console.log('\nFixing incorrect locations...');
            const result = await User.updateMany({}, {
                location: {
                    type: 'Point',
                    coordinates: SHEFFIELD_COORDINATES
                }
            });
            console.log(`Updated ${result.modifiedCount} users to Sheffield`);
        } else {
            console.log('\nAll users have correct Sheffield location!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error verifying locations:', error);
        process.exit(1);
    }
}

verifyLocations();










