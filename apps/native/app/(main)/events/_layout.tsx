/**
 * Events folder layout
 */

import { Stack } from 'expo-router';

export default function EventsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="[id]" />
            <Stack.Screen name="test" />
        </Stack>
    );
}
