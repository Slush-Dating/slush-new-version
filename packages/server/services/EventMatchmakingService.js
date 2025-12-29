/**
 * EventMatchmakingService
 * Centralized server-side matchmaking for speed dating events
 * 
 * This service manages:
 * - Active participants per event
 * - Round management and timing synchronization
 * - Optimal pairing algorithm (opposite gender for straight events)
 * - Pairing history to prevent duplicate dates
 */

// In-memory storage for event sessions
// In production, consider Redis for multi-instance deployments
const eventSessions = new Map();

// Phase durations in seconds
const PHASE_DURATIONS = {
    lobby: 60,      // 60 seconds prep before date
    date: 180,      // 3 minutes date
    feedback: 60,   // 60 seconds decision
};

/**
 * Get or create an event session
 */
function getSession(eventId) {
    if (!eventSessions.has(eventId)) {
        eventSessions.set(eventId, {
            eventId,
            participants: new Map(),    // userId -> participant info
            pairingHistory: new Set(),  // "smallerId-largerId" strings
            currentRound: 0,
            currentPhase: 'waiting',
            phaseStartTime: null,
            currentPairings: new Map(), // roundNumber -> [{user1, user2}, ...]
            eventType: 'straight',      // straight, gay, bisexual
        });
    }
    return eventSessions.get(eventId);
}

/**
 * Create a pairing key that is consistent regardless of order
 */
function createPairingKey(userId1, userId2) {
    const ids = [userId1, userId2].sort();
    return `${ids[0]}-${ids[1]}`;
}

/**
 * Register a participant in an event session
 */
function joinSession(eventId, userId, socketId, userInfo) {
    const session = getSession(eventId);

    // If user already exists, update their socket
    if (session.participants.has(userId)) {
        const existing = session.participants.get(userId);
        existing.socketId = socketId;
        existing.isReady = true;
        existing.isOnline = true;
        console.log(`[Matchmaking] User ${userId} reconnected to event ${eventId}`);
        return session;
    }

    session.participants.set(userId, {
        userId,
        socketId,
        gender: userInfo.gender || 'other',
        interestedIn: userInfo.interestedIn || 'everyone',
        isReady: true,
        isOnline: true,
        currentPartner: null,
        roundsCompleted: 0,
        // New fields for robust event handling
        lastWaitedRound: 0,           // For fair waiting rotation
        consecutiveWaits: 0,          // Track consecutive waits for fairness
        dateStartTime: null,          // When current date started (for minimum threshold)
        lastDisconnectTime: null,     // Track when user disconnected
        isLateJoiner: session.currentRound > 0, // Mark if they joined after event started
    });

    // Set event type from first user if not set
    if (session.eventType === 'straight' && userInfo.eventType) {
        session.eventType = userInfo.eventType;
    }

    console.log(`[Matchmaking] User ${userId} (${userInfo.gender}) joined event ${eventId}. Total: ${session.participants.size}`);

    return session;
}

/**
 * Remove a participant from an event session
 */
function leaveSession(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const participant = session.participants.get(userId);
    if (participant) {
        participant.isOnline = false;
        participant.isReady = false;

        // If they were paired, their partner becomes unpaired
        if (participant.currentPartner) {
            const partner = session.participants.get(participant.currentPartner);
            if (partner) {
                partner.currentPartner = null;
            }
            participant.currentPartner = null;
        }
    }

    console.log(`[Matchmaking] User ${userId} left event ${eventId}`);
    return session;
}

/**
 * Mark a participant as ready for the next round
 */
function markReady(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return false;

    const participant = session.participants.get(userId);
    if (participant) {
        participant.isReady = true;
        return true;
    }
    return false;
}

/**
 * Check if two users can be paired based on event type and preferences
 */
function canPair(user1, user2, eventType) {
    // Can't pair with self
    if (user1.userId === user2.userId) return false;

    // Both must be online and ready
    if (!user1.isOnline || !user2.isOnline) return false;
    if (!user1.isReady || !user2.isReady) return false;

    // Both must not have current partners
    if (user1.currentPartner || user2.currentPartner) return false;

    // Check gender compatibility based on event type
    if (eventType === 'straight') {
        // Straight events: men pair with women only
        const isOppositeGender =
            (user1.gender === 'man' && user2.gender === 'woman') ||
            (user1.gender === 'woman' && user2.gender === 'man');
        if (!isOppositeGender) return false;
    } else if (eventType === 'gay') {
        // Gay events: same gender only
        if (user1.gender !== user2.gender) return false;
    }
    // Bisexual events: no gender restriction

    return true;
}

/**
 * Create optimal pairings for a round
 * Returns array of { user1, user2 } objects
 * Implements fair waiting rotation to prevent same user from waiting repeatedly
 */
function createPairings(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return [];

    const pairings = [];
    const availableUsers = [];

    // Get all ready online users (exclude late joiners until next round)
    for (const [userId, participant] of session.participants) {
        if (participant.isOnline && participant.isReady && !participant.currentPartner) {
            // Late joiners skip their first round (joined mid-round)
            if (participant.isLateJoiner) {
                participant.isLateJoiner = false; // Clear flag for next round
                console.log(`[Matchmaking] User ${userId} was late joiner - will be included in next round`);
                continue;
            }
            availableUsers.push({ ...participant, userId });
        }
    }

    // FAIR WAITING ROTATION: Sort users to prioritize those who waited recently
    // Users who waited in previous rounds should be paired first
    availableUsers.sort((a, b) => {
        // First priority: consecutiveWaits (higher = more urgent to pair)
        if (a.consecutiveWaits !== b.consecutiveWaits) {
            return b.consecutiveWaits - a.consecutiveWaits;
        }
        // Second priority: lastWaitedRound (closer to current = more urgent)
        if (a.lastWaitedRound !== b.lastWaitedRound) {
            return b.lastWaitedRound - a.lastWaitedRound;
        }
        // Third: for straight events, ensure gender mixing
        if (session.eventType === 'straight') {
            if (a.gender === 'man' && b.gender !== 'man') return -1;
            if (a.gender !== 'man' && b.gender === 'man') return 1;
        }
        return 0;
    });

    // Greedy matching algorithm
    const paired = new Set();

    for (const user1 of availableUsers) {
        if (paired.has(user1.userId)) continue;

        // Find best available match
        for (const user2 of availableUsers) {
            if (paired.has(user2.userId)) continue;
            if (user1.userId === user2.userId) continue;

            // Check if this pair is valid
            if (!canPair(user1, user2, session.eventType)) continue;

            // Check if they've already dated
            const pairingKey = createPairingKey(user1.userId, user2.userId);
            if (session.pairingHistory.has(pairingKey)) continue;

            // Create the pairing
            pairings.push({
                user1: user1.userId,
                user2: user2.userId,
            });

            paired.add(user1.userId);
            paired.add(user2.userId);

            // Update participant state
            const p1 = session.participants.get(user1.userId);
            const p2 = session.participants.get(user2.userId);
            if (p1) {
                p1.currentPartner = user2.userId;
                p1.consecutiveWaits = 0; // Reset consecutive waits since they're paired
            }
            if (p2) {
                p2.currentPartner = user1.userId;
                p2.consecutiveWaits = 0; // Reset consecutive waits since they're paired
            }

            // Add to history
            session.pairingHistory.add(pairingKey);

            console.log(`[Matchmaking] Paired ${user1.userId} (${user1.gender}) with ${user2.userId} (${user2.gender})`);
            break;
        }
    }

    // Store pairings for this round
    session.currentPairings.set(session.currentRound, pairings);

    // Update waiting users' history for fair rotation
    const waitingUsers = availableUsers.filter(u => !paired.has(u.userId));
    for (const waiting of waitingUsers) {
        const participant = session.participants.get(waiting.userId);
        if (participant) {
            participant.lastWaitedRound = session.currentRound;
            participant.consecutiveWaits++;
            console.log(`[Matchmaking] User ${waiting.userId} waiting (consecutiveWaits: ${participant.consecutiveWaits}, lastWaitedRound: ${session.currentRound})`);
        }
    }

    if (waitingUsers.length > 0) {
        console.log(`[Matchmaking] ${waitingUsers.length} users waiting this round: ${waitingUsers.map(u => u.userId).join(', ')}`);
    }

    return pairings;
}


/**
 * Start a new round
 */
function startRound(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    // Clear current partners
    for (const [, participant] of session.participants) {
        participant.currentPartner = null;
        // Keep ready state for active users
    }

    session.currentRound++;
    session.currentPhase = 'lobby';
    session.phaseStartTime = new Date();

    const pairings = createPairings(eventId);

    console.log(`[Matchmaking] Event ${eventId} round ${session.currentRound} started with ${pairings.length} pairs`);

    return {
        round: session.currentRound,
        phase: session.currentPhase,
        pairings,
        phaseStartTime: session.phaseStartTime,
        phaseDuration: PHASE_DURATIONS[session.currentPhase],
    };
}

/**
 * Transition to next phase
 */
function nextPhase(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const phaseOrder = ['lobby', 'date', 'feedback'];
    const currentIndex = phaseOrder.indexOf(session.currentPhase);

    if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) {
        // End of round, prepare for next round or end event
        return null;
    }

    session.currentPhase = phaseOrder[currentIndex + 1];
    session.phaseStartTime = new Date();

    console.log(`[Matchmaking] Event ${eventId} transitioned to ${session.currentPhase}`);

    return {
        round: session.currentRound,
        phase: session.currentPhase,
        phaseStartTime: session.phaseStartTime,
        phaseDuration: PHASE_DURATIONS[session.currentPhase],
    };
}

/**
 * End a round and prepare for next
 */
function endRound(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    // Mark all participants as having completed this round
    for (const [, participant] of session.participants) {
        if (participant.isOnline && participant.currentPartner) {
            participant.roundsCompleted++;
        }
        // Clear partner for next round
        participant.currentPartner = null;
        // Keep ready state
    }

    session.currentPhase = 'waiting';

    return session;
}

/**
 * Check if all possible pairings have been exhausted
 */
function areAllPairingsExhausted(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return true;

    const availableUsers = [];
    for (const [userId, participant] of session.participants) {
        if (participant.isOnline) {
            availableUsers.push({ ...participant, userId });
        }
    }

    // Check if any valid pairing exists that hasn't been done
    for (let i = 0; i < availableUsers.length; i++) {
        for (let j = i + 1; j < availableUsers.length; j++) {
            const user1 = availableUsers[i];
            const user2 = availableUsers[j];

            // Reset partner status for check
            const tempUser1 = { ...user1, currentPartner: null };
            const tempUser2 = { ...user2, currentPartner: null };

            if (canPair(tempUser1, tempUser2, session.eventType)) {
                const pairingKey = createPairingKey(user1.userId, user2.userId);
                if (!session.pairingHistory.has(pairingKey)) {
                    // Found a valid pairing that hasn't been done
                    return false;
                }
            }
        }
    }

    return true;
}

/**
 * Get the assigned partner for a user in the current round
 */
function getAssignedPartner(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const participant = session.participants.get(userId);
    if (!participant) return null;

    return participant.currentPartner;
}

/**
 * Get session stats
 */
function getSessionStats(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    let onlineCount = 0;
    let readyCount = 0;
    let maleCount = 0;
    let femaleCount = 0;

    for (const [, participant] of session.participants) {
        if (participant.isOnline) {
            onlineCount++;
            if (participant.isReady) readyCount++;
            if (participant.gender === 'man') maleCount++;
            if (participant.gender === 'woman') femaleCount++;
        }
    }

    return {
        eventId,
        totalParticipants: session.participants.size,
        onlineCount,
        readyCount,
        maleCount,
        femaleCount,
        currentRound: session.currentRound,
        currentPhase: session.currentPhase,
        pairingHistoryCount: session.pairingHistory.size,
        exhausted: areAllPairingsExhausted(eventId),
    };
}

/**
 * Clean up finished or stale sessions
 */
function cleanupSession(eventId) {
    eventSessions.delete(eventId);
    console.log(`[Matchmaking] Cleaned up session for event ${eventId}`);
}

/**
 * Get all participants in a session
 */
function getParticipants(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return [];

    return Array.from(session.participants.entries()).map(([userId, p]) => ({
        userId,
        gender: p.gender,
        isOnline: p.isOnline,
        isReady: p.isReady,
        hasPartner: !!p.currentPartner,
    }));
}

/**
 * Get maximum possible rounds for an event based on participant count and event type
 * For straight events: min(males, females) - each person dates opposite gender
 * For gay events: max count - 1 (each person dates same gender)
 * For bisexual events: total - 1 (each person can date everyone else)
 */
function getMaxPossibleRounds(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return 0;

    let males = 0, females = 0, others = 0;
    for (const [, p] of session.participants) {
        if (p.isOnline) {
            if (p.gender === 'man') males++;
            else if (p.gender === 'woman') females++;
            else others++;
        }
    }

    if (session.eventType === 'straight') {
        // Each person can date everyone of opposite gender
        return Math.min(males, females);
    } else if (session.eventType === 'gay') {
        // Each person dates same gender (n-1 possible dates per person)
        const maxSameGender = Math.max(males, females);
        return maxSameGender > 1 ? maxSameGender - 1 : 0;
    }
    // Bisexual: everyone can date everyone
    const total = males + females + others;
    return total > 1 ? total - 1 : 0;
}
// Minimum date duration (seconds) before counting as completed pairing
const MIN_DATE_THRESHOLD = 30;

/**
 * Handle disconnect during event - notifies partner and manages re-matching
 * Returns info about what happened for socket handler to emit
 */
function handleDisconnect(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const participant = session.participants.get(userId);
    if (!participant) return null;

    const partnerId = participant.currentPartner;
    const wasInDate = session.currentPhase === 'date';

    // Mark disconnection time
    participant.lastDisconnectTime = new Date();
    participant.isOnline = false;
    participant.isReady = false;

    // If they had a partner during date phase
    if (partnerId) {
        const partner = session.participants.get(partnerId);
        if (partner) {
            partner.currentPartner = null;
        }

        // Check if date met minimum threshold
        const dateMetThreshold = participant.dateStartTime &&
            (new Date() - new Date(participant.dateStartTime)) >= MIN_DATE_THRESHOLD * 1000;

        if (!dateMetThreshold && wasInDate) {
            // Remove pairing from history since it didn't meet threshold
            const pairingKey = createPairingKey(userId, partnerId);
            session.pairingHistory.delete(pairingKey);
            console.log(`[Matchmaking] Removed pairing ${pairingKey} from history (did not meet ${MIN_DATE_THRESHOLD}s threshold)`);
        }

        participant.currentPartner = null;

        console.log(`[Matchmaking] User ${userId} disconnected during event ${eventId}. Partner: ${partnerId}, Phase: ${session.currentPhase}`);

        return {
            partnerId,
            wasInDate,
            dateMetThreshold,
            currentPhase: session.currentPhase,
            currentRound: session.currentRound,
        };
    }

    return { partnerId: null, wasInDate: false };
}

/**
 * Get authoritative event state for a user (for reconnection sync)
 */
function getEventState(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const participant = session.participants.get(userId);

    // Calculate remaining time in current phase
    let remainingTime = 0;
    if (session.phaseStartTime && PHASE_DURATIONS[session.currentPhase]) {
        const elapsed = Math.floor((new Date() - new Date(session.phaseStartTime)) / 1000);
        remainingTime = Math.max(0, PHASE_DURATIONS[session.currentPhase] - elapsed);
    }

    // Get partner info if user has one
    let partnerId = null;
    if (participant && participant.currentPartner) {
        partnerId = participant.currentPartner;
    }

    // Check if user should be waiting (not paired)
    const isWaiting = participant && !participant.currentPartner && session.currentPhase !== 'waiting';

    // Calculate when next round starts if waiting
    let timeUntilNextRound = null;
    if (isWaiting && session.phaseStartTime) {
        // Sum remaining time for all phases until round ends
        const phases = ['lobby', 'date', 'feedback'];
        const currentIdx = phases.indexOf(session.currentPhase);
        if (currentIdx >= 0) {
            timeUntilNextRound = remainingTime;
            for (let i = currentIdx + 1; i < phases.length; i++) {
                timeUntilNextRound += PHASE_DURATIONS[phases[i]];
            }
        }
    }

    return {
        eventId,
        currentRound: session.currentRound,
        currentPhase: session.currentPhase,
        phaseStartTime: session.phaseStartTime,
        remainingTime,
        partnerId,
        isWaiting,
        timeUntilNextRound,
        totalRounds: getMaxPossibleRounds(eventId),
    };
}

/**
 * Set date start time when entering date phase (for minimum threshold tracking)
 */
function setDateStartTime(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return;

    const participant = session.participants.get(userId);
    if (participant) {
        participant.dateStartTime = new Date();
    }
}

/**
 * Check if a pairing should be recorded in history (met minimum duration)
 */
function shouldRecordPairing(eventId, userId) {
    const session = eventSessions.get(eventId);
    if (!session) return false;

    const participant = session.participants.get(userId);
    if (!participant || !participant.dateStartTime) return false;

    const duration = (new Date() - new Date(participant.dateStartTime)) / 1000;
    return duration >= MIN_DATE_THRESHOLD;
}

/**
 * Get list of currently waiting participants (for potential re-matching)
 */
function getWaitingParticipants(eventId) {
    const session = eventSessions.get(eventId);
    if (!session) return [];

    const waiting = [];
    for (const [userId, participant] of session.participants) {
        if (participant.isOnline && participant.isReady && !participant.currentPartner) {
            waiting.push({ userId, ...participant });
        }
    }
    return waiting;
}

/**
 * Find a waiting participant to re-match with
 * Used when partner disconnects mid-date
 */
function findWaitingPartner(eventId, userId, eventType) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const user = session.participants.get(userId);
    if (!user) return null;

    // Find first compatible waiting user
    for (const [waitingId, participant] of session.participants) {
        if (waitingId === userId) continue;
        if (!participant.isOnline || !participant.isReady || participant.currentPartner) continue;

        // Check compatibility
        const tempUser = { ...user, currentPartner: null };
        const tempWaiting = { ...participant, currentPartner: null };

        if (canPair(tempUser, tempWaiting, eventType)) {
            const pairingKey = createPairingKey(userId, waitingId);
            if (!session.pairingHistory.has(pairingKey)) {
                // Create the new pairing
                user.currentPartner = waitingId;
                participant.currentPartner = userId;
                session.pairingHistory.add(pairingKey);

                console.log(`[Matchmaking] Re-matched ${userId} with waiting user ${waitingId}`);
                return waitingId;
            }
        }
    }

    return null;
}

/**
 * Mark user as rejoined (reconnected to session)
 */
function rejoinSession(eventId, userId, socketId) {
    const session = eventSessions.get(eventId);
    if (!session) return null;

    const participant = session.participants.get(userId);
    if (!participant) return null;

    participant.socketId = socketId;
    participant.isOnline = true;
    participant.isReady = true;
    participant.lastDisconnectTime = null;

    console.log(`[Matchmaking] User ${userId} rejoined event ${eventId}`);

    return getEventState(eventId, userId);
}

export default {
    getSession,
    joinSession,
    leaveSession,
    markReady,
    createPairings,
    startRound,
    nextPhase,
    endRound,
    areAllPairingsExhausted,
    getAssignedPartner,
    getSessionStats,
    cleanupSession,
    getParticipants,
    getMaxPossibleRounds,
    PHASE_DURATIONS,
    // New functions for robust event handling
    handleDisconnect,
    getEventState,
    setDateStartTime,
    shouldRecordPairing,
    getWaitingParticipants,
    findWaitingPartner,
    rejoinSession,
    MIN_DATE_THRESHOLD,
};

