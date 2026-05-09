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
        <Text style={styles.mainTitle}>
          p34 — это онлайн-платформа для лекций, творческих занятий и встреч с наставниками.
        </Text>
        <Text style={styles.intro}>
          На платформе размещаются лекции, вебинары и мастер-классы, проводимые независимыми авторами и организациями.
        </Text>
        <Text style={styles.intro}>
          Платформа p34 предоставляет техническую возможность для размещения мероприятий, их бронирования, оплаты и участия в онлайн-формате. p34 не является исполнителем услуг — услуги оказываются непосредственно наставниками и организаторами.
        </Text>

        {/* Как это работает */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Как это работает</Text>
          {[
            'Вы выбираете мероприятие',
            'Бронируете участие',
            'Оплачиваете онлайн',
            'Получаете доступ и подключаетесь к мероприятию',
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Форматы */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Форматы мероприятий</Text>
          <Text style={styles.body}>Все мероприятия проводятся в онлайн-формате.</Text>
          {['Лекции', 'Паблик-толки', 'Творческие мастер-классы', 'Книжные клубы'].map((f, i) => (
            <Text key={i} style={styles.bulletItem}>— {f}</Text>
          ))}
        </View>

        {/* Кто проводит */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Кто проводит мероприятия</Text>
          <Text style={styles.body}>
            Мероприятия на платформе проводят независимые наставники и организаторы. Они самостоятельно формируют программу, содержание и стоимость своих мероприятий.
          </Text>
          <Text style={styles.bodyLabel}>Платформа p34 обеспечивает:</Text>
          {['Размещение мероприятий', 'Бронирование участия', 'Приём оплаты', 'Доступ к онлайн-формату'].map((item, i) => (
            <Text key={i} style={styles.bulletItem}>— {item}</Text>
          ))}
        </View>

        {/* Карточка мероприятия */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Карточка мероприятия</Text>
          <Text style={styles.body}>Каждое мероприятие содержит:</Text>
          {['Название', 'Описание', 'Дату и время', 'Формат', 'Стоимость участия'].map((item, i) => (
            <Text key={i} style={styles.bulletItem}>— {item}</Text>
          ))}
        </View>

        {/* Оплата */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Оплата</Text>
          <Text style={styles.body}>
            Оплата мероприятий осуществляется онлайн через платёжные сервисы, включая ЮKassa.
          </Text>
          <Text style={styles.body}>
            После успешной оплаты пользователю предоставляется доступ к мероприятию.
          </Text>
          <Text style={styles.body}>
            Платформа действует как агент по приёму платежей и удерживает комиссию. Оставшиеся средства перечисляются наставнику или организатору.
          </Text>
        </View>

        {/* Получение услуги */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Получение услуги</Text>
          <Text style={styles.body}>Доступ к мероприятию предоставляется:</Text>
          {['В личном кабинете пользователя', 'По ссылке, направляемой перед началом мероприятия'].map((item, i) => (
            <Text key={i} style={styles.bulletItem}>— {item}</Text>
          ))}
        </View>

        {/* Правовая информация */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Правовая информация</Text>
          <Text style={styles.body}>
            Настоящий сайт является публичной офертой. Регистрируясь на платформе или оплачивая мероприятие, пользователь принимает условия публичной оферты и политики конфиденциальности.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => router.push('/offer' as any)}>
              <Text style={styles.legalLink}>Публичная оферта →</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/privacy' as any)}>
              <Text style={styles.legalLink}>Политика конфиденциальности →</Text>
            </Pressable>
          </View>
        </View>

        {/* Контакты и реквизиты */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionHeading}>Контакты и реквизиты</Text>
          {[
            ['Оператор платформы', 'Якунин Владислав Александрович'],
            ['Статус', 'Плательщик налога на профессиональный доход (самозанятый)'],
            ['ИНН', '344214640369'],
            ['Email', 'v.yakunin2011@yandex.ru'],
            ['Телефон', '+7 905 390 12 93'],
            ['Банк', 'Альфа-Банк'],
            ['Расчётный счёт', '40817810404981038195'],
          ].map(([label, value], i) => (
            <View key={i} style={styles.contactRow}>
              <Text style={styles.contactLabel}>{label}:</Text>
              <Text style={styles.contactValue}>{value}</Text>
            </View>
          ))}
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
    marginBottom: 12, marginTop: 8,
  },
  intro: {
    fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#555',
    marginBottom: 10,
  },
  section: { marginTop: 20, marginBottom: 8 },
  lastSection: { marginBottom: 0 },
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
  body: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 8 },
  bodyLabel: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 6, marginTop: 4 },
  legalLinks: { gap: 8, marginTop: 4 },
  legalLink: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', textDecorationLine: 'underline' },
  bulletItem: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4, paddingLeft: 4 },
  contactRow: { flexDirection: 'row', marginBottom: 8, flexWrap: 'wrap' },
  contactLabel: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#555', marginRight: 6, minWidth: 120 },
  contactValue: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', flex: 1 },
});

