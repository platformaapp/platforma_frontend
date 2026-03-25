import { Redirect, useLocalSearchParams } from 'expo-router';

/** Карточка события с API и регистрацией — в табе «События» */
export default function LegacyEventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <Redirect href="/(tabs)/events" />;
  }
  return <Redirect href={`/(tabs)/events/${id}`} />;
}
