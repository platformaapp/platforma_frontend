import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Mentor = {
  id: string;
  name: string;
  role: string;
  bio: string;
  price: string;
  avatar: any;
};

const MENTORS: Mentor[] = [
  {
    id: '1',
    name: 'Андрей Осетров',
    role: 'Куратор, исследователь визуальной культуры',
    bio: 'Преподаю на стыке современного искусства, медиа и теории восприятия. Веду открытые курсы по визуальной грамотности, сотрудничал с Третьяковской галереей, ГЭС-2 и Garage Digital. Умею объяснять сложно просто, без пафоса и скуки. Считаю, что понимание искусства — это не про образование, а про внимание.',
    price: '2500 ₽ / час',
    avatar: require('@/assets/images/avatar.png'),
  },
  {
    id: '2',
    name: 'Варвара Михайлова',
    role: 'Коллекционер, програмный директор региональных грантов',
    bio: 'Пишу о независимом кино и дистрибуции. Составляю программы для «Каро Арт» и ММКФ, веду подкаст «Снять на улице». Расскажу, как наменять студии бренда 24 и не работать вовремя.',
    price: '2500 ₽ / час',
    avatar: require('@/assets/images/avatar.png'),
  },
  {
    id: '3',
    name: 'Кирилл Грачёв',
    role: 'Дизайнер цифровых и арт-директор',
    bio: 'Автор принтов «Golos» и «Berlinke Cyrillic». Консультировал The Village и «Логос» по типографике. Помогаю видеть в буквах ритм, а в сетке — свободу, даю инсайты по Figma.',
    price: '2500 ₽ / час',
    avatar: require('@/assets/images/avatar.png'),
  },
  {
    id: '4',
    name: 'Полина Селезнёва',
    role: 'Футуролог, исследователь технологий',
    bio: 'Исследую экосистемы и цифровую культуру. Запускала концепции для Beeline, Ректор «Деткартум» и Dicks Design Week. Докладчик на RoboBreak, UXR, Wearable Fest.',
    price: '2500 ₽ / час',
    avatar: require('@/assets/images/avatar.png'),
  },
  {
    id: '5',
    name: 'Марк Дроздов',
    role: 'Серебряный арт-директор',
    bio: '10 лет делаю уникальные плакаты и постеры. Нахожу общие идеи из разных тем и люблю обсуждать искусство, когда это не про карьеру, а про жизнь.',
    price: '2500 ₽ / час',
    avatar: require('@/assets/images/avatar.png'),
  },
  {
    id: '6',
    name: 'Инга Рунова',
    role: 'Историк искусств, исследователь',
    bio: 'Специализируюсь на русском плакате XX-XXI веков и «новой эстетике» до Gucci и Raf Simons. Помогу выстроить культурный код бренда и расскажу, почему худой имеет биткоин.',
    price: '2500 ₽ / час',
    avatar: require('@/assets/images/avatar.png'),
  },
];

export default function MentorsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>НАСТАВНИКИ</Text>
      {MENTORS.map((mentor) => (
        <View key={mentor.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Image source={mentor.avatar} style={styles.avatar} />
            <View style={styles.headerText}>
              <Text style={styles.name}>{mentor.name}</Text>
              <Text style={styles.role}>{mentor.role}</Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.bio}>{mentor.bio}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Стоимость консультации</Text>
            <Text style={styles.priceValue}>{mentor.price}</Text>
          </View>
          <Pressable style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Написать наставнику</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    paddingTop: 16,
    paddingBottom: 12,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  card: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  avatar: {
    width: 72,
    height: 72,
  },
  headerText: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  role: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  bio: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  priceLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  priceValue: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  contactButton: {
    backgroundColor: '#111',
    paddingVertical: 14,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
});
