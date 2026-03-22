import { Redirect } from 'expo-router';
import React from 'react';

// МОИ ЗАПИСИ moved to myevents tab
export default function IndexRedirect() {
  return <Redirect href="/(tabs)/myevents" />;
}
