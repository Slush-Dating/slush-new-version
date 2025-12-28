import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['like', 'match', 'general', 'security', 'event_reminder', 'event_starting', 'new_events'],
        required: true
    },
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        default: null
    },
    reminderType: {
        type: String,
        enum: ['30_minutes', '15_minutes', '60_seconds', 'waiting_room_open', null],
        default: null
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: null
    },
    actionButton: {
        type: String,
        default: null
    },
    actionLink: {
        type: String,
        default: null
    },
    matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
