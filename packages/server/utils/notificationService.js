/**
 * Notification Service
 * Centralized service for creating and sending notifications
 */

import Notification from '../models/Notification.js';
import Event from '../models/Event.js';
import EventBooking from '../models/EventBooking.js';

// Socket.IO instance - set by server/index.js
let io = null;

/**
 * Set the Socket.IO instance for real-time notifications
 */
export const setSocketIO = (socketIO) => {
    io = socketIO;
};

/**
 * Helper to format relative time
 */
const getRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
};

/**
 * Create a notification and optionally send it in real-time
 */
export const createNotification = async ({
    userId,
    type,
    title,
    description = null,
    fromUserId = null,
    eventId = null,
    matchId = null,
    reminderType = null,
    actionButton = null,
    actionLink = null,
    sendRealTime = true
}) => {
    try {
        const notification = new Notification({
            userId,
            type,
            title,
            description,
            fromUserId,
            eventId,
            matchId,
            reminderType,
            actionButton,
            actionLink
        });

        await notification.save();

        // Send real-time notification via Socket.IO
        if (sendRealTime && io) {
            const notificationData = {
                id: notification._id.toString(),
                type: notification.type,
                title: notification.title,
                description: notification.description,
                eventId: notification.eventId?.toString() || null,
                matchId: notification.matchId?.toString() || null,
                reminderType: notification.reminderType,
                actionButton: notification.actionButton,
                actionLink: notification.actionLink,
                timestamp: 'Just now',
                isRead: false
            };

            io.to(`user_${userId}`).emit('new_notification', {
                type: notification.type,
                notification: notificationData
            });

            console.log(`[NotificationService] Sent real-time notification to user ${userId}: ${type}`);
        }

        return notification;
    } catch (error) {
        console.error('[NotificationService] Error creating notification:', error);
        throw error;
    }
};

/**
 * Send event reminder notifications to all booked users
 */
export const sendEventReminder = async (eventId, reminderType) => {
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            console.error(`[NotificationService] Event not found: ${eventId}`);
            return;
        }

        // Get all booked users for this event
        const bookings = await EventBooking.find({
            eventId: eventId,
            status: 'booked'
        });

        const userIds = bookings.map(b => b.userId);

        // Define notification content based on reminder type
        let title, description, actionButton;

        switch (reminderType) {
            case '30_minutes':
                title = 'Event starting soon!';
                description = `${event.name} starts in 30 minutes`;
                actionButton = 'View Event';
                break;
            case '15_minutes':
                title = 'Waiting room is now open!';
                description = `Join the waiting room for ${event.name}`;
                actionButton = 'Join Waiting Room';
                break;
            case '60_seconds':
                title = 'Event starting now!';
                description = `${event.name} starts in 60 seconds!`;
                actionButton = 'Join Now';
                break;
            case 'waiting_room_open':
                title = 'Waiting room is open!';
                description = `The waiting room for ${event.name} is now open`;
                actionButton = 'Enter';
                break;
            default:
                title = 'Event reminder';
                description = `Don't forget about ${event.name}`;
                actionButton = 'View Event';
        }

        // Check for existing notifications to avoid duplicates
        const existingNotifications = await Notification.find({
            eventId: eventId,
            reminderType: reminderType,
            type: reminderType === '60_seconds' ? 'event_starting' : 'event_reminder'
        });

        const notifiedUserIds = new Set(existingNotifications.map(n => n.userId.toString()));

        // Create notifications for users who haven't been notified yet
        const notificationsToCreate = [];
        for (const userId of userIds) {
            if (!notifiedUserIds.has(userId.toString())) {
                notificationsToCreate.push({
                    userId,
                    type: reminderType === '60_seconds' ? 'event_starting' : 'event_reminder',
                    title,
                    description,
                    eventId: event._id,
                    reminderType,
                    actionButton,
                    actionLink: `/events/${event._id}`
                });
            }
        }

        // Create all notifications
        for (const notifData of notificationsToCreate) {
            await createNotification(notifData);
        }

        console.log(`[NotificationService] Sent ${reminderType} reminders to ${notificationsToCreate.length} users for event ${event.name}`);

    } catch (error) {
        console.error('[NotificationService] Error sending event reminders:', error);
    }
};

/**
 * Notify users about new events
 */
export const notifyNewEvents = async (eventIds, userIds = null) => {
    try {
        const events = await Event.find({ _id: { $in: eventIds } });

        if (events.length === 0) return;

        // If no specific users, we could notify all active users
        // For now, we'll skip if no users specified (admin can trigger this)
        if (!userIds || userIds.length === 0) {
            console.log('[NotificationService] No users specified for new events notification');
            return;
        }

        const title = events.length === 1
            ? 'New event available!'
            : `${events.length} new events available!`;

        const description = events.length === 1
            ? `Check out ${events[0].name}`
            : 'Check out the new events';

        for (const userId of userIds) {
            await createNotification({
                userId,
                type: 'new_events',
                title,
                description,
                actionButton: 'View Events',
                actionLink: '/events'
            });
        }

        console.log(`[NotificationService] Notified ${userIds.length} users about new events`);

    } catch (error) {
        console.error('[NotificationService] Error notifying new events:', error);
    }
};

/**
 * Check for upcoming events and send reminders
 * This function should be called periodically (e.g., every minute)
 */
export const checkAndSendEventReminders = async () => {
    try {
        const now = new Date();

        // 30 minutes reminder (29-31 minute window)
        const thirtyMinStart = new Date(now.getTime() + 29 * 60000);
        const thirtyMinEnd = new Date(now.getTime() + 31 * 60000);

        const thirtyMinEvents = await Event.find({
            date: { $gte: thirtyMinStart, $lte: thirtyMinEnd },
            status: 'Scheduled'
        });

        for (const event of thirtyMinEvents) {
            await sendEventReminder(event._id, '30_minutes');
        }

        // 15 minutes reminder (14-16 minute window) - Waiting room opens
        const fifteenMinStart = new Date(now.getTime() + 14 * 60000);
        const fifteenMinEnd = new Date(now.getTime() + 16 * 60000);

        const fifteenMinEvents = await Event.find({
            date: { $gte: fifteenMinStart, $lte: fifteenMinEnd },
            status: 'Scheduled'
        });

        for (const event of fifteenMinEvents) {
            await sendEventReminder(event._id, '15_minutes');
        }

        // 60 seconds reminder (50-70 second window)
        const sixtySecStart = new Date(now.getTime() + 50 * 1000);
        const sixtySecEnd = new Date(now.getTime() + 70 * 1000);

        const sixtySecEvents = await Event.find({
            date: { $gte: sixtySecStart, $lte: sixtySecEnd },
            status: 'Scheduled'
        });

        for (const event of sixtySecEvents) {
            await sendEventReminder(event._id, '60_seconds');
        }

    } catch (error) {
        console.error('[NotificationService] Error checking event reminders:', error);
    }
};

export default {
    setSocketIO,
    createNotification,
    sendEventReminder,
    notifyNewEvents,
    checkAndSendEventReminders
};
