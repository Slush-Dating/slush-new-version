const API_BASE_URL = 'http://localhost:5001/api';

export interface EventData {
    _id?: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    status?: 'Scheduled' | 'Active' | 'Completed' | 'Cancelled';
}

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
