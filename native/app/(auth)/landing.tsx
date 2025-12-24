/**
 * Landing Page - First screen users see
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function LandingPage() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleCreateAccount = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(auth)/register');
    };

    const handleSignIn = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(auth)/login');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#eff6ff', '#ffffff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>
                    <Animated.View
                        style={[
                            styles.content,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    { translateY: slideAnim },
                                    { scale: scaleAnim },
                                ],
                            },
                        ]}
                    >
                        {/* Logo Section */}
                        <View style={styles.logoContainer}>
                            <Text style={styles.title}>Slush<Text style={styles.titleAccent}>Dating</Text></Text>
                            <Text style={styles.subtitle}>Find Your Perfect Match</Text>
                        </View>

                        {/* Features */}
                        <View style={styles.features}>
                            <FeatureItem
                                icon="💬"
                                title="Real Conversations"
                                description="Chat with matches who share your interests and values"
                            />
                            <FeatureItem
                                icon="🎉"
                                title="Local Events"
                                description="Join speed dating events and social gatherings in your area"
                            />
                            <FeatureItem
                                icon="🔒"
                                title="Safe & Secure"
                                description="Your privacy and safety are our top priorities"
                            />
                        </View>

                        {/* Buttons */}
                        <View style={styles.buttons}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleCreateAccount}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.buttonGradient, { backgroundColor: '#e74c3c' }]}>
                                    <Text style={styles.primaryButtonText}>Get Started</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleSignIn}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.secondaryButtonText}>
                                    Already have an account? <Text style={styles.signInLink}>Sign In</Text>
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

function FeatureItem({
    icon,
    title,
    description,
}: {
    icon: string;
    title: string;
    description: string;
}) {
    return (
        <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        paddingTop: 20,
        paddingBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    title: {
        fontSize: 42,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
    },
    titleAccent: {
        color: '#3B82F6',
    },
    subtitle: {
        fontSize: 18,
        color: '#64748b',
        fontWeight: '500',
    },
    features: {
        gap: 16,
        marginTop: 20,
    },
    featureItem: {
        backgroundColor: '#ffffff',
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    featureIcon: {
        fontSize: 32,
        marginBottom: 12,
    },
    featureText: {
        alignItems: 'center',
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
    },
    featureDescription: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        textAlign: 'center',
    },
    buttons: {
        gap: 12,
        marginTop: 20,
    },
    primaryButton: {
        borderRadius: 50,
        overflow: 'hidden',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        backgroundColor: '#3B82F6',
    },
    primaryButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: 18,
        backgroundColor: '#ffffff',
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    secondaryButtonText: {
        fontSize: 16,
        color: '#64748b',
    },
    signInLink: {
        color: '#3B82F6',
        fontWeight: '600',
    },
});
