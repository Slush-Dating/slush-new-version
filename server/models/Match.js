import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
    user1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    user2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Track individual actions
    actions: [{
        fromUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        toUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        action: {
            type: String,
            enum: ['like', 'pass', 'super_like'],
            required: true
        },
        context: {
            type: String,
            enum: ['video_feed', 'live_event'],
            required: true
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            default: null
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Match status
    isMatch: {
        type: Boolean,
        default: false
    },
    matchedAt: {
        type: Date,
        default: null
    },
    // Context where match happened
    matchContext: {
        type: String,
        enum: ['video_feed', 'live_event'],
        default: null
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
matchSchema.index({ user1: 1, user2: 1 });
matchSchema.index({ user1: 1, isMatch: 1 });
matchSchema.index({ user2: 1, isMatch: 1 });
matchSchema.index({ 'actions.fromUser': 1, 'actions.toUser': 1 });

// Ensure unique user pairs
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });

// Method to check if users have matched
matchSchema.methods.checkAndCreateMatch = function() {
    // Check if user1 has liked user2 (from user1 to user2)
    const user1LikedUser2 = this.actions.some(
        action => action.fromUser.toString() === this.user1.toString() && 
                 action.toUser.toString() === this.user2.toString() &&
                 (action.action === 'like' || action.action === 'super_like')
    );
    
    // Check if user2 has liked user1 (from user2 to user1)
    const user2LikedUser1 = this.actions.some(
        action => action.fromUser.toString() === this.user2.toString() && 
                 action.toUser.toString() === this.user1.toString() &&
                 (action.action === 'like' || action.action === 'super_like')
    );

    // Both users must have liked each other for a match
    if (user1LikedUser2 && user2LikedUser1 && !this.isMatch) {
        this.isMatch = true;
        this.matchedAt = new Date();
        // Use the most recent context
        const latestAction = this.actions[this.actions.length - 1];
        this.matchContext = latestAction.context;
        this.eventId = latestAction.eventId;
        return true;
    }
    return false;
};

const Match = mongoose.model('Match', matchSchema);

export default Match;


