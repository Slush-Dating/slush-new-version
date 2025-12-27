/**
 * Chat List Screen
 * List of all chat conversations
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
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageSquare, Search, Loader2, Heart, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { chatService, matchService, type Match } from '../../../services/api';
import { getAbsoluteMediaUrl } from '../../../services/apiConfig';
import socketService from '../../../services/socketService';
import { useAuth } from '../../../hooks/useAuth';

interface ChatItem {
    matchId: string;
    user: {
        _id: string;
        name: string;
        photos?: string[];
        imageUrl?: string;
    };
    lastMessage?: {
        content: string;
        createdAt: string;
        senderId: string;
    };
    unreadCount: number;
}

export default function ChatListScreen() {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const socketCallbackRef = useRef<((message: any) => void) | null>(null);

    const fetchData = useCallback(async () => {
        try {
            console.log('📋 Chat list screen: Starting data fetch');
            const [chatList, matchesData] = await Promise.all([
                chatService.getChatList(),
                matchService.getMatches(),
            ]);
            
            console.log('📋 Chat list screen: Data fetched successfully', {
                chatCount: chatList?.length || 0,
                matchCount: matchesData?.length || 0
            });
            
            setChats(Array.isArray(chatList) ? chatList : []);
            setMatches(Array.isArray(matchesData) ? matchesData : []);
        } catch (err: any) {
            console.error('📋 Chat list screen: Failed to fetch chat data:', err);
            
            // Check if it's a session expired error
            if (err?.message === 'SESSION_EXPIRED') {
                console.log('📋 Session expired, user may need to log in again');
                // The auth hook should handle this, but we'll set empty arrays
                setChats([]);
                setMatches([]);
            } else {
                // For other errors, still set empty arrays but log the error
                console.error('📋 Chat list fetch error details:', {
                    message: err?.message,
                    name: err?.name
                });
                setChats([]);
                setMatches([]);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Socket setup for real-time message previews
    useEffect(() => {
        if (!currentUser?.id) return;

        const handleNewMessage = (message: any) => {
            console.log('📨 Chat list received new message via socket:', message);

            setChats(prevChats => {
                const existingChat = prevChats.find(c => c.matchId === message.matchId);

                if (existingChat) {
                    // Update existing chat
                    const updatedChat = {
                        ...existingChat,
                        lastMessage: {
                            content: message.content,
                            createdAt: message.createdAt,
                            senderId: typeof message.senderId === 'object' ? message.senderId._id : message.senderId
                        },
                        unreadCount: (typeof message.senderId === 'object' ? message.senderId._id : message.senderId) !== currentUser.id
                            ? existingChat.unreadCount + 1
                            : existingChat.unreadCount
                    };

                    // Move to top
                    return [updatedChat, ...prevChats.filter(c => c.matchId !== message.matchId)];
                } else {
                    // This case might happen if we get a message for a match not in the list yet
                    // In a real app, we might want to fetch the chat list again or handle it more robustly
                    return prevChats;
                }
            });

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        };

        socketService.onNewMessage(handleNewMessage);
        socketCallbackRef.current = handleNewMessage;

        return () => {
            if (socketCallbackRef.current) {
                // socketService.off('new_message', socketCallbackRef.current);
            }
        };
    }, [currentUser?.id]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const handleChatPress = (chat: ChatItem | Match) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const matchId = 'matchId' in chat ? chat.matchId : chat.id;
        router.push(`/(main)/chat/${matchId}`);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = diff / (1000 * 60 * 60);

        if (hours < 24) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
        } else if (hours < 24 * 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
        }
    };

    const newMatches = matches.filter(m => m.isNew && !chats.some(c => c.matchId === m.id));

    const renderNewMatches = () => {
        if (newMatches.length === 0) return null;
        return (
            <View style={styles.newMatchesSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>New Sparks</Text>
                    <Heart size={14} fill="#EF4444" color="#EF4444" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newMatchesScroll}>
                    {newMatches.map((match) => (
                        <TouchableOpacity
                            key={match.id}
                            style={styles.newMatchItem}
                            onPress={() => handleChatPress(match)}
                        >
                            <View style={styles.newMatchAvatarContainer}>
                                <Image
                                    source={{ uri: match.imageUrl ? getAbsoluteMediaUrl(match.imageUrl) : 'https://via.placeholder.com/100' }}
                                    style={styles.newMatchAvatar}
                                />
                                <View style={styles.newMatchBadge} />
                            </View>
                            <Text style={styles.newMatchName} numberOfLines={1}>{match.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    const filteredChats = chats.filter(chat =>
        chat.user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderChat = ({ item }: { item: ChatItem }) => {
        const imageUrl = item.user.photos?.[0] || item.user.imageUrl;

        return (
            <TouchableOpacity
                style={styles.chatCard}
                onPress={() => handleChatPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarWrapper}>
                    <Image
                        source={{
                            uri: imageUrl
                                ? getAbsoluteMediaUrl(imageUrl)
                                : 'https://via.placeholder.com/56',
                        }}
                        style={styles.avatar}
                    />
                    {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>
                                {item.unreadCount > 99 ? '99+' : item.unreadCount}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.chatName}>{item.user.name}</Text>
                        {item.lastMessage && (
                            <Text style={styles.chatTime}>
                                {formatTime(item.lastMessage.createdAt)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.chatFooter}>
                        <Text
                            style={[
                                styles.lastMessage,
                                item.unreadCount > 0 && styles.unreadMessage,
                            ]}
                            numberOfLines={1}
                        >
                            {item.lastMessage ? (
                                <>
                                    {item.lastMessage.senderId === currentUser?.id && <Text style={styles.youIndicator}>You: </Text>}
                                    {item.lastMessage.content}
                                </>
                            ) : (
                                <Text style={styles.newConversationText}>You just matched! Send a message.</Text>
                            )}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Your conversations are loading...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Background Orbs */}
            <View style={styles.orb1} />
            <View style={styles.orb2} />
            <View style={styles.orb3} />

            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>
                <Text style={styles.subtitle}>Chat with your matches and see your progress.</Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#64748B" />
                    <TextInput
                        placeholder="Search conversations..."
                        placeholderTextColor="#94A3B8"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <FlatList
                data={filteredChats}
                renderItem={renderChat}
                keyExtractor={(item) => item.matchId}
                ListHeaderComponent={renderNewMatches}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MessageSquare size={64} color="#94A3B8" />
                        <Text style={styles.emptyTitle}>
                            {searchQuery ? 'No conversations found' : 'No messages yet'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? "Try searching for someone else."
                                : "Match with someone to start chatting and find your connection!"}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FCFDFF', // Very light blue tint
    },
    orb1: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    orb2: {
        position: 'absolute',
        bottom: 200,
        left: -150,
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: 'rgba(59, 130, 246, 0.03)',
    },
    orb3: {
        position: 'absolute',
        top: 200,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(14, 165, 233, 0.04)',
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
        paddingBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0F172A',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#1E293B',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    newMatchesSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
    },
    newMatchesScroll: {
        paddingRight: 10,
    },
    newMatchItem: {
        alignItems: 'center',
        marginRight: 20,
        width: 70,
    },
    newMatchAvatarContainer: {
        position: 'relative',
        marginBottom: 6,
    },
    newMatchAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    newMatchBadge: {
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
    newMatchName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#475569',
        textAlign: 'center',
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.5)',
        // shadowColor: '#000',
        // shadowOffset: { width: 0, height: 1 },
        // shadowOpacity: 0.05,
        // shadowRadius: 2,
        // elevation: 1,
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    unreadBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    unreadText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    chatInfo: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
    },
    chatTime: {
        fontSize: 12,
        color: '#94A3B8',
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        color: '#64748B',
        flex: 1,
    },
    unreadMessage: {
        color: '#0F172A',
        fontWeight: '600',
    },
    youIndicator: {
        color: '#94A3B8',
        fontWeight: '500',
    },
    newConversationText: {
        color: '#3B82F6',
        fontStyle: 'italic',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 20,
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 40,
    },
});

