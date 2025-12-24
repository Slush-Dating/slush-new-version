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

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
 *     description: Retrieve all events. By default returns only upcoming events. Use ?includeAll=true to get all events including past ones.
 *     parameters:
 *       - in: query
 *         name: includeAll
 *         schema:
 *           type: boolean
 *         description: Set to true to include past events
 *     responses:
 *       200:
 *         description: List of events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Event'
 */
router.get('/', async (req, res) => {
    try {
        const includeAll = req.query.includeAll === 'true';
        const filter = includeAll ? {} : { date: { $gte: new Date() } };
        const events = await Event.find(filter).sort({ date: 1 });

        // Convert to JSON to include virtual fields (maleCount, femaleCount, etc.)
        // The Event model has toJSON configured to include virtuals
        const eventsData = events.map(event => event.toJSON());

        console.log(`[Events API] Returning ${eventsData.length} events (includeAll: ${includeAll})`);
        if (eventsData.length > 0) {
            console.log(`[Events API] Sample event:`, {
                id: eventsData[0]._id,
                name: eventsData[0].name,
                date: eventsData[0].date,
                maleCount: eventsData[0].maleCount,
                femaleCount: eventsData[0].femaleCount
            });
        }
        res.json(eventsData);
    } catch (err) {
        console.error('[Events API] Error fetching events:', err.message);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @swagger
 * /api/events/user/bookings:
 *   get:
 *     summary: Get user's event bookings
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     description: Get all active bookings for the authenticated user. Only returns bookings for future events.
 *     parameters:
 *       - in: query
 *         name: debug
 *         schema:
 *           type: boolean
 *         description: Set to true to include diagnostic information
 *     responses:
 *       200:
 *         description: List of user's bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   eventId:
 *                     $ref: '#/components/schemas/Event'
 *                   userId:
 *                     type: string
 *                   status:
 *                     type: string
 *                   bookedAt:
 *                     type: string
 *                     format: date-time
 */
router.get('/user/bookings', authMiddleware, async (req, res) => {
    try {
        console.log('[Events API] Fetching bookings for userId:', req.userId);

        const bookings = await EventBooking.find({
            userId: req.userId,
            status: 'booked'
        })
            .populate('eventId', '_id name date location imageUrl description eventType minAge maxAge maleCount femaleCount otherCount maxMaleParticipants maxFemaleParticipants isPasswordProtected status')
            .sort({ bookedAt: -1 });

        console.log('[Events API] Total bookings found (before date filter):', bookings.length);

        // Log individual bookings for debugging
        bookings.forEach((b, i) => {
            console.log(`[Events API] Booking ${i}: EventId=${b.eventId?._id}, EventName=${b.eventId?.name}, EventDate=${b.eventId?.date}, Status=${b.status}`);
        });

        // Filter out bookings for events that have already passed
        const now = new Date();
        console.log('[Events API] Current server time (now):', now.toISOString());

        const activeBookings = bookings.filter(booking => {
            if (!booking.eventId) {
                console.log('[Events API] Booking filtered out: no eventId populated');
                return false;
            }
            const eventDate = new Date(booking.eventId.date);
            const isFuture = eventDate > now;
            console.log(`[Events API] Comparing eventDate (${eventDate.toISOString()}) > now (${now.toISOString()}): ${isFuture}`);
            return isFuture;
        });

        console.log('[Events API] Active bookings (after date filter):', activeBookings.length);

        // Create a diagnostic object to help debug
        const diagnostics = {
            userId: req.userId,
            serverTime: now.toISOString(),
            totalBookingsBeforeFilter: bookings.length,
            filteredOutCount: bookings.length - activeBookings.length
        };

        // For backwards compatibility and easier client handling, 
        // we'll return the array but add a custom header or log it
        console.log('[Events API] Diagnostics:', diagnostics);

        // Let's actually wrap the response to include diagnostics if a query param is present
        if (req.query.debug === 'true') {
            return res.json({
                bookings: activeBookings,
                diagnostics
            });
        }

        res.json(activeBookings);
    } catch (err) {
        console.error('[Events API] Error fetching user bookings:', err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       404:
 *         description: Event not found
 */
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

/**
 * @swagger
 * /api/events/{id}/participants:
 *   get:
 *     summary: Get event participants
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event participants grouped by gender
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maleParticipants:
 *                   type: array
 *                 femaleParticipants:
 *                   type: array
 *                 otherParticipants:
 *                   type: array
 *                 maleCount:
 *                   type: number
 *                 femaleCount:
 *                   type: number
 *                 otherCount:
 *                   type: number
 *                 totalParticipants:
 *                   type: number
 *       404:
 *         description: Event not found
 */
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

/**
 * @swagger
 * /api/events/{id}/book:
 *   post:
 *     summary: Book an event ticket
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Required if event is password protected
 *     responses:
 *       201:
 *         description: Successfully booked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 booking:
 *                   type: object
 *                 event:
 *                   type: object
 *       400:
 *         description: Validation error (age, orientation, capacity, etc.)
 *       401:
 *         description: Unauthorized or incorrect password
 *       404:
 *         description: Event not found
 */
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

        console.log('[Events API] Creating booking for user:', req.userId, 'event:', event._id);

        // Create booking record
        const booking = new EventBooking({
            eventId: event._id,
            userId: req.userId,
            userGender: userGender
        });
        await booking.save();
        console.log('[Events API] Booking created successfully:', booking._id);

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

/**
 * @swagger
 * /api/events/{id}/book:
 *   delete:
 *     summary: Cancel event booking
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       404:
 *         description: Booking not found
 */
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

/**
 * @swagger
 * /api/events/{id}/leave:
 *   post:
 *     summary: Leave event (mark as absent)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Successfully left event (marked as absent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 booking:
 *                   type: object
 *                 event:
 *                   type: object
 *       400:
 *         description: Cannot leave event after matches have been made
 *       404:
 *         description: Booking not found
 */
router.post('/:id/leave', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Find and update booking to absent status
        const booking = await EventBooking.findOneAndUpdate(
            { eventId: event._id, userId: req.userId, status: 'booked' },
            { status: 'absent' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ message: 'Active booking not found' });
        }

        // Check if user has matches from this event - if so, don't allow leaving
        const Match = (await import('../models/Match.js')).default;
        const userMatches = await Match.find({
            $or: [
                { user1: req.userId },
                { user2: req.userId }
            ],
            eventId: event._id,
            status: { $in: ['active', 'mutual'] }
        });

        if (userMatches.length > 0) {
            // Revert the status change
            await EventBooking.findByIdAndUpdate(booking._id, { status: 'booked' });
            return res.status(400).json({
                message: 'You cannot leave this event as you have active matches. Complete the event or wait for it to end.',
                hasMatches: true
            });
        }

        // Remove from participant arrays (they can still see the event but won't be matched)
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

        // Emit socket event to notify other participants
        const io = req.app.get('io');
        if (io) {
            io.to(`event_${event._id}`).emit('user_absent', {
                userId: req.userId,
                eventId: event._id
            });
        }

        res.json({
            message: 'Successfully left event. You will remain in the lobby until your next round.',
            booking: {
                eventId: event._id,
                status: booking.status,
                leftAt: new Date()
            },
            event: {
                maleCount: event.maleParticipants.length,
                femaleCount: event.femaleParticipants.length,
                otherCount: event.otherParticipants.length
            }
        });
    } catch (err) {
        console.error('Leave event error:', err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @swagger
 * /api/events/{id}/booking-status:
 *   get:
 *     summary: Check if user has booked event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Booking status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isBooked:
 *                   type: boolean
 *                 booking:
 *                   type: object
 *                   nullable: true
 */
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
