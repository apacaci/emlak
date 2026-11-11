import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';

// Uygulama yalnızca bu siteyi gösterir. Site güncellenince uygulama da güncellenir.
const SITE_URL = 'https://apacaci.github.io/emlak/';

const GROUND = '#F4F6F3';
const INK = '#14201B';
const MUTED = '#56635C';
const ACCENT = '#0F6B4F';

function isSiteUrl(url: string): boolean {
  return url.startsWith(SITE_URL) || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:');
}

export default function App() {
  const webRef = useRef<WebView<{}>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  // Site, kopyalama isteğini uygulamaya iletir; panoya uygulama yazar.
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg && msg.type === 'copy' && typeof msg.text === 'string') {
        Clipboard.setStringAsync(msg.text).catch(() => {});
      }
    } catch {
      // Tanınmayan mesajlar yok sayılır.
    }
  }, []);

  const retry = () => {
    setFailed(false);
    webRef.current?.reload();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <WebView<{}>
          ref={webRef}
          source={{ uri: SITE_URL }}
          style={s.web}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[s.center, s.cover]}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          )}
          onNavigationStateChange={onNavChange}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 400) setFailed(true);
          }}
          onShouldStartLoadWithRequest={(req) => {
            if (isSiteUrl(req.url)) return true;
            // Diğer siteler ve WhatsApp bağlantıları telefonun kendi uygulamasında açılır.
            Linking.openURL(req.url).catch(() => {});
            return false;
          }}
        />
        {failed && (
          <View style={[s.center, s.cover]}>
            <Text style={s.title}>Site açılamadı</Text>
            <Text style={s.body}>İnternet bağlantını kontrol edip tekrar dene.</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [s.button, pressed && s.pressed]}>
              <Text style={s.buttonText}>Tekrar dene</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GROUND },
  web: { flex: 1, backgroundColor: GROUND },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: GROUND },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  title: { fontSize: 22, fontWeight: '700', color: INK },
  body: { fontSize: 15, color: MUTED, textAlign: 'center' },
  button: { minHeight: 48, paddingHorizontal: 24, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  pressed: { opacity: 0.8 },
});
