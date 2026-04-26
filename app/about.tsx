import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
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
        <Text style={styles.mainTitle}>Платформа для онлайн-лекций, творческих занятий и встреч с наставниками.</Text>

        {/* 1. First screen */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Лекции, вебинары и мастер-классы в одном месте.</Text>
          <Text style={styles.subtitle}>Бронируйте и оплачивайте мероприятия онлайн</Text>
        </View>

        {/* 2. How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Как это работает</Text>
          {['Вы выбираете событие', 'Бронируете участие', 'Оплачиваете онлайн', 'Подключаетесь к мероприятию'].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* 3. Formats */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Форматы мероприятий</Text>
          {['Лекции', 'Паблик-толки', 'Творческие мастер-классы', 'Книжные клубы', 'Подкасты'].map((f, i) => (
            <Text key={i} style={styles.bulletItem}>— {f}</Text>
          ))}
        </View>

        {/* 4. Event cards */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Карточки событий</Text>
          <Text style={styles.body}>Каждое событие содержит: название, описание, дату и время, формат (лекция, мастер-класс) и цену.</Text>
          <View style={styles.exampleCard}>
            <Text style={styles.exampleTitle}>Лекция: Современное искусство</Text>
            <Text style={styles.exampleMeta}>12 мая, онлайн</Text>
            <Text style={styles.examplePrice}>1500 ₽</Text>
          </View>
        </View>

        {/* 5. Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Оплата</Text>
          <Text style={styles.body}>Оплата мероприятий осуществляется онлайн через платформу.</Text>
          <Text style={styles.body}>Доступ к событию предоставляется после подтверждения оплаты.</Text>
        </View>

        {/* 6. Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Контакты и реквизиты</Text>
          {[
            ['Исполнитель', 'Якунин Владислав Александрович'],
            ['Статус', 'Самозанятый (НПД)'],
            ['ИНН', '344214640369'],
            ['Email', 'v.yakunin2011@yandex.ru'],
            ['Телефон', '+7 905 390 12 93'],
            ['Банк', 'Альфа Банк'],
            ['Расчётный счёт', '40817810404981038195'],
          ].map(([label, value], i) => (
            <View key={i} style={styles.contactRow}>
              <Text style={styles.contactLabel}>{label}:</Text>
              <Text style={styles.contactValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* 7. Offer */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionHeading}>Оферта</Text>
          <Text style={styles.body}>
            Настоящий сайт является публичной офертой. Регистрируясь на платформе и оплачивая мероприятие, вы принимаете условия пользовательского соглашения и политики конфиденциальности, размещённых на сайте.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  mainTitle: {
    fontSize: 20, lineHeight: 28, fontFamily: 'Inter-Regular', color: '#181818',
    marginBottom: 24, marginTop: 8,
  },
  section: { marginBottom: 28 },
  lastSection: { marginBottom: 0 },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#555' },
  sectionHeading: {
    fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818',
    borderBottomWidth: 1, borderColor: '#1E1E1E', paddingBottom: 6, marginBottom: 12,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stepNum: {
    width: 24, height: 24, backgroundColor: '#1E1E1E', alignItems: 'center',
    justifyContent: 'center', marginRight: 10, flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#fff' },
  stepText: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', flex: 1 },
  bulletItem: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 8 },
  exampleCard: {
    borderWidth: 1, borderColor: '#1E1E1E', padding: 14, marginTop: 8,
  },
  exampleTitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  exampleMeta: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 4 },
  examplePrice: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818' },
  contactRow: { flexDirection: 'row', marginBottom: 8, flexWrap: 'wrap' },
  contactLabel: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#555', marginRight: 6, minWidth: 120 },
  contactValue: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', flex: 1 },
});
