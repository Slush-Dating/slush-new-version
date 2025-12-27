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
    isAdmin?: boolean;
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

        // Use debug=true to get diagnostic info from the server
        const url = `${API_BASE_URL}/events/user/bookings?debug=true`;
        console.log('📅 getUserBookings - API URL:', url);
        console.log('📅 getUserBookings - Token present:', !!token, token ? `(starts with: ${token.substring(0, 20)}...)` : '');

        try {
            const response = await fetch(url, { headers });

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

            // Log full response structure for debugging
            console.log('📅 getUserBookings - Response type:', Array.isArray(data) ? 'array' : typeof data);
            console.log('📅 getUserBookings - Response keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
            console.log('📅 getUserBookings - Raw response data (full):', JSON.stringify(data, null, 2));

            // Handle both array response and diagnostic object response
            let bookings = [];
            if (Array.isArray(data)) {
                bookings = data;
                console.log('📅 getUserBookings - Bookings count (array):', bookings.length);
            } else if (data && typeof data === 'object') {
                // Check for debug response format first
                if (data.bookings !== undefined) {
                    bookings = Array.isArray(data.bookings) ? data.bookings : [];
                    console.log('📅 getUserBookings - Found bookings in data.bookings:', bookings.length);
                    if (data.diagnostics) {
                        console.log('📅 getUserBookings - Diagnostics received:', JSON.stringify(data.diagnostics, null, 2));
                    }
                } else if (data.diagnostics) {
                    // Fallback: check diagnostics first (shouldn't happen but just in case)
                    console.log('📅 getUserBookings - Diagnostics received (no bookings field):', JSON.stringify(data.diagnostics, null, 2));
                    bookings = [];
                } else {
                    console.log('📅 getUserBookings - Response is object but no bookings/diagnostics fields found');
                    console.log('📅 getUserBookings - Available keys:', Object.keys(data));
                    bookings = [];
                }
                console.log('📅 getUserBookings - Final bookings count:', bookings.length);
            } else {
                console.log('📅 getUserBookings - Unexpected response format:', typeof data);
            }

            // Log each booking for debugging
            if (bookings.length > 0) {
                console.log('📅 getUserBookings - Bookings details:');
                bookings.forEach((booking, index) => {
                    console.log(`  Booking ${index}:`, {
                        _id: booking._id,
                        eventId: booking.eventId,
                        eventIdType: typeof booking.eventId,
                        eventId_id: booking.eventId?._id,
                        eventName: booking.eventId?.name,
                        eventDate: booking.eventId?.date,
                        status: booking.status
                    });
                });
            } else {
                console.log('📅 getUserBookings - No bookings found in response');
            }

            return bookings;
        } catch (error: any) {
            console.error('📅 Network error fetching bookings:', error);
            // Return empty array on network errors too
            return [];
        }
    },

    async getParticipants(id: string): Promise<{
        maleParticipants: Array<{ _id: string; name: string; photos?: string[] }>;
        femaleParticipants: Array<{ _id: string; name: string; photos?: string[] }>;
        otherParticipants: Array<{ _id: string; name: string; photos?: string[] }>;
        maleCount: number;
        femaleCount: number;
        otherCount: number;
        totalParticipants: number;
    }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/events/${id}/participants`, { headers });

        if (!response.ok) {
            return handleApiError(response);
        }

        return response.json();
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

    async leaveEvent(id: string): Promise<{ message: string; booking: any; event: any }> {
        const API_BASE_URL = getApiBaseUrl();
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/events/${id}/leave`, {
            method: 'POST',
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

/**
 * Fallback helper to construct chat list from matches when chat endpoint is unavailable
 */
const getChatListFromMatches = async (): Promise<any[]> => {
    try {
        console.log('📋 Using fallback: constructing chat list from matches');
        const matches = await matchService.getMatches();
        
        // Transform matches into chat list format
        const chatList = matches.map(match => ({
            matchId: match.id || match.matchId,
            user: {
                _id: match.userId,
                name: match.name,
                photos: match.imageUrl ? [match.imageUrl] : [],
                imageUrl: match.imageUrl
            },
            lastMessage: match.lastMessage || null,
            unreadCount: 0 // Can't determine unread count without chat endpoint
        }));

        console.log('📋 Fallback chat list created:', `${chatList.length} chats from matches`);
        return chatList;
    } catch (error) {
        console.error('📋 Error creating fallback chat list:', error);
        return [];
    }
};

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
            console.log('📋 Fetching chat list from:', `${API_BASE_URL}/chat`);
            const response = await fetch(`${API_BASE_URL}/chat`, { headers });

            console.log('📋 Chat list response status:', response.status);

            // Read response text once (can only read body once)
            const responseText = await response.text();
            
            if (!response.ok) {
                // Handle 404 specifically - endpoint might not be deployed yet
                if (response.status === 404) {
                    console.warn('📋 Chat endpoint not found (404) - using fallback from matches');
                    // Fallback: construct chat list from matches
                    return getChatListFromMatches();
                }

                // Try to get error details from response text
                let errorMessage = `HTTP ${response.status}`;
                try {
                    if (responseText) {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.message || errorMessage;
                        console.error('📋 Chat list error response:', errorData);
                    }
                } catch (e) {
                    console.error('📋 Chat list error text:', responseText);
                    errorMessage = responseText || errorMessage;
                }

                // Handle specific error cases
                if (response.status === 401) {
                    console.error('📋 Unauthorized - token may be expired');
                    throw new Error('SESSION_EXPIRED');
                }

                if (response.status === 500) {
                    console.error('📋 Server error fetching chat list:', errorMessage);
                    throw new Error(`Server error: ${errorMessage}`);
                }

                if (response.status >= 400 && response.status < 500 && response.status !== 404) {
                    console.error(`📋 Client error fetching chat list (${response.status}):`, errorMessage);
                    throw new Error(`Client error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }

            // Parse successful response
            let data;
            try {
                console.log('📋 Chat list raw response (first 500 chars):', responseText.substring(0, 500));
                
                if (!responseText || responseText.trim().length === 0) {
                    console.warn('📋 Chat list response is empty');
                    return [];
                }
                
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('📋 Failed to parse chat list response as JSON:', parseError);
                console.error('📋 Response text:', responseText);
                throw new Error('Invalid response format from server');
            }
            
            console.log('📋 Chat list fetched successfully:', Array.isArray(data) ? `${data.length} chats` : 'Invalid format');
            
            // Ensure we return an array
            if (!Array.isArray(data)) {
                console.warn('📋 Chat list response is not an array:', typeof data, data);
                return [];
            }

            return data;
        } catch (error: any) {
            // If it's a 404 or network error, try fallback
            if (error?.message?.includes('404') || error?.message?.includes('Client error: HTTP 404')) {
                console.warn('📋 Chat endpoint unavailable, using fallback');
                return getChatListFromMatches();
            }

            // Log the full error for debugging
            console.error('📋 Error fetching chat list:', error);
            console.error('📋 Error details:', {
                message: error?.message,
                name: error?.name,
                stack: error?.stack?.substring(0, 200)
            });
            
            // Re-throw the error so the caller can handle it
            throw error;
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

        const response = await fetch(`${API_BASE_URL}/agora/event/${eventId}/next-partner`, {
            method: 'POST',
            headers,
        });

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
