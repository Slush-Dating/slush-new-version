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

    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Animate card entrance
        Animated.timing(cardAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

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
            <LinearGradient
                colors={['#0F172A', '#1E293B', '#334155']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Decorative elements */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

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
                                    <ArrowLeft size={22} color="#F8FAFC" />
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
                                        <Mail size={20} color="#94A3B8" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="name@example.com"
                                            placeholderTextColor="#64748B"
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
                                        <Lock size={20} color="#94A3B8" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="••••••••"
                                            placeholderTextColor="#64748B"
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
                                                <EyeOff size={20} color="#94A3B8" />
                                            ) : (
                                                <Eye size={20} color="#94A3B8" />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#3B82F6', '#60A5FA']}
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
            </LinearGradient>
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
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    authCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 28,
        padding: 32,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 36,
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: '#F8FAFC',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    titleAccent: {
        color: '#60A5FA',
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
    },
    form: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E2E8F0',
        marginLeft: 4,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#FCA5A5',
        fontSize: 14,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.2)',
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#F8FAFC',
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
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
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
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    forgotButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    forgotText: {
        fontSize: 14,
        color: '#94A3B8',
    },
    cardFooter: {
        alignItems: 'center',
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(96, 165, 250, 0.15)',
        marginTop: 8,
    },
    footerText: {
        fontSize: 15,
        color: '#94A3B8',
    },
    signUpLink: {
        color: '#60A5FA',
        fontWeight: '600',
    },
});
