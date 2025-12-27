import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, X, Video, VideoOff, Mic, MicOff, Clock, Users, MessageCircle } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { agoraService, matchService } from '../services/api';
import './EventSession.css';

interface Partner {
  id: string;
  userId: string;
  name: string;
  age: number | null;
  imageUrl: string | null;
  bio: string;
}

interface EventSessionProps {
  eventId: string;
  onComplete: () => void;
  onMatch: (matchData: any) => void;
}

type SessionPhase = 'prep' | 'date' | 'feedback' | 'summary' | 'ended';

// Configurable timing constants (in seconds)
const EVENT_TIMING = {
  PREP_SECONDS: 60,      // 60 seconds prep/lobby
  DATE_SECONDS: 180,     // 3 minutes (180 seconds) date
  FEEDBACK_SECONDS: 60,  // 60 seconds decision
};

export const EventSession: React.FC<EventSessionProps> = ({ eventId, onComplete, onMatch }) => {
  const [currentPhase, setCurrentPhase] = useState<SessionPhase>('prep');
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [prepTimeLeft, setPrepTimeLeft] = useState(EVENT_TIMING.PREP_SECONDS);
  const [dateTimeLeft, setDateTimeLeft] = useState(EVENT_TIMING.DATE_SECONDS);
  const [feedbackTimeLeft, setFeedbackTimeLeft] = useState(EVENT_TIMING.FEEDBACK_SECONDS);
  // Test mode: true = use mock data, false = use real API
  const [useTestMode, setUseTestMode] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [currentPartnerIndex, setCurrentPartnerIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    totalPartners: 0,
    likes: 0,
    matches: 0,
    timeSpent: 0
  });
  const [isLoadingPartner, setIsLoadingPartner] = useState(false);
  const [agoraError, setAgoraError] = useState<string | null>(null);
  const [pairedPartnerIds, setPairedPartnerIds] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Agora client and tracks
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteUserRef = useRef<IAgoraRTCRemoteUser | null>(null);
  const currentChannelRef = useRef<string | null>(null);
  const currentUidRef = useRef<number | null>(null);

  // Get current user ID from localStorage
  const getCurrentUserId = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id || user._id;
      }
    } catch (e) {
      console.error('Error getting user ID:', e);
    }
    return null;
  };

  // Initialize Agora client
  useEffect(() => {
    if (!agoraClientRef.current) {
      agoraClientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }

    return () => {
      // Cleanup on unmount
      leaveAgoraChannel();
    };
  }, []);

  // Fetch first partner on mount
  useEffect(() => {
    fetchNextPartner();
  }, [eventId]);

  // Prep phase timer (60 seconds)
  useEffect(() => {
    if (currentPhase === 'prep' && prepTimeLeft > 0 && currentPartner) {
      const timer = setInterval(() => {
        setPrepTimeLeft(prev => {
          if (prev <= 1) {
            startDate();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentPhase, prepTimeLeft, currentPartner]);

  // Date phase timer (180 seconds / 3 minutes)
  useEffect(() => {
    if (currentPhase === 'date' && dateTimeLeft > 0) {
      const timer = setInterval(() => {
        setDateTimeLeft(prev => {
          if (prev <= 1) {
            endDate();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentPhase, dateTimeLeft]);

  // Feedback phase timer (60 seconds)
  useEffect(() => {
    if (currentPhase === 'feedback' && feedbackTimeLeft > 0) {
      const timer = setInterval(() => {
        setFeedbackTimeLeft(prev => {
          if (prev <= 1) {
            // Auto-pass if time runs out
            handlePass();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentPhase, feedbackTimeLeft]);

  const fetchNextPartner = async () => {
    setIsLoadingPartner(true);
    setAgoraError(null);

    // Initialize camera for prep phase (don't await to avoid blocking)
    const initCamera = () => {
      if (isCamOn && !localVideoTrackRef.current) {
        AgoraRTC.createCameraVideoTrack()
          .then(track => {
            localVideoTrackRef.current = track;
            if (localVideoRef.current) {
              track.play(localVideoRef.current);
            }
          })
          .catch(error => console.error('Error initializing camera:', error));
      }
    };

    // Use mock partner for testing mode
    if (useTestMode) {
      const mockPartner: Partner = {
        id: 'test-partner-' + Date.now(),
        userId: 'test-partner',
        name: 'Test Partner',
        age: 25,
        imageUrl: null,
        bio: 'This is a test partner for development. Toggle "Test Mode" off to use real API.'
      };

      setCurrentPartner(mockPartner);
      setPartners(prev => [...prev, mockPartner]);
      setSessionStats(prev => ({ ...prev, totalPartners: (prev.totalPartners || 0) + 1 }));
      setCurrentPhase('prep');
      setPrepTimeLeft(EVENT_TIMING.PREP_SECONDS);
      initCamera();
      setIsLoadingPartner(false);
      return;
    }

    // Real API mode
    try {
      const response = await agoraService.getNextPartner(eventId, pairedPartnerIds);

      // Check if all partners exhausted
      if (response.allPartnersExhausted) {
        console.log('All partners dated! Moving to summary.');
        setCurrentPhase('summary');
        setIsLoadingPartner(false);
        return;
      }

      const newPartner: Partner = {
        id: response.partner.userId,
        userId: response.partner.userId,
        name: response.partner.name,
        age: response.partner.age,
        imageUrl: response.partner.imageUrl,
        bio: response.partner.bio || ''
      };

      setCurrentPartner(newPartner);
      setPartners(prev => [...prev, newPartner]);
      setSessionStats(prev => ({ ...prev, totalPartners: (prev.totalPartners || 0) + 1 }));
      setCurrentPhase('prep');
      setPrepTimeLeft(EVENT_TIMING.PREP_SECONDS);
      initCamera();
    } catch (error: any) {
      console.error('Error fetching partner:', error);
      setAgoraError(error.message || 'Failed to find partner. Try enabling Test Mode.');

      // Fallback to mock partner if API fails and no partners yet
      if (partners.length === 0) {
        const mockPartner: Partner = {
          id: 'test-partner-fallback',
          userId: 'test-partner',
          name: 'Test Partner',
          age: 25,
          imageUrl: null,
          bio: 'API unavailable - using test partner. Enable Test Mode for reliable testing.'
        };

        setCurrentPartner(mockPartner);
        setPartners([mockPartner]);
        setSessionStats(prev => ({ ...prev, totalPartners: 1 }));
        setCurrentPhase('prep');
        setPrepTimeLeft(EVENT_TIMING.PREP_SECONDS);
        initCamera();
      } else {
        // No more partners, go to summary
        setCurrentPhase('summary');
      }
    } finally {
      setIsLoadingPartner(false);
    }
  };

  const leaveAgoraChannel = async () => {
    try {
      // Leave channel
      if (agoraClientRef.current && currentChannelRef.current) {
        await agoraClientRef.current.leave();
        currentChannelRef.current = null;
      }

      // Stop and release local tracks
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }

      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      // Clear remote video
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteUserRef.current = null;
    } catch (error) {
      console.error('Error leaving Agora channel:', error);
    }
  };

  const joinAgoraChannel = async (channelName: string, uid: number) => {
    try {
      setAgoraError(null);

      if (!agoraClientRef.current) {
        throw new Error('Agora client not initialized');
      }

      // Get token
      const tokenData = await agoraService.getToken(channelName, uid);
      currentUidRef.current = tokenData.uid;

      // Create local tracks
      if (isCamOn) {
        localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack();
        if (localVideoRef.current) {
          localVideoTrackRef.current.play(localVideoRef.current);
        }
      }

      if (isMicOn) {
        localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      }

      // Join channel
      await agoraClientRef.current.join(
        tokenData.appId,
        channelName,
        tokenData.token,
        tokenData.uid
      );

      currentChannelRef.current = channelName;

      // Publish local tracks
      const tracksToPublish: (ICameraVideoTrack | IMicrophoneAudioTrack)[] = [];
      if (localVideoTrackRef.current) tracksToPublish.push(localVideoTrackRef.current);
      if (localAudioTrackRef.current) tracksToPublish.push(localAudioTrackRef.current);

      if (tracksToPublish.length > 0) {
        await agoraClientRef.current.publish(tracksToPublish);
      }

      // Handle remote user
      agoraClientRef.current.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
        await agoraClientRef.current!.subscribe(user, mediaType);
        remoteUserRef.current = user;

        if (mediaType === 'video') {
          if (remoteVideoRef.current) {
            user.videoTrack?.play(remoteVideoRef.current);
          }
        }

        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      agoraClientRef.current.on('user-unpublished', (_user: IAgoraRTCRemoteUser, _mediaType: 'video' | 'audio') => {
        if (_mediaType === 'video') {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        }
      });

    } catch (error: any) {
      console.error('Error joining Agora channel:', error);
      setAgoraError(error.message || 'Failed to join video call');
      throw error;
    }
  };

  // Skip to next phase (for testing)
  const skipCurrentPhase = () => {
    if (currentPhase === 'prep') {
      startDate();
    } else if (currentPhase === 'date') {
      endDate();
    } else if (currentPhase === 'feedback') {
      handlePass();
    }
  };

  const startDate = async () => {
    if (!currentPartner) return;

    setCurrentPhase('date');
    setDateTimeLeft(EVENT_TIMING.DATE_SECONDS);

    // For mock partners (testing), skip Agora setup
    if (currentPartner.userId === 'test-partner') {
      console.log('Mock partner detected - skipping Agora setup for testing');
      return;
    }

    // Generate channel name from eventId and partner IDs (sorted to ensure both users join same channel)
    const userId = getCurrentUserId();
    const userIds = [userId, currentPartner.userId].sort();
    const channelName = `event_${eventId}_${userIds[0]}_${userIds[1]}`;
    const uid = parseInt(userId?.toString().slice(-8) || '0', 16) || Date.now() % 1000000;

    try {
      await joinAgoraChannel(channelName, uid);
    } catch (error) {
      console.error('Failed to start video call:', error);
      // Continue anyway - user can still see the UI
    }
  };

  const endDate = async () => {
    await leaveAgoraChannel();
    setCurrentPhase('feedback');
    setFeedbackTimeLeft(EVENT_TIMING.FEEDBACK_SECONDS);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLike = async () => {
    if (!currentPartner) return;

    // For mock partners (testing), skip API call but update stats
    if (currentPartner.userId === 'test-partner') {
      setSessionStats(prev => ({ ...prev, likes: prev.likes + 1 }));
      // Simulate a match for testing
      setSessionStats(prev => ({ ...prev, matches: prev.matches + 1 }));
      onMatch({
        matchId: 'test-match-' + Date.now(),
        user: currentPartner,
        matchedAt: new Date().toISOString(),
        context: 'live_event'
      });
    } else {
      try {
        const response = await matchService.performAction(
          currentPartner.userId,
          'like',
          'live_event',
          eventId
        );

        setSessionStats(prev => ({ ...prev, likes: prev.likes + 1 }));

        if (response.isMatch && response.match) {
          setSessionStats(prev => ({ ...prev, matches: prev.matches + 1 }));
          onMatch({
            matchId: response.match.matchId,
            user: currentPartner,
            matchedAt: response.match.matchedAt,
            context: 'live_event'
          });
        }
      } catch (error) {
        console.error('Error performing like action:', error);
      }
    }

    moveToNextPartner();
  };

  const handlePass = async () => {
    if (!currentPartner) return;

    // For mock partners (testing), skip API call
    if (currentPartner.userId !== 'test-partner') {
      try {
        await matchService.performAction(
          currentPartner.userId,
          'pass',
          'live_event',
          eventId
        );
      } catch (error) {
        console.error('Error performing pass action:', error);
      }
    }

    moveToNextPartner();
  };

  const moveToNextPartner = async () => {
    await leaveAgoraChannel();

    // Track this partner as someone we've dated
    if (currentPartner?.userId) {
      setPairedPartnerIds(prev => [...prev, currentPartner.userId]);
    }

    setCurrentPartnerIndex(prev => prev + 1);

    // For mock partners, since we only have one, go to summary
    if (currentPartner?.userId === 'test-partner') {
      setCurrentPhase('summary');
    } else {
      await fetchNextPartner();
    }
  };

  const toggleCamera = async () => {
    setIsCamOn(prev => {
      const newValue = !prev;

      if (agoraClientRef.current && currentChannelRef.current) {
        if (newValue) {
          // Enable camera
          AgoraRTC.createCameraVideoTrack().then(track => {
            localVideoTrackRef.current = track;
            if (localVideoRef.current) {
              track.play(localVideoRef.current);
            }
            agoraClientRef.current?.publish(track);
          }).catch(err => console.error('Error enabling camera:', err));
        } else {
          // Disable camera
          if (localVideoTrackRef.current) {
            agoraClientRef.current?.unpublish(localVideoTrackRef.current);
            localVideoTrackRef.current.stop();
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
          }
        }
      }

      return newValue;
    });
  };

  const toggleMicrophone = async () => {
    setIsMicOn(prev => {
      const newValue = !prev;

      if (agoraClientRef.current && currentChannelRef.current) {
        if (newValue) {
          // Enable microphone
          AgoraRTC.createMicrophoneAudioTrack().then(track => {
            localAudioTrackRef.current = track;
            agoraClientRef.current?.publish(track);
          }).catch(err => console.error('Error enabling microphone:', err));
        } else {
          // Disable microphone
          if (localAudioTrackRef.current) {
            agoraClientRef.current?.unpublish(localAudioTrackRef.current);
            localAudioTrackRef.current.stop();
            localAudioTrackRef.current.close();
            localAudioTrackRef.current = null;
          }
        }
      }

      return newValue;
    });
  };

  const renderPrepScreen = () => (
    <motion.div
      className="prep-screen-v2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {isLoadingPartner ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
          <Clock className="animate-spin" size={40} />
          <p>Finding your next partner...</p>
        </div>
      ) : currentPartner ? (
        <>
          <div className="prep-main-content">
            <div className="partner-focus-card">
              <div className="partner-avatar-ring">
                <img src={currentPartner.imageUrl || '/default-event.png'} alt={currentPartner.name} />
                <div className="pulse-ring"></div>
              </div>
              <div className="prep-text-content">
                <span className="upcoming-label">NEXT PARTNER</span>
                <h2>{currentPartner.name}{currentPartner.age ? `, ${currentPartner.age}` : ''}</h2>
                <p>{currentPartner.bio || 'Ready to connect!'}</p>
              </div>
            </div>

            <div className="user-readiness-card">
              <div className="readiness-preview">
                <div className="cam-preview-container">
                  {isCamOn ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="cam-preview-container video"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <VideoOff size={40} />
                    </div>
                  )}
                  <div className="live-tag">LIVE</div>
                </div>
              </div>
              <div className="readiness-actions">
                <p>Ready for your next connection?</p>
                <button
                  className={`prep-cam-toggle ${isCamOn ? 'active' : ''}`}
                  onClick={toggleCamera}
                >
                  {isCamOn ? <Video size={16} /> : <VideoOff size={16} />}
                  Camera {isCamOn ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          <div className="prep-footer-tips">
            <Clock size={14} />
            <span>3 minutes to connect • Be yourself!</span>
          </div>

          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              {formatTime(prepTimeLeft)}
            </div>
            <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '20px' }}>Starting soon...</p>
            <button className="prep-start-btn" onClick={startDate}>
              Start Conversation Now
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
          <p>No partner available</p>
          {agoraError && <p style={{ color: '#ef4444' }}>{agoraError}</p>}
        </div>
      )}
    </motion.div>
  );

  const renderDateScreen = () => (
    <motion.div
      className="date-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="partner-video-container">
        {remoteUserRef.current?.hasVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="partner-video"
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
            {currentPartner?.imageUrl ? (
              <img src={currentPartner.imageUrl} alt={currentPartner.name} style={{ width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <Users size={80} />
            )}
            <p>{currentPartner?.name} is connecting...</p>
          </div>
        )}
      </div>

      <div className="partner-info-box">
        <h3>{currentPartner?.name}{currentPartner?.age ? `, ${currentPartner.age}` : ''}</h3>
        <p>{currentPartner?.bio || ''}</p>
      </div>

      <div className="my-pip-container">
        {isCamOn && localVideoTrackRef.current ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
        ) : (
          <div className="cam-off-pip">
            <VideoOff size={24} />
          </div>
        )}
      </div>

      <div className="date-controls">
        <button
          className={`control-btn ${!isCamOn ? 'off' : ''}`}
          onClick={toggleCamera}
        >
          {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button
          className={`control-btn ${!isMicOn ? 'off' : ''}`}
          onClick={toggleMicrophone}
        >
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button className="control-btn hang-up" onClick={handlePass}>
          <X size={20} />
        </button>
        <button className="control-btn like" onClick={handleLike}>
          <Heart size={20} />
        </button>
      </div>
    </motion.div>
  );

  const renderFeedbackScreen = () => (
    <motion.div
      className="feedback-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="feedback-background"></div>
      <div className="feedback-content">
        <div className="feedback-avatar-wrapper">
          <div className="feedback-avatar-glow"></div>
          <div className="feedback-avatar">
            <img src={currentPartner?.imageUrl || '/default-event.png'} alt={currentPartner?.name} />
          </div>
        </div>

        <div className="feedback-text-content">
          <h2 className="feedback-title">What did you think?</h2>
          <p className="feedback-subtitle">Your feedback helps us find better matches</p>
          <div style={{ marginTop: '20px', fontSize: '18px', fontWeight: 'bold' }}>
            {formatTime(feedbackTimeLeft)}
          </div>
        </div>

        <div className="feedback-actions">
          <button className="feedback-btn feedback-btn-pass" onClick={handlePass}>
            <div className="feedback-btn-icon">
              <X size={24} />
            </div>
            <span>Not for me</span>
          </button>
          <button className="feedback-btn feedback-btn-like" onClick={handleLike}>
            <div className="feedback-btn-icon">
              <Heart size={24} />
            </div>
            <span>Like</span>
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderSummaryScreen = () => (
    <motion.div
      className="summary-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="summary-background"></div>
      <div className="summary-content">
        <div className="summary-header">
          <h2>Session Complete!</h2>
        </div>

        <div className="summary-stats">
          <div className="summary-stat-card">
            <Users className="stat-icon" size={24} />
            <div className="stat-info">
              <span className="stat-number">{sessionStats.totalPartners}</span>
              <span className="stat-label">Partners</span>
            </div>
          </div>
          <div className="summary-stat-card">
            <Heart className="stat-icon" size={24} />
            <div className="stat-info">
              <span className="stat-number">{sessionStats.likes}</span>
              <span className="stat-label">Likes</span>
            </div>
          </div>
          <div className="summary-stat-card">
            <MessageCircle className="stat-icon" size={24} />
            <div className="stat-info">
              <span className="stat-number">{sessionStats.matches}</span>
              <span className="stat-label">Matches</span>
            </div>
          </div>
        </div>

        {partners.length > 0 && (
          <div className="summary-partners">
            <h3>Your Connections</h3>
            <div className="partners-grid">
              {partners.map((partner) => (
                <div key={partner.id} className="partner-summary-card">
                  <div className="partner-summary-avatar">
                    <img src={partner.imageUrl || '/default-event.png'} alt={partner.name} />
                  </div>
                  <div className="partner-summary-info">
                    <h4>{partner.name}{partner.age ? `, ${partner.age}` : ''}</h4>
                    <p>{partner.bio || ''}</p>
                  </div>
                  <div className="partner-summary-status">
                    <Heart size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="summary-continue-btn" onClick={() => setCurrentPhase('ended')}>
          Continue
        </button>
      </div>
    </motion.div>
  );

  const renderEndScreen = () => (
    <motion.div
      className="event-ended"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="event-ended-background"></div>
      <div className="event-ended-content">
        <div className="event-ended-icon">
          <Heart size={48} />
        </div>
        <div className="event-ended-text">
          <h2>Great session!</h2>
          <p>Check your matches tab to start conversations with your new connections.</p>
        </div>
        <button className="event-ended-btn" onClick={onComplete}>
          Return to Events
        </button>
      </div>
    </motion.div>
  );

  const getTimeLeft = () => {
    if (currentPhase === 'prep') return prepTimeLeft;
    if (currentPhase === 'date') return dateTimeLeft;
    if (currentPhase === 'feedback') return feedbackTimeLeft;
    return 0;
  };

  return (
    <div className="session-container">
      <header className="session-header">
        <button className="back-btn" onClick={onComplete}>
          <ArrowLeft size={24} />
        </button>
        <div className="round-indicator">
          ROUND {currentPartnerIndex + 1}
        </div>
        <div className="phase-badge">
          {currentPhase === 'prep' && <span className="phase-badge prep">PREP</span>}
          {currentPhase === 'date' && <span className="phase-badge date">DATE</span>}
          {currentPhase === 'feedback' && <span className="phase-badge feedback">FEEDBACK</span>}
          {currentPhase === 'summary' && <span className="phase-badge summary">SUMMARY</span>}
        </div>
        {(currentPhase === 'date' || currentPhase === 'feedback' || currentPhase === 'prep') && (
          <div className="phase-timer">{formatTime(getTimeLeft())}</div>
        )}
      </header>

      {/* Dev Controls - only visible in development */}
      {import.meta.env.DEV && (
        <div className="dev-controls" style={{
          position: 'fixed',
          top: '70px',
          right: '10px',
          zIndex: 1000,
          display: 'flex',
          gap: '8px',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            background: useTestMode ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '20px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={useTestMode}
              onChange={(e) => setUseTestMode(e.target.checked)}
              style={{ width: '12px', height: '12px' }}
            />
            Test Mode
          </label>
          {(currentPhase === 'prep' || currentPhase === 'date' || currentPhase === 'feedback') && (
            <button
              onClick={skipCurrentPhase}
              style={{
                fontSize: '11px',
                background: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Skip Phase →
            </button>
          )}
        </div>
      )}

      {currentPhase === 'prep' && renderPrepScreen()}
      {currentPhase === 'date' && renderDateScreen()}
      {currentPhase === 'feedback' && renderFeedbackScreen()}
      {currentPhase === 'summary' && renderSummaryScreen()}
      {currentPhase === 'ended' && renderEndScreen()}
    </div>
  );
};
