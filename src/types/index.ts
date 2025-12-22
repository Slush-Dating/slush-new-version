export interface ChatMessage {
    _id: string;
    matchId: string;
    senderId: {
        _id: string;
        name: string;
        profilePicture?: string;
    };
    receiverId: string;
    content: string;
    messageType: 'text' | 'image' | 'system';
    isRead: boolean;
    readAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MatchUser {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    imageUrl: string | null;
    bio: string;
    isPremium: boolean;
}






