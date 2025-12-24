/**
 * User Directory Layout
 */

import { Stack } from 'expo-router';

export default function UserLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
            }}
        />
    );
}
