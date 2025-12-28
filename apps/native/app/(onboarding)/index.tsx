/**
 * Onboarding Flow
 * Multi-step profile setup - restored from web version
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronLeft,
    ChevronRight,
    Camera,
    Video as VideoIcon,
    MapPin,
    Check,
    Sparkles,
    Trash2,
    Play,
    X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';

import { useAuth } from '../../hooks/useAuth';
import { getApiBaseUrl, getAbsoluteMediaUrl } from '../../services/apiConfig';
import * as authService from '../../services/authService';

// Constants for file validation
const MAX_VIDEO_SIZE_MB = 100; // Without compression
const MAX_IMAGE_SIZE_MB = 50;

const STEPS = [
    { id: 'name-dob', title: 'Nice to meet you. What\'s your name?', subtitle: 'This is how you\'ll appear to others' },
    { id: 'preferences', title: 'Who are you looking for?', subtitle: 'Help us find your perfect match' },
    { id: 'location', title: 'Where are you located?', subtitle: 'We\'ll use this to show you nearby matches' },
    { id: 'interests', title: 'What are you into?', subtitle: 'Select up to 6 interests to find your match' },
    { id: 'prompts', title: 'Let\'s break the ice', subtitle: 'Share something fun about yourself' },
    { id: 'media', title: 'Add your best shots', subtitle: 'Upload at least 1 photo and 1 video' },
];

const GENDERS = [
    { id: 'woman', label: 'Woman' },
    { id: 'man', label: 'Man' },
    { id: 'non-binary', label: 'Non-binary' },
];

const INTERESTED_IN_OPTIONS = [
    { id: 'men', label: 'Men' },
    { id: 'women', label: 'Women' },
    { id: 'everyone', label: 'Everyone' },
];

const INTERESTS_OPTIONS = [
    'Hiking', 'Cooking', 'Gaming', 'Travel', 'Music', 'Movies', 'Art',
    'Fitness', 'Photography', 'Reading', 'Coffee', 'Wine', 'Dancing',
    'Yoga', 'Pets', 'Nature', 'Tech', 'Fashion', 'Foodie'
];

export default function OnboardingScreen() {
    const { completeOnboarding, logout } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);

    // Form data - matching web version structure
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [interestedIn, setInterestedIn] = useState('everyone');
    const [interests, setInterests] = useState<string[]>([]);
    const [prompts, setPrompts] = useState([
        { question: 'A life goal of mine is...', answer: '' },
        { question: 'My simple pleasures include...', answer: '' }
    ]);
    const [photos, setPhotos] = useState<string[]>([]);
    const [videos, setVideos] = useState<{ url: string, thumbnailUrl?: string }[]>([]);
    const [uploadingSlots, setUploadingSlots] = useState<{ [key: string]: boolean }>({});
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

    // Location state
    const [userLocation, setUserLocation] = useState<{
        coordinates: [number, number];
        city: string;
        state: string;
        country: string;
        locationString: string;
    } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const step = STEPS[currentStep];
    const progress = (currentStep + 1) / STEPS.length;

    // Restore saved onboarding state on mount
    useEffect(() => {
        const restoreState = async () => {
            try {
                const savedState = await authService.getOnboardingState();
                if (savedState) {
                    console.log('📂 Restoring onboarding state from step', savedState.currentStep);
                    setCurrentStep(savedState.currentStep);
                    setName(savedState.name || '');
                    setDob(savedState.dob || '');
                    setGender(savedState.gender || '');
                    setInterestedIn(savedState.interestedIn || 'everyone');
                    setInterests(savedState.interests || []);
                    setPrompts(savedState.prompts || [
                        { question: 'A life goal of mine is...', answer: '' },
                        { question: 'My simple pleasures include...', answer: '' }
                    ]);
                    setPhotos(savedState.photos || []);
                    setVideos(savedState.videos || []);
                    setUserLocation(savedState.userLocation);
                }
            } catch (error) {
                console.error('Failed to restore onboarding state:', error);
            } finally {
                setIsRestoring(false);
            }
        };
        restoreState();
    }, []);

    // Save state whenever form data changes (debounced via step change)
    useEffect(() => {
        if (isRestoring) return; // Don't save while restoring

        const saveState = async () => {
            await authService.saveOnboardingState({
                currentStep,
                name,
                dob,
                gender,
                interestedIn,
                interests,
                prompts,
                photos,
                videos,
                userLocation,
            });
        };
        saveState();
    }, [currentStep, name, dob, gender, interestedIn, interests, prompts, photos, videos, userLocation, isRestoring]);

    // Handle exit from onboarding
    const handleExit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Exit Onboarding?',
            'Your progress will be saved. You can continue later by signing back in.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Exit',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // State is already saved via useEffect
                            // Just logout to return to sign-in
                            await logout();
                        } catch (error) {
                            console.error('Exit failed:', error);
                        }
                    },
                },
            ]
        );
    };

    const canContinue = () => {
        switch (step.id) {
            case 'name-dob':
                return name.trim().length >= 2 && dob.length === 10;
            case 'preferences':
                return !!gender && !!interestedIn;
            case 'location':
                return userLocation !== null;
            case 'interests':
                return interests.length >= 1;
            case 'prompts':
                return prompts.some(p => p.answer.trim().length > 0);
            case 'media':
                return photos.length >= 1 && videos.length >= 1;
            default:
                return false;
        }
    };

    const handleNext = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (currentStep < STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            // Complete onboarding
            setIsLoading(true);
            try {
                // Parse DOB
                const [month, day, year] = dob.split('/');
                const dobDate = new Date(`${year}-${month}-${day}`);

                // Combine prompts into bio
                const combinedBio = prompts.map(p => p.answer).filter(a => a.trim()).join('\n\n');

                await completeOnboarding({
                    name,
                    dob: dobDate.toISOString(),
                    gender,
                    interestedIn,
                    interests,
                    bio: combinedBio,
                    prompts,
                    photos,
                    videos: videos.map(v => v.url),
                    location: userLocation ? {
                        type: 'Point',
                        coordinates: userLocation.coordinates,
                        city: userLocation.city,
                        state: userLocation.state,
                        country: userLocation.country,
                        locationString: userLocation.locationString,
                    } : undefined,
                });
                // Clear saved onboarding state after successful completion
                await authService.clearOnboardingState();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
                console.error('Onboarding failed:', err);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    // Helper: Detect MIME type from file URI
    const getMimeType = (uri: string, fileType: 'image' | 'video'): string => {
        const extension = uri.split('.').pop()?.toLowerCase();
        if (fileType === 'video') {
            switch (extension) {
                case 'mov': return 'video/quicktime';
                case 'mp4': return 'video/mp4';
                case 'm4v': return 'video/x-m4v';
                case '3gp': return 'video/3gpp';
                default: return 'video/mp4';
            }
        } else {
            switch (extension) {
                case 'heic': return 'image/heic';
                case 'heif': return 'image/heif';
                case 'png': return 'image/png';
                case 'webp': return 'image/webp';
                case 'gif': return 'image/gif';
                case 'jpg':
                case 'jpeg':
                default: return 'image/jpeg';
            }
        }
    };

    // Helper: Get file extension from URI
    const getFileExtension = (uri: string): string => {
        const ext = uri.split('.').pop()?.toLowerCase();
        return ext || 'jpg';
    };



    // Upload file with progress tracking
    const uploadFile = async (
        fileUri: string,
        fileType: 'image' | 'video',
        slotKey: string
    ): Promise<string | { url: string; thumbnailUrl?: string }> => {
        return new Promise(async (resolve, reject) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                const token = await authService.getToken();

                if (!token) {
                    throw new Error('Not authenticated');
                }

                // Get file info and validate size
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (!fileInfo.exists) {
                    throw new Error('File does not exist');
                }

                // Note: fileInfo.size may not be available in all cases
                const fileSizeMB = ((fileInfo as any).size || 0) / (1024 * 1024);
                const maxSize = fileType === 'video' ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;

                if (fileSizeMB > maxSize) {
                    throw new Error(`File too large (${Math.round(fileSizeMB)}MB). Maximum size is ${maxSize}MB.`);
                }

                console.log(`📤 Uploading ${fileType}: ${Math.round(fileSizeMB)}MB`);

                // Use original URI (no compression for Expo Go compatibility)
                const finalUri = fileUri;

                // Create FormData
                const formData = new FormData();
                const mimeType = getMimeType(finalUri, fileType);
                const extension = getFileExtension(finalUri);

                formData.append('file', {
                    uri: finalUri,
                    type: mimeType,
                    name: `upload_${Date.now()}.${extension}`
                } as any);

                // Use XMLHttpRequest for progress tracking
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = event.loaded / event.total;
                        setUploadProgress(prev => ({ ...prev, [slotKey]: progress }));
                        console.log(`📊 Upload progress: ${Math.round(progress * 100)}%`);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            console.log('✅ Upload success:', result);
                            if (fileType === 'video') {
                                resolve({ url: result.url, thumbnailUrl: result.thumbnailUrl });
                            } else {
                                resolve(result.url);
                            }
                        } catch (e) {
                            reject(new Error('Invalid server response'));
                        }
                    } else {
                        let errorMessage = 'Upload failed';
                        try {
                            const error = JSON.parse(xhr.responseText);
                            errorMessage = error.message || errorMessage;
                        } catch (e) {
                            // Use default error message
                        }
                        reject(new Error(errorMessage));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });

                xhr.addEventListener('timeout', () => {
                    reject(new Error('Upload timed out. Please try again with a smaller file.'));
                });

                xhr.open('POST', `${API_BASE_URL}/auth/upload`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                // IMPORTANT: Do NOT set Content-Type header - let XHR set it with proper boundary
                xhr.timeout = 300000; // 5 minute timeout for videos
                xhr.send(formData);

            } catch (error) {
                console.error('❌ Upload failed:', error);
                reject(error);
            }
        });
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const slotKey = `photo-${photos.length}`;
                setUploadingSlots(prev => ({ ...prev, [slotKey]: true }));

                try {
                    // Upload image to server
                    const uploadedUrl = await uploadFile(result.assets[0].uri, 'image', slotKey);
                    setPhotos((prev) => [...prev, typeof uploadedUrl === 'string' ? uploadedUrl : (uploadedUrl as any).url]);
                } catch (uploadError) {
                    console.error('Image upload failed:', uploadError);
                    Alert.alert(
                        'Upload Failed',
                        'Failed to upload image. Please try again.',
                        [{ text: 'OK' }]
                    );
                } finally {
                    setUploadingSlots(prev => ({ ...prev, [slotKey]: false }));
                }
            }
        } catch (error) {
            console.error('Image selection failed:', error);
            Alert.alert(
                'Error',
                'Failed to select image. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    const pickVideo = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const slotKey = `video-${videos.length}`;
                setUploadingSlots(prev => ({ ...prev, [slotKey]: true }));

                try {
                    // Upload video to server
                    console.log('📤 Uploading video from:', result.assets[0].uri);
                    const uploadResult = await uploadFile(result.assets[0].uri, 'video', slotKey) as { url: string, thumbnailUrl: string };
                    console.log('✅ Video upload success:', uploadResult);
                    setVideos((prev) => [...prev, uploadResult]);
                } catch (uploadError) {
                    console.error('Video upload failed:', uploadError);
                    Alert.alert(
                        'Upload Failed',
                        'Failed to upload video. Please try again.',
                        [{ text: 'OK' }]
                    );
                } finally {
                    setUploadingSlots(prev => ({ ...prev, [slotKey]: false }));
                }
            }
        } catch (error) {
            console.error('Video selection failed:', error);
            Alert.alert(
                'Error',
                'Failed to select video. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    const toggleInterest = (interest: string) => {
        setInterests(prev => {
            const isSelected = prev.includes(interest);
            if (isSelected) {
                return prev.filter(i => i !== interest);
            } else if (prev.length < 6) {
                return [...prev, interest];
            }
            return prev;
        });
    };

    const updatePrompt = (index: number, answer: string) => {
        const newPrompts = [...prompts];
        newPrompts[index].answer = answer;
        setPrompts(newPrompts);
    };

    const deleteVideo = (index: number) => {
        Alert.alert(
            'Delete Video',
            'Are you sure you want to delete this video?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setVideos(prev => prev.filter((_, i) => i !== index));
                    },
                },
            ]
        );
    };

    // Request user location and reverse geocode
    const requestLocation = async () => {
        setLocationLoading(true);
        setLocationError(null);

        try {
            // Request permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationError('Permission to access location was denied. Please enable it in Settings.');
                setLocationLoading(false);
                return;
            }

            // Get current position
            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = position.coords;

            // Reverse geocode using OpenStreetMap Nominatim (free API)
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
                    {
                        headers: {
                            'User-Agent': 'SlushDatingApp/1.0',
                        },
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    const address = data.address || {};

                    const city = address.city || address.town || address.village || address.municipality || '';
                    const state = address.state || address.county || '';
                    const country = address.country || '';

                    // Build location string
                    const parts = [];
                    if (city) parts.push(city);
                    if (state) parts.push(state);
                    if (country) parts.push(country);
                    const locationString = parts.join(', ') || 'Unknown Location';

                    setUserLocation({
                        coordinates: [longitude, latitude], // GeoJSON format: [lng, lat]
                        city,
                        state,
                        country,
                        locationString,
                    });

                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    // Fallback: use coordinates without reverse geocoding
                    setUserLocation({
                        coordinates: [longitude, latitude],
                        city: '',
                        state: '',
                        country: '',
                        locationString: 'Location set',
                    });
                }
            } catch (geocodeError) {
                console.warn('Reverse geocoding failed:', geocodeError);
                // Fallback: use coordinates without reverse geocoding
                setUserLocation({
                    coordinates: [longitude, latitude],
                    city: '',
                    state: '',
                    country: '',
                    locationString: 'Location set',
                });
            }
        } catch (error: any) {
            console.error('Location error:', error);
            setLocationError(error.message || 'Failed to get location. Please try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLocationLoading(false);
        }
    };


    const renderStepContent = () => {
        switch (step.id) {
            case 'name-dob':
                return (
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Ex. Alex"
                            placeholderTextColor="#64748b"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                            maxLength={30}
                        />
                        <TextInput
                            style={styles.textInput}
                            placeholder="Birthday"
                            placeholderTextColor="#64748b"
                            value={dob}
                            onChangeText={(text) => {
                                // Auto-format as MM/DD/YYYY
                                const cleaned = text.replace(/\D/g, '');
                                let formatted = '';
                                if (cleaned.length > 0) formatted += cleaned.slice(0, 2);
                                if (cleaned.length > 2) formatted += '/' + cleaned.slice(2, 4);
                                if (cleaned.length > 4) formatted += '/' + cleaned.slice(4, 8);
                                setDob(formatted);
                            }}
                            keyboardType="number-pad"
                            maxLength={10}
                        />
                    </View>
                );

            case 'preferences':
                return (
                    <View style={styles.inputWrapper}>
                        <View style={styles.preferenceSection}>
                            <Text style={styles.sectionLabel}>I am a...</Text>
                            <View style={styles.genderGrid}>
                                {GENDERS.map((g) => (
                                    <TouchableOpacity
                                        key={g.id}
                                        style={[
                                            styles.genderOption,
                                            gender === g.id && styles.genderSelected,
                                        ]}
                                        onPress={() => setGender(g.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.genderText,
                                                gender === g.id && styles.genderTextSelected,
                                            ]}
                                        >
                                            {g.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.preferenceSection}>
                            <Text style={styles.sectionLabel}>Interested in...</Text>
                            <View style={styles.genderGrid}>
                                {INTERESTED_IN_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.genderOption,
                                            interestedIn === option.id && styles.genderSelected,
                                        ]}
                                        onPress={() => setInterestedIn(option.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.genderText,
                                                interestedIn === option.id && styles.genderTextSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                );

            case 'location':
                return (
                    <View style={styles.locationWrapper}>
                        {userLocation ? (
                            <View style={styles.locationSuccess}>
                                <View style={styles.locationIconCircle}>
                                    <MapPin size={32} color="#22c55e" />
                                </View>
                                <Text style={styles.locationCity}>{userLocation.locationString}</Text>
                                <Text style={styles.locationSuccessText}>Location set successfully!</Text>
                                <TouchableOpacity
                                    style={styles.locationChangeButton}
                                    onPress={requestLocation}
                                    disabled={locationLoading}
                                >
                                    <Text style={styles.locationChangeText}>Update Location</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.locationPrompt}>
                                <View style={styles.locationIconCircle}>
                                    <MapPin size={32} color="#3B82F6" />
                                </View>
                                <Text style={styles.locationTitle}>Enable Location</Text>
                                <Text style={styles.locationSubtitle}>
                                    We'll use your location to show you nearby matches and events.
                                </Text>
                                {locationError && (
                                    <Text style={styles.locationError}>{locationError}</Text>
                                )}
                                <TouchableOpacity
                                    style={[styles.locationButton, locationLoading && styles.locationButtonDisabled]}
                                    onPress={requestLocation}
                                    disabled={locationLoading}
                                >
                                    {locationLoading ? (
                                        <ActivityIndicator color="#ffffff" size="small" />
                                    ) : (
                                        <>
                                            <MapPin size={20} color="#ffffff" />
                                            <Text style={styles.locationButtonText}>Allow Location Access</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                );

            case 'interests':
                return (
                    <View style={styles.interestsWrapper}>
                        <Text style={styles.interestsHint}>
                            Select up to 6 interests to find your match
                        </Text>
                        <View style={styles.interestsGrid}>
                            {INTERESTS_OPTIONS.map((interest) => {
                                const isSelected = interests.includes(interest);
                                return (
                                    <TouchableOpacity
                                        key={interest}
                                        style={[
                                            styles.interestItem,
                                            isSelected && styles.interestSelected,
                                        ]}
                                        onPress={() => toggleInterest(interest)}
                                    >
                                        <Text
                                            style={[
                                                styles.interestText,
                                                isSelected && styles.interestTextSelected,
                                            ]}
                                        >
                                            {interest}
                                        </Text>
                                        {isSelected && <Check size={14} color="#3B82F6" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );

            case 'prompts':
                return (
                    <View style={styles.inputWrapper}>
                        {prompts.map((prompt, index) => (
                            <View key={index} style={styles.promptSection}>
                                <Text style={styles.promptQuestion}>{prompt.question}</Text>
                                <TextInput
                                    style={[styles.textInput, styles.promptInput]}
                                    placeholder="Share something fun..."
                                    placeholderTextColor="#64748b"
                                    value={prompt.answer}
                                    onChangeText={(text) => updatePrompt(index, text)}
                                    multiline
                                    maxLength={200}
                                />
                            </View>
                        ))}
                    </View>
                );

            case 'media':
                return (
                    <View style={styles.mediaWrapper}>
                        <View style={styles.mediaSection}>
                            <Text style={styles.mediaSectionTitle}>Photos</Text>
                            <View style={styles.photosGrid}>
                                {Array.from({ length: 4 }).map((_, index) => {
                                    const slotKey = `photo-${index}`;
                                    const upProgress = uploadProgress[slotKey];
                                    return (
                                        <TouchableOpacity
                                            key={slotKey}
                                            style={styles.mediaSlot}
                                            onPress={photos[index] || uploadingSlots[slotKey] ? undefined : pickImage}
                                        >
                                            {uploadingSlots[slotKey] ? (
                                                <View style={styles.loadingOverlay}>
                                                    <ActivityIndicator color="#3B82F6" />
                                                    <Text style={styles.loadingText}>
                                                        {upProgress ? `Uploading: ${Math.round(upProgress * 100)}%` : 'Uploading...'}
                                                    </Text>
                                                </View>
                                            ) : photos[index] ? (
                                                <Image
                                                    source={{ uri: getAbsoluteMediaUrl(photos[index]) }}
                                                    style={styles.media}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={styles.iconContainer}>
                                                    <Camera size={24} color="#64748b" />
                                                    <Text style={styles.uploadHint}>Tap to add photo</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.mediaSection}>
                            <Text style={styles.mediaSectionTitle}>Videos</Text>
                            <View style={styles.photosGrid}>
                                {Array.from({ length: 2 }).map((_, index) => {
                                    const slotKey = `video-${index}`;
                                    const upProgress = uploadProgress[slotKey];
                                    return (
                                        <TouchableOpacity
                                            key={slotKey}
                                            style={styles.mediaSlot}
                                            onPress={videos[index] || uploadingSlots[slotKey] ? undefined : pickVideo}
                                        >
                                            {uploadingSlots[slotKey] ? (
                                                <View style={styles.loadingOverlay}>
                                                    <ActivityIndicator color="#3B82F6" />
                                                    <Text style={styles.loadingText}>
                                                        {upProgress
                                                            ? `Uploading: ${Math.round(upProgress * 100)}%`
                                                            : 'Uploading...'
                                                        }
                                                    </Text>
                                                </View>
                                            ) : videos[index] ? (
                                                <View style={styles.videoPreviewContainer}>
                                                    {videos[index].thumbnailUrl ? (
                                                        <Image
                                                            source={{ uri: getAbsoluteMediaUrl(videos[index].thumbnailUrl || '') }}
                                                            style={styles.media}
                                                            resizeMode="cover"
                                                        />
                                                    ) : (
                                                        <View style={styles.videoPlaceholder}>
                                                            <VideoIcon size={32} color="#64748b" />
                                                        </View>
                                                    )}
                                                    <View style={styles.playIconOverlay}>
                                                        <Play size={24} color="#fff" fill="#fff" />
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.deleteButton}
                                                        onPress={() => deleteVideo(index)}
                                                    >
                                                        <Trash2 size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View style={styles.iconContainer}>
                                                    <VideoIcon size={24} color="#64748b" />
                                                    <Text style={styles.uploadHint}>Tap to add video</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        {currentStep > 0 ? (
                            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                <ChevronLeft size={24} color="#64748b" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.backButton} />
                        )}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View
                                    style={[styles.progressFill, { width: `${progress * 100}%` }]}
                                />
                            </View>
                            <Text style={styles.stepText}>
                                {currentStep + 1} of {STEPS.length}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
                            <X size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Title */}
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>{step.title}</Text>
                            <Text style={styles.subtitle}>{step.subtitle}</Text>
                        </View>

                        {/* Content */}
                        {renderStepContent()}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                !canContinue() && styles.buttonDisabled,
                            ]}
                            onPress={handleNext}
                            disabled={!canContinue() || isLoading}
                        >
                            <LinearGradient
                                colors={canContinue() ? ['#3B82F6', '#60A5FA'] : ['#374151', '#374151']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Text style={styles.continueText}>
                                            {currentStep === STEPS.length - 1 ? 'Finish' : 'Continue'}
                                        </Text>
                                        {currentStep === STEPS.length - 1 ? (
                                            <Sparkles size={20} color="#ffffff" />
                                        ) : (
                                            <ChevronRight size={20} color="#ffffff" />
                                        )}
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    exitButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        flex: 1,
        gap: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 2,
    },
    stepText: {
        fontSize: 12,
        color: '#64748b',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    titleContainer: {
        marginTop: 24,
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1A202C',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#4A5568',
    },
    inputWrapper: {
        gap: 8,
    },
    textInput: {
        backgroundColor: '#F8F9FA',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 18,
        color: '#1A202C',
    },
    bioInput: {
        height: 150,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'right',
    },
    genderGrid: {
        gap: 12,
    },
    genderOption: {
        backgroundColor: '#F8F9FA',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        padding: 20,
        alignItems: 'center',
    },
    genderSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#DBEAFE',
    },
    genderText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#4A5568',
    },
    genderTextSelected: {
        color: '#3B82F6',
    },
    photosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    photoSlot: {
        width: '30%',
        aspectRatio: 0.75,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    locationWrapper: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    locationPrompt: {
        alignItems: 'center',
        gap: 16,
    },
    locationIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0F9FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1A202C',
        textAlign: 'center',
    },
    locationSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    locationError: {
        fontSize: 14,
        color: '#ef4444',
        textAlign: 'center',
        marginTop: 8,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        marginTop: 16,
        minWidth: 220,
    },
    locationButtonDisabled: {
        opacity: 0.6,
    },
    locationButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    locationSuccess: {
        alignItems: 'center',
        gap: 12,
    },
    locationCity: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1A202C',
    },
    locationSuccessText: {
        fontSize: 14,
        color: '#22c55e',
    },
    locationChangeButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    locationChangeText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3B82F6',
    },
    locationText: {
        fontSize: 14,
        color: '#22c55e',
    },
    preferenceSection: {
        gap: 16,
        marginBottom: 32,
    },
    sectionLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A202C',
        marginBottom: 12,
    },
    interestsWrapper: {
        gap: 24,
    },
    interestsHint: {
        fontSize: 16,
        color: '#4A5568',
        textAlign: 'center',
        marginBottom: 8,
    },
    interestsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    interestItem: {
        backgroundColor: '#F8F9FA',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 80,
    },
    interestSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#DBEAFE',
    },
    interestText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4A5568',
    },
    interestTextSelected: {
        color: '#3B82F6',
    },
    promptSection: {
        gap: 12,
        marginBottom: 24,
    },
    promptQuestion: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A202C',
    },
    promptInput: {
        height: 80,
        textAlignVertical: 'top',
    },
    mediaWrapper: {
        gap: 20,
    },
    mediaSection: {
        gap: 12,
    },
    mediaSectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1A202C',
    },
    mediaHint: {
        fontSize: 12,
        color: '#64748b',
    },
    mediaSlot: {
        flex: 1,
        maxWidth: '48%',
        aspectRatio: 0.75,
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginHorizontal: 2,
    },
    media: {
        width: '100%',
        height: '100%',
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    videoPreview: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoPreviewContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIconOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -20 }, { translateY: -20 }],
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadHint: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },
    videoText: {
        fontSize: 10,
        color: '#64748b',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    loadingText: {
        fontSize: 10,
        color: '#3B82F6',
        marginTop: 8,
        textAlign: 'center',
        fontWeight: '600',
    },
    deleteButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        padding: 24,
    },
    continueButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 8,
    },
    continueText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
});
