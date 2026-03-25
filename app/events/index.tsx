import { Redirect } from 'expo-router';

/** Список событий с API — в табе «События» */
export default function LegacyEventsIndex() {
  return <Redirect href="/(tabs)/events" />;
}
