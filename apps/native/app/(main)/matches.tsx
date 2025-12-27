/**
 * Matches Screen
 * View all matches and people who liked you
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, Sparkles, MessageCircle, Users, Zap, Loader2, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { matchService, type Match } from '../../services/api';
import { getAbsoluteMediaUrl } from '../../services/apiConfig';
import { useAuth } from '../../hooks/useAuth';
import socketService from '../../services/socketService';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function MatchesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [matches, setMatches] = useState<Match[]>([]);
    const [likedYou, setLikedYou] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'matches' | 'liked'>('matches');
    const socketCallbackRef = useRef<((matchData: any) => void) | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [matchesData, likedYouData] = await Promise.all([
                matchService.getMatches(),
                matchService.getLikedYou(),
            ]);

            // Sort to prioritize super-liked users at the top
            const sortedLikedYou = (likedYouData || []).sort((a, b) => {
                if (a.isSuperLike && !b.isSuperLike) return -1;
                if (!a.isSuperLike && b.isSuperLike) return 1;
                return new Date(b.likedAt || Date.now()).getTime() - new Date(a.likedAt || Date.now()).getTime();
            });

            setMatches(matchesData || []);
            setLikedYou(sortedLikedYou);
        } catch (err) {
            console.error('Failed to fetch matches:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Socket setup for real-time matches
    useEffect(() => {
        if (!user?.id) return;

        const handleNewMatch = (matchData: any) => {
            console.log('🎉 Matches screen received new match via socket:', matchData);

            setMatches(prevMatches => {
                const exists = prevMatches.some(m => m.id === matchData.matchId);
                if (exists) return prevMatches;

                const newMatch: Match = {
                    id: matchData.matchId,
                    userId: matchData.user._id?.toString() || matchData.user.id || '',
                    name: matchData.user.name || 'Unknown',
                    age: matchData.user.age || null,
                    imageUrl: matchData.user.imageUrl || (matchData.user.photos?.[0] || null),
                    bio: matchData.user.bio || '',
                    matchedAt: matchData.matchedAt || new Date().toISOString(),
                    context: matchData.context || 'video_feed',
                    isNew: true,
                    lastMessage: null
                };

                return [newMatch, ...prevMatches];
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };

        socketService.onNewMatch(handleNewMatch);
        socketCallbackRef.current = handleNewMatch;

        return () => {
            if (socketCallbackRef.current) {
                // socketService.off('new_match', socketCallbackRef.current);
            }
        };
    }, [user?.id]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const handleMatchPress = (match: Match) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(main)/chat/${match.matchId || match.id}`);
    };

    const handleProfilePress = (userId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(main)/user/${userId}`);
    };

    const formatLastActive = (matchedAt: string) => {
        const date = new Date(matchedAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const newMatches = matches.filter(m => m.isNew);

    const renderNewSparks = () => {
        if (newMatches.length === 0) return null;
        return (
            <View style={styles.sparksSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>New Sparks</Text>
                    <Heart size={14} fill="#EF4444" color="#EF4444" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sparksScroll}>
                    {newMatches.map((match) => (
                        <TouchableOpacity
                            key={match.id}
                            style={styles.sparkItem}
                            onPress={() => handleProfilePress(match.userId)}
                        >
                            <View style={styles.sparkAvatarContainer}>
                                <Image
                                    source={{ uri: match.imageUrl ? getAbsoluteMediaUrl(match.imageUrl) : 'https://via.placeholder.com/100' }}
                                    style={styles.sparkAvatar}
                                />
                                <View style={styles.sparkNewBadge} />
                            </View>
                            <Text style={styles.sparkName} numberOfLines={1}>{match.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    const renderMatchItem = ({ item }: { item: Match }) => (
        <TouchableOpacity
            style={styles.gridCard}
            onPress={() => handleProfilePress(item.userId)}
            activeOpacity={0.9}
        >
            <View style={styles.cardImageContainer}>
                <Image
                    source={{ uri: item.imageUrl ? getAbsoluteMediaUrl(item.imageUrl) : 'https://via.placeholder.com/200' }}
                    style={styles.cardImage}
                />
                <TouchableOpacity
                    style={styles.chatOverlayButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleMatchPress(item);
                    }}
                >
                    <MessageCircle size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.cardGradient}
                />
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
                    <View style={styles.cardStatus}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.statusText}>{formatLastActive(item.matchedAt)}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderLikedYouItem = ({ item }: { item: any }) => (
        <View style={[styles.gridCard, !user?.isPremium && styles.premiumLocked]}>
            <View style={styles.cardImageContainer}>
                <Image
                    source={{ uri: item.imageUrl ? getAbsoluteMediaUrl(item.imageUrl) : 'https://via.placeholder.com/200' }}
                    style={[styles.cardImage, !user?.isPremium && styles.blurredImage]}
                />
                {user?.isPremium ? (
                    <>
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.cardGradient}
                        />
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardName}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
                            {item.isSuperLike && (
                                <View style={styles.superLikeTag}>
                                    <Sparkles size={10} color="#0EA5E9" fill="#0EA5E9" />
                                    <Text style={styles.superLikeText}>Super Liked You!</Text>
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.lockOverlay}>
                        <Crown size={24} color="rgba(255,255,255,0.5)" />
                    </View>
                )}
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading matches...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Matches</Text>
                <Text style={styles.headerSubtitle}>This is a list of people who have liked you and your matches.</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'matches' && styles.activeTabButton]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('matches');
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'matches' && styles.activeTabText]}>Matches</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'liked' && styles.activeTabButton]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('liked');
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>Liked You</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={activeTab === 'matches' ? matches : likedYou}
                renderItem={activeTab === 'matches' ? renderMatchItem : renderLikedYouItem}
                keyExtractor={(item) => item.matchId || item.id}
                numColumns={2}
                ListHeaderComponent={activeTab === 'matches' ? renderNewSparks : null}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.columnWrapper}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconContainer}>
                            {activeTab === 'matches' ? (
                                <>
                                    <Heart size={48} color="#94A3B8" />
                                    <Sparkles style={styles.emptySparkle} size={20} color="#3B82F6" />
                                </>
                            ) : (
                                <Users size={48} color="#94A3B8" />
                            )}
                        </View>
                        <Text style={styles.emptyTitle}>
                            {activeTab === 'matches' ? 'No Matches Yet' : 'No Likes Yet'}
                        </Text>
                        <Text style={styles.emptyMessage}>
                            {activeTab === 'matches'
                                ? "Keep swiping and connecting! Your perfect match is out there waiting to meet you."
                                : "People who like you will appear here once you start receiving likes."}
                        </Text>
                        {activeTab === 'matches' && (
                            <View style={styles.tipContainer}>
                                <Zap size={14} color="#F59E0B" />
                                <Text style={styles.tipText}>Tip: Try attending events to increase your chances!</Text>
                            </View>
                        )}
                    </View>
                }
            />

            {!user?.isPremium && activeTab === 'liked' && (
                <TouchableOpacity
                    style={styles.premiumBanner}
                    onPress={() => router.push('/(main)/premium')}
                >
                    <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        style={styles.premiumGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.premiumBannerText}>Update to Slush Silver to see who has liked you!</Text>
                        <Crown size={20} color="#FFFFFF" />
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0F172A',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
        lineHeight: 20,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 25,
        padding: 4,
        marginHorizontal: 20,
        marginBottom: 20,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 21,
    },
    activeTabButton: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    activeTabText: {
        color: '#3B82F6',
    },
    sparksSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 6,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
    },
    sparksScroll: {
        paddingLeft: 20,
        paddingRight: 10,
    },
    sparkItem: {
        alignItems: 'center',
        marginRight: 20,
        width: 70,
    },
    sparkAvatarContainer: {
        position: 'relative',
        marginBottom: 6,
    },
    sparkAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    sparkNewBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    sparkName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#475569',
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    gridCard: {
        width: COLUMN_WIDTH,
        height: COLUMN_WIDTH * 1.3,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
    },
    cardImageContainer: {
        flex: 1,
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    blurredImage: {
        opacity: 0.8,
    },
    cardGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    cardInfo: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
    },
    cardName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cardStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
    },
    statusText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    chatOverlayButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    premiumLocked: {
        backgroundColor: '#1E293B',
    },
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    superLikeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 6,
        gap: 4,
    },
    superLikeText: {
        color: '#0EA5E9',
        fontSize: 10,
        fontWeight: '700',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    emptyIconContainer: {
        position: 'relative',
        marginBottom: 20,
    },
    emptySparkle: {
        position: 'absolute',
        top: -10,
        right: -10,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 10,
    },
    emptyMessage: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    tipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginTop: 20,
        gap: 8,
    },
    tipText: {
        fontSize: 12,
        color: '#D97706',
        fontWeight: '500',
    },
    premiumBanner: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    premiumGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    premiumBannerText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
        marginRight: 10,
    },
});

