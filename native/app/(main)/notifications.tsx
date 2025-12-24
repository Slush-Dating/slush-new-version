/**
 * Notifications Screen
 * View all notifications with filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    User,
    Heart,
    MessageCircle,
    Shield,
    Bell,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { notificationService, type NotificationData } from '../../services/api';
import { getAbsoluteMediaUrl } from '../../services/apiConfig';
import { useAuth } from '../../hooks/useAuth';

type FilterType = 'all' | 'general' | 'match' | 'like';

const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'general', label: 'General' },
    { id: 'match', label: 'Matches' },
    { id: 'like', label: 'Likes' },
];

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            setError(null);
            const response = await notificationService.getNotifications(activeFilter);
            setNotifications(response.notifications);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
            setError('Failed to load notifications');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [activeFilter]);

    useEffect(() => {
        setIsLoading(true);
        fetchNotifications();
    }, [fetchNotifications]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchNotifications();
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const handleFilterChange = (filter: FilterType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveFilter(filter);
    };

    const handleNotificationPress = async (notification: NotificationData) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Mark as read
        if (!notification.isRead) {
            try {
                await notificationService.markAsRead(notification.id);
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, isRead: true } : n
                    )
                );
            } catch (err) {
                console.error('Failed to mark as read:', err);
            }
        }

        // Navigate based on type
        if (notification.type === 'match' && notification.matchId) {
            router.push(`/(main)/chat/${notification.matchId}`);
        } else if (notification.type === 'like') {
            router.push('/(main)/matches');
        }
    };

    const renderNotificationIcon = (notification: NotificationData) => {
        if (notification.userImage) {
            return (
                <Image
                    source={{ uri: getAbsoluteMediaUrl(notification.userImage) }}
                    style={styles.avatar}
                />
            );
        }

        let Icon = Bell;
        let color = '#64748b';
        let bgColor = 'rgba(100, 116, 139, 0.15)';

        switch (notification.type) {
            case 'like':
                Icon = Heart;
                color = '#ec4899';
                bgColor = 'rgba(236, 72, 153, 0.15)';
                break;
            case 'match':
                Icon = Heart;
                color = '#22c55e';
                bgColor = 'rgba(34, 197, 94, 0.15)';
                break;
            case 'message':
                Icon = MessageCircle;
                color = '#3b82f6';
                bgColor = 'rgba(59, 130, 246, 0.15)';
                break;
            case 'security':
                Icon = Shield;
                color = '#f59e0b';
                bgColor = 'rgba(245, 158, 11, 0.15)';
                break;
        }

        return (
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
                <Icon size={20} color={color} />
            </View>
        );
    };

    const getBadgeColor = (type: NotificationData['type']) => {
        switch (type) {
            case 'like':
                return '#ec4899';
            case 'match':
                return '#22c55e';
            case 'message':
                return '#3b82f6';
            default:
                return '#64748b';
        }
    };

    const renderNotification = ({ item }: { item: NotificationData }) => (
        <TouchableOpacity
            style={[styles.notificationCard, !item.isRead && styles.unread]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.8}
        >
            {renderNotificationIcon(item)}

            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    {item.type !== 'general' && (
                        <View
                            style={[
                                styles.badge,
                                { backgroundColor: `${getBadgeColor(item.type)}20` },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.badgeText,
                                    { color: getBadgeColor(item.type) },
                                ]}
                            >
                                {item.type === 'like' ? 'Like' : item.type === 'match' ? 'Match' : ''}
                            </Text>
                        </View>
                    )}
                </View>

                {item.description && (
                    <Text style={styles.notificationDescription} numberOfLines={2}>
                        {item.description}
                    </Text>
                )}

                <Text style={styles.timestamp}>{item.timestamp}</Text>
            </View>

            {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <ArrowLeft size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Notifications</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ec4899" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <ArrowLeft size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Filters */}
            <View style={styles.filters}>
                {FILTERS.map((filter) => (
                    <TouchableOpacity
                        key={filter.id}
                        style={[
                            styles.filterTab,
                            activeFilter === filter.id && styles.filterTabActive,
                        ]}
                        onPress={() => handleFilterChange(filter.id)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                activeFilter === filter.id && styles.filterTextActive,
                            ]}
                        >
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Premium Banner for Likes */}
            {!user?.isPremium && activeFilter === 'like' && notifications.length > 0 && (
                <TouchableOpacity
                    style={styles.premiumBanner}
                    onPress={() => router.push('/(main)/premium')}
                >
                    <Text style={styles.premiumText}>
                        Upgrade to Premium to see who liked you!
                    </Text>
                    <Text style={styles.premiumCta}>Upgrade Now →</Text>
                </TouchableOpacity>
            )}

            {/* Error State */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={fetchNotifications}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Bell size={64} color="#64748b" />
                    <Text style={styles.emptyTitle}>No notifications</Text>
                    <Text style={styles.emptyText}>
                        Matches and likes will appear here
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotification}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor="#ec4899"
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    placeholder: {
        width: 40,
    },
    filters: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 16,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    filterTabActive: {
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    filterTextActive: {
        color: '#ec4899',
    },
    premiumBanner: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    premiumText: {
        fontSize: 14,
        color: '#fbbf24',
        marginBottom: 4,
    },
    premiumCta: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fbbf24',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        marginBottom: 12,
    },
    retryText: {
        color: '#ec4899',
        fontSize: 16,
        fontWeight: '500',
    },
    listContent: {
        paddingHorizontal: 16,
    },
    notificationCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        marginBottom: 8,
        gap: 12,
    },
    unread: {
        backgroundColor: 'rgba(236, 72, 153, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.1)',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationContent: {
        flex: 1,
        gap: 4,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
        flex: 1,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    notificationDescription: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 20,
    },
    timestamp: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ec4899',
        marginTop: 6,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#ffffff',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
    },
});
