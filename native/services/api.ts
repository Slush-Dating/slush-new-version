/**
 * API Service for React Native
 * Handles all API requests to the backend
 */

import { getApiBaseUrl } from './apiConfig';
import { getToken } from './authService';

/**
 * Helper function to get auth headers
 */
const getAuthHeaders = async (): Promise<HeadersInit> => {
    const token = await getToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

/**
 * Handle API errors, especially token expiration
 */
const handleApiError = async (response: Response): Promise<never> => {
    if (response.status === 401) {
        // Token expired or invalid
        console.log('🔑 Token expired, redirecting to login');
        throw new Error('SESSION_EXPIRED');
    }

    if (response.status === 500) {
        // Don't log every 500 error to reduce spam - let the caller handle logging
        throw new Error('Server error (500) - please try again later');
    }

    if (response.status >= 400 && response.status < 500) {
        const error = await response.json().catch(() => ({ message: 'Client error' }));
        throw new Error(error.message || `Request failed (${response.status})`);
    }

    // Network or other errors
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || 'Request failed');
};

// =============================================================================
// TYPES
// =============================================================================

export interface EventData {
    _id?: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    description?: string;
    eventType?: 'straight' | 'gay' | 'bisexual';
    maxParticipants?: number;
    maxMaleParticipants?: number;
    maxFemaleParticipants?: number;
    minAge?: number;
    maxAge?: number;
    maleCount?: number;
    femaleCount?: number;
    totalParticipants?: number;
    status?: 'Scheduled' | 'Active' | 'Completed' | 'Cancelled';
    isPasswordProtected?: boolean;
}

export interface Match {
    id: string;
    matchId?: string;
    userId: string;
    name: string;
    age: number | null;
    imageUrl: string | null;
    bio: string;
    matchedAt: string;
    context: 'video_feed' | 'live_event';
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
    action: 'like' | 'pass' | 'super_like' | 'icebreaker';
    isMatch: boolean;
    match: {
        matchId: string;
        user: any;
        matchedAt: string;
        context: string;
    } | null;
}

export interface DiscoveryProfile {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    bio: string;
    videoUrl: string | null;
    videoUrlOriginal: string | null;
    thumbnail: string | null;
    distance: string;
    locationString?: string;
    photos: string[];
    interests: string[];
}

export interface ChatMessage {
    _id: string;
    matchId: string;
    senderId: string | { _id: string; name: string; photos?: string[] };
    content: string;
    createdAt: string;
    read: boolean;
}

// =============================================================================
// EVENT SERVICE
// =============================================================================

export const eventService = {
    async getAllEvents(): Promise<EventData[]> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        console.log('📅 Fetching events from:', `${API_BASE_URL}/events`);

        try {
            const response = await fetch(`${API_BASE_URL}/events`, { headers });

            console.log('📅 Events API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Events API error:', response.status, errorText);
                return handleApiError(response);
            }

            const data = await response.json();
            console.log('✅ Events fetched successfully:', Array.isArray(data) ? `${data.length} events` : 'Invalid format');

            // Handle both array response and wrapped object response
            if (Array.isArray(data)) {
                return data;
            } else if (data && Array.isArray(data.events)) {
                return data.events;
            } else {
                console.warn('⚠️ Unexpected events response format:', data);
                return [];
            }
        } catch (error: any) {
            console.error('❌ Network error fetching events:', error);
            throw new Error(error.message || 'Failed to fetch events from server');
        }
    },

    async getEventById(id: string): Promise<EventData> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/events/${id}`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async bookEvent(id: string, password?: string): Promise<{ message: string; booking: any; event: any }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/events/${id}/book`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ password }),
        });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async cancelBooking(id: string): Promise<{ message: string; event: any }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/events/${id}/book`, {
            method: 'DELETE',
            headers,
        });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async getBookingStatus(id: string): Promise<{ isBooked: boolean; booking: any | null }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/events/${id}/booking-status`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async getUserBookings(): Promise<any[]> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();
        const token = await getToken();

        console.log('📅 getUserBookings - API URL:', `${API_BASE_URL}/events/user/bookings`);
        console.log('📅 getUserBookings - Token present:', !!token, token ? `(starts with: ${token.substring(0, 20)}...)` : '');

        try {
            const response = await fetch(`${API_BASE_URL}/events/user/bookings`, { headers });

            console.log('📅 getUserBookings - Response status:', response.status);

            if (!response.ok) {
                // Log the actual status code for debugging
                console.log(`📅 Bookings API response status: ${response.status}`);

                // If 401, might be auth issue - return empty array instead of throwing
                if (response.status === 401) {
                    console.warn('📅 Unauthorized to fetch bookings - returning empty array');
                    return [];
                }

                // If 404, endpoint might not exist - return empty array
                if (response.status === 404) {
                    console.warn('📅 Bookings endpoint not found (404) - returning empty array');
                    return [];
                }

                // For other client errors, try to get error message
                try {
                    const errorData = await response.json();
                    console.error('📅 Bookings API error:', errorData);
                } catch (e) {
                    console.error('📅 Bookings API error (could not parse JSON):', response.status);
                }

                // Return empty array instead of throwing for client errors
                if (response.status >= 400 && response.status < 500) {
                    return [];
                }

                return handleApiError(response);
            }

            const data = await response.json();
            console.log('📅 getUserBookings - Raw response data:', JSON.stringify(data).substring(0, 200));
            console.log('📅 getUserBookings - Bookings count:', Array.isArray(data) ? data.length : 'not an array');

            return data;
        } catch (error: any) {
            console.error('📅 Network error fetching bookings:', error);
            // Return empty array on network errors too
            return [];
        }
    },
};

// =============================================================================
// DISCOVERY SERVICE
// =============================================================================

export const discoveryService = {
    async getFeed(): Promise<DiscoveryProfile[]> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/discovery/feed`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : (data.profiles || []);
    },

    async getUserProfile(userId: string): Promise<DiscoveryProfile> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/auth/profile/${userId}`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },
};

// =============================================================================
// MATCH SERVICE
// =============================================================================

export const matchService = {
    async performAction(
        toUserId: string,
        action: 'like' | 'pass' | 'super_like' | 'icebreaker',
        context: 'video_feed' | 'live_event',
        eventId?: string | null
    ): Promise<MatchActionResponse> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/matches/action`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ toUserId, action, context, eventId }),
        });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async getMatches(): Promise<Match[]> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        try {
            const response = await fetch(`${API_BASE_URL}/matches`, { headers });

            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('Server error fetching matches');
                    return [];
                }
                return handleApiError(response);
            }

            return response.json();
        } catch (error) {
            console.warn('Network error fetching matches');
            return [];
        }
    },

    async getLikedYou(): Promise<any[]> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        try {
            const response = await fetch(`${API_BASE_URL}/matches/liked-you`, { headers });

            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('Server error fetching liked-you');
                    return [];
                }
                return handleApiError(response);
            }

            return response.json();
        } catch (error) {
            console.warn('Network error fetching liked-you');
            return [];
        }
    },

    async getMatchStats(): Promise<{ totalMatches: number; likesGiven: number; likesReceived: number }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        try {
            const response = await fetch(`${API_BASE_URL}/matches/stats`, { headers });

            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('Server error fetching match stats');
                    return { totalMatches: 0, likesGiven: 0, likesReceived: 0 };
                }
                return handleApiError(response);
            }

            return response.json();
        } catch (error) {
            console.warn('Network error fetching match stats');
            return { totalMatches: 0, likesGiven: 0, likesReceived: 0 };
        }
    },

    async unmatch(matchId: string): Promise<{ message: string }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/matches/${matchId}`, {
            method: 'DELETE',
            headers,
        });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },
};

// =============================================================================
// CHAT SERVICE
// =============================================================================

export const chatService = {
    async getMessages(matchId: string, page = 1): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/chat/${matchId}?page=${page}`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async sendMessage(matchId: string, content: string): Promise<ChatMessage> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/chat/${matchId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content }),
        });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async markAsRead(matchId: string): Promise<void> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        try {
            const response = await fetch(`${API_BASE_URL}/chat/${matchId}/read`, {
                method: 'POST',
                headers,
            });

            if (!response.ok) {
                if (response.status === 500) {
                    // Silently fail for server errors - don't spam console
                    console.warn(`Server error marking message as read for match ${matchId}`);
                    return;
                }
                return handleApiError(response);
            }
        } catch (error) {
            // Silently handle network errors for this non-critical function
            console.warn(`Network error marking message as read for match ${matchId}`);
        }
    },

    async getUnreadCount(): Promise<{ unreadCount: number }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            const response = await fetch(`${API_BASE_URL}/chat/unread`, {
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                return handleApiError(response);
            }

            return response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - server may be busy');
            }
            throw error;
        }
    },

    async getChatList(): Promise<any[]> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, { headers });

            if (!response.ok) {
                if (response.status === 500) {
                    // Return empty array for server errors - don't spam console
                    console.warn('Server error fetching chat list');
                    return [];
                }
                if (response.status >= 400 && response.status < 500) {
                    // Return empty array for client errors - endpoint may not exist or be unavailable
                    console.warn(`Client error fetching chat list (${response.status})`);
                    return [];
                }
                return handleApiError(response);
            }

            return response.json();
        } catch (error) {
            // Return empty array for network errors
            console.warn('Network error fetching chat list');
            return [];
        }
    },
};

// =============================================================================
// AGORA SERVICE (Video Calls)
// =============================================================================

export const agoraService = {
    async getToken(channelName: string, uid?: number): Promise<{ token: string; appId: string; channelName: string; uid: number }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/agora/token`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ channelName, uid }),
        });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },

    async getNextPartner(eventId: string): Promise<{ partner: any; totalAvailable: number }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/agora/next-partner?eventId=${eventId}`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
    },
};

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

export interface NotificationData {
    id: string;
    type: 'like' | 'match' | 'message' | 'general' | 'security';
    title: string;
    description?: string;
    userImage?: string;
    matchId?: string;
    timestamp: string;
    isRead: boolean;
    actionButton?: string;
}

export const notificationService = {
    async getNotifications(filter: string = 'all'): Promise<{ notifications: NotificationData[]; isPremium: boolean }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const url = filter === 'all'
            ? `${API_BASE_URL}/notifications`
            : `${API_BASE_URL}/notifications?type=${filter}`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        const data = await response.json();
        // Handle different response formats
        if (Array.isArray(data)) {
            return { notifications: data, isPremium: false };
        }
        return data;
    },

    async markAsRead(notificationId: string): Promise<void> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
            method: 'POST',
            headers,
        });

        if (!response.ok) {
            return handleApiError(response);
        }
    },

    async markAllAsRead(): Promise<void> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
            method: 'POST',
            headers,
        });

        if (!response.ok) {
            return handleApiError(response);
        }
    },
};
