import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { getUserProfile } from '@/lib/auth';
import { withoutDeepLinkingPrompt } from '@/lib/jitsi';

/**
 * expo-linking's createURL() has no native-app meaning on web (it returns a
 * same-origin https URL there, not our custom scheme) — build the
 * platformaapp:// deep link by hand so "Присоединиться в приложении" actually
 * targets the app, not another web page.
 */
function buildAppDeepLink(url: string, title: string): string {
  const scheme = (Constants.expoConfig?.scheme as string | undefined) ?? 'platformaapp';
  const params = new URLSearchParams({ url, title });
  return `${scheme}://conference?${params.toString()}`;
}

/** URL комнаты вида https://domain/roomName?query#hash → { domain, roomName, jwt }. */
function parseJitsiUrl(rawUrl: string): { domain: string; roomName: string; jwt?: string } {
  const [withoutHash] = rawUrl.split('#');
  const [withoutQuery, queryString = ''] = withoutHash.split('?');
  const withoutProtocol = withoutQuery.replace(/^https?:\/\//, '');
  const slashIndex = withoutProtocol.indexOf('/');
  const domain = slashIndex === -1 ? withoutProtocol : withoutProtocol.slice(0, slashIndex);
  const roomName = slashIndex === -1 ? '' : withoutProtocol.slice(slashIndex + 1);
  let jwt: string | undefined;
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key === 'jwt' && value) jwt = decodeURIComponent(value);
  }
  return { domain, roomName, jwt };
}

/** Безопасно встраивает произвольную строку (название лекции, имя пользователя) в inline-скрипт. */
function jsString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003C');
}

/**
 * interfaceConfigOverwrite.SHOW_JITSI_WATERMARK не гарантированно работает на всех
 * версиях self-hosted Jitsi (сервер может игнорировать client-side overrides для
 * interface_config.js). Дополнительно форсируем скрытие CSS-ом прямо внутри iframe
 * конференции — inject идёт во все фреймы (injectedJavaScriptForMainFrameOnly=false),
 * поэтому применяется и к нашей обёртке, и к самому Jitsi.
 */
const HIDE_WATERMARK_SCRIPT = `
(function () {
  function hide() {
    var style = document.createElement('style');
    style.setAttribute('data-platforma-hide-watermark', 'true');
    style.textContent = '[class*="watermark" i] { display: none !important; visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hide);
  } else {
    hide();
  }
})();
true;
`;

function buildConferenceHtml(params: {
  domain: string;
  roomName: string;
  jwt?: string;
  subject: string;
  displayName: string;
  avatarUrl: string;
}): string {
  const { domain, roomName, jwt, subject, displayName, avatarUrl } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>html, body, #jitsi-container { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; }</style>
</head>
<body>
  <div id="jitsi-container"></div>
  <script src="https://${domain}/external_api.js"></script>
  <script>
    var api = new JitsiMeetExternalAPI(${jsString(domain)}, {
      roomName: ${jsString(roomName)},
      parentNode: document.querySelector('#jitsi-container'),
      ${jwt ? `jwt: ${jsString(jwt)},` : ''}
      userInfo: {
        displayName: ${jsString(displayName)},
        avatarURL: ${jsString(avatarUrl)}
      },
      configOverwrite: {
        disableDeepLinking: true,
        subject: ${jsString(subject)}
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        MOBILE_APP_PROMO: false
      }
    });

    // Некоторые версии Jitsi игнорируют userInfo/subject, переданные в конструктор —
    // дублируем командами после того, как встреча реально запустилась.
    api.addEventListener('videoConferenceJoined', function () {
      ${avatarUrl ? `api.executeCommand('avatarUrl', ${jsString(avatarUrl)});` : ''}
      ${displayName ? `api.executeCommand('displayName', ${jsString(displayName)});` : ''}
      api.executeCommand('subject', ${jsString(subject)});
    });

    function notifyLeave() {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('jitsi-left');
    }
    api.addEventListener('readyToClose', notifyLeave);
    api.addEventListener('videoConferenceLeft', notifyLeave);
  </script>
</body>
</html>`;
}

/** Полноэкранный WebView конференции Jitsi (через IFrame API) — открывается прямо в приложении. */
export default function ConferenceScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; avatarUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserProfile()
      .then((p) => {
        if (!cancelled) setProfile({ name: p?.full_name ?? '', avatarUrl: p?.avatar_url ?? '' });
      })
      .catch(() => {
        if (!cancelled) setProfile({ name: '', avatarUrl: '' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = useMemo(() => (url ? parseJitsiUrl(url) : null), [url]);

  const html = useMemo(() => {
    if (!parsed || !parsed.domain || !parsed.roomName || !profile) return null;
    return buildConferenceHtml({
      domain: parsed.domain,
      roomName: parsed.roomName,
      jwt: parsed.jwt,
      subject: title || 'Видеовстреча',
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
    });
  }, [parsed, title, profile]);

  const leaveToEvents = () => router.replace('/events');

  if (!url) {
    router.replace('/events');
    return null;
  }

  // Веб: показываем свой выбор "в приложении / в браузере" вместо родного экрана
  // Jitsi (у него сломанный app-deep-link и нет способа открыть именно наше приложение).
  if (Platform.OS === 'web') {
    const openInBrowser = () => {
      const w = (globalThis as any).window;
      if (w) w.location.href = withoutDeepLinkingPrompt(url);
    };
    const openInApp = () => {
      const w = (globalThis as any).window;
      if (!w) return;
      w.location.href = buildAppDeepLink(url, title || '');
    };
    return (
      <View style={styles.webChooser}>
        <View style={styles.webChooserCard}>
          <Text style={styles.webChooserTitle} numberOfLines={2}>{title || 'Видеовстреча'}</Text>
          <Text style={styles.webChooserSubtitle}>Как вы хотите присоединиться к встрече?</Text>
          <Pressable style={styles.webChooserButtonPrimary} onPress={openInApp}>
            <Text style={styles.webChooserButtonPrimaryText}>Присоединиться в приложении</Text>
          </Pressable>
          <Pressable style={styles.webChooserButtonSecondary} onPress={openInBrowser}>
            <Text style={styles.webChooserButtonSecondaryText}>Присоединиться в браузере</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 12 }]}>
        <Pressable style={styles.closeButton} onPress={leaveToEvents} hitSlop={12}>
          <MaterialIcons name="close" size={26} color="#181818" />
        </Pressable>
      </View>

      {html ? (
        <WebView
          source={{ html, baseUrl: `https://${parsed?.domain}/` }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType={Platform.OS === 'ios' ? 'grant' : undefined}
          injectedJavaScriptBeforeContentLoaded={HIDE_WATERMARK_SCRIPT}
          injectedJavaScriptForMainFrameOnly={false}
          onLoadEnd={() => setLoading(false)}
          onMessage={(event: WebViewMessageEvent) => {
            if (event.nativeEvent.data === 'jitsi-left') leaveToEvents();
          }}
        />
      ) : null}

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
  webChooser: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  webChooserCard: { width: '100%', maxWidth: 360, alignItems: 'stretch' },
  webChooserTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#181818', textAlign: 'center', marginBottom: 8 },
  webChooserSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076', textAlign: 'center', marginBottom: 24 },
  webChooserButtonPrimary: { backgroundColor: '#E02D2D', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  webChooserButtonPrimaryText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-Medium' },
  webChooserButtonSecondary: { borderWidth: 1, borderColor: '#CFCFCF', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  webChooserButtonSecondaryText: { color: '#181818', fontSize: 16, fontFamily: 'Inter-Medium' },
});
