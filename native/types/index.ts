/**
 * Shared Types
 */

export interface ChatMessage {
    _id: string;
    matchId: string;
    senderId: string | { _id: string; name: string; photos?: string[] };
    content: string;
    createdAt: string;
    read: boolean;
}

export interface User {
    _id: string;
    id?: string;
    email: string;
    name?: string;
    dob?: string;
    gender?: string;
    photos?: string[];
    bio?: string;
    interests?: string[];
    onboardingCompleted?: boolean;
    isPremium?: boolean;
    isAdmin?: boolean;
    location?: {
        type: string;
        coordinates: number[];
        city?: string;
    };
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
    icebreakerQuestions?: string[];
    isNew: boolean;
    isSuperLike?: boolean;
    lastMessage?: {
        content: string;
        createdAt: string;
        senderId: string;
    } | null;
}

export interface EventData {
    _id?: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    description?: string;
    eventType?: 'straight' | 'gay' | 'bisexual';
    maxParticipants?: number;
    totalParticipants?: number;
    status?: 'Scheduled' | 'Active' | 'Completed' | 'Cancelled';
    isPasswordProtected?: boolean;
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
    icebreakerQuestions?: string[];
    isAdmin?: boolean;
}
