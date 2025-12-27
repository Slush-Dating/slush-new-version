/**
 * Individual Chat Screen
 * Real-time messaging with a match
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, MoreVertical } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { chatService, matchService, discoveryService, type ChatMessage } from '../../../services/api';
import { getAbsoluteMediaUrl } from '../../../services/apiConfig';
import { getCurrentUserId } from '../../../services/authService';
import socketService from '../../../services/socketService';
import { colors } from '../../../constants/theme';
import { useBackNavigation } from '../../../hooks/useBackNavigation';

export default function ChatScreen() {
    const router = useRouter();
    const { matchId } = useLocalSearchParams<{ matchId: string }>();
    const handleBack = useBackNavigation('/(main)/chat');

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [matchInfo, setMatchInfo] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const [otherUserId, setOtherUserId] = useState<string | null>(null);
    const [isOtherUserOnline, setIsOtherUserOnline] = useState<boolean | null>(null);

    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingSentRef = useRef<number>(0);

    // Load current user ID
    useEffect(() => {
        const loadUserId = async () => {
            const userId = await getCurrentUserId();
            setCurrentUserId(userId);
        };
        loadUserId();
    }, []);

    // Fetch messages and match info
    const fetchData = useCallback(async () => {
        if (!matchId || !currentUserId) return;

        try {
            const [messagesData, matchesData] = await Promise.all([
                chatService.getMessages(matchId),
                matchService.getMatches(),
            ]);

            setMessages(messagesData.messages);

            // Find match info
            const match = matchesData.find(m => m.matchId === matchId || m.id === matchId);
            setMatchInfo(match);

            // Set other user ID for typing indicators
            if (match?.userId) {
                setOtherUserId(match.userId);
            }

            // Fetch full user profile if we have userId
            if (match?.userId) {
                try {
                    const profile = await discoveryService.getUserProfile(match.userId);
                    setUserProfile(profile);
                } catch (err) {
                    console.error('Failed to fetch user profile:', err);
                    // Fallback to match info if profile fetch fails
                    setUserProfile(match);
                }
            } else {
                // Fallback to match info
                setUserProfile(match);
            }

            // Mark as read
            await chatService.markAsRead(matchId);
        } catch (err) {
            console.error('Failed to fetch chat data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [matchId, currentUserId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Request user status when otherUserId is available and socket is connected
    useEffect(() => {
        if (otherUserId && socketService.isConnected()) {
            socketService.getUserStatus(otherUserId);
        }
    }, [otherUserId]);

    // Socket connection for real-time messages and typing indicators
    useEffect(() => {
        if (!matchId || !currentUserId) return;

        // Join chat room
        socketService.joinRoom(matchId);

        // Listen for new messages
        const handleNewMessage = (message: ChatMessage) => {
            if (message.matchId === matchId) {
                setMessages(prev => {
                    // Check for duplicates (optimistic messages)
                    const isDuplicate = prev.some(m => {
                        if (m._id === message._id) return true;
                        if (m._id?.toString().startsWith('temp_')) {
                            const timeDiff = Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime());
                            return m.content === message.content && timeDiff < 5000;
                        }
                        return false;
                    });

                    if (isDuplicate) {
                        // Replace optimistic message with real one
                        return prev.map(m => {
                            if (m._id?.toString().startsWith('temp_') && m.content === message.content) {
                                return message;
                            }
                            return m._id === message._id ? message : m;
                        });
                    }

                    return [...prev, message];
                });
                // Mark as read
                chatService.markAsRead(matchId);
            }
        };

        // Listen for typing indicators
        const handleTypingStart = (userId: string) => {
            if (userId === otherUserId) {
                setIsOtherUserTyping(true);
            }
        };

        const handleTypingStop = (userId: string) => {
            if (userId === otherUserId) {
                setIsOtherUserTyping(false);
            }
        };

        // Listen for user status changes (online/offline)
        const handleUserStatusChange = (data: { userId: string; isOnline: boolean }) => {
            if (data.userId === otherUserId) {
                setIsOtherUserOnline(data.isOnline);
                console.log('👤 Other user status updated:', data.isOnline ? 'online' : 'offline');
            }
        };

        socketService.onNewMessage(handleNewMessage);
        socketService.onTypingStart(handleTypingStart);
        socketService.onTypingStop(handleTypingStop);
        socketService.onUserStatusChange(handleUserStatusChange);

        return () => {
            socketService.leaveRoom(matchId);
            socketService.off('new_message', handleNewMessage);
            socketService.off('typing_start', handleTypingStart);
            socketService.off('typing_stop', handleTypingStop);
            socketService.off('user_status_change', handleUserStatusChange);
            // Cleanup typing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            // Stop typing indicator on unmount
            if (matchId) {
                socketService.sendStoppedTyping(matchId);
            }
        };
    }, [matchId, currentUserId, otherUserId]);

    // Handle typing detection with debouncing
    const handleInputChange = (text: string) => {
        setInputText(text);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Send typing indicator if user is typing
        if (text.trim().length > 0 && matchId) {
            const now = Date.now();
            // Throttle typing indicators (send max once per 2 seconds)
            if (now - lastTypingSentRef.current > 2000) {
                socketService.sendTyping(matchId);
                lastTypingSentRef.current = now;
            }

            // Set timeout to stop typing indicator
            typingTimeoutRef.current = setTimeout(() => {
                if (matchId) {
                    socketService.sendStoppedTyping(matchId);
                }
            }, 2000);
        } else {
            // Stop typing if input is empty
            if (matchId) {
                socketService.sendStoppedTyping(matchId);
            }
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || !matchId || isSending) return;

        const messageText = inputText.trim();
        setInputText('');
        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Stop typing indicator
        if (matchId) {
            socketService.sendStoppedTyping(matchId);
        }
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Create optimistic message
        const tempId = `temp_${Date.now()}`;
        const optimisticMessage: ChatMessage = {
            _id: tempId,
            matchId,
            senderId: currentUserId!,
            receiverId: otherUserId || '',
            content: messageText,
            messageType: 'text',
            createdAt: new Date().toISOString(),
            isRead: false,
        };

        setMessages(prev => [...prev, optimisticMessage]);

        try {
            // Try socket first, fallback to HTTP if socket not connected
            console.log('📤 Sending message, socket connected:', socketService.isConnected());
            if (socketService.isConnected()) {
                try {
                    console.log('📤 Sending via socket...');
                    await socketService.sendMessage(matchId, messageText, 'text');
                    console.log('✅ Message sent via socket');
                    // Socket will broadcast the message back, we'll deduplicate by content+time
                } catch (socketErr: any) {
                    console.log('❌ Socket send failed:', socketErr.message);
                    // If socket fails, fallback to HTTP
                    if (socketErr.message === 'Socket not connected') {
                        console.log('🔄 Falling back to HTTP API');
                        const message = await chatService.sendMessage(matchId, messageText);
                        // Replace optimistic message with real one
                        setMessages(prev => prev.map(m =>
                            m._id === tempId ? message : m
                        ));
                    } else {
                        throw socketErr;
                    }
                }
            } else {
                console.log('🔄 Socket not connected, using HTTP API');
                // Use HTTP API as fallback
                const message = await chatService.sendMessage(matchId, messageText);
                // Replace optimistic message with real one
                setMessages(prev => prev.map(m =>
                    m._id === tempId ? message : m
                ));
            }

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (err) {
            console.error('Failed to send message:', err);
            setInputText(messageText); // Restore message on error
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m._id !== tempId));
        } finally {
            setIsSending(false);
        }
    };

    const onBackPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleBack();
    };

    const getSenderId = (message: ChatMessage): string => {
        if (typeof message.senderId === 'object') {
            return message.senderId._id;
        }
        return message.senderId;
    };

    const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
        const isMe = getSenderId(item) === currentUserId;
        const showAvatar = !isMe && (
            index === 0 || getSenderId(messages[index - 1]) !== getSenderId(item)
        );

        return (
            <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
                {!isMe && showAvatar && displayImage && (
                    <Image
                        source={{ uri: getAbsoluteMediaUrl(displayImage) }}
                        style={styles.messageAvatar}
                    />
                )}
                {!isMe && !showAvatar && <View style={styles.avatarPlaceholder} />}

                <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
                        {item.content}
                    </Text>
                    <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
                        {new Date(item.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                        })}
                    </Text>
                </View>
            </View>
        );
    };

    // Use userProfile if available, otherwise fallback to matchInfo
    const displayUser = userProfile || matchInfo;
    const displayName = displayUser?.name || 'Chat';
    const displayImage = displayUser?.photos?.[0] || displayUser?.imageUrl || displayUser?.thumbnail;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.headerProfile}>
                    {displayImage && (
                        <Image
                            source={{ uri: getAbsoluteMediaUrl(displayImage) }}
                            style={styles.headerAvatar}
                        />
                    )}
                    <View>
                        <Text style={styles.headerName}>{displayName}</Text>
                        <Text style={styles.headerStatus}>
                            {isOtherUserTyping
                                ? 'Typing...'
                                : isOtherUserOnline === true
                                    ? 'Active now'
                                    : isOtherUserOnline === false
                                        ? 'Offline'
                                        : '...'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreButton}>
                    <MoreVertical size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={90}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => {
                        flatListRef.current?.scrollToEnd({ animated: false });
                    }}
                    ListFooterComponent={
                        isOtherUserTyping ? (
                            <View style={styles.typingIndicator}>
                                <Text style={styles.typingText}>typing...</Text>
                            </View>
                        ) : null
                    }
                />

                {/* Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.textTertiary}
                        value={inputText}
                        onChangeText={handleInputChange}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || isSending}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Send size={20} color="#ffffff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgPrimary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bgPrimary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        backgroundColor: colors.bgWhite,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
    },
    headerProfile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginLeft: 8,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    headerStatus: {
        fontSize: 12,
        color: colors.success,
    },
    moreButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
    },
    keyboardView: {
        flex: 1,
    },
    messagesList: {
        padding: 16,
        gap: 8,
        backgroundColor: colors.bgPrimary,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 4,
    },
    messageRowMe: {
        justifyContent: 'flex-end',
    },
    messageAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    avatarPlaceholder: {
        width: 28,
        marginRight: 8,
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    bubbleMe: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: colors.bgWhite,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    messageText: {
        fontSize: 15,
        color: colors.textPrimary,
        lineHeight: 20,
    },
    messageTextMe: {
        color: '#ffffff',
    },
    messageTime: {
        fontSize: 10,
        color: colors.textTertiary,
        marginTop: 4,
        textAlign: 'right',
    },
    messageTimeMe: {
        color: 'rgba(255, 255, 255, 0.8)',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        backgroundColor: colors.bgWhite,
    },
    input: {
        flex: 1,
        backgroundColor: colors.bgSecondary,
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.textPrimary,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.bgAccent,
    },
    typingIndicator: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'flex-start',
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic',
        color: colors.textTertiary,
    },
});
