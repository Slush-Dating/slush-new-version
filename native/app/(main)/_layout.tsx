/**
 * Main App Layout with Tab Navigation
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { PlayCircle, Calendar, Heart, MessageSquare, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/api';
import socketService from '../../services/socketService';
import { getCurrentUserId } from '../../services/authService';

export default function MainLayout() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [newMatchCount, setNewMatchCount] = useState(0);
    const apiErrorCountRef = useRef(0);
    const isCircuitOpenRef = useRef(false);
    const lastFetchTimeRef = useRef(0);

    // Fetch unread message count with improved error handling and circuit breaker
    useEffect(() => {
        if (!user) return;

        const fetchUnreadCount = async (isRetry = false) => {
            // Circuit breaker: if too many errors, stop trying for a while
            if (isCircuitOpenRef.current) {
                const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
                // Wait at least 30 seconds before trying again after circuit opens
                if (timeSinceLastFetch < 30000) {
                    return;
                }
                // Reset circuit breaker after cooldown
                isCircuitOpenRef.current = false;
                apiErrorCountRef.current = 0;
            }

            try {
                const { unreadCount: count } = await chatService.getUnreadCount();
                setUnreadCount(count || 0);
                apiErrorCountRef.current = 0; // Reset error count on success
                isCircuitOpenRef.current = false; // Reset circuit breaker
                lastFetchTimeRef.current = Date.now();
                
                // Only log success occasionally to reduce spam
                if (!isRetry) {
                    console.log('✅ Fetched unread count:', count);
                }
            } catch (error) {
                const errorMessage = error.message || '';
                lastFetchTimeRef.current = Date.now();
                apiErrorCountRef.current += 1;

                // Don't retry on 500 errors - these are server issues
                // Only retry on network/timeout errors
                const isRetryableError = (
                    errorMessage.includes('network') ||
                    errorMessage.includes('timeout') ||
                    errorMessage.includes('fetch')
                ) && !errorMessage.includes('500');

                if (isRetryableError && apiErrorCountRef.current < 2) {
                    // Retry once for network errors only
                    setTimeout(() => fetchUnreadCount(true), 3000);
                    return;
                }

                // Set default value on failure
                setUnreadCount(0);

                // Open circuit breaker after 3 consecutive failures
                if (apiErrorCountRef.current >= 3) {
                    isCircuitOpenRef.current = true;
                    // Only log warning once when circuit opens
                    if (apiErrorCountRef.current === 3) {
                        console.warn('⚠️ Chat API unavailable - using fallback. Will retry in 30s.');
                    }
                }
            }
        };

        // Initial fetch
        fetchUnreadCount();

        // Set up periodic refresh every 30 seconds (normal polling)
        const intervalId = setInterval(() => {
            // Only poll if circuit breaker is not open
            if (!isCircuitOpenRef.current) {
                fetchUnreadCount();
            }
        }, 30000); // 30 seconds

        return () => clearInterval(intervalId);
    }, [user]);

    // Set up socket connection for real-time updates
    useEffect(() => {
        const setupSocket = async () => {
            const userId = await getCurrentUserId();
            if (!userId) return;

            try {
                await socketService.connect(userId);

                socketService.onNewMessage((message) => {
                    console.log('📨 Real-time message received, updating unread count');
                    // Increment unread count for new messages
                    setUnreadCount((prev) => prev + 1);
                    // Reset API error count and circuit breaker when socket works
                    apiErrorCountRef.current = 0;
                    isCircuitOpenRef.current = false;
                });

                socketService.onNewMatch((match) => {
                    console.log('🎉 Real-time match received');
                    // Increment match count for new matches
                    setNewMatchCount((prev) => prev + 1);
                });
            } catch (error) {
                console.error('Failed to connect socket:', error);
            }
        };

        setupSocket();

        return () => {
            socketService.disconnect();
        };
    }, []);

    const handleTabPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <View style={styles.container}>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: [
                        styles.tabBar,
                        {
                            paddingBottom: Math.max(insets.bottom, 8),
                            height: 60 + Math.max(insets.bottom, 8),
                        },
                    ],
                    tabBarActiveTintColor: '#3B82F6',
                    tabBarInactiveTintColor: '#718096',
                    tabBarLabelStyle: styles.tabLabel,
                    tabBarItemStyle: styles.tabItem,
                }}
                screenListeners={{
                    tabPress: handleTabPress,
                }}
            >
                <Tabs.Screen
                    name="feed"
                    options={{
                        title: 'Feed',
                        tabBarIcon: ({ color, size }) => (
                            <PlayCircle size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="events"
                    options={{
                        title: 'Events',
                        tabBarIcon: ({ color, size }) => (
                            <Calendar size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="matches"
                    options={{
                        title: 'Matches',
                        tabBarIcon: ({ color, size }) => (
                            <View>
                                <Heart size={size} color={color} />
                                {newMatchCount > 0 && (
                                    <View style={styles.badge}>
                                        {/* Badge indicator */}
                                    </View>
                                )}
                            </View>
                        ),
                    }}
                    listeners={{
                        tabPress: () => {
                            setNewMatchCount(0);
                        },
                    }}
                />
                <Tabs.Screen
                    name="chat"
                    options={{
                        title: 'Chat',
                        tabBarIcon: ({ color, size }) => (
                            <View>
                                <MessageSquare size={size} color={color} />
                                {unreadCount > 0 && (
                                    <View style={styles.badge}>
                                        {/* Badge indicator */}
                                    </View>
                                )}
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color, size }) => (
                            <User size={size} color={color} />
                        ),
                    }}
                />
                {/* Hidden Screens - Not in Tab Bar */}
                <Tabs.Screen
                    name="notifications"
                    options={{
                        href: null,
                    }}
                />
                <Tabs.Screen
                    name="premium"
                    options={{
                        href: null,
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        href: null,
                    }}
                />
                <Tabs.Screen
                    name="user"
                    options={{
                        href: null,
                    }}
                />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    tabBar: {
        backgroundColor: '#ffffff',
        borderTopColor: '#e5e7eb',
        borderTopWidth: 1,
        paddingTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 8,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    tabItem: {
        gap: 4,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e74c3c',
    },
});
