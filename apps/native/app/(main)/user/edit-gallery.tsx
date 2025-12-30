/**
 * Edit Gallery Screen
 * Allow users to manage their photos and videos
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import {
    ArrowLeft,
    Save,
    Plus,
    X,
    Play,
    Image as ImageIcon,
    Video as VideoIcon,
} from 'lucide-react-native';

import { useAuth } from '../../../hooks/useAuth';
import { useBackNavigation } from '../../../hooks/useBackNavigation';
import { getApiBaseUrl, getAbsoluteMediaUrl } from '../../../services/apiConfig';
import * as authService from '../../../services/authService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_COLUMNS = 3;
const SLOT_SIZE = (SCREEN_WIDTH - 48 - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 3;
const MAX_VIDEO_SIZE_MB = 100;
const MAX_IMAGE_SIZE_MB = 50;

export default function EditGalleryScreen() {
    const router = useRouter();
    const { user, updateUser } = useAuth();
    const handleBack = useBackNavigation('/(main)/profile');

    const [photos, setPhotos] = useState<string[]>([]);
    const [videos, setVideos] = useState<string[]>([]);
    const [uploadingSlots, setUploadingSlots] = useState<{ [key: string]: boolean }>({});
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize with user data
    useEffect(() => {
        if (user) {
            setPhotos(user.photos || []);
            setVideos(user.videos || []);
        }
    }, [user]);

    // Helper: Detect MIME type from file URI
    const getMimeType = (uri: string, fileType: 'image' | 'video', assetMimeType?: string): string => {
        if (assetMimeType) return assetMimeType;

        const extension = uri.split('.').pop()?.toLowerCase();

        if (fileType === 'video') {
            switch (extension) {
                case 'mov': return 'video/quicktime';
                case 'mp4': return 'video/mp4';
                case 'm4v': return 'video/x-m4v';
                default: return 'video/mp4';
            }
        } else {
            switch (extension) {
                case 'heic': return 'image/heic';
                case 'png': return 'image/png';
                case 'webp': return 'image/webp';
                default: return 'image/jpeg';
            }
        }
    };

    // Upload file function
    const uploadFile = async (
        fileUri: string,
        fileType: 'image' | 'video',
        slotKey: string,
        assetMimeType?: string
    ): Promise<string> => {
        const API_BASE_URL = getApiBaseUrl();
        const token = await authService.getToken();

        if (!token) {
            throw new Error('Not authenticated. Please log in again.');
        }

        // Normalize file URI
        let finalUri = fileUri;
        if (Platform.OS === 'ios' && !fileUri.startsWith('file://') && !fileUri.startsWith('ph://')) {
            finalUri = `file://${fileUri}`;
        }

        // Validate file exists
        const fileInfo = await FileSystem.getInfoAsync(finalUri);
        if (!fileInfo.exists) {
            if (finalUri.startsWith('file://')) {
                const altUri = finalUri.replace('file://', '');
                const altInfo = await FileSystem.getInfoAsync(altUri);
                if (altInfo.exists) {
                    finalUri = altUri;
                } else {
                    throw new Error('File does not exist.');
                }
            } else {
                throw new Error('File does not exist.');
            }
        }

        // Validate file size
        const fileSize = (fileInfo as any).size || 0;
        const fileSizeMB = fileSize / (1024 * 1024);
        const maxSize = fileType === 'video' ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;

        if (fileSizeMB > maxSize) {
            throw new Error(`File too large (${Math.round(fileSizeMB)}MB). Maximum size is ${maxSize}MB.`);
        }

        const mimeType = getMimeType(finalUri, fileType, assetMimeType);
        const extension = finalUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `upload_${Date.now()}.${extension}`;

        const formData = new FormData();
        const fileData: any = {
            uri: Platform.OS === 'ios' ? finalUri.replace('file://', '') : finalUri,
            type: mimeType,
            name: fileName,
        };

        if (Platform.OS === 'android') {
            fileData.uri = finalUri;
        }

        formData.append('file', fileData);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && event.total > 0) {
                    const progress = event.loaded / event.total;
                    setUploadProgress(prev => ({ ...prev, [slotKey]: progress }));
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result.url || result.originalUrl);
                    } catch {
                        reject(new Error('Invalid server response.'));
                    }
                } else {
                    let errorMessage = `Upload failed (${xhr.status})`;
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        errorMessage = errorResponse.message || errorMessage;
                    } catch { }
                    reject(new Error(errorMessage));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
            xhr.addEventListener('timeout', () => reject(new Error('Upload timed out.')));

            const uploadUrl = `${API_BASE_URL}/auth/upload`;
            xhr.open('POST', uploadUrl);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.timeout = fileType === 'video' ? 300000 : 120000;
            xhr.send(formData);
        });
    };

    const pickAndUploadImage = async (slotIndex: number) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant photo library access to upload images.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const slotKey = `photo-${slotIndex}`;
                setUploadingSlots(prev => ({ ...prev, [slotKey]: true }));
                setUploadProgress(prev => ({ ...prev, [slotKey]: 0 }));

                try {
                    const uploadedUrl = await uploadFile(asset.uri, 'image', slotKey, asset.mimeType);
                    setPhotos(prev => {
                        const newPhotos = [...prev];
                        if (slotIndex < newPhotos.length) {
                            newPhotos[slotIndex] = uploadedUrl;
                        } else {
                            newPhotos.push(uploadedUrl);
                        }
                        return newPhotos;
                    });
                    setHasChanges(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (error: any) {
                    Alert.alert('Upload Failed', error.message || 'Failed to upload image.');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } finally {
                    setUploadingSlots(prev => ({ ...prev, [slotKey]: false }));
                    setUploadProgress(prev => {
                        const updated = { ...prev };
                        delete updated[slotKey];
                        return updated;
                    });
                }
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to select image.');
        }
    };

    const pickAndUploadVideo = async (slotIndex: number) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant photo library access to upload videos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 0.8,
                videoMaxDuration: 30,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const slotKey = `video-${slotIndex}`;
                setUploadingSlots(prev => ({ ...prev, [slotKey]: true }));
                setUploadProgress(prev => ({ ...prev, [slotKey]: 0 }));

                try {
                    const uploadedUrl = await uploadFile(asset.uri, 'video', slotKey, asset.mimeType);
                    setVideos(prev => {
                        const newVideos = [...prev];
                        if (slotIndex < newVideos.length) {
                            newVideos[slotIndex] = uploadedUrl;
                        } else {
                            newVideos.push(uploadedUrl);
                        }
                        return newVideos;
                    });
                    setHasChanges(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (error: any) {
                    Alert.alert('Upload Failed', error.message || 'Failed to upload video.');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } finally {
                    setUploadingSlots(prev => ({ ...prev, [slotKey]: false }));
                    setUploadProgress(prev => {
                        const updated = { ...prev };
                        delete updated[slotKey];
                        return updated;
                    });
                }
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to select video.');
        }
    };

    const deletePhoto = (index: number) => {
        Alert.alert(
            'Delete Photo',
            'Are you sure you want to delete this photo?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setPhotos(prev => prev.filter((_, i) => i !== index));
                        setHasChanges(true);
                    },
                },
            ]
        );
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
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setVideos(prev => prev.filter((_, i) => i !== index));
                        setHasChanges(true);
                    },
                },
            ]
        );
    };

    const handleSave = async () => {
        if (!hasChanges) {
            handleBack();
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await updateUser({ photos, videos });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Success',
                'Gallery updated successfully!',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to update gallery.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackPress = () => {
        if (hasChanges) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to leave?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: handleBack },
                ]
            );
        } else {
            handleBack();
        }
    };

    const renderPhotoSlot = (index: number) => {
        const photo = photos[index];
        const slotKey = `photo-${index}`;
        const isUploading = uploadingSlots[slotKey];
        const progress = uploadProgress[slotKey] || 0;

        if (isUploading) {
            return (
                <View key={slotKey} style={styles.slot}>
                    <View style={styles.uploadingOverlay}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
                    </View>
                </View>
            );
        }

        if (photo) {
            return (
                <View key={slotKey} style={styles.slot}>
                    <Image
                        source={{ uri: getAbsoluteMediaUrl(photo) }}
                        style={styles.slotMedia}
                        resizeMode="cover"
                    />
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deletePhoto(index)}
                    >
                        <X size={16} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableOpacity
                key={slotKey}
                style={[styles.slot, styles.emptySlot]}
                onPress={() => pickAndUploadImage(index)}
            >
                <Plus size={32} color="#94a3b8" />
            </TouchableOpacity>
        );
    };

    const renderVideoSlot = (index: number) => {
        const video = videos[index];
        const slotKey = `video-${index}`;
        const isUploading = uploadingSlots[slotKey];
        const progress = uploadProgress[slotKey] || 0;

        if (isUploading) {
            return (
                <View key={slotKey} style={styles.slot}>
                    <View style={styles.uploadingOverlay}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
                    </View>
                </View>
            );
        }

        if (video) {
            return (
                <View key={slotKey} style={styles.slot}>
                    <Video
                        source={{ uri: getAbsoluteMediaUrl(video) }}
                        style={styles.slotMedia}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        isMuted
                    />
                    <View style={styles.videoOverlay}>
                        <Play size={24} color="#ffffff" fill="#ffffff" />
                    </View>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteVideo(index)}
                    >
                        <X size={16} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableOpacity
                key={slotKey}
                style={[styles.slot, styles.emptySlot]}
                onPress={() => pickAndUploadVideo(index)}
            >
                <Plus size={32} color="#94a3b8" />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                    <ArrowLeft size={24} color="#1A202C" />
                </TouchableOpacity>
                <Text style={styles.title}>Edit Gallery</Text>
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
                contentContainerStyle={styles.scrollContent}
            >
                {/* Photos Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ImageIcon size={20} color="#3B82F6" />
                        <Text style={styles.sectionTitle}>Photos</Text>
                        <Text style={styles.sectionCount}>{photos.length}/{MAX_PHOTOS}</Text>
                    </View>
                    <Text style={styles.sectionHint}>Add up to {MAX_PHOTOS} photos. First photo is your main profile picture.</Text>
                    <View style={styles.grid}>
                        {Array.from({ length: MAX_PHOTOS }).map((_, index) => renderPhotoSlot(index))}
                    </View>
                </View>

                {/* Videos Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <VideoIcon size={20} color="#3B82F6" />
                        <Text style={styles.sectionTitle}>Videos</Text>
                        <Text style={styles.sectionCount}>{videos.length}/{MAX_VIDEOS}</Text>
                    </View>
                    <Text style={styles.sectionHint}>Add up to {MAX_VIDEOS} videos (max 30 seconds each).</Text>
                    <View style={styles.grid}>
                        {Array.from({ length: MAX_VIDEOS }).map((_, index) => renderVideoSlot(index))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
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
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A202C',
        flex: 1,
    },
    sectionCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    sectionHint: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GRID_GAP,
    },
    slot: {
        width: SLOT_SIZE,
        height: SLOT_SIZE * 1.33,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
    },
    emptySlot: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    slotMedia: {
        width: '100%',
        height: '100%',
    },
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    uploadingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        gap: 8,
    },
    progressText: {
        fontSize: 12,
        color: '#3B82F6',
        fontWeight: '600',
    },
});
