import mongoose from 'mongoose';

const eventBookingSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userGender: {
        type: String,
        enum: ['man', 'woman', 'non-binary', 'other'],
        required: true
    },
    bookedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['booked', 'attended', 'cancelled'],
        default: 'booked'
    }
});

// Compound index to ensure a user can only book once per event
eventBookingSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const EventBooking = mongoose.model('EventBooking', eventBookingSchema);

export default EventBooking;
