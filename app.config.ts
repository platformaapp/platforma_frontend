import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

const config = appJson.expo as ExpoConfig;

const expoConfig: ExpoConfig = {
  ...config,
  // EXPO_PUBLIC_* variables are automatically inlined for the client.
};

export default expoConfig;


