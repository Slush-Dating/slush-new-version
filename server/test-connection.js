/**
 * Test script to verify MongoDB connection and API server setup
 * Run with: node test-connection.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
    console.log('🧪 Testing MongoDB Connection...\n');
    
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
        console.error('❌ ERROR: MONGODB_URI is not set in .env file');
        console.log('\nPlease add MONGODB_URI to your server/.env file');
        process.exit(1);
    }

    // Parse connection string to check format
    const uri = process.env.MONGODB_URI;
    const maskedUri = uri.replace(/:[^:@]+@/, ':****@');
    console.log('📋 Connection String:', maskedUri);
    
    // Check for common issues
    console.log('\n🔍 Checking connection string format...');
    
    // Extract username from connection string
    const usernameMatch = uri.match(/mongodb\+srv:\/\/([^:]+):/);
    if (usernameMatch) {
        console.log(`   Username: ${usernameMatch[1]}`);
    }
    
    // Check if password needs URL encoding
    const passwordMatch = uri.match(/:[^@]+@/);
    if (passwordMatch) {
        const passwordPart = passwordMatch[0].slice(1, -1);
        const needsEncoding = /[^a-zA-Z0-9._~-]/.test(passwordPart);
        if (needsEncoding) {
            console.log('   ⚠️  Password contains special characters - may need URL encoding');
        }
    }
    
    // Check if database name is specified
    const dbMatch = uri.match(/\.mongodb\.net\/([^?]+)/);
    if (!dbMatch) {
        console.log('   ⚠️  No database name specified - will use default database');
    } else {
        console.log(`   Database: ${dbMatch[1]}`);
    }
    
    console.log('');

    try {
        console.log('⏳ Connecting to MongoDB...');
        
        // Try connection with better error handling
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000, // 10 second timeout
            retryWrites: true,
            w: 'majority'
        });
        
        console.log('✅ Successfully connected to MongoDB!');
        
        // Show connection details
        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        console.log(`   Database Name: ${dbName}`);
        
        // Test a simple query
        const collections = await db.listCollections().toArray();
        console.log(`\n📊 Found ${collections.length} collections in database`);
        
        if (collections.length > 0) {
            console.log('Collections:', collections.map(c => c.name).join(', '));
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Connection test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ MongoDB connection failed!');
        console.error('Error:', error.message);
        console.error('Error Code:', error.code || 'N/A');
        
        // Provide specific guidance based on error
        if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
            console.error('\n🔐 Authentication Failed - Possible Solutions:');
            console.error('1. Verify the password is correct in MongoDB Atlas');
            console.error('2. If password contains special characters, URL encode them:');
            console.error('   - @ becomes %40');
            console.error('   - : becomes %3A');
            console.error('   - / becomes %2F');
            console.error('   - ? becomes %3F');
            console.error('   - # becomes %23');
            console.error('   - [ becomes %5B');
            console.error('   - ] becomes %5D');
            console.error('3. Reset the database user password in MongoDB Atlas');
            console.error('4. Verify the username is correct');
            console.error('\n💡 To get a fresh connection string:');
            console.error('   1. Go to MongoDB Atlas → Clusters → Connect');
            console.error('   2. Choose "Connect your application"');
            console.error('   3. Copy the connection string');
            console.error('   4. Replace <password> with your actual password');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            console.error('\n🌐 Network Error - Possible Solutions:');
            console.error('1. Check your internet connection');
            console.error('2. Verify the cluster hostname is correct');
            console.error('3. Check if MongoDB Atlas cluster is running');
        } else if (error.message.includes('IP')) {
            console.error('\n🚫 IP Whitelist Error - Possible Solutions:');
            console.error('1. Go to MongoDB Atlas → Network Access');
            console.error('2. Add your current IP address (or 0.0.0.0/0 for all IPs)');
            console.error('3. Wait a few minutes for changes to propagate');
        }
        
        process.exit(1);
    }
}

testConnection();

