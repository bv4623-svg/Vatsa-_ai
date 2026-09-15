import { useState } from 'react';
import api from '../services/api';

export function useChat() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = async (message: string, conversationId?: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/api/chat', { message, conversation_id: conversationId });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { sendMessage, loading, error };
}
