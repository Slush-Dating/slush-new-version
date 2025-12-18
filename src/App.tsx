import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VideoFeed } from './components/VideoFeed';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';
import { Events } from './components/Events';
import { WaitingRoom } from './components/WaitingRoom';
import { EventSession } from './components/EventSession';
import { Matches } from './components/Matches';
import { Chat } from './components/Chat';
import { PlayCircle, User, Compass, Heart } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/*" element={<DatingApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function DatingApp() {
  const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'matches' | 'events'>('feed');
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  const handleJoinEvent = (eventId: string) => {
    setActiveEvent(eventId);
  };

  const handleStartSession = () => {
    setIsSessionActive(true);
  };

  return (
    <div className="app-main">
      <main className="content-area">
        <AnimatePresence mode="wait">
          {!activeEvent && !activeChat && activeTab === 'feed' && (
            <VideoFeed
              key="feed"
              onOpenProfile={() => setActiveTab('profile')}
            />
          )}
          {!activeEvent && !activeChat && activeTab === 'events' && <Events key="events" onJoin={handleJoinEvent} />}
          {!activeEvent && !activeChat && activeTab === 'matches' && <Matches key="matches" onChat={(id) => setActiveChat(id)} />}
          {!activeEvent && !activeChat && activeTab === 'profile' && <Profile key="profile" />}

          {activeEvent && !isSessionActive && (
            <WaitingRoom
              key="waiting"
              eventId={activeEvent}
              onLeave={() => setActiveEvent(null)}
              onStart={handleStartSession}
            />
          )}

          {isSessionActive && (
            <EventSession
              key="session"
              onComplete={() => {
                setIsSessionActive(false);
                setActiveEvent(null);
                setActiveTab('events');
              }}
            />
          )}

          {activeChat && (
            <Chat
              key="chat"
              matchId={activeChat}
              onBack={() => setActiveChat(null)}
            />
          )}
        </AnimatePresence>
      </main>

      {!activeChat && (
        <nav className="bottom-nav glass">
          <button
            className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <PlayCircle size={24} />
            <span>Feed</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <Compass size={24} />
            <span>Events</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Heart size={24} />
            <span>Matches</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={24} />
            <span>Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
