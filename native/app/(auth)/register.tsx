/**
 * Register Screen
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';

export default function RegisterScreen() {
    const router = useRouter();
    const { register } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please fill in all fields');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await register(email.trim().toLowerCase(), password);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Navigation will be handled by the root layout based on auth state
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
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
            <View style={[styles.backgroundOrb, styles.orb1]} />
            <View style={[styles.backgroundOrb, styles.orb2]} />
            <View style={[styles.backgroundOrb, styles.orb3]} />
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                <ArrowLeft size={24} color="#1f2937" />
                            </TouchableOpacity>
                        </View>

                        {/* Title */}
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>Slush<Text style={styles.titleAccent}>Dating</Text></Text>
                            <Text style={styles.subtitle}>Create your account</Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            {error ? (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <View style={styles.inputContainer}>
                                <Mail size={20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    placeholderTextColor="#9ca3af"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    editable={!isLoading}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#9ca3af"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoComplete="new-password"
                                    editable={!isLoading}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeButton}
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} color="#94a3b8" />
                                    ) : (
                                        <Eye size={20} color="#94a3b8" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputContainer, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}>
                                <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: '#1f2937' }]}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#9ca3af"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoComplete="new-password"
                                    editable={!isLoading}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.registerButton, isLoading && styles.buttonDisabled]}
                                onPress={handleRegister}
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
                                        <Text style={styles.registerButtonText}>Create Account</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <Text style={styles.termsText}>
                                By signing up, you agree to our{' '}
                                <Text style={styles.link}>Terms of Service</Text> and{' '}
                                <Text style={styles.link}>Privacy Policy</Text>
                            </Text>
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Already have an account?{' '}
                                <Text
                                    style={styles.signInLink}
                                    onPress={() => router.push('/(auth)/login')}
                                >
                                    Sign In
                                </Text>
                            </Text>
                        </View>
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
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    header: {
        paddingTop: 8,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    titleContainer: {
        marginTop: 32,
        marginBottom: 32,
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
        flex: 1,
        gap: 16,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#ef4444',
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
        color: '#1f2937',
        fontSize: 16,
    },
    eyeButton: {
        padding: 8,
        marginRight: -8,
    },
    registerButton: {
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
        paddingVertical: 18,
        alignItems: 'center',
    },
    registerButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    termsText: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 18,
    },
    link: {
        color: '#3b82f6',
    },
    footer: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 16,
        color: '#94a3b8',
    },
    signInLink: {
        color: '#3b82f6',
        fontWeight: '600',
    },
});
