import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMAIL = 'v.yakunin2011@yandex.ru';

export default function ContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.mainTitle}>Контакты для связи</Text>

        <Pressable onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
          <Text style={styles.email}>{EMAIL}</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Реквизиты сервиса</Text>
          <Row label="Наименование" value="Индивидуальный предприниматель Якунин Владислав Александрович" />
          <Row label="ИНН" value="344214640369" />
          <Row label="ОГРНИП" value="326344300061998" />
          <Row label="Юридический адрес" value="400007, Россия, Волгоградская обл., г. Волгоград, ул. Таращанцев, д. 8, кв. 1" />
          <Row label="Расчётный счёт" value="40802810000009675691" />
          <Row label="Банк" value="АО «ТБанк»" />
          <Row label="ИНН банка" value="7710140679" />
          <Row label="БИК банка" value="044525974" />
          <Row label="Корр. счёт банка" value="30101810145250000974" />
          <Row label="Адрес банка" value="127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26" />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}:</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  mainTitle: { fontSize: 22, lineHeight: 28, fontFamily: 'Gramatika-Bold', color: '#181818', marginTop: 4, marginBottom: 16 },
  email: { fontSize: 15, lineHeight: 22, fontFamily: 'Gramatika-Bold', color: '#181818', textDecorationLine: 'underline', marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionHeading: { fontSize: 14, lineHeight: 22, fontFamily: 'Gramatika-Regular', fontWeight: '700', color: '#181818', borderBottomWidth: 1, borderColor: '#1E1E1E', paddingBottom: 6, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  rowLabel: { fontSize: 13, lineHeight: 20, fontFamily: 'Gramatika-Regular', color: '#555', minWidth: 110, marginRight: 6 },
  rowValue: { fontSize: 13, lineHeight: 20, fontFamily: 'Gramatika-Regular', color: '#181818', flex: 1 },
});
