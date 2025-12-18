import type { ChatMessage } from '../types';

const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5001/api';
    }
    return `http://${window.location.hostname}:5001/api`;
};

const API_BASE_URL = getApiBaseUrl();

export interface EventData {
    _id?: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    status?: 'Scheduled' | 'Active' | 'Completed' | 'Cancelled';
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

    // If token expired, clear auth data
    if (response.status === 401 && (error.code === 'TOKEN_EXPIRED' || error.message?.includes('expired'))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Reload page to trigger re-authentication
        window.location.reload();
    }

    throw new Error(error.message || 'An error occurred');
};

export const eventService = {
    getAllEvents: async (): Promise<EventData[]> => {
        const response = await fetch(`${API_BASE_URL}/events`);
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        return response.json();
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

        const url = new URL(`${API_BASE_URL}/discovery/feed`);
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

        const url = new URL(`${API_BASE_URL}/discovery/event-partners`);
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

        const url = new URL(`${API_BASE_URL}/chat/${matchId}`);
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
