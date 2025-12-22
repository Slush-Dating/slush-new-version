import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        required: true,
        enum: ['harassment', 'inappropriate_content', 'spam', 'fake_profile', 'underage', 'other']
    },
    description: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'dismissed', 'action_taken'],
        default: 'pending'
    },
    adminReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    adminNotes: {
        type: String,
        trim: true
    },
    actionTaken: {
        type: String,
        enum: ['none', 'warning', 'suspension', 'ban', 'content_removal'],
        default: 'none'
    },
    // Context where the report originated
    context: {
        type: String,
        enum: ['profile', 'chat', 'video_feed', 'event', 'match'],
        default: 'profile'
    },
    // Reference to related content (match ID, message ID, etc.)
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
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
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedUserId: 1, status: 1 });
reportSchema.index({ reporterId: 1 });

// Update the updatedAt field before saving
reportSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const Report = mongoose.model('Report', reportSchema);

export default Report;

