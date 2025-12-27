import type { ChatMessage } from '../types';
import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = getApiBaseUrl();

export interface EventData {
    _id?: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    description?: string;
    eventType?: 'straight' | 'gay' | 'bisexual';
    maxMaleParticipants?: number;
    maxFemaleParticipants?: number;
    minAge?: number;
    maxAge?: number;
    maleParticipants?: string[];
    femaleParticipants?: string[];
    otherParticipants?: string[];
    // Virtual fields from backend
    maleCount?: number;
    femaleCount?: number;
    otherCount?: number;
    totalParticipants?: number;
    status?: 'Scheduled' | 'Active' | 'Completed' | 'Cancelled';
    isPasswordProtected?: boolean;
}

export interface Match {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    imageUrl: string | null;
    bio: string;
    matchedAt: string;
    context: 'video_feed' | 'live_event';
    event: {
        name: string;
        date: string;
        location: string;
    } | null;
    isNew: boolean;
    isSuperLike?: boolean;
    lastMessage?: {
        content: string;
        createdAt: string;
        senderId: string;
    } | null;
}

export interface MatchActionResponse {
    success: boolean;
    action: 'like' | 'pass' | 'super_like';
    isMatch: boolean;
    match: {
        matchId: string;
        user: any;
        matchedAt: string;
        context: string;
    } | null;
}

export interface LikedYouUser {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    imageUrl: string | null;
    bio: string;
    likedAt: string;
    isSuperLike?: boolean;
}

export interface MatchStats {
    totalMatches: number;
    likesGiven: number;
    likesReceived: number;
}


export interface ChatHistory {
    messages: ChatMessage[];
    hasMore: boolean;
    page: number;
}

// Helper to get auth token
const getAuthToken = (): string | null => {
    return localStorage.getItem('token');
};

// Helper to handle API errors, especially token expiration
const handleApiError = async (response: Response): Promise<never> => {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));

    // If token expired or invalid, clear auth data
    if (response.status === 401 && (error.code === 'TOKEN_EXPIRED' || error.message?.includes('expired') || error.message?.includes('Invalid token'))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Reload page to trigger re-authentication
        window.location.reload();
    }

    throw new Error(error.message || 'An error occurred');
};

export const eventService = {
    getAllEvents: async (): Promise<EventData[]> => {
        try {
            const response = await fetch(`${API_BASE_URL}/events`);
            if (!response.ok) {
                let errorMessage = 'Failed to fetch events';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();
            // Ensure we return an array
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            console.error('Error fetching events:', err);
            // Re-throw with more context
            if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                throw new Error(`Cannot connect to server at ${API_BASE_URL}. Please check your network connection.`);
            }
            throw err;
        }
    },

    createEvent: async (eventData: EventData): Promise<EventData> => {
        const response = await fetch(`${API_BASE_URL}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
        });
        if (!response.ok) {
            throw new Error('Failed to create event');
        }
        return response.json();
    },

    getEventById: async (id: string): Promise<EventData> => {
        const response = await fetch(`${API_BASE_URL}/events/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch event');
        }
        return response.json();
    },

    deleteEvent: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/events/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error('Failed to delete event');
        }
    },

    bookEvent: async (id: string, password?: string): Promise<{ message: string; booking: any; event: any }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/events/${id}/book`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(password ? { password } : {})
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to book event');
        }
        return response.json();
    },

    cancelBooking: async (id: string): Promise<{ message: string; event: any }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/events/${id}/book`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to cancel booking');
        }
        return response.json();
    },

    getBookingStatus: async (id: string): Promise<{ isBooked: boolean; booking: any | null }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/events/${id}/booking-status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                // Handle auth errors locally for booking status
                throw new Error('Invalid token');
            }
            await handleApiError(response);
        }
        return response.json();
    },

    getParticipants: async (id: string): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/events/${id}/participants`);
        if (!response.ok) {
            throw new Error('Failed to fetch participants');
        }
        return response.json();
    },

    getUserBookings: async (): Promise<any[]> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/events/user/bookings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch user bookings');
        }

        return response.json();
    },

    leaveEvent: async (id: string): Promise<{ message: string; booking: any; event: any }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/events/${id}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to leave event');
        }
        return response.json();
    },

    rejoinEvent: async (id: string): Promise<{ message: string; booking: any; event: any }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/events/${id}/rejoin`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to rejoin event');
        }
        return response.json();
    },
};

export interface AgoraTokenResponse {
    token: string;
    appId: string;
    channelName: string;
    uid: number;
}

export interface PartnerResponse {
    partner: {
        id: string;
        userId: string;
        name: string;
        age: number | null;
        bio: string;
        imageUrl: string | null;
    };
    totalAvailable: number;
    totalExcluded?: number;
    allPartnersExhausted?: boolean;
}

export const agoraService = {
    getToken: async (channelName: string, uid?: number): Promise<AgoraTokenResponse> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/agora/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ channelName, uid })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get Agora token');
        }

        return response.json();
    },

    getNextPartner: async (eventId: string, pairedPartnerIds: string[] = []): Promise<PartnerResponse> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/agora/event/${eventId}/next-partner`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pairedPartnerIds })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get next partner');
        }

        return response.json();
    },
};

export interface DiscoveryProfile {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    bio: string;
    videoUrl: string | null;
    thumbnail: string | null;
    distance: string;
    photos: string[];
    interests: string[];
}

export const matchService = {
    performAction: async (
        toUserId: string,
        action: 'like' | 'pass' | 'super_like',
        context: 'video_feed' | 'live_event',
        eventId?: string | null
    ): Promise<MatchActionResponse> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                toUserId,
                action,
                context,
                eventId: eventId || null
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to perform action');
        }

        return response.json();
    },

    getMatches: async (): Promise<Match[]> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch matches');
        }

        return response.json();
    },

    getLikedYou: async (): Promise<any[]> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/liked-you`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch liked you users');
        }

        return response.json();
    },

    getMatchStats: async (): Promise<MatchStats> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch match stats');
        }

        return response.json();
    },

    getMatchById: async (matchId: string): Promise<Match> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/${matchId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    checkMatchStatus: async (userId: string): Promise<{ isMatched: boolean; matchId?: string }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/check/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to check match status');
        }

        return response.json();
    },

    unmatch: async (userId: string): Promise<{ success: boolean }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/unmatch/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to unmatch user');
        }

        return response.json();
    },

    report: async (userId: string, reason: string): Promise<{ success: boolean }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/report/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to report user');
        }

        return response.json();
    },
};

export const discoveryService = {
    getFeed: async (limit?: number): Promise<DiscoveryProfile[]> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Construct the feed URL, handling both absolute and relative API base URLs
        let feedUrl: string;
        if (API_BASE_URL.startsWith('http')) {
            // Absolute URL – safe to use directly
            feedUrl = `${API_BASE_URL}/discovery/feed`;
        } else {
            // Relative URL – prepend the current origin to form a full URL
            feedUrl = `${window.location.origin}${API_BASE_URL}/discovery/feed`;
        }
        const url = new URL(feedUrl);
        if (limit) {
            url.searchParams.append('limit', limit.toString());
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch discovery feed');
        }

        return response.json();
    },

    getEventPartners: async (eventId?: string, limit?: number): Promise<DiscoveryProfile[]> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Handle both absolute and relative API base URLs
        let eventPartnersUrl: string;
        if (API_BASE_URL.startsWith('http')) {
            // Absolute URL – safe to use directly
            eventPartnersUrl = `${API_BASE_URL}/discovery/event-partners`;
        } else {
            // Relative URL – prepend the current origin to form a full URL
            eventPartnersUrl = `${window.location.origin}${API_BASE_URL}/discovery/event-partners`;
        }

        const url = new URL(eventPartnersUrl);
        if (eventId) {
            url.searchParams.append('eventId', eventId);
        }
        if (limit) {
            url.searchParams.append('limit', limit.toString());
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch event partners');
        }

        return response.json();
    },
};

export const chatService = {
    getChatHistory: async (matchId: string, page?: number, limit?: number): Promise<ChatHistory> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Handle both absolute and relative API base URLs
        let chatUrl: string;
        if (API_BASE_URL.startsWith('http')) {
            // Absolute URL – safe to use directly
            chatUrl = `${API_BASE_URL}/chat/${matchId}`;
        } else {
            // Relative URL – prepend the current origin to form a full URL
            chatUrl = `${window.location.origin}${API_BASE_URL}/chat/${matchId}`;
        }

        const url = new URL(chatUrl);
        if (page) url.searchParams.append('page', page.toString());
        if (limit) url.searchParams.append('limit', limit.toString());

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    sendMessage: async (matchId: string, content: string, messageType?: 'text' | 'image' | 'system'): Promise<ChatMessage> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/chat/${matchId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content,
                messageType: messageType || 'text'
            }),
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    getUnreadCount: async (): Promise<{ unreadCount: number }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/chat/unread/count`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    getUnreadCountByMatch: async (): Promise<{ unreadByMatch: Record<string, number> }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/chat/unread/by-match`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    markAsRead: async (matchId: string): Promise<{ updated: number }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/chat/${matchId}/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    checkMatchStatus: async (userId: string): Promise<{ isMatched: boolean; matchId?: string }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/check/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to check match status');
        }

        return response.json();
    },

    unmatch: async (userId: string): Promise<{ success: boolean }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/unmatch/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to unmatch user');
        }

        return response.json();
    },

    report: async (userId: string, reason: string): Promise<{ success: boolean }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/matches/report/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to report user');
        }

        return response.json();
    },
};

export interface NotificationData {
    id: string;
    type: 'like' | 'match' | 'general' | 'security';
    title: string;
    description?: string | null;
    actionButton?: string | null;
    actionLink?: string | null;
    userImage?: string | null;
    matchId?: string | null;
    fromUserId?: string | null;
    isRead: boolean;
    timestamp: string;
    createdAt: string;
}

export interface NotificationsResponse {
    notifications: NotificationData[];
    isPremium: boolean;
    unreadCount: number;
}

export const notificationService = {
    getNotifications: async (type?: string): Promise<NotificationsResponse> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Handle both absolute and relative API base URLs
        let notificationsUrl: string;
        if (API_BASE_URL.startsWith('http')) {
            // Absolute URL – safe to use directly
            notificationsUrl = `${API_BASE_URL}/notifications`;
        } else {
            // Relative URL – prepend the current origin to form a full URL
            notificationsUrl = `${window.location.origin}${API_BASE_URL}/notifications`;
        }

        const url = new URL(notificationsUrl);
        if (type && type !== 'all') {
            url.searchParams.append('type', type);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    getUnreadCount: async (): Promise<{ unreadCount: number }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    markAsRead: async (id: string): Promise<{ success: boolean }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },

    markAllAsRead: async (): Promise<{ success: boolean; updated: number }> => {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            await handleApiError(response);
        }

        return response.json();
    },
};
