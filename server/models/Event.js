import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: 'You will virtually meet different people. Each date will last 3 minutes and you will have an opportunity to decide whether or not you like the person. If you both like each other, you will match at the end of the session!'
    },
    eventType: {
        type: String,
        enum: ['straight', 'gay', 'bisexual'],
        default: 'straight'
    },
    maxMaleParticipants: {
        type: Number,
        default: 10
    },
    maxFemaleParticipants: {
        type: Number,
        default: 10
    },
    minAge: {
        type: Number,
        default: 18
    },
    maxAge: {
        type: Number,
        default: 99
    },
    // Participant arrays store user IDs
    maleParticipants: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    femaleParticipants: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    otherParticipants: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    status: {
        type: String,
        enum: ['Scheduled', 'Active', 'Completed', 'Cancelled'],
        default: 'Scheduled'
    },
    // Password protection for private events
    password: {
        type: String,
        default: null
    },
    isPasswordProtected: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for getting participant counts
eventSchema.virtual('maleCount').get(function () {
    return Array.isArray(this.maleParticipants) ? this.maleParticipants.length : 0;
});

eventSchema.virtual('femaleCount').get(function () {
    return Array.isArray(this.femaleParticipants) ? this.femaleParticipants.length : 0;
});

eventSchema.virtual('otherCount').get(function () {
    return Array.isArray(this.otherParticipants) ? this.otherParticipants.length : 0;
});

eventSchema.virtual('totalParticipants').get(function () {
    return (this.maleParticipants?.length || 0) +
        (this.femaleParticipants?.length || 0) +
        (this.otherParticipants?.length || 0);
});

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// Method to hash password
eventSchema.methods.setPassword = async function(password) {
    if (password) {
        this.password = await bcrypt.hash(password, 12);
        this.isPasswordProtected = true;
    } else {
        this.password = null;
        this.isPasswordProtected = false;
    }
};

// Method to verify password
eventSchema.methods.verifyPassword = async function(password) {
    if (!this.password) return true; // No password set, allow access
    return await bcrypt.compare(password, this.password);
};

const Event = mongoose.model('Event', eventSchema);

export default Event;
