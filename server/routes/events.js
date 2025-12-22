import express from 'express';
import jwt from 'jsonwebtoken';
import Event from '../models/Event.js';
import EventBooking from '../models/EventBooking.js';
import User from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth middleware for routes that need authentication
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// GET all events (only upcoming ones by default, use ?includeAll=true for all)
router.get('/', async (req, res) => {
    try {
        const includeAll = req.query.includeAll === 'true';
        const filter = includeAll ? {} : { date: { $gte: new Date() } };
        const events = await Event.find(filter).sort({ date: 1 });

        console.log(`[Events API] Returning ${events.length} events (includeAll: ${includeAll})`);
        res.json(events);
    } catch (err) {
        console.error('[Events API] Error fetching events:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// GET a single event by ID
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET event participants
router.get('/:id/participants', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('maleParticipants', 'name photos')
            .populate('femaleParticipants', 'name photos')
            .populate('otherParticipants', 'name photos');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json({
            maleParticipants: event.maleParticipants,
            femaleParticipants: event.femaleParticipants,
            otherParticipants: event.otherParticipants,
            maleCount: event.maleCount,
            femaleCount: event.femaleCount,
            otherCount: event.otherCount,
            totalParticipants: event.totalParticipants,
            maxMaleParticipants: event.maxMaleParticipants,
            maxFemaleParticipants: event.maxFemaleParticipants
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST book event ticket
router.post('/:id/book', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Get user to check gender
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userGender = user.gender || 'other';
        const userInterestedIn = user.interestedIn || 'everyone';

        // Calculate user age from date of birth
        let userAge = null;
        if (user.dob) {
            const today = new Date();
            const birthDate = new Date(user.dob);
            userAge = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                userAge--;
            }
        }

        // Validate age range
        if (userAge !== null) {
            const minAge = event.minAge || 18;
            const maxAge = event.maxAge || 99;
            if (userAge < minAge || userAge > maxAge) {
                return res.status(400).json({
                    message: `This event is for ages ${minAge}-${maxAge}. You are ${userAge}.`
                });
            }
        } else {
            return res.status(400).json({ message: 'Date of birth is required to book events' });
        }

        // Validate orientation matches event type
        const eventType = event.eventType || 'straight';

        // Non-binary/other users can only join bisexual events
        if ((userGender === 'non-binary' || userGender === 'other') && eventType !== 'bisexual') {
            return res.status(400).json({
                message: 'Non-binary users can only join bisexual events.'
            });
        }

        if (eventType === 'straight') {
            // Straight events: user must be interested in opposite gender
            const isValidOrientation =
                (userGender === 'man' && userInterestedIn === 'women') ||
                (userGender === 'woman' && userInterestedIn === 'men') ||
                (userInterestedIn === 'everyone');

            if (!isValidOrientation) {
                return res.status(400).json({
                    message: 'This is a straight event. Your orientation does not match.'
                });
            }
        } else if (eventType === 'gay') {
            // Gay events: user must be interested in same gender
            const isValidOrientation =
                (userGender === 'man' && userInterestedIn === 'men') ||
                (userGender === 'woman' && userInterestedIn === 'women') ||
                (userInterestedIn === 'everyone');

            if (!isValidOrientation) {
                return res.status(400).json({
                    message: 'This is a gay event. Your orientation does not match.'
                });
            }
        }
        // Bisexual events: no orientation restriction

        // Check password if event is password protected
        if (event.isPasswordProtected) {
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({
                    message: 'This event requires a password to book',
                    requiresPassword: true
                });
            }

            const isValidPassword = await event.verifyPassword(password);
            if (!isValidPassword) {
                return res.status(401).json({
                    message: 'Incorrect password for this event',
                    requiresPassword: true
                });
            }
        }

        // Check if already booked
        const existingBooking = await EventBooking.findOne({
            eventId: event._id,
            userId: req.userId,
            status: 'booked'
        });

        if (existingBooking) {
            return res.status(400).json({ message: 'Already booked for this event' });
        }

        // Check capacity based on gender
        if (userGender === 'man') {
            if (event.maleParticipants.length >= event.maxMaleParticipants) {
                return res.status(400).json({ message: 'No more male slots available' });
            }
            event.maleParticipants.push(req.userId);
        } else if (userGender === 'woman') {
            if (event.femaleParticipants.length >= event.maxFemaleParticipants) {
                return res.status(400).json({ message: 'No more female slots available' });
            }
            event.femaleParticipants.push(req.userId);
        } else {
            // Non-binary/other - can book in either slot that's available
            // For straight events, try to balance; for others, just add
            event.otherParticipants.push(req.userId);
        }

        await event.save();

        // Create booking record
        const booking = new EventBooking({
            eventId: event._id,
            userId: req.userId,
            userGender: userGender
        });
        await booking.save();

        res.status(201).json({
            message: 'Successfully booked',
            booking: {
                eventId: event._id,
                bookedAt: booking.bookedAt,
                status: booking.status
            },
            event: {
                maleCount: event.maleParticipants.length,
                femaleCount: event.femaleParticipants.length,
                otherCount: event.otherParticipants.length,
                maxMaleParticipants: event.maxMaleParticipants,
                maxFemaleParticipants: event.maxFemaleParticipants
            }
        });
    } catch (err) {
        console.error('Booking error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE cancel booking
router.delete('/:id/book', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Find and update booking
        const booking = await EventBooking.findOneAndUpdate(
            { eventId: event._id, userId: req.userId, status: 'booked' },
            { status: 'cancelled' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Remove from participant arrays
        event.maleParticipants = event.maleParticipants.filter(
            id => id.toString() !== req.userId.toString()
        );
        event.femaleParticipants = event.femaleParticipants.filter(
            id => id.toString() !== req.userId.toString()
        );
        event.otherParticipants = event.otherParticipants.filter(
            id => id.toString() !== req.userId.toString()
        );

        await event.save();

        res.json({ message: 'Booking cancelled', event });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET check if user has booked
router.get('/:id/booking-status', authMiddleware, async (req, res) => {
    try {
        const booking = await EventBooking.findOne({
            eventId: req.params.id,
            userId: req.userId,
            status: 'booked'
        });

        res.json({
            isBooked: !!booking,
            booking: booking ? {
                bookedAt: booking.bookedAt,
                status: booking.status
            } : null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET user's current bookings
router.get('/user/bookings', authMiddleware, async (req, res) => {
    try {
        const bookings = await EventBooking.find({
            userId: req.userId,
            status: 'booked'
        })
        .populate('eventId', 'name date location imageUrl description eventType minAge maxAge maleCount femaleCount otherCount maxMaleParticipants maxFemaleParticipants isPasswordProtected')
        .sort({ bookedAt: -1 });

        // Filter out bookings for events that have already passed
        const now = new Date();
        const activeBookings = bookings.filter(booking => {
            return booking.eventId && booking.eventId.date > now;
        });

        res.json(activeBookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new event
router.post('/', async (req, res) => {
    const event = new Event({
        name: req.body.name,
        date: req.body.date,
        location: req.body.location,
        imageUrl: req.body.imageUrl,
        description: req.body.description,
        eventType: req.body.eventType || 'straight',
        maxMaleParticipants: req.body.maxMaleParticipants || 10,
        maxFemaleParticipants: req.body.maxFemaleParticipants || 10,
        minAge: req.body.minAge || 18,
        maxAge: req.body.maxAge || 99,
        status: req.body.status || 'Scheduled'
    });

    // Set password if provided
    if (req.body.password) {
        await event.setPassword(req.body.password);
    }

    try {
        const newEvent = await event.save();
        console.log(`[Events API] Created event: ${newEvent._id}, name: ${newEvent.name}, date: ${newEvent.date}, imageUrl: ${newEvent.imageUrl}`);
        res.status(201).json(newEvent);
    } catch (err) {
        console.error('[Events API] Error creating event:', err.message);
        res.status(400).json({ message: err.message });
    }
});

// PUT update an event
router.put('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Update allowed fields
        if (req.body.name) event.name = req.body.name;
        if (req.body.date) event.date = req.body.date;
        if (req.body.location) event.location = req.body.location;
        if (req.body.imageUrl) event.imageUrl = req.body.imageUrl;
        if (req.body.description) event.description = req.body.description;
        if (req.body.eventType) event.eventType = req.body.eventType;
        if (req.body.maxMaleParticipants) event.maxMaleParticipants = req.body.maxMaleParticipants;
        if (req.body.maxFemaleParticipants) event.maxFemaleParticipants = req.body.maxFemaleParticipants;
        if (req.body.minAge !== undefined) event.minAge = req.body.minAge;
        if (req.body.maxAge !== undefined) event.maxAge = req.body.maxAge;
        if (req.body.status) event.status = req.body.status;

        // Handle password updates
        if (req.body.password !== undefined) {
            await event.setPassword(req.body.password);
        }

        const updatedEvent = await event.save();
        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE an event
router.delete('/:id', async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Also delete all bookings for this event
        await EventBooking.deleteMany({ eventId: req.params.id });

        res.json({ message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
