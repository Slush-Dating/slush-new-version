/**
 * Helper script to check and fix MongoDB connection string format
 * This helps identify issues with special characters in passwords
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
}

console.log('🔍 Analysing MongoDB Connection String...\n');

// Parse the connection string
const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)(\/([^?]+))?(\?.*)?/);

if (!match) {
    console.error('❌ Invalid connection string format');
    console.log('Expected format: mongodb+srv://username:password@cluster.mongodb.net/database?options');
    process.exit(1);
}

const [, username, password, host, , database, options] = match;

console.log('📋 Connection String Breakdown:');
console.log(`   Username: ${username}`);
console.log(`   Password: ${'*'.repeat(password.length)} (${password.length} characters)`);
console.log(`   Host: ${host}`);
console.log(`   Database: ${database || '(not specified - will use default)'}`);
console.log(`   Options: ${options || '(none)'}`);

// Check for special characters in password
const specialChars = password.match(/[^a-zA-Z0-9._~-]/g);
if (specialChars) {
    console.log('\n⚠️  Password contains special characters that may need URL encoding:');
    console.log(`   Found: ${[...new Set(specialChars)].join(', ')}`);
    console.log('\n💡 If authentication fails, try URL encoding these characters:');
    
    const encodingMap = {
        '@': '%40',
        ':': '%3A',
        '/': '%2F',
        '?': '%3F',
        '#': '%23',
        '[': '%5B',
        ']': '%5D',
        ' ': '%20',
        '%': '%25'
    };
    
    let encodedPassword = password;
    Object.entries(encodingMap).forEach(([char, encoded]) => {
        if (password.includes(char)) {
            encodedPassword = encodedPassword.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), encoded);
            console.log(`   ${char} → ${encoded}`);
        }
    });
    
    const encodedUri = uri.replace(`:${password}@`, `:${encodedPassword}@`);
    console.log('\n📝 Try this encoded connection string:');
    console.log(`MONGODB_URI="${encodedUri}"`);
} else {
    console.log('\n✅ Password format looks good (no special characters detected)');
}

console.log('\n💡 Next Steps:');
console.log('1. If authentication still fails, verify the password in MongoDB Atlas');
console.log('2. Go to: MongoDB Atlas → Database Access → Edit User');
console.log('3. Reset the password if needed');
console.log('4. Make sure to copy the password exactly (including any special characters)');







