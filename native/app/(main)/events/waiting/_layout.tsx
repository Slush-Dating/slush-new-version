/**
 * Waiting Room Layout
 */

import { Stack } from 'expo-router';

export default function WaitingLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
            }}
        />
    );
}
