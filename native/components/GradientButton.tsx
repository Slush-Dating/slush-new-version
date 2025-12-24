/**
 * Gradient Button Component
 */

import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface GradientButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    style?: ViewStyle;
    textStyle?: TextStyle;
}

const GRADIENT_COLORS = {
    primary: ['#ec4899', '#f472b6'] as const,
    secondary: ['#3b82f6', '#60a5fa'] as const,
    danger: ['#ef4444', '#f87171'] as const,
};

export function GradientButton({
    title,
    onPress,
    loading = false,
    disabled = false,
    variant = 'primary',
    size = 'medium',
    style,
    textStyle,
}: GradientButtonProps) {
    const handlePress = () => {
        if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
        }
    };

    const buttonHeight = {
        small: 40,
        medium: 52,
        large: 60,
    }[size];

    const fontSize = {
        small: 14,
        medium: 16,
        large: 18,
    }[size];

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { opacity: disabled || loading ? 0.6 : 1 },
                style,
            ]}
            onPress={handlePress}
            activeOpacity={0.8}
            disabled={disabled || loading}
        >
            <LinearGradient
                colors={disabled ? ['#374151', '#374151'] : GRADIENT_COLORS[variant]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.gradient, { height: buttonHeight }]}
            >
                {loading ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <Text style={[styles.text, { fontSize }, textStyle]}>{title}</Text>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    gradient: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    text: {
        color: '#ffffff',
        fontWeight: '600',
    },
});

export default GradientButton;
