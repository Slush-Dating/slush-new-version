import { useState, useEffect, useCallback, useRef } from 'react';
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
import { SplashScreen } from './components/SplashScreen';
import { LandingPage } from './components/LandingPage';
import { Onboarding } from './components/Onboarding';
import { MatchOverlay } from './components/MatchOverlay';
import { ChatList } from './components/ChatList';
import { Notifications } from './components/Notifications';
import { ToastNotification, type Toast } from './components/ToastNotification';
import { chatService, eventService } from './services/api';
import socketService from './services/socketService';
import { getMediaBaseUrl } from './services/apiConfig';
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
    <BrowserRouter basename={import.meta.env.VITE_USE_SUBPATH === 'false' ? '/' : '/app'}>
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
  const [view, setView] = useState<'splash' | 'landing' | 'login' | 'register'>('splash');

  const handleSplashComplete = () => {
    setView('landing');
  };

  return (
    <AnimatePresence mode="wait">
      {view === 'splash' && (
        <SplashScreen
          key="splash"
          onComplete={handleSplashComplete}
        />
      )}
      {view === 'landing' && (
        <LandingPage
          key="landing"
          onCreateAccount={() => setView('register')}
          onSignIn={() => setView('login')}
        />
      )}
      {view === 'login' && (
        <Login
          key="login"
          onLogin={onAuth}
          onSwitchToRegister={() => setView('register')}
        />
      )}
      {view === 'register' && (
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
  const [eventPassword, setEventPassword] = useState<string>('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [currentMatchData, setCurrentMatchData] = useState<any>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [chatListRefreshKey, setChatListRefreshKey] = useState(0);
  const [newMatchCount, setNewMatchCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Use refs to access current tab/chat state in socket handlers without recreating listeners
  const activeTabRef = useRef(activeTab);
  const activeChatRef = useRef(activeChat);

  // Keep refs in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Toast notification management
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    setToasts(prev => [newToast, ...prev].slice(0, 3)); // Max 3 toasts

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleToastAction = useCallback((toast: Toast) => {
    dismissToast(toast.id);
    if (toast.type === 'message' && toast.matchId) {
      setActiveChat(toast.matchId);
      setActiveTab('chat');
    } else if (toast.type === 'match') {
      setActiveTab('matches');
      setNewMatchCount(0);
    }
  }, [dismissToast]);

  // Fetch unread message count
  const fetchUnreadCount = async () => {
    try {
      const { unreadCount } = await chatService.getUnreadCount();
      setUnreadMessageCount(unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Fetch user's current bookings to restore booked event state
  const fetchUserBookings = async () => {
    try {
      const bookings = await eventService.getUserBookings();
      // Set the most recent active booking
      if (bookings.length > 0) {
        const mostRecentBooking = bookings[0]; // Already sorted by bookedAt desc
        setBookedEventId(mostRecentBooking.eventId._id);
        console.log('Restored booked event:', mostRecentBooking.eventId.name);
      }
    } catch (error) {
      console.error('Failed to fetch user bookings:', error);
    }
  };

  // Fetch unread count and user bookings on mount
  useEffect(() => {
    fetchUnreadCount();
    if (user) {
      fetchUserBookings();
    }
  }, [user]);

  // Set up persistent socket connection and listeners once on mount
  // This ensures real-time updates work regardless of which tab is active
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

    let messageHandler: ((message: any) => void) | null = null;
    let matchHandler: ((matchData: any) => void) | null = null;

    // Connect to socket and set up persistent listeners
    const setupSocket = async () => {
      try {
        console.log('🔌 Setting up persistent socket connection...');
        await socketService.connect(currentUserId);
        console.log('✅ Socket connected successfully');

        // Track processed message IDs to prevent duplicate updates from multiple rooms
        const processedMessageIds = new Set<string>();

        // Listen for new messages - update badge immediately and show toast
        // This handler persists regardless of which tab is active
        messageHandler = (message: any) => {
          // Deduplicate: we may receive the same message from both match room and user room
          const messageId = message._id;
          if (processedMessageIds.has(messageId)) {
            console.log('🔄 App: Skipping duplicate message:', messageId);
            return;
          }
          processedMessageIds.add(messageId);

          // Cleanup old IDs to prevent memory leak (keep last 100)
          if (processedMessageIds.size > 100) {
            const idsArray = Array.from(processedMessageIds);
            idsArray.slice(0, 50).forEach(id => processedMessageIds.delete(id));
          }

          const senderId = typeof message.senderId === 'object'
            ? message.senderId._id
            : message.senderId;

          // Only process if message is from someone else
          if (senderId !== currentUserId) {
            // Use refs to get current values without recreating listeners
            const currentActiveChat = activeChatRef.current;
            const currentActiveTab = activeTabRef.current;

            // Update unread count immediately if not in that chat
            // Only increment if not viewing the chat and not on chat tab
            // (ChatList handles updates when on chat tab via onUnreadCountChange)
            if (currentActiveChat !== message.matchId && currentActiveTab !== 'chat') {
              console.log('📨 Incrementing unread count (not viewing chat, not on chat tab)');
              setUnreadMessageCount(prev => prev + 1);
            }

            // Always show toast notification if not viewing that chat
            if (currentActiveChat !== message.matchId) {
              const senderName = message.senderId?.name || 'Someone';
              const senderImage = message.senderId?.photos?.[0] || message.senderId?.imageUrl;
              addToast({
                type: 'message',
                title: senderName,
                message: message.content?.substring(0, 50) + (message.content?.length > 50 ? '...' : '') || 'New message',
                imageUrl: senderImage,
                matchId: message.matchId
              });
            }
          }
        };

        // Listen for new matches - update badge immediately
        matchHandler = (matchData: any) => {
          console.log('🎉 App received new match via socket:', matchData);
          setNewMatchCount(prev => prev + 1);

          // Show toast notification
          const matchUserName = matchData.user?.name || 'Someone';
          const matchUserImage = matchData.user?.imageUrl || matchData.user?.photos?.[0];
          addToast({
            type: 'match',
            title: matchUserName,
            message: "It's a match! Start a conversation.",
            imageUrl: matchUserImage,
            matchId: matchData.matchId,
            userId: matchData.user?._id?.toString() || matchData.user?.id
          });
        };

        // Set up listeners (these persist until component unmounts)
        // Note: Socket.IO listeners persist across reconnections automatically
        socketService.onNewMessage(messageHandler);
        socketService.onNewMatch(matchHandler);
        console.log('✅ Socket listeners set up - they will persist across reconnections');

      } catch (error) {
        console.error('Failed to connect socket for notifications:', error);
      }
    };

    setupSocket();

    // Cleanup: Remove listeners only when component unmounts (user logs out)
    return () => {
      console.log('🧹 Cleaning up socket listeners');
      if (messageHandler) {
        socketService.off('new_message', messageHandler);
      }
      if (matchHandler) {
        socketService.off('new_match', matchHandler);
      }
    };
  }, []); // Empty dependency array - set up once on mount


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
                : `${getMediaBaseUrl()}${matchData.user.photos[0]}`)
              : null),
          bio: matchData.user.bio || ''
        },
        matchedAt: matchData.matchedAt || new Date().toISOString(),
        context: matchData.context || 'video_feed'
      };

      setCurrentMatchData(transformedMatchData);
      setShowMatchOverlay(true);

      // Increment new match count and show toast
      setNewMatchCount(prev => prev + 1);
      addToast({
        type: 'match',
        title: transformedMatchData.user.name,
        message: "It's a match! Start a conversation.",
        imageUrl: transformedMatchData.user.imageUrl,
        matchId: matchData.matchId,
        userId: transformedMatchData.user.id
      });
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

  const handleJoinEvent = (eventId: string, password?: string) => {
    setActiveEvent(eventId);
    setEventPassword(password || '');
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
      <ToastNotification
        toasts={toasts}
        onDismiss={dismissToast}
        onAction={handleToastAction}
      />
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
                  onOpenProfile={(userId: string) => setViewingUserId(userId)}
                  user={user}
                  onMatch={handleMatch}
                />
              )}
              {!activeEvent && !activeChat && activeTab === 'events' && !showNotifications && (
                <Events
                  key="events"
                  onJoin={handleJoinEvent}
                  user={user}
                  bookedEventId={bookedEventId}
                  onJoinWaitingRoom={handleJoinWaitingRoom}
                  onNotificationsClick={() => setShowNotifications(true)}
                />
              )}
              {!activeEvent && !activeChat && activeTab === 'events' && showNotifications && (
                <Notifications
                  key="notifications"
                  onBack={() => setShowNotifications(false)}
                  onUpgrade={() => {
                    setShowNotifications(false);
                    setActiveTab('premium');
                  }}
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
                  onUnreadCountChange={(change) => {
                    console.log(`🔄 Global unread count change: ${change > 0 ? '+' : ''}${change}`);
                    setUnreadMessageCount(prev => Math.max(0, prev + change));
                  }}
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
                  password={eventPassword}
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

              {isSessionActive && activeEvent && (
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
            onClick={() => {
              setActiveTab('matches');
              setNewMatchCount(0);
            }}
          >
            <div className="nav-icon-wrapper">
              <Heart size={24} />
              {newMatchCount > 0 && (
                <span className="notification-badge match-badge">
                  {newMatchCount > 99 ? '99+' : newMatchCount}
                </span>
              )}
            </div>
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
