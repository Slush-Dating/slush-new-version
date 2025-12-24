/**
 * User Profile View Screen
 * View another user's profile with photos/video and actions
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    MessageCircle,
    MapPin,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Flag,
    UserX,
    Play,
    Pause,
    Volume2,
    VolumeX,
    X,
    Heart,
    Zap,
    Edit3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { matchService, type Match } from '../../../services/api';
import { getAbsoluteMediaUrl, getApiBaseUrl } from '../../../services/apiConfig';
import * as authService from '../../../services/authService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.5;

interface UserProfile {
    _id: string;
    name: string;
    age?: number;
    dob?: string;
    profession?: string;
    bio?: string;
    photos?: string[];
    videos?: string[];
    videoUrl?: string;
    location?: {
        city?: string;
        state?: string;
        country?: string;
    };
    interests?: string[];
}

export default function UserProfileScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [isMatched, setIsMatched] = useState(false);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [bioExpanded, setBioExpanded] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const videoRef = useRef<Video>(null);

    useEffect(() => {
        console.log('🔍 UserProfileScreen loaded with id:', id);
        if (id) {
            fetchProfile();
            checkMatch();
        } else {
            console.warn('⚠️ No user ID provided to UserProfileScreen');
            setIsLoading(false);
        }
    }, [id]);

    const fetchProfile = async () => {
        try {
            setIsLoading(true);
            const token = await authService.getToken();
            if (!token) return;

            const response = await fetch(
                `${getApiBaseUrl()}/auth/profile/${id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!response.ok) throw new Error('Failed to fetch profile');

            const data = await response.json();
            setProfile(data);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            Alert.alert('Error', 'Failed to load profile');
        } finally {
            setIsLoading(false);
        }
    };

    const checkMatch = async () => {
        try {
            const matches = await matchService.getMatches();
            const match = matches.find(
                (m) => m.userId === id || m.id === id
            );
            if (match) {
                setIsMatched(true);
                setMatchId(match.matchId || match.id);
            }
        } catch (error) {
            console.error('Failed to check match:', error);
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const handleChat = () => {
        if (matchId) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/(main)/chat/${matchId}`);
        }
    };

    const handleUnmatch = () => {
        setShowMenu(false);
        Alert.alert(
            'Unmatch',
            'Are you sure you want to unmatch with this person?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unmatch',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsActionLoading(true);
                            if (matchId) {
                                await matchService.unmatch(matchId);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                router.back();
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to unmatch');
                        } finally {
                            setIsActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleReport = () => {
        setShowMenu(false);
        Alert.alert(
            'Report User',
            'Why are you reporting this user?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Harassment',
                    onPress: () => submitReport('harassment'),
                },
                {
                    text: 'Inappropriate Content',
                    onPress: () => submitReport('inappropriate_content'),
                },
                {
                    text: 'Spam',
                    onPress: () => submitReport('spam'),
                },
                {
                    text: 'Fake Profile',
                    onPress: () => submitReport('fake_profile'),
                },
                {
                    text: 'Underage',
                    onPress: () => submitReport('underage'),
                },
                {
                    text: 'Other',
                    onPress: () => submitReport('other'),
                },
            ],
            { cancelable: true }
        );
    };

    const submitReport = async (reason: string) => {
        if (!profile || !id) return;

        try {
            setIsActionLoading(true);
            const token = await authService.getToken();
            if (!token) {
                Alert.alert('Error', 'Please log in to report a user');
                return;
            }

            const response = await fetch(
                `${getApiBaseUrl()}/matches/report/${id}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        reason,
                        description: '',
                        context: 'profile',
                        referenceId: matchId || null,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to submit report' }));
                throw new Error(errorData.message || 'Failed to submit report');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Report Submitted',
                'Thank you for your report. We will review it and take appropriate action.'
            );
        } catch (error: any) {
            console.error('Failed to report user:', error);
            Alert.alert(
                'Error',
                error.message || 'Failed to submit report. Please try again later.'
            );
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleAction = async (action: 'like' | 'pass' | 'super_like') => {
        if (!profile || isActionLoading) return;

        setIsActionLoading(true);
        Haptics.impactAsync(
            action === 'super_like'
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Medium
        );

        try {
            const result = await matchService.performAction(
                profile._id,
                action,
                'video_feed'
            );

            if (result.isMatch && result.match) {
                setIsMatched(true);
                setMatchId(result.match.matchId);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('It\'s a Match!', 'You and ' + profile.name + ' liked each other!');
            } else if (action === 'like' || action === 'super_like') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            if (action === 'pass') {
                router.back();
            }
        } catch (error) {
            console.error('Action failed:', error);
            Alert.alert('Error', 'Failed to perform action');
        } finally {
            setIsActionLoading(false);
        }
    };

    const navigateMedia = (direction: 'next' | 'prev') => {
        const mediaItems = getMediaItems();
        if (direction === 'next' && currentMediaIndex < mediaItems.length - 1) {
            setCurrentMediaIndex((prev) => prev + 1);
        } else if (direction === 'prev' && currentMediaIndex > 0) {
            setCurrentMediaIndex((prev) => prev - 1);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const getMediaItems = () => {
        const items: { type: 'photo' | 'video'; url: string }[] = [];
        if (profile?.videoUrl) {
            items.push({ type: 'video', url: profile.videoUrl });
        }
        profile?.photos?.forEach((photo) => {
            items.push({ type: 'photo', url: photo });
        });
        return items;
    };

    const calculateAge = (dob: string) => {
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Profile not found</Text>
                <TouchableOpacity onPress={handleBack}>
                    <Text style={styles.backLink}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const mediaItems = getMediaItems();
    const currentMedia = mediaItems[currentMediaIndex];
    const age = profile.age || (profile.dob ? calculateAge(profile.dob) : null);
    const photos = profile.photos || [];
    const videos = profile.videos || (profile.videoUrl ? [profile.videoUrl] : []);
    const bioText = profile.bio || '';
    const bioPreview = bioText.length > 150 ? bioText.substring(0, 150) + '...' : bioText;
    const showReadMore = bioText.length > 150;

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Image Section */}
                <View style={styles.headerImageContainer}>
                    {currentMedia?.type === 'video' ? (
                        <Video
                            ref={videoRef}
                            source={{ uri: getAbsoluteMediaUrl(currentMedia.url) }}
                            style={styles.headerImage}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={isPlaying}
                            isLooping
                            isMuted={isMuted}
                        />
                    ) : currentMedia ? (
                        <Image
                            source={{ uri: getAbsoluteMediaUrl(currentMedia.url) }}
                            style={styles.headerImage}
                        />
                    ) : (
                        <View style={[styles.headerImage, styles.noMedia]}>
                            <Text style={styles.noMediaText}>No photos</Text>
                        </View>
                    )}

                    {/* Navigation Dots - Positioned below image */}
                    {mediaItems.length > 1 && (
                        <View style={styles.dots}>
                            {mediaItems.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.dot,
                                        index === currentMediaIndex && styles.dotActive,
                                    ]}
                                />
                            ))}
                        </View>
                    )}

                    {/* Top Header */}
                    <SafeAreaView style={styles.headerOverlay} edges={['top']}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <ArrowLeft size={24} color="#ffffff" />
                        </TouchableOpacity>
                        {isMatched && (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowMenu(!showMenu);
                                }}
                                style={styles.editButton}
                            >
                                <MoreVertical size={20} color="#000000" />
                            </TouchableOpacity>
                        )}
                    </SafeAreaView>

                    {/* Menu Overlay */}
                    {showMenu && isMatched && (
                        <TouchableOpacity
                            style={styles.menuOverlay}
                            activeOpacity={1}
                            onPress={() => setShowMenu(false)}
                        >
                            <View style={styles.menu}>
                                <TouchableOpacity style={styles.menuItem} onPress={handleUnmatch}>
                                    <UserX size={18} color="#ef4444" />
                                    <Text style={styles.menuItemText}>Unmatch</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                                    <Flag size={18} color="#f59e0b" />
                                    <Text style={styles.menuItemText}>Report</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Action Buttons */}
                    {!isMatched && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleAction('pass')}
                                disabled={isActionLoading}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.actionButtonCircle, styles.passButton]}>
                                    <X size={28} color="#F59E0B" strokeWidth={3} />
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleAction('like')}
                                disabled={isActionLoading}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.actionButtonCircle, styles.likeButton]}>
                                    <Heart size={32} color="#ffffff" fill="#3B82F6" />
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleAction('super_like')}
                                disabled={isActionLoading}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.actionButtonCircle, styles.superLikeButton]}>
                                    <Zap size={28} color="#8B5CF6" strokeWidth={3} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Profile Content */}
                <View style={styles.content}>
                    {/* Name, Age and Profession */}
                    <View style={styles.nameSection}>
                        <Text style={styles.name}>
                            {profile.name}
                            {age && <Text style={styles.age}>, {age}</Text>}
                        </Text>
                        {profile.profession && (
                            <Text style={styles.profession}>{profile.profession}</Text>
                        )}
                    </View>

                    {/* Location */}
                    {profile.location?.city && (
                        <View style={styles.locationSection}>
                            <Text style={styles.sectionTitle}>Location</Text>
                            <View style={styles.locationRow}>
                                <Text style={styles.locationText}>
                                    {profile.location.city}
                                    {profile.location.state && `, ${profile.location.state}`}
                                    {profile.location.country && ` ${profile.location.country}`}
                                </Text>
                                <View style={styles.proximityBadge}>
                                    <MapPin size={12} color="#3B82F6" />
                                    <Text style={styles.proximityText}>1 km</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* About */}
                    {bioText && (
                        <View style={styles.aboutSection}>
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text style={styles.bio}>
                                {bioExpanded ? bioText : bioPreview}
                            </Text>
                            {showReadMore && (
                                <TouchableOpacity
                                    onPress={() => setBioExpanded(!bioExpanded)}
                                    style={styles.readMoreButton}
                                >
                                    <Text style={styles.readMoreText}>
                                        {bioExpanded ? 'Read less' : 'Read more'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Interests */}
                    {profile.interests && profile.interests.length > 0 && (
                        <View style={styles.interestsSection}>
                            <Text style={styles.sectionTitle}>Interests</Text>
                            <View style={styles.interests}>
                                {profile.interests.map((interest, index) => (
                                    <View key={index} style={styles.interestTag}>
                                        <Text style={styles.interestText}>{interest}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Gallery */}
                    {photos.length > 0 && (
                        <View style={styles.gallerySection}>
                            <Text style={styles.sectionTitle}>Gallery</Text>
                            <View style={styles.galleryGrid}>
                                {photos.slice(0, 3).map((photo, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => {
                                            const photoIndex = mediaItems.findIndex(
                                                (item) => item.url === photo && item.type === 'photo'
                                            );
                                            if (photoIndex !== -1) {
                                                setCurrentMediaIndex(photoIndex);
                                            }
                                        }}
                                        style={styles.galleryItem}
                                    >
                                        <Image
                                            source={{ uri: getAbsoluteMediaUrl(photo) }}
                                            style={styles.galleryImage}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Video */}
                    {(videos.length > 0 || profile.videos?.length) && (
                        <View style={styles.videoSection}>
                            <Text style={styles.sectionTitle}>Video</Text>
                            <View style={styles.videoGrid}>
                                {(profile.videos || videos).slice(0, 3).map((video, index) => {
                                    const thumbnailUrl = photos[0] || video; // Use first photo as thumbnail fallback
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => {
                                                const videoIndex = mediaItems.findIndex(
                                                    (item) => item.url === video && item.type === 'video'
                                                );
                                                if (videoIndex !== -1) {
                                                    setCurrentMediaIndex(videoIndex);
                                                }
                                            }}
                                            style={styles.videoItem}
                                        >
                                            <Image
                                                source={{ uri: getAbsoluteMediaUrl(thumbnailUrl) }}
                                                style={styles.videoThumbnail}
                                            />
                                            <View style={styles.playOverlay}>
                                                <Play size={24} color="#ffffff" fill="#ffffff" />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Chat Button for Matched Users */}
            {isMatched && (
                <SafeAreaView style={styles.footer} edges={['bottom']}>
                    <TouchableOpacity
                        style={styles.chatButton}
                        onPress={handleChat}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#60A5FA']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.chatGradient}
                        >
                            <MessageCircle size={20} color="#ffffff" />
                            <Text style={styles.chatButtonText}>Send Message</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </SafeAreaView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        marginBottom: 16,
    },
    backLink: {
        color: '#3B82F6',
        fontSize: 16,
    },
    headerImageContainer: {
        height: HEADER_HEIGHT,
        position: 'relative',
        backgroundColor: '#000000',
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    noMedia: {
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noMediaText: {
        color: '#64748b',
        fontSize: 16,
    },
    dots: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        zIndex: 10,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
        backgroundColor: '#3B82F6',
        width: 24,
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15,
    },
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15,
    },
    menu: {
        position: 'absolute',
        top: 60,
        right: 16,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 20,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    menuItemText: {
        fontSize: 15,
        color: '#1A202C',
    },
    actionButtons: {
        position: 'absolute',
        bottom: -30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        zIndex: 10,
    },
    actionButton: {
        zIndex: 10,
    },
    actionButtonCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    passButton: {
        backgroundColor: '#ffffff',
    },
    likeButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#3B82F6',
    },
    superLikeButton: {
        backgroundColor: '#ffffff',
    },
    content: {
        backgroundColor: '#ffffff',
        paddingTop: 24,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    nameSection: {
        marginBottom: 20,
    },
    name: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1A202C',
        marginBottom: 4,
    },
    age: {
        fontWeight: '400',
        color: '#1A202C',
    },
    profession: {
        fontSize: 15,
        color: '#718096',
        marginTop: 2,
    },
    locationSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A202C',
        marginBottom: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    locationText: {
        fontSize: 15,
        color: '#4A5568',
        flex: 1,
    },
    proximityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    proximityText: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '600',
    },
    aboutSection: {
        marginBottom: 24,
    },
    bio: {
        fontSize: 15,
        color: '#4A5568',
        lineHeight: 22,
    },
    readMoreButton: {
        marginTop: 8,
    },
    readMoreText: {
        fontSize: 15,
        color: '#3B82F6',
        fontWeight: '600',
    },
    interestsSection: {
        marginBottom: 24,
    },
    interests: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    interestTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    interestText: {
        color: '#4A5568',
        fontSize: 14,
        fontWeight: '500',
    },
    gallerySection: {
        marginBottom: 24,
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        justifyContent: 'flex-start',
    },
    galleryItem: {
        width: '31%',
        aspectRatio: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    galleryImage: {
        width: '100%',
        height: '100%',
    },
    videoSection: {
        marginBottom: 24,
    },
    videoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        justifyContent: 'flex-start',
    },
    videoItem: {
        width: '31%',
        aspectRatio: 1,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    footer: {
        padding: 20,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    chatButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    chatGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 8,
    },
    chatButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
});
