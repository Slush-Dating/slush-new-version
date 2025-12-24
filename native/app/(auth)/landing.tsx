/**
 * Landing Page - Modern video dating app design
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
import { Video, PlayCircle, Users, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function LandingPage() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
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
                colors={['#0F172A', '#1E293B', '#334155']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Decorative video circles */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />
                <View style={styles.decorativeCircle3} />

                <SafeAreaView style={styles.safeArea}>
                    <Animated.View
                        style={[
                            styles.content,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Hero Section */}
                        <View style={styles.heroSection}>
                            <View style={styles.logoContainer}>
                                <View style={styles.videoIconWrapper}>
                                    <Video size={32} color="#60A5FA" strokeWidth={2.5} />
                                </View>
                                <Text style={styles.title}>Slush</Text>
                                <Text style={styles.titleAccent}>Dating</Text>
                            </View>
                            
                            <Text style={styles.tagline}>Break the ice through video</Text>
                            <Text style={styles.description}>
                                Connect authentically with video-first dating. See the real person behind the profile.
                            </Text>
                        </View>

                        {/* Key Features */}
                        <View style={styles.features}>
                            <FeatureItem
                                icon={<PlayCircle size={24} color="#60A5FA" />}
                                title="Video First"
                                description="Start conversations with video profiles"
                            />
                            <FeatureItem
                                icon={<Users size={24} color="#60A5FA" />}
                                title="Real Connections"
                                description="Meet genuine people in your area"
                            />
                            <FeatureItem
                                icon={<Shield size={24} color="#60A5FA" />}
                                title="Safe & Secure"
                                description="Your privacy is protected"
                            />
                        </View>

                        {/* CTA Buttons */}
                        <View style={styles.buttons}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleCreateAccount}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#3B82F6', '#60A5FA']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.primaryButtonText}>Get Started</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleSignIn}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.secondaryButtonText}>
                                    Already have an account?{' '}
                                    <Text style={styles.signInLink}>Sign In</Text>
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
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
                {icon}
            </View>
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
    decorativeCircle1: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        top: -100,
        right: -100,
    },
    decorativeCircle2: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(96, 165, 250, 0.08)',
        bottom: 100,
        left: -50,
    },
    decorativeCircle3: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(59, 130, 246, 0.06)',
        top: '40%',
        right: 50,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingBottom: 48,
    },
    heroSection: {
        alignItems: 'center',
        marginTop: 20,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 12,
    },
    videoIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(96, 165, 250, 0.3)',
    },
    title: {
        fontSize: 48,
        fontWeight: '800',
        color: '#F8FAFC',
        letterSpacing: -1,
    },
    titleAccent: {
        color: '#60A5FA',
    },
    tagline: {
        fontSize: 24,
        fontWeight: '700',
        color: '#F8FAFC',
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 16,
        color: '#CBD5E1',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 8,
    },
    features: {
        gap: 16,
        marginTop: 32,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.15)',
        gap: 16,
    },
    featureIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#F8FAFC',
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        color: '#94A3B8',
        lineHeight: 20,
    },
    buttons: {
        gap: 16,
        marginTop: 24,
    },
    primaryButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    buttonGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    secondaryButtonText: {
        fontSize: 15,
        color: '#94A3B8',
    },
    signInLink: {
        color: '#60A5FA',
        fontWeight: '600',
    },
});
