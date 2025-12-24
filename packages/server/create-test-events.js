import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Event from './models/Event.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables');
    process.exit(1);
}

async function createTestEvents() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\nCreating test events...');

        const testEvents = [
            {
                name: 'Friday Night Speed Dating',
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                location: 'Sheffield, UK',
                imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
                description: 'Join us for an exciting night of speed dating! Meet new people in a fun, relaxed environment.',
                eventType: 'straight',
                maxMaleParticipants: 20,
                maxFemaleParticipants: 20,
                status: 'Scheduled'
            },
            {
                name: 'Weekend Adventure Meetup',
                date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
                location: 'Sheffield, UK',
                imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400',
                description: 'For adventure seekers! Meet like-minded people who love outdoor activities and exploring.',
                eventType: 'bisexual',
                maxMaleParticipants: 15,
                maxFemaleParticipants: 15,
                status: 'Scheduled'
            },
            {
                name: 'Coffee & Conversation',
                date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                location: 'Sheffield, UK',
                imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
                description: 'Casual coffee meetup for meaningful conversations. Perfect for busy professionals!',
                eventType: 'straight',
                maxMaleParticipants: 12,
                maxFemaleParticipants: 12,
                status: 'Scheduled'
            }
        ];

        const createdEvents = [];
        for (const eventData of testEvents) {
            // Check if event already exists
            let event = await Event.findOne({ name: eventData.name });
            if (event) {
                // Update existing event
                await Event.findByIdAndUpdate(event._id, eventData);
                console.log(`✅ Updated existing event: ${eventData.name}`);
                createdEvents.push(event);
            } else {
                // Create new event
                event = new Event(eventData);
                await event.save();
                console.log(`✅ Created new event: ${eventData.name}`);
                createdEvents.push(event);
            }
        }

        console.log(`\n✅ Successfully created/updated ${createdEvents.length} test events!`);
        console.log('\n📅 Test Events:');
        testEvents.forEach(event => {
            console.log(`   - ${event.name} (${new Date(event.date).toLocaleDateString()})`);
        });

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating test events:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

createTestEvents();
