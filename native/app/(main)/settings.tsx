/**
 * Settings Screen
 * User preferences, privacy, and account management
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    User,
    Bell,
    Lock,
    Eye,
    MapPin,
    Sliders,
    HelpCircle,
    Info,
    Trash2,
    LogOut,
    ChevronRight,
    Shield,
    Globe,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';

interface UserSettings {
    notifications: boolean;
    showOnlineStatus: boolean;
    distancePreference: number;
    ageRangeMin: number;
    ageRangeMax: number;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<UserSettings>({
        notifications: true,
        showOnlineStatus: true,
        distancePreference: 50,
        ageRangeMin: 18,
        ageRangeMax: 50,
    });

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const handleToggle = (key: keyof UserSettings) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSettings((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
        // TODO: Save to backend
    };

    const handleSliderChange = (key: keyof UserSettings, value: number) => {
        setSettings((prev) => ({
            ...prev,
            [key]: Math.round(value),
        }));
    };

    const handleLogout = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implement account deletion
                        Alert.alert('Account Deleted', 'Your account has been deleted.');
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <ArrowLeft size={24} color="#1A202C" />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.sectionContent}>
                        <SettingsRow
                            icon={<User size={20} color="#94a3b8" />}
                            title="Edit Profile"
                            onPress={() => {
                                // TODO: Navigate to edit profile
                            }}
                            showArrow
                        />
                        <SettingsRow
                            icon={<Lock size={20} color="#94a3b8" />}
                            title="Change Password"
                            onPress={() => { }}
                            showArrow
                        />
                    </View>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.sectionContent}>
                        <View style={styles.sliderRow}>
                            <View style={styles.sliderHeader}>
                                <MapPin size={20} color="#94a3b8" />
                                <Text style={styles.rowTitle}>Distance</Text>
                                <Text style={styles.sliderValue}>{settings.distancePreference} km</Text>
                            </View>
                            <Slider
                                style={styles.slider}
                                minimumValue={5}
                                maximumValue={100}
                                value={settings.distancePreference}
                                onValueChange={(v) => handleSliderChange('distancePreference', v)}
                                minimumTrackTintColor="#3B82F6"
                                maximumTrackTintColor="#E5E7EB"
                                thumbTintColor="#3B82F6"
                            />
                        </View>

                        <View style={styles.sliderRow}>
                            <View style={styles.sliderHeader}>
                                <Sliders size={20} color="#94a3b8" />
                                <Text style={styles.rowTitle}>Age Range</Text>
                                <Text style={styles.sliderValue}>
                                    {settings.ageRangeMin} - {settings.ageRangeMax}
                                </Text>
                            </View>
                            <View style={styles.doubleSlider}>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={18}
                                    maximumValue={settings.ageRangeMax - 1}
                                    value={settings.ageRangeMin}
                                    onValueChange={(v) => handleSliderChange('ageRangeMin', v)}
                                    minimumTrackTintColor="#E5E7EB"
                                    maximumTrackTintColor="#3B82F6"
                                    thumbTintColor="#3B82F6"
                                />
                                <Slider
                                    style={styles.slider}
                                    minimumValue={settings.ageRangeMin + 1}
                                    maximumValue={80}
                                    value={settings.ageRangeMax}
                                    onValueChange={(v) => handleSliderChange('ageRangeMax', v)}
                                    minimumTrackTintColor="#3B82F6"
                                    maximumTrackTintColor="#E5E7EB"
                                    thumbTintColor="#3B82F6"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Privacy Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy</Text>
                    <View style={styles.sectionContent}>
                        <SettingsToggleRow
                            icon={<Eye size={20} color="#94a3b8" />}
                            title="Show Online Status"
                            value={settings.showOnlineStatus}
                            onToggle={() => handleToggle('showOnlineStatus')}
                        />
                    </View>
                </View>

                {/* Notifications Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications</Text>
                    <View style={styles.sectionContent}>
                        <SettingsToggleRow
                            icon={<Bell size={20} color="#94a3b8" />}
                            title="Push Notifications"
                            value={settings.notifications}
                            onToggle={() => handleToggle('notifications')}
                        />
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <View style={styles.sectionContent}>
                        <SettingsRow
                            icon={<HelpCircle size={20} color="#94a3b8" />}
                            title="Help & FAQ"
                            onPress={() => { }}
                            showArrow
                        />
                        <SettingsRow
                            icon={<Shield size={20} color="#94a3b8" />}
                            title="Privacy Policy"
                            onPress={() => { }}
                            showArrow
                        />
                        <SettingsRow
                            icon={<Info size={20} color="#94a3b8" />}
                            title="Terms of Service"
                            onPress={() => { }}
                            showArrow
                        />
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <View style={styles.sectionContent}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <LogOut size={20} color="#ef4444" />
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                            <Trash2 size={20} color="#ef4444" />
                            <Text style={styles.deleteText}>Delete Account</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Version */}
                <Text style={styles.version}>Version 1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function SettingsRow({
    icon,
    title,
    onPress,
    showArrow,
}: {
    icon: React.ReactNode;
    title: string;
    onPress: () => void;
    showArrow?: boolean;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress}>
            {icon}
            <Text style={styles.rowTitle}>{title}</Text>
            {showArrow && <ChevronRight size={20} color="#64748b" />}
        </TouchableOpacity>
    );
}

function SettingsToggleRow({
    icon,
    title,
    value,
    onToggle,
}: {
    icon: React.ReactNode;
    title: string;
    value: boolean;
    onToggle: () => void;
}) {
    return (
        <View style={styles.row}>
            {icon}
            <Text style={styles.rowTitle}>{title}</Text>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                thumbColor="#ffffff"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
        color: '#1A202C',
    },
    placeholder: {
        width: 40,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#718096',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    sectionContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    rowTitle: {
        flex: 1,
        fontSize: 16,
        color: '#1A202C',
    },
    sliderRow: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    sliderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    sliderValue: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    doubleSlider: {
        gap: 8,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ef4444',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    deleteText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ef4444',
    },
    version: {
        textAlign: 'center',
        fontSize: 12,
        color: '#64748b',
        marginVertical: 24,
    },
});
