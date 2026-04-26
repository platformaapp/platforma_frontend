import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { EventBanner } from '@/components/event-banner';
import { HapticTab } from '@/components/haptic-tab';
import { TabIcon } from '@/components/tab-icons';

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
      tabBar={(props) => {
        const currentRoute = props.state.routes[props.state.index]?.name;
        return (
          <View>
            {currentRoute !== 'myevents' && <EventBanner />}
            <BottomTabBar {...props} />
          </View>
        );
      }}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: '#E02D2D',
        tabBarInactiveTintColor: '#181818',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#CFCFCF',
          height: 82,
          paddingBottom: 0,
          paddingTop: 12,
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
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="square" />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace('/events' as any);
            },
          }}
        />

        <Tabs.Screen
          name="explore"
          options={{
            title: '',
            tabBarButton: HapticTab,
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="triangle" />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace('/explore' as any);
            },
          }}
        />

        <Tabs.Screen
          name="myevents"
          options={{
            title: '',
            tabBarButton: HapticTab,
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="circle" />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace('/myevents' as any);
            },
          }}
        />

        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: '',
            tabBarButton: HapticTab,
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} type="home" />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace('/profile' as any);
            },
          }}
        />
    </Tabs>
  );
}
