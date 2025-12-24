/**
 * Login Screen - Updated with polished design
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Animation values for background orbs
    const orb1Anim = useRef(new Animated.Value(0)).current;
    const orb2Anim = useRef(new Animated.Value(0)).current;
    const orb3Anim = useRef(new Animated.Value(0)).current;
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Animate background orbs
        const animateOrb = (anim: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 4000,
                        delay,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 4000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        };

        animateOrb(orb1Anim, 0);
        animateOrb(orb2Anim, 1000);
        animateOrb(orb3Anim, 2000);

        // Animate card entrance
        Animated.timing(cardAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

    const getOrbTransform = (anim: Animated.Value) => ({
        transform: [
            {
                translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 30],
                }),
            },
            {
                translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                }),
            },
            {
                scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05],
                }),
            },
        ],
    });

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please fill in all fields');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await login(email.trim().toLowerCase(), password);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Navigation will be handled by the root layout based on auth state
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    return (
        <View style={styles.container}>
            {/* Animated Background Orbs */}
            <Animated.View
                style={[
                    styles.backgroundOrb,
                    styles.orb1,
                    getOrbTransform(orb1Anim),
                ]}
            />
            <Animated.View
                style={[
                    styles.backgroundOrb,
                    styles.orb2,
                    getOrbTransform(orb2Anim),
                ]}
            />
            <Animated.View
                style={[
                    styles.backgroundOrb,
                    styles.orb3,
                    getOrbTransform(orb3Anim),
                ]}
            />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                <ArrowLeft size={24} color="#1f2937" />
                            </TouchableOpacity>
                        </View>

                        {/* Auth Card */}
                        <Animated.View
                            style={[
                                styles.authCard,
                                {
                                    opacity: cardAnim,
                                    transform: [
                                        {
                                            translateY: cardAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [30, 0],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            {/* Title Section */}
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>Slush<Text style={styles.titleAccent}>Dating</Text></Text>
                                <Text style={styles.subtitle}>Sign in to your account</Text>
                            </View>

                            {/* Form */}
                            <View style={styles.form}>
                                {error ? (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Email Address</Text>
                                    <View style={styles.inputContainer}>
                                        <Mail size={20} color="#6b7280" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="name@example.com"
                                            placeholderTextColor="#9ca3af"
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoComplete="email"
                                            editable={!isLoading}
                                            autoFocus
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Password</Text>
                                    <View style={styles.inputContainer}>
                                        <Lock size={20} color="#6b7280" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="••••••••"
                                            placeholderTextColor="#9ca3af"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                            autoComplete="password"
                                            editable={!isLoading}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPassword(!showPassword)}
                                            style={styles.eyeButton}
                                        >
                                            {showPassword ? (
                                                <EyeOff size={20} color="#6b7280" />
                                            ) : (
                                                <Eye size={20} color="#6b7280" />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={isLoading}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#3b82f6', '#2563eb']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.buttonGradient}
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color="#ffffff" />
                                        ) : (
                                            <>
                                                <Text style={styles.loginButtonText}>Sign In</Text>
                                                <ChevronRight size={20} color="#ffffff" />
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.forgotButton}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.forgotText}>Forgot password?</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Footer */}
                            <View style={styles.cardFooter}>
                                <Text style={styles.footerText}>
                                    Don't have an account?{' '}
                                    <Text
                                        style={styles.signUpLink}
                                        onPress={() => router.push('/(auth)/register')}
                                    >
                                        Sign Up
                                    </Text>
                                </Text>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    backgroundOrb: {
        position: 'absolute',
        borderRadius: 200,
        opacity: 0.2,
    },
    orb1: {
        width: 400,
        height: 400,
        backgroundColor: '#3b82f6',
        top: -150,
        right: -100,
    },
    orb2: {
        width: 300,
        height: 300,
        backgroundColor: '#60a5fa',
        bottom: -100,
        left: -80,
    },
    orb3: {
        width: 200,
        height: 200,
        backgroundColor: '#93c5fd',
        top: '30%',
        left: '40%',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingVertical: 40,
        justifyContent: 'center',
        minHeight: Dimensions.get('window').height - 100,
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 24,
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    authCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 40,
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1f2937',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    titleAccent: {
        color: '#3b82f6',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
    },
    form: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginLeft: 4,
    },
    errorContainer: {
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#111827',
        fontSize: 16,
        fontWeight: '500',
    },
    eyeButton: {
        padding: 8,
        marginRight: -8,
    },
    loginButton: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonGradient: {
        flexDirection: 'row',
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loginButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    forgotButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    forgotText: {
        fontSize: 14,
        color: '#6b7280',
    },
    cardFooter: {
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    footerText: {
        fontSize: 16,
        color: '#6b7280',
    },
    signUpLink: {
        color: '#3b82f6',
        fontWeight: '600',
    },
});
