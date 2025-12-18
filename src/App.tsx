import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VideoFeed } from './components/VideoFeed';
import { Profile } from './components/Profile';
import { UserProfileView } from './components/UserProfileView';
import { AdminPanel } from './components/AdminPanel';
import { Events } from './components/Events';
import { EventDetail } from './components/EventDetail';
import { WaitingRoom } from './components/WaitingRoom';
import { EventSession } from './components/EventSession';
import { Matches } from './components/Matches';
import { Chat } from './components/Chat';
import { Premium } from './components/Premium';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Onboarding } from './components/Onboarding';
import { MatchOverlay } from './components/MatchOverlay';
import { ChatList } from './components/ChatList';
import { chatService } from './services/api';
import socketService from './services/socketService';
import { PlayCircle, User, Compass, Heart, MessageSquare } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser && token) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
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

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#fff'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

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
  const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'matches' | 'events' | 'chat' | 'premium'>('feed');
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [bookedEventId, setBookedEventId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [currentMatchData, setCurrentMatchData] = useState<any>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [chatListRefreshKey, setChatListRefreshKey] = useState(0);

  // Fetch unread message count
  const fetchUnreadCount = async () => {
    try {
      const { unreadCount } = await chatService.getUnreadCount();
      setUnreadMessageCount(unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Fetch unread count on mount and when activeTab changes
  useEffect(() => {
    fetchUnreadCount();
  }, []);

  // Listen for new messages via socket to update badge in real-time
  useEffect(() => {
    const getCurrentUserId = (): string | null => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
      } catch {
        return null;
      }
    };

    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    // Connect to socket if not already connected
    const setupSocket = async () => {
      try {
        await socketService.connect(currentUserId);

        // Listen for new messages
        const handleNewMessage = () => {
          // If not currently viewing chat, increment unread count
          if (activeTab !== 'chat' && !activeChat) {
            setUnreadMessageCount(prev => prev + 1);
          }
        };

        socketService.onNewMessage(handleNewMessage);

        return () => {
          socketService.off('new_message', handleNewMessage);
        };
      } catch (error) {
        console.error('Failed to connect socket for notifications:', error);
      }
    };

    setupSocket();
  }, [activeTab, activeChat]);

  // Refetch unread count when returning to chat list
  useEffect(() => {
    if (activeTab === 'chat' && !activeChat) {
      fetchUnreadCount();
    }
  }, [activeTab, activeChat]);

  // Use user name if available for logging or display
  console.log(`User ${user.name || user.email} logged in`);

  const handleMatch = (matchData: any) => {
    console.log('New match!', matchData);

    // Transform match data to match MatchOverlay's expected structure
    if (matchData && matchData.user) {
      const transformedMatchData = {
        matchId: matchData.matchId,
        user: {
          id: matchData.user._id?.toString() || matchData.user.id || '',
          name: matchData.user.name || 'Unknown',
          age: matchData.user.age !== undefined
            ? matchData.user.age
            : (matchData.user.dob
              ? (() => {
                const today = new Date();
                const birthDate = new Date(matchData.user.dob);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
                return age;
              })()
              : null),
          imageUrl: matchData.user.imageUrl
            || (matchData.user.photos && matchData.user.photos.length > 0
              ? (matchData.user.photos[0].startsWith('http')
                ? matchData.user.photos[0]
                : `http://localhost:5001${matchData.user.photos[0]}`)
              : null),
          bio: matchData.user.bio || ''
        },
        matchedAt: matchData.matchedAt || new Date().toISOString(),
        context: matchData.context || 'video_feed'
      };

      setCurrentMatchData(transformedMatchData);
      setShowMatchOverlay(true);
    } else {
      console.error('Invalid match data structure:', matchData);
    }
  };

  const handleMatchOverlayDismiss = () => {
    setShowMatchOverlay(false);
    setCurrentMatchData(null);
  };

  const handleStartChatFromMatch = (matchId: string) => {
    setShowMatchOverlay(false);
    setCurrentMatchData(null);
    setActiveChat(matchId);
  };

  const handleViewProfile = (userId: string) => {
    setViewingUserId(userId);
    setShowMatchOverlay(false);
    setActiveChat(null);
  };

  const handleBackFromProfile = () => {
    setViewingUserId(null);
  };

  const handleChat = (matchId: string) => {
    setActiveChat(matchId);
    setViewingUserId(null); // Close profile view when opening chat
  };

  const handleJoinEvent = (eventId: string) => {
    setActiveEvent(eventId);
    setShowEventDetail(true);
  };

  const handleBookEvent = (eventId: string) => {
    setBookedEventId(eventId);
    setShowEventDetail(false);
    setActiveEvent(null);
    setActiveTab('events');
  };

  const handleJoinWaitingRoom = (eventId: string) => {
    setActiveEvent(eventId);
    setShowEventDetail(false);
  };

  const handleStartSession = () => {
    setIsSessionActive(true);
  };

  return (
    <div className="app-main">
      <main className="content-area">
        <AnimatePresence mode="wait">
          {viewingUserId ? (
            <UserProfileView
              key="user-profile"
              userId={viewingUserId}
              onBack={handleBackFromProfile}
              onChat={handleChat}
            />
          ) : (
            <>
              {!activeEvent && !activeChat && activeTab === 'feed' && (
                <VideoFeed
                  key="feed"
                  onOpenProfile={() => setActiveTab('profile')}
                  user={user}
                  onMatch={handleMatch}
                />
              )}
              {!activeEvent && !activeChat && activeTab === 'events' && (
                <Events
                  key="events"
                  onJoin={handleJoinEvent}
                  user={user}
                  bookedEventId={bookedEventId}
                  onJoinWaitingRoom={handleJoinWaitingRoom}
                />
              )}
              {!activeEvent && !activeChat && activeTab === 'matches' && (
                <Matches
                  key="matches"
                  user={user}
                  onChat={(id) => setActiveChat(id)}
                  onProfile={(id) => setViewingUserId(id)}
                  onUpgrade={() => setActiveTab('premium')}
                />
              )}
              {!activeEvent && !activeChat && activeTab === 'chat' && (
                <ChatList
                  key="chat-list"
                  onChat={(id) => setActiveChat(id)}
                  refreshKey={chatListRefreshKey}
                />
              )}
              {!activeEvent && !activeChat && activeTab === 'profile' && <Profile key="profile" onLogout={onLogout} />}

              {!activeEvent && !activeChat && activeTab === 'premium' && (
                <Premium
                  key="premium"
                  onBack={() => setActiveTab('matches')}
                  onUpgradeSuccess={(updatedUser) => {
                    // Update user in localStorage and state
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    // The App component's user state should be updated by parent but we're in DatingApp
                    // For now, reload or find a way to update parent user
                    window.location.reload();
                  }}
                />
              )}

              {activeEvent && showEventDetail && !isSessionActive && (
                <EventDetail
                  key="event-detail"
                  eventId={activeEvent}
                  onBack={() => {
                    setShowEventDetail(false);
                    setActiveEvent(null);
                  }}
                  onBook={() => handleBookEvent(activeEvent)}
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
                  eventId={activeEvent}
                  onComplete={() => {
                    setIsSessionActive(false);
                    setActiveEvent(null);
                    setShowEventDetail(false);
                    setActiveTab('events');
                  }}
                  onMatch={handleMatch}
                />
              )}

              {activeChat && (
                <Chat
                  key="chat"
                  matchId={activeChat}
                  onBack={() => {
                    setActiveChat(null);
                    // Increment refresh key to update chat list with new messages
                    setChatListRefreshKey(prev => prev + 1);
                  }}
                  onViewProfile={handleViewProfile}
                />
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      <MatchOverlay
        isVisible={showMatchOverlay}
        matchData={currentMatchData}
        currentUser={user}
        onStartChat={handleStartChatFromMatch}
        onDismiss={handleMatchOverlayDismiss}
        onViewProfile={handleViewProfile}
      />

      {!activeChat && !showEventDetail && !viewingUserId && (
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
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <div className="nav-icon-wrapper">
              <MessageSquare size={24} />
              {unreadMessageCount > 0 && (
                <span className="notification-badge">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              )}
            </div>
            <span>Chat</span>
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
