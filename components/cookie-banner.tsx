import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { acceptCookieConsent, isCookieConsentAccepted } from '@/lib/cookie-consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    isCookieConsentAccepted().then((accepted) => {
      if (!accepted) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  async function handleOk() {
    setVisible(false);
    await acceptCookieConsent();
  }

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Text style={styles.text}>Мы используем куки. Все так делают.</Text>
      <Pressable style={styles.button} onPress={handleOk}>
        <Text style={styles.buttonText}>ОК</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181818',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    marginRight: 16,
  },
  button: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
});
