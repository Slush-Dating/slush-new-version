/**
 * App Index - Redirects to appropriate screen
 */

import { Redirect } from 'expo-router';

export default function Index() {
    // Root layout handles authentication state and redirects appropriately
    return <Redirect href="/(auth)/landing" />;
}
