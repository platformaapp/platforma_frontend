import { Redirect } from 'expo-router';
import React from 'react';

export default function IndexRedirect() {
  return <Redirect href="/(tabs)/events" />;
}
