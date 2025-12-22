import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        trim: true
    },
    dob: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['man', 'woman', 'non-binary', 'other']
    },
    interestedIn: {
        type: String,
        enum: ['men', 'women', 'everyone']
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    bio: {
        type: String,
        trim: true
    },
    prompts: [{
        question: String,
        answer: String
    }],
    interests: [String],
    photos: [String],
    videos: [String],
    onboardingCompleted: {
        type: Boolean,
        default: false
    },
    isPremium: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    // Admin status fields
    status: {
        type: String,
        enum: ['active', 'suspended', 'banned'],
        default: 'active'
    },
    statusReason: {
        type: String,
        trim: true
    },
    statusUpdatedAt: {
        type: Date
    },
    adminNotes: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for geo-queries
userSchema.index({ location: '2dsphere' });

const User = mongoose.model('User', userSchema);
export default User;
