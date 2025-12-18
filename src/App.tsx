import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VideoFeed } from './components/VideoFeed';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';
import { Events } from './components/Events';
import { EventDetail } from './components/EventDetail';
import { WaitingRoom } from './components/WaitingRoom';
import { EventSession } from './components/EventSession';
import { Matches } from './components/Matches';
import { Chat } from './components/Chat';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Onboarding } from './components/Onboarding';
import { PlayCircle, User, Compass, Heart } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, [token]);

  const handleAuth = (data: { token: string; user: any }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (isLoading) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route
          path="/*"
          element={
            !token ? (
              <AuthFlow onAuth={handleAuth} />
            ) : !user?.onboardingCompleted ? (
              <Onboarding token={token} onComplete={(updatedUser) => {
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
              }} />
            ) : (
              <DatingApp user={user} onLogout={handleLogout} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function AuthFlow({ onAuth }: { onAuth: (data: { token: string; user: any }) => void }) {
  const [view, setView] = useState<'login' | 'register'>('login');

  return (
    <AnimatePresence mode="wait">
      {view === 'login' ? (
        <Login
          key="login"
          onLogin={onAuth}
          onSwitchToRegister={() => setView('register')}
        />
      ) : (
        <Register
          key="register"
          onRegister={onAuth}
          onSwitchToLogin={() => setView('login')}
        />
      )}
    </AnimatePresence>
  );
}

function DatingApp({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'matches' | 'events'>('feed');
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  // Use user name if available for logging or display
  console.log(`User ${user.name || user.email} logged in`);

  const handleJoinEvent = (eventId: string) => {
    setActiveEvent(eventId);
    setShowEventDetail(true);
  };

  const handleBookEvent = () => {
    setShowEventDetail(false);
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
          {!activeEvent && !activeChat && activeTab === 'events' && <Events key="events" onJoin={handleJoinEvent} user={user} />}
          {!activeEvent && !activeChat && activeTab === 'matches' && <Matches key="matches" onChat={(id) => setActiveChat(id)} />}
          {!activeEvent && !activeChat && activeTab === 'profile' && <Profile key="profile" onLogout={onLogout} />}

          {activeEvent && showEventDetail && !isSessionActive && (
            <EventDetail
              key="event-detail"
              eventId={activeEvent}
              onBack={() => {
                setShowEventDetail(false);
                setActiveEvent(null);
              }}
              onBook={handleBookEvent}
            />
          )}

          {activeEvent && !showEventDetail && !isSessionActive && (
            <WaitingRoom
              key="waiting"
              eventId={activeEvent}
              onLeave={() => {
                setActiveEvent(null);
                setShowEventDetail(false);
              }}
              onStart={handleStartSession}
            />
          )}

          {isSessionActive && (
            <EventSession
              key="session"
              onComplete={() => {
                setIsSessionActive(false);
                setActiveEvent(null);
                setShowEventDetail(false);
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

      {!activeChat && !showEventDetail && (
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
