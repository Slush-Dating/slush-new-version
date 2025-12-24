/**
 * Premium/Subscription Screen
 * Upgrade to premium features
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Crown,
    Sparkles,
    Zap,
    Shield,
    Eye,
    Heart,
    Infinity,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { useAuth } from '../../hooks/useAuth';
import { useBackNavigation } from '../../hooks/useBackNavigation';

const PREMIUM_FEATURES = [
    {
        icon: Eye,
        title: 'See Who Liked You',
        description: 'Unblur all profiles in your "Liked You" tab and start matching instantly.',
        color: '#8b5cf6',
    },
    {
        icon: Infinity,
        title: 'Unlimited Likes',
        description: "Swipe to your heart's content without any daily limits.",
        color: '#3b82f6',
    },
    {
        icon: Zap,
        title: 'Priority Discovery',
        description: 'Your profile gets seen by more people in the feed.',
        color: '#f59e0b',
    },
    {
        icon: Crown,
        title: 'Premium Badge',
        description: 'Stand out with a distinctive crown on your profile.',
        color: '#3B82F6',
    },
    {
        icon: Shield,
        title: 'Advanced Filters',
        description: 'Filter by education, lifestyle, and more specific criteria.',
        color: '#10b981',
    },
];

export default function PremiumScreen() {
    const router = useRouter();
    const { user, updateUser } = useAuth();
    const handleBack = useBackNavigation('/(main)/profile');
    const [isUpgrading, setIsUpgrading] = useState(false);

    // Animation for crown
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    React.useEffect(() => {
        rotation.value = withRepeat(
            withSequence(
                withTiming(5, { duration: 1000 }),
                withTiming(-5, { duration: 1000 }),
                withTiming(0, { duration: 1000 })
            ),
            -1,
            true
        );

        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1500 }),
                withTiming(1, { duration: 1500 })
            ),
            -1,
            true
        );
    }, []);

    const crownAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
    }));

    const onBackPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleBack();
    };

    const handleUpgrade = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsUpgrading(true);

        try {
            // Mock upgrade - in real app would integrate with payment provider
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Update user to premium
            await updateUser({ isPremium: true });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                '🎉 Welcome to Premium!',
                'You now have access to all premium features.',
                [{ text: 'Awesome!', onPress: () => handleBack() }]
            );
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to upgrade. Please try again.');
        } finally {
            setIsUpgrading(false);
        }
    };

    if (user?.isPremium) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                        <ArrowLeft size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium</Text>
                    <View style={styles.placeholder} />
                </View>

                <View style={styles.alreadyPremium}>
                    <Crown size={64} color="#fbbf24" />
                    <Text style={styles.premiumTitle}>You're Premium!</Text>
                    <Text style={styles.premiumSubtitle}>
                        Enjoy all premium features. Thank you for your support!
                    </Text>
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
                <Text style={styles.headerTitle}>Slush Premium</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={styles.crownContainer}>
                        <Animated.View style={crownAnimatedStyle}>
                            <Crown size={72} color="#fbbf24" />
                        </Animated.View>
                        <View style={styles.glowEffect} />
                    </View>
                    <Text style={styles.heroTitle}>Unlock Slush Premium</Text>
                    <Text style={styles.heroSubtitle}>
                        Make every connection count with our premium features designed to help you find your spark.
                    </Text>
                </View>

                {/* Features List */}
                <View style={styles.features}>
                    {PREMIUM_FEATURES.map((feature, index) => (
                        <View key={index} style={styles.featureCard}>
                            <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                                <feature.icon size={24} color={feature.color} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDescription}>{feature.description}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceAmount}>£0.00</Text>
                    <Text style={styles.pricePeriod}>/ month</Text>
                </View>
                <Text style={styles.priceNote}>Free during beta period</Text>

                <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={handleUpgrade}
                    disabled={isUpgrading}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#fbbf24', '#f59e0b']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.upgradeGradient}
                    >
                        {isUpgrading ? (
                            <ActivityIndicator color="#1e293b" />
                        ) : (
                            <>
                                <Crown size={20} color="#1e293b" />
                                <Text style={styles.upgradeText}>Upgrade to Premium</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.footerNote}>
                    Experience the best of Slush. No payment required during beta.
                </Text>
            </View>
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
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    placeholder: {
        width: 40,
    },
    hero: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
    },
    crownContainer: {
        position: 'relative',
        marginBottom: 24,
    },
    glowEffect: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 120,
        height: 120,
        marginLeft: -60,
        marginTop: -60,
        borderRadius: 60,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 12,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
    },
    features: {
        paddingHorizontal: 20,
        gap: 12,
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        gap: 16,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 20,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 4,
    },
    priceAmount: {
        fontSize: 32,
        fontWeight: '700',
        color: '#ffffff',
    },
    pricePeriod: {
        fontSize: 16,
        color: '#94a3b8',
        marginLeft: 4,
    },
    priceNote: {
        fontSize: 14,
        color: '#22c55e',
        textAlign: 'center',
        marginBottom: 16,
    },
    upgradeButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
    },
    upgradeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 8,
    },
    upgradeText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
    },
    footerNote: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
    },
    alreadyPremium: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    premiumTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginTop: 24,
        marginBottom: 12,
    },
    premiumSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
    },
});
