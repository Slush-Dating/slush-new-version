/**
 * Notification Service for React Native
 * Handles local and push notifications using expo-notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

// Configure default notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Types for socket notifications
interface SocketNotification {
    id: string;
    type: 'like' | 'match' | 'event_reminder' | 'event_starting' | 'new_events' | 'general' | 'security';
    title: string;
    description?: string;
    eventId?: string;
    matchId?: string;
    reminderType?: '30_minutes' | '15_minutes' | '60_seconds' | 'waiting_room_open';
    actionButton?: string;
    actionLink?: string;
    timestamp: string;
}

class NotificationService {
    private notificationListener: Notifications.Subscription | null = null;
    private responseListener: Notifications.Subscription | null = null;
    private scheduledNotifications: Map<string, string[]> = new Map(); // eventId -> notificationIds

    /**
     * Initialize notification service
     */
    async initialize(): Promise<void> {
        // Set up notification listeners
        this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
            console.log('[NotificationService] Notification received:', notification);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });

        this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('[NotificationService] Notification tapped:', response);
            this.handleNotificationResponse(response);
        });

        console.log('[NotificationService] Initialized');
    }

    /**
     * Clean up listeners
     */
    cleanup(): void {
        if (this.notificationListener) {
            this.notificationListener.remove();
        }
        if (this.responseListener) {
            this.responseListener.remove();
        }
    }

    /**
     * Request notification permissions
     */
    async requestPermissions(): Promise<boolean> {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[NotificationService] Permission not granted');
                return false;
            }

            // For Android, we need to set up a notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF6F61',
                });

                await Notifications.setNotificationChannelAsync('events', {
                    name: 'Event Reminders',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF6F61',
                });

                await Notifications.setNotificationChannelAsync('social', {
                    name: 'Likes & Matches',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    vibrationPattern: [0, 250],
                    lightColor: '#FF6F61',
                });
            }

            console.log('[NotificationService] Permissions granted');
            return true;
        } catch (error) {
            console.error('[NotificationService] Error requesting permissions:', error);
            return false;
        }
    }

    /**
     * Schedule a local notification for an event reminder
     */
    async scheduleEventReminder(
        eventId: string,
        eventName: string,
        startTime: Date,
        reminderType: '30_minutes' | '15_minutes' | '60_seconds'
    ): Promise<string | null> {
        try {
            const now = new Date();
            let triggerTime: Date;
            let title: string;
            let body: string;

            switch (reminderType) {
                case '30_minutes':
                    triggerTime = new Date(startTime.getTime() - 30 * 60 * 1000);
                    title = 'Event starting soon!';
                    body = `${eventName} starts in 30 minutes`;
                    break;
                case '15_minutes':
                    triggerTime = new Date(startTime.getTime() - 15 * 60 * 1000);
                    title = 'Waiting room is open!';
                    body = `Join the waiting room for ${eventName}`;
                    break;
                case '60_seconds':
                    triggerTime = new Date(startTime.getTime() - 60 * 1000);
                    title = 'Event starting now!';
                    body = `${eventName} starts in 60 seconds!`;
                    break;
            }

            // Don't schedule if the trigger time has already passed
            if (triggerTime <= now) {
                console.log(`[NotificationService] Skipping ${reminderType} reminder - time has passed`);
                return null;
            }

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: {
                        type: reminderType === '60_seconds' ? 'event_starting' : 'event_reminder',
                        eventId,
                        reminderType
                    },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    ...(Platform.OS === 'android' && { channelId: 'events' }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerTime,
                },
            });

            // Track scheduled notifications for this event
            const existing = this.scheduledNotifications.get(eventId) || [];
            existing.push(notificationId);
            this.scheduledNotifications.set(eventId, existing);

            console.log(`[NotificationService] Scheduled ${reminderType} reminder for ${eventName} at ${triggerTime.toISOString()}`);
            return notificationId;
        } catch (error) {
            console.error('[NotificationService] Error scheduling event reminder:', error);
            return null;
        }
    }

    /**
     * Schedule all reminders for a booked event
     */
    async scheduleAllEventReminders(eventId: string, eventName: string, startTime: Date): Promise<void> {
        await this.scheduleEventReminder(eventId, eventName, startTime, '30_minutes');
        await this.scheduleEventReminder(eventId, eventName, startTime, '15_minutes');
        await this.scheduleEventReminder(eventId, eventName, startTime, '60_seconds');
    }

    /**
     * Cancel all scheduled reminders for an event
     */
    async cancelEventReminders(eventId: string): Promise<void> {
        const notificationIds = this.scheduledNotifications.get(eventId);
        if (notificationIds) {
            for (const id of notificationIds) {
                await Notifications.cancelScheduledNotificationAsync(id);
            }
            this.scheduledNotifications.delete(eventId);
            console.log(`[NotificationService] Cancelled reminders for event ${eventId}`);
        }
    }

    /**
     * Show an immediate notification
     */
    async showNotification(
        title: string,
        body: string,
        data?: Record<string, unknown>
    ): Promise<string | null> {
        try {
            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data || {},
                    sound: true,
                    ...(Platform.OS === 'android' && {
                        channelId: data?.type === 'like' || data?.type === 'match' ? 'social' : 'default'
                    }),
                },
                trigger: null, // Immediate notification
            });

            console.log(`[NotificationService] Showed notification: ${title}`);
            return notificationId;
        } catch (error) {
            console.error('[NotificationService] Error showing notification:', error);
            return null;
        }
    }

    /**
     * Handle incoming socket notification and show as local notification
     */
    handleSocketNotification(notification: SocketNotification): void {
        // Show haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // For now just log - in the future could show a local notification
        // if the app is in background
        console.log('[NotificationService] Socket notification received:', notification.type, notification.title);
    }

    /**
     * Handle when user taps a notification
     */
    private handleNotificationResponse(response: Notifications.NotificationResponse): void {
        const data = response.notification.request.content.data;

        if (!data) return;

        switch (data.type) {
            case 'event_reminder':
            case 'event_starting':
                if (data.eventId) {
                    // Navigate to event waiting room
                    router.push(`/(main)/events/waiting/${data.eventId}`);
                }
                break;
            case 'match':
                if (data.matchId) {
                    // Navigate to chat
                    router.push(`/(main)/chat/${data.matchId}`);
                }
                break;
            case 'like':
                // Navigate to notifications or matches
                router.push('/(main)/matches');
                break;
            case 'new_events':
                // Navigate to events list
                router.push('/(main)/events');
                break;
            default:
                // Navigate to notifications
                router.push('/(main)/notifications');
        }
    }

    /**
     * Get the push token for this device (for future push notifications)
     */
    async getPushToken(): Promise<string | null> {
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) return null;

            const token = await Notifications.getExpoPushTokenAsync({
                projectId: 'your-project-id', // Replace with your Expo project ID
            });

            console.log('[NotificationService] Push token:', token.data);
            return token.data;
        } catch (error) {
            console.error('[NotificationService] Error getting push token:', error);
            return null;
        }
    }

    /**
     * Get badge count
     */
    async getBadgeCount(): Promise<number> {
        return await Notifications.getBadgeCountAsync();
    }

    /**
     * Set badge count
     */
    async setBadgeCount(count: number): Promise<void> {
        await Notifications.setBadgeCountAsync(count);
    }

    /**
     * Clear all notifications
     */
    async clearAllNotifications(): Promise<void> {
        await Notifications.dismissAllNotificationsAsync();
        await this.setBadgeCount(0);
    }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;
