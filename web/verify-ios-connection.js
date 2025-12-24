// Quick verification script to test iOS simulator connectivity
// Run this in browser console when testing in simulator

console.log('🔍 iOS Simulator Connection Test');
console.log('=================================');

const SERVER_IP = '192.168.1.208';
const SERVER_PORT = 5001;
const API_BASE = `http://${SERVER_IP}:${SERVER_PORT}/api`;

// Test basic connectivity
fetch(`${API_BASE}/health`)
  .then(response => {
    console.log('✅ Server reachable:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('📊 Health check response:', data);
  })
  .catch(error => {
    console.error('❌ Server not reachable:', error.message);
    console.log('💡 Check that server is running: pm2 status');
    console.log('💡 Verify firewall allows connections to port 5001');
  });

// Test auth endpoint
fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test123'
  })
})
  .then(response => {
    console.log('🔐 Auth endpoint response:', response.status);
    if (response.status === 400) {
      console.log('✅ Auth endpoint reachable (expected 400 for invalid credentials)');
    }
    return response.text();
  })
  .then(text => {
    try {
      const data = JSON.parse(text);
      console.log('📝 Auth response:', data);
    } catch (e) {
      console.log('📄 Auth response (text):', text);
    }
  })
  .catch(error => {
    console.error('❌ Auth endpoint error:', error.message);
  });

console.log('🌐 Current page location:', window.location.href);
console.log('📱 Is Capacitor:', !!(window as any).Capacitor);
console.log('🔗 Expected API URL:', API_BASE);
