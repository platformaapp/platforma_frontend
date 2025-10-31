import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

const USERS_URL = endpoints.users;

type User = {
  id?: string | number;
  email?: string;
  fullName?: string;
  role?: string;
  avatarUrl?: string;
  phone?: string;
};

export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(USERS_URL, {
        headers: {
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        const message = typeof data === 'string' ? data : data?.message || 'Failed to load users';
        throw new Error(message);
      }
      setUsers(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="title">Пользователи</ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}> 
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText>Ошибка: {error}</ThemedText>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.item}>
              {Object.entries(item || {}).map(([key, value]) => (
                <View key={key} style={{ flexDirection: 'row', marginBottom: 4, flexWrap: 'wrap' }}>
                  <ThemedText type="defaultSemiBold" style={{ marginRight: 6 }}>{String(key)}:</ThemedText>
                  <ThemedText style={{ flexShrink: 1 }}>
                    {formatValue(value)}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  headerRow: {
    marginBottom: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    paddingVertical: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
});

function formatValue(value: any): string {
  if (value === null || value === undefined) return '' + value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}


