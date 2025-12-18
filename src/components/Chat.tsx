import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Image, Smile, MoreVertical } from 'lucide-react';
import './Chat.css';

interface Message {
    id: string;
    text: string;
    sender: 'me' | 'them';
    time: string;
}

export const Chat: React.FC<{ matchId: string, onBack: () => void }> = ({ matchId, onBack }) => {
    // Using matchId for potential logic/API calls later
    console.log("Chatting with match:", matchId);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: "Hey! Loved your video from the rooftop event! 😍", sender: 'them', time: '10:05 PM' },
        { id: '2', text: "Thank you! It was such a great night. Have you been there before?", sender: 'me', time: '10:08 PM' },
        { id: '3', text: "No, first time! We should definitely go back together sometime.", sender: 'them', time: '10:10 PM' },
    ]);
    const [inputValue, setInputValue] = useState('');

    const handleSend = () => {
        if (!inputValue.trim()) return;
        const newMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([...messages, newMessage]);
        setInputValue('');
    };

    return (
        <motion.div
            className="chat-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
            <header className="chat-header glass">
                <div className="header-left">
                    <button className="back-btn" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                    <div className="chat-user">
                        <div className="user-avatar">
                            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" alt="Sophia" />
                            <div className="online-status"></div>
                        </div>
                        <div className="user-text">
                            <h4>Sophia</h4>
                            <span>Online now</span>
                        </div>
                    </div>
                </div>
                <button className="icon-btn"><MoreVertical size={20} /></button>
            </header>

            <div className="messages-area">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            className={`message-bubble ${msg.sender}`}
                            initial={{ scale: 0.8, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                        >
                            <div className="bubble-content">{msg.text}</div>
                            <span className="bubble-time">{msg.time}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <footer className="chat-input-area glass">
                <div className="input-tools">
                    <button className="tool-btn"><Image size={20} /></button>
                    <button className="tool-btn"><Smile size={20} /></button>
                </div>
                <div className="input-wrapper">
                    <input
                        type="text"
                        placeholder="Type a message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button className="send-btn vibrant-btn" onClick={handleSend}>
                        <Send size={18} />
                    </button>
                </div>
            </footer>
        </motion.div>
    );
};
