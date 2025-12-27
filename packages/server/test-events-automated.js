/**
 * Automated Event Testing Script for Staging
 * 
 * This script tests all event-related functionality against the staging API.
 * Run with: node test-events-automated.js
 * 
 * Environment variables:
 *   API_URL - Staging API URL (default: https://api.staging.slush.app)
 *   
 * The script will:
 *   1. Create test users with different profiles
 *   2. Create a test event
 *   3. Run all test cases
 *   4. Output results with pass/fail status
 *   5. Clean up test data
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Configuration
// Default to localhost - set API_URL env var to point to staging if running remotely
const API_URL = process.env.API_URL || 'http://localhost:5001';
// Use staging DB if MONGODB_URI_STAGING is set, otherwise default
const MONGODB_URI = process.env.MONGODB_URI_STAGING || process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables');
    console.error('   Set MONGODB_URI or MONGODB_URI_STAGING');
    process.exit(1);
}

// Test results tracking
let passCount = 0;
let failCount = 0;
const results = [];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`  ${status}: ${testName}`, color);
    if (details && !passed) {
        log(`         Details: ${details}`, 'yellow');
    }
    results.push({ testName, passed, details });
    if (passed) passCount++;
    else failCount++;
}

// HTTP helper with fetch
async function apiRequest(method, endpoint, body = null, token = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json().catch(() => null);
    return { status: response.status, data, ok: response.ok };
}

// Import models after dotenv is loaded
let User, Event, EventBooking;

async function loadModels() {
    User = (await import('./models/User.js')).default;
    Event = (await import('./models/Event.js')).default;
    EventBooking = (await import('./models/EventBooking.js')).default;
}

// Test user configurations
const testUserConfigs = [
    {
        email: 'event-test-man-straight@test.slush.app',
        name: 'TestMan',
        dob: new Date('1995-05-15'), // Age ~29
        gender: 'man',
        interestedIn: 'women',
        bio: 'Test user - man interested in women'
    },
    {
        email: 'event-test-woman-straight@test.slush.app',
        name: 'TestWoman',
        dob: new Date('1997-08-22'), // Age ~27
        gender: 'woman',
        interestedIn: 'men',
        bio: 'Test user - woman interested in men'
    },
    {
        email: 'event-test-man-gay@test.slush.app',
        name: 'TestGayMan',
        dob: new Date('1996-03-10'), // Age ~28
        gender: 'man',
        interestedIn: 'men',
        bio: 'Test user - man interested in men'
    },
    {
        email: 'event-test-woman-gay@test.slush.app',
        name: 'TestGayWoman',
        dob: new Date('1998-11-28'), // Age ~26
        gender: 'woman',
        interestedIn: 'women',
        bio: 'Test user - woman interested in women'
    },
    {
        email: 'event-test-nonbinary@test.slush.app',
        name: 'TestNonBinary',
        dob: new Date('1999-07-04'), // Age ~25
        gender: 'non-binary',
        interestedIn: 'everyone',
        bio: 'Test user - non-binary interested in everyone'
    },
    {
        email: 'event-test-underage@test.slush.app',
        name: 'TestUnderage',
        dob: new Date('2010-01-01'), // Age ~14 - too young
        gender: 'man',
        interestedIn: 'women',
        bio: 'Test user - underage for testing age validation'
    },
    {
        email: 'event-test-woman2@test.slush.app',
        name: 'TestWoman2',
        dob: new Date('1994-04-12'), // Age ~30
        gender: 'woman',
        interestedIn: 'men',
        bio: 'Test user - second woman for matching tests'
    },
    {
        email: 'event-test-woman3@test.slush.app',
        name: 'TestWoman3',
        dob: new Date('1993-09-08'), // Age ~31
        gender: 'woman',
        interestedIn: 'men',
        bio: 'Test user - third woman for matching tests'
    }
];

// Store created test data for cleanup
const testData = {
    users: [],
    tokens: {},
    events: [],
    bookings: []
};

// ============================================
// TEST USER AND EVENT SETUP
// ============================================

async function createTestUsers() {
    log('\n📋 Creating test users...', 'cyan');

    const password = await bcrypt.hash('testpassword123', 12);

    for (const config of testUserConfigs) {
        try {
            let user = await User.findOne({ email: config.email });

            if (user) {
                // Update existing user
                Object.assign(user, {
                    ...config,
                    password,
                    onboardingCompleted: true,
                    photos: ['https://example.com/photo.jpg'],
                    location: {
                        type: 'Point',
                        coordinates: [-0.1276, 51.5074]
                    }
                });
                await user.save();
            } else {
                // Create new user
                user = new User({
                    ...config,
                    password,
                    onboardingCompleted: true,
                    photos: ['https://example.com/photo.jpg'],
                    location: {
                        type: 'Point',
                        coordinates: [-0.1276, 51.5074]
                    }
                });
                await user.save();
            }

            testData.users.push(user);
            log(`  ✓ User: ${config.email} (${config.name})`, 'green');
        } catch (error) {
            log(`  ✗ Failed to create ${config.email}: ${error.message}`, 'red');
        }
    }
}

async function loginTestUsers() {
    log('\n🔐 Logging in test users...', 'cyan');

    for (const user of testData.users) {
        try {
            const response = await apiRequest('POST', '/api/auth/login', {
                email: user.email,
                password: 'testpassword123'
            });

            if (response.ok && response.data?.token) {
                testData.tokens[user.email] = response.data.token;
                log(`  ✓ Logged in: ${user.email}`, 'green');
            } else {
                log(`  ✗ Failed to login ${user.email}: ${JSON.stringify(response.data)}`, 'red');
            }
        } catch (error) {
            log(`  ✗ Login error ${user.email}: ${error.message}`, 'red');
        }
    }
}

async function createTestEvent(options = {}) {
    const eventData = {
        name: options.name || `Test Event ${Date.now()}`,
        date: options.date || new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        location: options.location || 'Test Location',
        description: options.description || 'Automated test event',
        eventType: options.eventType || 'straight',
        maxMaleParticipants: options.maxMaleParticipants || 10,
        maxFemaleParticipants: options.maxFemaleParticipants || 10,
        minAge: options.minAge || 18,
        maxAge: options.maxAge || 99,
        status: options.status || 'Active'
    };

    const event = new Event(eventData);

    if (options.password) {
        await event.setPassword(options.password);
    }

    await event.save();
    testData.events.push(event);

    return event;
}

// ============================================
// TEST CASES
// ============================================

async function testEventCreation() {
    log('\n🧪 Test: Event Creation via API', 'blue');

    const response = await apiRequest('POST', '/api/events', {
        name: `API Created Event ${Date.now()}`,
        date: new Date(Date.now() + 48 * 60 * 60 * 1000),
        location: 'API Test Location',
        description: 'Created via API test',
        eventType: 'straight',
        maxMaleParticipants: 5,
        maxFemaleParticipants: 5
    });

    if (response.ok && response.data?._id) {
        // Track for cleanup
        testData.events.push({ _id: response.data._id });
        logTest('Event creation via API', true);
        return response.data;
    } else {
        logTest('Event creation via API', false, JSON.stringify(response.data));
        return null;
    }
}

async function testEventRetrieval() {
    log('\n🧪 Test: Event Retrieval', 'blue');

    const event = await createTestEvent({ name: 'Retrieval Test Event' });

    const response = await apiRequest('GET', `/api/events/${event._id}`);

    logTest('Get event by ID',
        response.ok && response.data?.name === 'Retrieval Test Event',
        response.ok ? '' : JSON.stringify(response.data));

    const listResponse = await apiRequest('GET', '/api/events');

    logTest('List events',
        listResponse.ok && Array.isArray(listResponse.data),
        listResponse.ok ? '' : JSON.stringify(listResponse.data));
}

async function testBookingSuccess() {
    log('\n🧪 Test: Booking Success', 'blue');

    const event = await createTestEvent({ name: 'Booking Success Event' });
    const token = testData.tokens['event-test-man-straight@test.slush.app'];

    if (!token) {
        logTest('Booking success (man)', false, 'No auth token available');
        return;
    }

    const response = await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    logTest('Book event (man interested in women)',
        response.ok && response.data?.message === 'Successfully booked',
        response.ok ? '' : JSON.stringify(response.data));

    // Book with woman
    const womanToken = testData.tokens['event-test-woman-straight@test.slush.app'];
    if (womanToken) {
        const womanResponse = await apiRequest('POST', `/api/events/${event._id}/book`, {}, womanToken);
        logTest('Book event (woman interested in men)',
            womanResponse.ok && womanResponse.data?.message === 'Successfully booked',
            womanResponse.ok ? '' : JSON.stringify(womanResponse.data));
    }

    return event;
}

async function testBookingAgeValidation() {
    log('\n🧪 Test: Age Validation', 'blue');

    const event = await createTestEvent({
        name: 'Age Validation Event',
        minAge: 21,
        maxAge: 35
    });

    const underageToken = testData.tokens['event-test-underage@test.slush.app'];

    if (!underageToken) {
        logTest('Age validation (too young)', false, 'No auth token for underage user');
        return;
    }

    const response = await apiRequest('POST', `/api/events/${event._id}/book`, {}, underageToken);

    logTest('Age validation rejects underage user',
        response.status === 400 && response.data?.message?.includes('ages'),
        `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);
}

async function testBookingOrientationMismatch() {
    log('\n🧪 Test: Orientation Mismatch', 'blue');

    // Create straight event
    const straightEvent = await createTestEvent({
        name: 'Straight Event Only',
        eventType: 'straight'
    });

    // Try to book with gay man
    const gayManToken = testData.tokens['event-test-man-gay@test.slush.app'];

    if (!gayManToken) {
        logTest('Orientation mismatch (gay man on straight event)', false, 'No auth token');
        return;
    }

    const response = await apiRequest('POST', `/api/events/${straightEvent._id}/book`, {}, gayManToken);

    logTest('Orientation mismatch rejected',
        response.status === 400 && response.data?.message?.includes('orientation'),
        `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);

    // Non-binary on straight event
    const nbToken = testData.tokens['event-test-nonbinary@test.slush.app'];
    if (nbToken) {
        const nbResponse = await apiRequest('POST', `/api/events/${straightEvent._id}/book`, {}, nbToken);
        logTest('Non-binary rejected from straight event',
            nbResponse.status === 400,
            `Status: ${nbResponse.status}, Message: ${nbResponse.data?.message || 'none'}`);
    }
}

async function testPasswordProtectedEvent() {
    log('\n🧪 Test: Password Protected Event', 'blue');

    const event = await createTestEvent({
        name: 'Password Protected Event',
        password: 'secretpass123'
    });

    const token = testData.tokens['event-test-man-straight@test.slush.app'];

    if (!token) {
        logTest('Password protected event', false, 'No auth token');
        return;
    }

    // Try without password
    const noPassResponse = await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    logTest('Password required message returned',
        noPassResponse.status === 400 && noPassResponse.data?.requiresPassword === true,
        `Status: ${noPassResponse.status}, Data: ${JSON.stringify(noPassResponse.data)}`);

    // Try with wrong password
    const wrongPassResponse = await apiRequest('POST', `/api/events/${event._id}/book`,
        { password: 'wrongpassword' }, token);

    logTest('Wrong password rejected',
        wrongPassResponse.status === 401,
        `Status: ${wrongPassResponse.status}`);

    // Try with correct password
    const correctPassResponse = await apiRequest('POST', `/api/events/${event._id}/book`,
        { password: 'secretpass123' }, token);

    logTest('Correct password accepted',
        correctPassResponse.ok && correctPassResponse.data?.message === 'Successfully booked',
        `Status: ${correctPassResponse.status}, Data: ${JSON.stringify(correctPassResponse.data)}`);
}

async function testDuplicateBooking() {
    log('\n🧪 Test: Duplicate Booking Prevention', 'blue');

    const event = await createTestEvent({ name: 'Duplicate Booking Event' });
    const token = testData.tokens['event-test-woman-straight@test.slush.app'];

    if (!token) {
        logTest('Duplicate booking prevention', false, 'No auth token');
        return;
    }

    // First booking
    await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    // Try duplicate
    const response = await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    logTest('Duplicate booking rejected',
        response.status === 400 && response.data?.message?.includes('Already booked'),
        `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);
}

async function testCapacityFull() {
    log('\n🧪 Test: Capacity Full', 'blue');

    const event = await createTestEvent({
        name: 'Capacity Test Event',
        maxMaleParticipants: 1,
        maxFemaleParticipants: 1
    });

    // Book with first man
    const manToken = testData.tokens['event-test-man-straight@test.slush.app'];
    if (manToken) {
        await apiRequest('POST', `/api/events/${event._id}/book`, {}, manToken);
    }

    // Try to book with second man (gay man, but try anyway - should fail on capacity)
    // Actually we need another straight man... let's use a woman instead
    const womanToken = testData.tokens['event-test-woman-straight@test.slush.app'];
    const woman2Token = testData.tokens['event-test-woman2@test.slush.app'];

    if (womanToken) {
        await apiRequest('POST', `/api/events/${event._id}/book`, {}, womanToken);
    }

    if (woman2Token) {
        const response = await apiRequest('POST', `/api/events/${event._id}/book`, {}, woman2Token);
        logTest('Capacity full rejected',
            response.status === 400 && response.data?.message?.includes('slots'),
            `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);
    } else {
        logTest('Capacity full rejected', false, 'No second woman token available');
    }
}

async function testLeaveEvent() {
    log('\n🧪 Test: Leave Event', 'blue');

    const event = await createTestEvent({ name: 'Leave Event Test' });
    const token = testData.tokens['event-test-man-straight@test.slush.app'];

    if (!token) {
        logTest('Leave event', false, 'No auth token');
        return;
    }

    // Book first
    await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    // Leave
    const response = await apiRequest('POST', `/api/events/${event._id}/leave`, {}, token);

    logTest('Leave event',
        response.ok && response.data?.message?.includes('left'),
        `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);

    return event;
}

async function testRejoinEvent() {
    log('\n🧪 Test: Rejoin Event', 'blue');

    const event = await createTestEvent({ name: 'Rejoin Event Test' });
    const token = testData.tokens['event-test-man-straight@test.slush.app'];

    if (!token) {
        logTest('Rejoin event', false, 'No auth token');
        return;
    }

    // Book first
    await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    // Leave
    await apiRequest('POST', `/api/events/${event._id}/leave`, {}, token);

    // Rejoin
    const response = await apiRequest('POST', `/api/events/${event._id}/rejoin`, {}, token);

    logTest('Rejoin event after leaving',
        response.ok && response.data?.message?.includes('rejoined'),
        `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);
}

async function testNextPartner() {
    log('\n🧪 Test: Next Partner Matching', 'blue');

    const event = await createTestEvent({ name: 'Partner Matching Event' });

    const manToken = testData.tokens['event-test-man-straight@test.slush.app'];
    const womanToken = testData.tokens['event-test-woman-straight@test.slush.app'];
    const woman2Token = testData.tokens['event-test-woman2@test.slush.app'];
    const woman3Token = testData.tokens['event-test-woman3@test.slush.app'];

    // Book all users
    if (manToken) await apiRequest('POST', `/api/events/${event._id}/book`, {}, manToken);
    if (womanToken) await apiRequest('POST', `/api/events/${event._id}/book`, {}, womanToken);
    if (woman2Token) await apiRequest('POST', `/api/events/${event._id}/book`, {}, woman2Token);
    if (woman3Token) await apiRequest('POST', `/api/events/${event._id}/book`, {}, woman3Token);

    if (!manToken) {
        logTest('Next partner', false, 'No auth token');
        return;
    }

    // Get first partner
    const response1 = await apiRequest('POST', `/api/agora/event/${event._id}/next-partner`, {}, manToken);

    logTest('Get first partner',
        response1.ok && response1.data?.partner?.id,
        response1.ok ? `Partner: ${response1.data?.partner?.name}` : JSON.stringify(response1.data));

    if (!response1.ok) return;

    const firstPartnerId = response1.data.partner.id;

    // Get second partner, excluding first
    const response2 = await apiRequest('POST', `/api/agora/event/${event._id}/next-partner`,
        { pairedPartnerIds: [firstPartnerId] }, manToken);

    logTest('Get second partner (different from first)',
        response2.ok && response2.data?.partner?.id && response2.data.partner.id !== firstPartnerId,
        response2.ok ? `Partner: ${response2.data?.partner?.name}, Excluded: ${response2.data?.totalExcluded}` : JSON.stringify(response2.data));

    if (!response2.ok) return;

    const secondPartnerId = response2.data.partner.id;

    // Get third partner
    const response3 = await apiRequest('POST', `/api/agora/event/${event._id}/next-partner`,
        { pairedPartnerIds: [firstPartnerId, secondPartnerId] }, manToken);

    logTest('Get third partner (different from first two)',
        response3.ok && response3.data?.partner?.id &&
        response3.data.partner.id !== firstPartnerId &&
        response3.data.partner.id !== secondPartnerId,
        response3.ok ? `Partner: ${response3.data?.partner?.name}` : JSON.stringify(response3.data));
}

async function testAllPartnersExhausted() {
    log('\n🧪 Test: All Partners Exhausted', 'blue');

    const event = await createTestEvent({
        name: 'Partners Exhausted Event',
        maxMaleParticipants: 2,
        maxFemaleParticipants: 1
    });

    const manToken = testData.tokens['event-test-man-straight@test.slush.app'];
    const womanToken = testData.tokens['event-test-woman-straight@test.slush.app'];

    // Book both
    if (manToken) await apiRequest('POST', `/api/events/${event._id}/book`, {}, manToken);
    if (womanToken) await apiRequest('POST', `/api/events/${event._id}/book`, {}, womanToken);

    if (!manToken || !womanToken) {
        logTest('All partners exhausted', false, 'Missing tokens');
        return;
    }

    // Get first partner
    const response1 = await apiRequest('POST', `/api/agora/event/${event._id}/next-partner`, {}, manToken);

    if (!response1.ok || !response1.data?.partner?.id) {
        logTest('All partners exhausted', false, 'Could not get first partner');
        return;
    }

    // Try to get another partner with the only one excluded
    const response2 = await apiRequest('POST', `/api/agora/event/${event._id}/next-partner`,
        { pairedPartnerIds: [response1.data.partner.id] }, manToken);

    logTest('All partners exhausted response',
        response2.status === 404 && response2.data?.allPartnersExhausted === true,
        `Status: ${response2.status}, Data: ${JSON.stringify(response2.data)}`);
}

async function testBookingStatus() {
    log('\n🧪 Test: Booking Status Check', 'blue');

    const event = await createTestEvent({ name: 'Booking Status Event' });
    const token = testData.tokens['event-test-man-straight@test.slush.app'];

    if (!token) {
        logTest('Booking status check', false, 'No auth token');
        return;
    }

    // Check before booking
    const beforeResponse = await apiRequest('GET', `/api/events/${event._id}/booking-status`, null, token);

    logTest('Booking status (not booked)',
        beforeResponse.ok && beforeResponse.data?.isBooked === false,
        `isBooked: ${beforeResponse.data?.isBooked}`);

    // Book
    await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    // Check after booking
    const afterResponse = await apiRequest('GET', `/api/events/${event._id}/booking-status`, null, token);

    logTest('Booking status (booked)',
        afterResponse.ok && afterResponse.data?.isBooked === true,
        `isBooked: ${afterResponse.data?.isBooked}`);
}

async function testUserBookings() {
    log('\n🧪 Test: User Bookings Endpoint', 'blue');

    const event = await createTestEvent({ name: 'User Bookings Event' });
    const token = testData.tokens['event-test-woman-straight@test.slush.app'];

    if (!token) {
        logTest('User bookings', false, 'No auth token');
        return;
    }

    // Book the event
    await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    // Get user's bookings
    const response = await apiRequest('GET', '/api/events/user/bookings', null, token);

    logTest('Get user bookings',
        response.ok && Array.isArray(response.data) && response.data.length > 0,
        `Count: ${response.data?.length || 0}`);
}

async function testCancelBooking() {
    log('\n🧪 Test: Cancel Booking', 'blue');

    const event = await createTestEvent({ name: 'Cancel Booking Event' });
    const token = testData.tokens['event-test-man-straight@test.slush.app'];

    if (!token) {
        logTest('Cancel booking', false, 'No auth token');
        return;
    }

    // Book first
    await apiRequest('POST', `/api/events/${event._id}/book`, {}, token);

    // Cancel
    const response = await apiRequest('DELETE', `/api/events/${event._id}/book`, null, token);

    logTest('Cancel booking',
        response.ok && response.data?.message?.includes('cancelled'),
        `Status: ${response.status}, Message: ${response.data?.message || 'none'}`);

    // Verify booking status
    const statusResponse = await apiRequest('GET', `/api/events/${event._id}/booking-status`, null, token);

    logTest('Booking status after cancel',
        statusResponse.ok && statusResponse.data?.isBooked === false,
        `isBooked: ${statusResponse.data?.isBooked}`);
}

async function testEventParticipants() {
    log('\n🧪 Test: Event Participants', 'blue');

    const event = await createTestEvent({ name: 'Participants Event' });

    const manToken = testData.tokens['event-test-man-straight@test.slush.app'];
    const womanToken = testData.tokens['event-test-woman-straight@test.slush.app'];

    // Book both
    if (manToken) await apiRequest('POST', `/api/events/${event._id}/book`, {}, manToken);
    if (womanToken) await apiRequest('POST', `/api/events/${event._id}/book`, {}, womanToken);

    // Get participants
    const response = await apiRequest('GET', `/api/events/${event._id}/participants`);

    logTest('Get event participants',
        response.ok && response.data?.maleCount >= 0 && response.data?.femaleCount >= 0,
        `Male: ${response.data?.maleCount}, Female: ${response.data?.femaleCount}, Total: ${response.data?.totalParticipants}`);
}

// ============================================
// CLEANUP
// ============================================

async function cleanup() {
    log('\n🧹 Cleaning up test data...', 'cyan');

    // Delete test events
    for (const event of testData.events) {
        try {
            if (event._id) {
                await Event.findByIdAndDelete(event._id);
                await EventBooking.deleteMany({ eventId: event._id });
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    log(`  ✓ Deleted ${testData.events.length} test events`, 'green');

    // Delete test users
    for (const user of testData.users) {
        try {
            await User.findByIdAndDelete(user._id);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    log(`  ✓ Deleted ${testData.users.length} test users`, 'green');
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runTests() {
    log('╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║     SLUSH EVENT TESTING - AUTOMATED TEST SUITE            ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    log(`\nAPI URL: ${API_URL}`, 'yellow');
    log(`Timestamp: ${new Date().toISOString()}`, 'yellow');

    try {
        // Connect to database
        log('\n📡 Connecting to MongoDB...', 'cyan');
        await mongoose.connect(MONGODB_URI);
        log('  ✓ Connected to MongoDB', 'green');

        // Load models
        await loadModels();

        // Setup
        await createTestUsers();
        await loginTestUsers();

        // Run all tests
        await testEventCreation();
        await testEventRetrieval();
        await testBookingSuccess();
        await testBookingAgeValidation();
        await testBookingOrientationMismatch();
        await testPasswordProtectedEvent();
        await testDuplicateBooking();
        await testCapacityFull();
        await testLeaveEvent();
        await testRejoinEvent();
        await testNextPartner();
        await testAllPartnersExhausted();
        await testBookingStatus();
        await testUserBookings();
        await testCancelBooking();
        await testEventParticipants();

        // Cleanup
        await cleanup();

    } catch (error) {
        log(`\n❌ Fatal error: ${error.message}`, 'red');
        console.error(error.stack);
    }

    // Results summary
    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                    TEST RESULTS SUMMARY                    ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');

    log(`\n  Total Tests: ${passCount + failCount}`, 'yellow');
    log(`  ✅ Passed: ${passCount}`, 'green');
    log(`  ❌ Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');

    if (failCount > 0) {
        log('\n  Failed Tests:', 'red');
        results.filter(r => !r.passed).forEach(r => {
            log(`    • ${r.testName}`, 'red');
            if (r.details) log(`      ${r.details}`, 'yellow');
        });
    }

    log('\n');

    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
}

runTests();
