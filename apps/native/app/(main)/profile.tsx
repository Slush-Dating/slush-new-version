/**
 * Profile Screen
 * View and edit user profile
 */

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Settings,
    Edit3,
    Camera,
    MapPin,
    Crown,
    LogOut,
    ChevronRight,
    Play,
    ArrowLeft,
    Clock,
    User,
} from 'lucide-react-native';

import { useAuth } from '../../hooks/useAuth';
import { useBackNavigation } from '../../hooks/useBackNavigation';
import { getAbsoluteMediaUrl } from '../../services/apiConfig';
import { colors, shadows } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.5;

export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout, fetchCurrentProfile } = useAuth();
    const handleBack = useBackNavigation('/(main)/feed');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [bioExpanded, setBioExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch fresh profile data when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            console.log('📱 Profile screen focused, fetching profile...');
            setIsLoading(true);
            fetchCurrentProfile().finally(() => {
                setIsLoading(false);
            });
        }, [])
    );

    // Debug log whenever user data changes
    React.useEffect(() => {
        console.log('👤 User data updated in profile screen:', {
            hasUser: !!user,
            userId: user?._id || user?.id,
            name: user?.name,
            email: user?.email,
            photoCount: user?.photos?.length || 0,
            firstPhoto: user?.photos?.[0],
            videoCount: user?.videos?.length || 0,
            hasBio: !!user?.bio,
            interestCount: user?.interests?.length || 0,
        });
    }, [user]);

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

    const profileImage = user?.photos?.[0]
        ? getAbsoluteMediaUrl(user.photos[0])
        : 'https://via.placeholder.com/150';

    const photos = user?.photos || [];
    const videos = user?.videos || [];
    const bioText = user?.bio || '';
    const age = user?.dob ? (() => {
        const today = new Date();
        const birthDate = new Date(user.dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    })() : null;

    const currentImage = photos[currentImageIndex] || profileImage;
    const showReadMore = bioText.length > 150;

    // Show loading indicator while fetching profile
    if (isLoading && !user) {
        return (
            <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top']}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </SafeAreaView>
        );
    }

    // Show error message if no user data after loading
    if (!isLoading && !user) {
        return (
            <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top']}>
                <Text style={styles.errorText}>Failed to load profile</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                        setIsLoading(true);
                        fetchCurrentProfile().finally(() => setIsLoading(false));
                    }}
                >
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Header Image Section */}
                <View style={styles.headerImageContainer}>
                    {photos.length > 0 ? (
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) => {
                                const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                                setCurrentImageIndex(newIndex);
                            }}
                            bounces={false}
                        >
                            {photos.map((photo, index) => (
                                <Image
                                    key={index}
                                    source={{ uri: getAbsoluteMediaUrl(photo) }}
                                    style={[styles.headerImage, { width: SCREEN_WIDTH }]}
                                    resizeMode="cover"
                                />
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={styles.headerImagePlaceholder}>
                            {profileImage && profileImage !== 'https://via.placeholder.com/150' ? (
                                <Image
                                    source={{ uri: profileImage }}
                                    style={[styles.headerImage, { width: SCREEN_WIDTH }]}
                                    resizeMode="cover"
                                    onError={() => {
                                        console.log('Failed to load profile image');
                                    }}
                                />
                            ) : (
                                <View style={styles.noImageContainer}>
                                    <User size={64} color="#94a3b8" />
                                    <Text style={styles.noImageText}>No photo available</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Navigation Dots */}
                    {photos.length > 1 && (
                        <View style={styles.dots}>
                            {photos.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.dot,
                                        index === currentImageIndex && styles.dotActive,
                                    ]}
                                />
                            ))}
                        </View>
                    )}

                    {/* Top Header */}
                    <SafeAreaView style={styles.headerOverlay} edges={['top']}>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleBack();
                            }}
                            style={styles.circleButton}
                        >
                            <ArrowLeft size={20} color="#000000" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push('/(main)/settings');
                            }}
                            style={styles.circleButton}
                        >
                            <Settings size={20} color="#000000" />
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>

                {/* Profile Content Card */}
                <View style={styles.contentCard}>
                    {/* Name, Age and Profession */}
                    <View style={styles.nameSection}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>
                                {user?.name || 'Add name'}
                                {age && <Text style={styles.age}>, {age}</Text>}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    router.push('/(main)/user/edit');
                                }}
                                style={styles.editIconButton}
                            >
                                <Edit3 size={20} color="#666666" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.profession}>
                            {(user as any)?.profession || 'Add your profession'}
                        </Text>
                    </View>

                    {/* Location */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Location</Text>
                        <View style={styles.distanceBadge}>
                            <MapPin size={12} color="#3B82F6" />
                            <Text style={styles.distanceText}>1 km</Text>
                        </View>
                    </View>
                    <Text style={styles.locationDetail}>
                        {user?.location?.city || 'Chicago'},
                        {(user?.location as any)?.state || ' IL'},
                        {(user?.location as any)?.country || ' United States'}
                    </Text>

                    {/* About */}
                    <View style={styles.aboutSection}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.bio} numberOfLines={bioExpanded ? undefined : 3}>
                            {bioText || "My name is Jessica Parker and I enjoy meeting new people and finding ways to help them have an uplifting experience. I enjoy reading.."}
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

                    {/* Interests */}
                    <View style={styles.interestsSection}>
                        <Text style={styles.sectionTitle}>Interests</Text>
                        <View style={styles.interests}>
                            {(user?.interests || ['Travelling', 'Modeling', 'Dancing', 'Books', 'Music', 'Dancing']).map((interest, index) => (
                                <View key={index} style={styles.interestTag}>
                                    <Text style={styles.interestText}>{interest}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Prompts (Life Goals & Simple Pleasures) */}
                    {user?.prompts && user.prompts.length > 0 && user.prompts.some((p: any) => p.answer && p.answer.trim()) && (
                        <View style={styles.promptsSection}>
                            <Text style={styles.sectionTitle}>About Me</Text>
                            {user.prompts.map((prompt: any, index: number) => (
                                prompt.answer && prompt.answer.trim() ? (
                                    <View key={index} style={styles.promptCard}>
                                        <Text style={styles.promptQuestion}>{prompt.question}</Text>
                                        <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                                    </View>
                                ) : null
                            ))}
                        </View>
                    )}

                    {/* Gallery */}
                    <View style={styles.gallerySection}>
                        <Text style={styles.sectionTitle}>Gallery</Text>
                        <View style={styles.customGrid}>
                            <View style={styles.gridLarge}>
                                <Image
                                    source={{ uri: photos[0] ? getAbsoluteMediaUrl(photos[0]) : 'https://via.placeholder.com/300' }}
                                    style={styles.gridImage}
                                />
                            </View>
                            <View style={styles.gridSmallColumn}>
                                <Image
                                    source={{ uri: photos[1] ? getAbsoluteMediaUrl(photos[1]) : 'https://via.placeholder.com/150' }}
                                    style={styles.gridImage}
                                />
                                <Image
                                    source={{ uri: photos[2] ? getAbsoluteMediaUrl(photos[2]) : 'https://via.placeholder.com/150' }}
                                    style={styles.gridImage}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Video */}
                    {videos.length > 0 && (
                        <View style={styles.videoSection}>
                            <Text style={styles.sectionTitle}>Video</Text>
                            <View style={styles.videoGrid}>
                                {videos.slice(0, 3).map((video, index) => (
                                    <View key={index} style={styles.videoGridItem}>
                                        <View style={styles.videoContainer}>
                                            <Video
                                                source={{ uri: getAbsoluteMediaUrl(video) }}
                                                style={styles.videoThumbnail}
                                                resizeMode={ResizeMode.COVER}
                                                shouldPlay={false}
                                                isLooping
                                                isMuted
                                            />
                                        </View>
                                        <View style={styles.playOverlay}>
                                            <Play size={24} color="#ffffff" fill="#ffffff" />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Premium Card */}
                {!user?.isPremium && (
                    <TouchableOpacity style={styles.premiumCard} activeOpacity={0.8} onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push('/(main)/premium');
                    }}>
                        <LinearGradient
                            colors={['#fbbf24', '#f59e0b']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.premiumGradient}
                        >
                            <Crown size={24} color="#1e293b" />
                            <View style={styles.premiumText}>
                                <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                                <Text style={styles.premiumSubtitle}>
                                    See who likes you, unlimited swipes & more
                                </Text>
                            </View>
                            <ChevronRight size={24} color="#1e293b" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}


                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color="#ef4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* Version */}
                <Text style={styles.version}>Version 1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function MenuItem({
    icon,
    title,
    onPress,
}: {
    icon: React.ReactNode;
    title: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            {icon}
            <Text style={styles.menuTitle}>{title}</Text>
            <ChevronRight size={20} color="#64748b" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    headerImageContainer: {
        height: HEADER_HEIGHT,
        position: 'relative',
        backgroundColor: '#F3F4F6',
    },
    headerImage: {
        width: SCREEN_WIDTH,
        height: '100%',
    },
    headerImagePlaceholder: {
        width: SCREEN_WIDTH,
        height: '100%',
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noImageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    noImageText: {
        fontSize: 16,
        color: '#94a3b8',
        fontWeight: '500',
    },
    dots: {
        position: 'absolute',
        bottom: 50, // Moved up to be clear of the overlapping card
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        zIndex: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderWidth: 1,
        borderColor: '#ffffff',
    },
    dotActive: {
        backgroundColor: '#ffffff',
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
    circleButton: {
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
    contentCard: {
        backgroundColor: '#ffffff',
        marginTop: -40,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 20,
        minHeight: SCREEN_HEIGHT - HEADER_HEIGHT + 40,
    },
    nameSection: {
        marginBottom: 24,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    name: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#000000',
    },
    editIconButton: {
        padding: 8,
        marginLeft: 8,
    },
    age: {
        fontWeight: 'normal',
    },
    profession: {
        fontSize: 16,
        color: '#666666',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f7ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    distanceText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '500',
    },
    locationDetail: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 24,
    },
    aboutSection: {
        marginBottom: 24,
    },
    bio: {
        fontSize: 15,
        color: '#333333',
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
        gap: 12,
        marginTop: 12,
    },
    interestTag: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
    },
    interestText: {
        color: '#000000',
        fontSize: 15,
        fontWeight: '500',
    },
    promptsSection: {
        marginBottom: 24,
    },
    promptCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
    },
    promptQuestion: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    promptAnswer: {
        fontSize: 16,
        color: '#333333',
        lineHeight: 24,
        fontWeight: '400',
    },
    gallerySection: {
        marginBottom: 32,
    },
    customGrid: {
        flexDirection: 'row',
        height: 200,
        marginTop: 12,
        gap: 8,
    },
    gridLarge: {
        flex: 2,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        ...shadows.sm,
    },
    gridSmallColumn: {
        flex: 1,
        flexDirection: 'column',
        gap: 8,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgSecondary,
        borderRadius: 16,
        ...shadows.sm,
    },
    videoSection: {
        marginBottom: 40,
    },
    videoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        gap: 8,
    },
    videoGridItem: {
        width: (SCREEN_WIDTH - 48 - 8) / 2, // Screen width minus horizontal padding (24*2) minus gap (8) divided by 2 columns
        aspectRatio: 1,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    videoContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        ...shadows.sm,
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgSecondary,
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
        borderRadius: 16,
        zIndex: 1,
    },
    premiumCard: {
        marginHorizontal: 24,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
    },
    premiumGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    premiumText: {
        flex: 1,
    },
    premiumTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    premiumSubtitle: {
        fontSize: 14,
        color: '#44403c',
        marginTop: 4,
    },
    menuSection: {
        marginHorizontal: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuTitle: {
        flex: 1,
        fontSize: 16,
        color: '#000000',
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 24,
        paddingVertical: 18,
        backgroundColor: '#FEF2F2',
        borderRadius: 20,
        marginBottom: 24,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ef4444',
    },
    version: {
        textAlign: 'center',
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 40,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
    errorText: {
        fontSize: 18,
        color: '#ef4444',
        marginBottom: 20,
        fontWeight: '600',
    },
    retryButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 20,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
