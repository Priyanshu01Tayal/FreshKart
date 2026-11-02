import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="checkout"
          options={{
            headerShown: true,
            title: 'Checkout (COD)',
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="order/[id]"
          options={{
            headerShown: true,
            title: 'Live Order Tracking',
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="(auth)/login"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Verify Mobile Number',
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

