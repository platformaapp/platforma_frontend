import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { TabIcon } from '@/components/tab-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E02D2D',
        tabBarInactiveTintColor: '#181818',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#CFCFCF',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter-Regular',
        },
      }}>
      <Tabs.Screen
        name="events"
        options={{
          title: '',
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="circle" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '',
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="triangle" />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="square" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="home" />,
        }}
      />
    </Tabs>
  );
}
