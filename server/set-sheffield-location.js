import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

// Sheffield coordinates: [longitude, latitude]
const SHEFFIELD_COORDINATES = [-1.4701, 53.3811];

async function setSheffieldLocation() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Update all users to have Sheffield location
        const result = await User.updateMany({}, {
            location: {
                type: 'Point',
                coordinates: SHEFFIELD_COORDINATES
            }
        });

        console.log(`Successfully updated ${result.modifiedCount} users to Sheffield location`);
        console.log(`Coordinates: ${SHEFFIELD_COORDINATES} (longitude, latitude)`);

        // Verify the update
        const sampleUser = await User.findOne().select('name location');
        if (sampleUser) {
            console.log(`Sample user ${sampleUser.name} location:`, sampleUser.location);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error setting Sheffield location:', error);
        process.exit(1);
    }
}

setSheffieldLocation();












