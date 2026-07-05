import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

/** Полноэкранный WebView конференции Jitsi — открывается прямо в приложении, без выхода в браузер. */
export default function ConferenceScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  if (!url) {
    router.back();
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 12 }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="close" size={26} color="#181818" />
        </Pressable>
      </View>

      <WebView
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType={Platform.OS === 'ios' ? 'grant' : undefined}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={(request) => request.url.startsWith('http://') || request.url.startsWith('https://') || request.url.startsWith('about:')}
      />

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E02D2D" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
