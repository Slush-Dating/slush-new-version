/**
 * Edit Profile Screen
 * Allow users to edit their profile information
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Save,
    User,
    MapPin,
    Briefcase,
    Heart,
    Plus,
    X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../../hooks/useAuth';
import { useBackNavigation } from '../../../hooks/useBackNavigation';

const INTERESTS_OPTIONS = [
    'Travelling', 'Music', 'Sports', 'Reading', 'Cooking', 'Photography',
    'Art', 'Dancing', 'Movies', 'Gaming', 'Fitness', 'Yoga',
    'Hiking', 'Writing', 'Gardening', 'Volunteering', 'Technology', 'Fashion'
];

export default function EditProfileScreen() {
    const router = useRouter();
    const { user, updateUser } = useAuth();
    const handleBack = useBackNavigation('/(main)/profile');

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [profession, setProfession] = useState((user as any)?.profession || '');
    const [location, setLocation] = useState({
        city: user?.location?.city || '',
        state: user?.location?.state || '',
        country: user?.location?.country || '',
    });
    const [interests, setInterests] = useState<string[]>(user?.interests || []);
    const [customInterest, setCustomInterest] = useState('');

    useEffect(() => {
        // Update form when user data changes
        if (user) {
            setName(user.name || '');
            setBio(user.bio || '');
            setProfession((user as any)?.profession || '');
            setLocation({
                city: user.location?.city || '',
                state: user.location?.state || '',
                country: user.location?.country || '',
            });
            setInterests(user.interests || []);
        }
    }, [user]);

    const handleBackPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleBack();
    };

    const handleSave = async () => {
        // Basic validation
        if (!name.trim()) {
            Alert.alert('Error', 'Name is required');
            return;
        }

        if (name.trim().length < 2) {
            Alert.alert('Error', 'Name must be at least 2 characters long');
            return;
        }

        if (bio && bio.length > 500) {
            Alert.alert('Error', 'Bio must be 500 characters or less');
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Build location update with only serializable fields
            const updatedLocation = location.city || location.state || location.country ? {
                type: user?.location?.type || 'Point',
                coordinates: user?.location?.coordinates || [0, 0],
                city: location.city.trim(),
                state: location.state.trim(),
                country: location.country.trim(),
                locationString: user?.location?.locationString || '',
            } : user?.location ? {
                type: user.location.type || 'Point',
                coordinates: user.location.coordinates || [0, 0],
                city: user.location.city || '',
                state: user.location.state || '',
                country: user.location.country || '',
                locationString: user.location.locationString || '',
            } : undefined;

            const updates = {
                name: name.trim(),
                bio: bio.trim(),
                profession: profession.trim(),
                interests: interests,
                location: updatedLocation,
            };


            await updateUser(updates);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Success',
                'Profile updated successfully!',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            console.error('Failed to update profile:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                'Error',
                error.message || 'Failed to update profile. Please try again.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const toggleInterest = (interest: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const addCustomInterest = () => {
        const trimmed = customInterest.trim();
        if (!trimmed) return;

        if (interests.includes(trimmed)) {
            Alert.alert('Error', 'This interest is already added');
            return;
        }

        if (interests.length >= 10) {
            Alert.alert('Error', 'You can add up to 10 interests');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setInterests(prev => [...prev, trimmed]);
        setCustomInterest('');
    };

    const removeInterest = (interest: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setInterests(prev => prev.filter(i => i !== interest));
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                        <ArrowLeft size={24} color="#1A202C" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Edit Profile</Text>
                    <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Save size={20} color="#ffffff" />
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Name */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <User size={20} color="#94a3b8" />
                            <Text style={styles.sectionTitle}>Name</Text>
                        </View>
                        <TextInput
                            style={styles.textInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter your name"
                            maxLength={50}
                        />
                    </View>

                    {/* Profession */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Briefcase size={20} color="#94a3b8" />
                            <Text style={styles.sectionTitle}>Profession</Text>
                        </View>
                        <TextInput
                            style={styles.textInput}
                            value={profession}
                            onChangeText={setProfession}
                            placeholder="Enter your profession"
                            maxLength={100}
                        />
                    </View>

                    {/* Location */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MapPin size={20} color="#94a3b8" />
                            <Text style={styles.sectionTitle}>Location</Text>
                        </View>
                        <View style={styles.locationInputs}>
                            <TextInput
                                style={[styles.textInput, styles.locationInput]}
                                value={location.city}
                                onChangeText={(text) => setLocation(prev => ({ ...prev, city: text }))}
                                placeholder="City"
                                maxLength={50}
                            />
                            <TextInput
                                style={[styles.textInput, styles.locationInput]}
                                value={location.state}
                                onChangeText={(text) => setLocation(prev => ({ ...prev, state: text }))}
                                placeholder="State"
                                maxLength={50}
                            />
                            <TextInput
                                style={[styles.textInput, styles.locationInput]}
                                value={location.country}
                                onChangeText={(text) => setLocation(prev => ({ ...prev, country: text }))}
                                placeholder="Country"
                                maxLength={50}
                            />
                        </View>
                    </View>

                    {/* Bio */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>About Me</Text>
                            <Text style={styles.charCount}>{bio.length}/500</Text>
                        </View>
                        <TextInput
                            style={[styles.textInput, styles.bioInput]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell others about yourself..."
                            multiline
                            maxLength={500}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Interests */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Heart size={20} color="#94a3b8" />
                            <Text style={styles.sectionTitle}>Interests</Text>
                        </View>

                        {/* Selected Interests */}
                        {interests.length > 0 && (
                            <View style={styles.selectedInterests}>
                                {interests.map((interest) => (
                                    <View key={interest} style={styles.selectedInterestTag}>
                                        <Text style={styles.selectedInterestText}>{interest}</Text>
                                        <TouchableOpacity
                                            onPress={() => removeInterest(interest)}
                                            style={styles.removeInterestButton}
                                        >
                                            <X size={14} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Add Custom Interest */}
                        <View style={styles.customInterestContainer}>
                            <TextInput
                                style={[styles.textInput, styles.customInterestInput]}
                                value={customInterest}
                                onChangeText={setCustomInterest}
                                placeholder="Add custom interest..."
                                maxLength={30}
                                onSubmitEditing={addCustomInterest}
                            />
                            <TouchableOpacity
                                onPress={addCustomInterest}
                                style={styles.addCustomButton}
                                disabled={!customInterest.trim()}
                            >
                                <Plus size={20} color={customInterest.trim() ? "#3B82F6" : "#94a3b8"} />
                            </TouchableOpacity>
                        </View>

                        {/* Interest Options */}
                        <Text style={styles.interestsSubtitle}>Choose from popular interests:</Text>
                        <View style={styles.interestsGrid}>
                            {INTERESTS_OPTIONS.map((interest) => (
                                <TouchableOpacity
                                    key={interest}
                                    onPress={() => toggleInterest(interest)}
                                    style={[
                                        styles.interestOption,
                                        interests.includes(interest) && styles.interestOptionSelected,
                                    ]}
                                    disabled={interests.length >= 10 && !interests.includes(interest)}
                                >
                                    <Text style={[
                                        styles.interestOptionText,
                                        interests.includes(interest) && styles.interestOptionTextSelected,
                                    ]}>
                                        {interest}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.interestsLimit}>
                            {interests.length}/10 interests selected
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
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
    saveButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#94a3b8',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    section: {
        backgroundColor: '#ffffff',
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A202C',
    },
    charCount: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 'auto',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1A202C',
        backgroundColor: '#ffffff',
    },
    bioInput: {
        height: 100,
        textAlignVertical: 'top',
    },
    locationInputs: {
        gap: 12,
    },
    locationInput: {
        flex: 1,
    },
    selectedInterests: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    selectedInterestTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF4FF',
        borderWidth: 1,
        borderColor: '#3B82F6',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
    },
    selectedInterestText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
    },
    removeInterestButton: {
        padding: 2,
    },
    customInterestContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    customInterestInput: {
        flex: 1,
    },
    addCustomButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    interestsSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    interestsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    interestOption: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#ffffff',
    },
    interestOptionSelected: {
        backgroundColor: '#EBF4FF',
        borderColor: '#3B82F6',
    },
    interestOptionText: {
        fontSize: 14,
        color: '#64748b',
    },
    interestOptionTextSelected: {
        color: '#3B82F6',
        fontWeight: '500',
    },
    interestsLimit: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 12,
    },
});
