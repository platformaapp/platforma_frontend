import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type EventItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  time: string;
  price: string;
  image: any;
  curator?: {
    name: string;
    role: string;
    avatar: any;
  };
};

const EVENTS: EventItem[] = [
  {
    id: '1',
    title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?',
    subtitle: undefined,
    description: 'Пообщался об этом с Настей Четвериковой из «Искусство для пацанчиков» искусствоведом Женей Гут. Сформировали коалицию надежды',
    time: '13 июня 18:00',
    price: '500 ₽',
    image: require('@/assets/images/img.png'),
    curator: {
      name: 'Андрей Осетров',
      role: 'Куратор, исследователь визуальной культуры',
      avatar: require('@/assets/images/avatar.png'),
    },
  },
  {
    id: '2',
    title: 'Как читать критику на кино и бороться с чувством «я ничего не понял»?',
    description: 'Обсудим с Егором Москвитяным может ли кино быть настоящим хобби, и как вообще начать в нем разбираться. Не выпуск, а мандари с сладкими косточками',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img1.png'),
  },
  {
    id: '3',
    title: 'Как вовлечь своих подписчиков в создание контента и привлечь новых',
    description: 'Рассказал на фестивале G8 о своем опыте взаимодейсвия с подписчиками бренда и создания с их помощью целого усс. На себя посмотреть и вас показать',
    time: '15 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img2.png'),
  },
  {
    id: '4',
    title: 'Типографика без пафоса',
    description: 'Практика в модульной сетке, гротесках и линий ритма. Дизайн, который не «кричит».',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img3.png'),
  },
];

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = EVENTS.find((e) => e.id === id);
  const otherEvents = EVENTS.filter((e) => e.id !== id);

  if (!event) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </Pressable>
        <ThemedText style={styles.errorText}>Событие не найдено</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </ThemedText>
      </Pressable>

      {/* Main Event Card */}
      <View style={styles.mainCard}>
        <Image source={event.image} style={styles.mainImage} resizeMode="cover" />
        <View style={styles.mainCardBody}>
          <Text style={styles.mainTitle}>{event.title}</Text>
          {event.description ? (
            <Text style={styles.mainDescription}>{event.description}</Text>
          ) : null}
        </View>
        <View style={styles.mainFooter}>
          <Text style={styles.mainFooterTime}>{event.time}</Text>
          <View style={styles.mainPriceContainer}>
            <Text style={styles.mainFooterPrice}>{event.price}</Text>
          </View>
        </View>
      </View>

      {/* Register Button */}
      <Pressable style={styles.registerButton}>
        <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
      </Pressable>

      {/* Curator Section */}
      {event.curator && (
        <View style={styles.curatorSection}>
          <View style={styles.curatorSectionWrapper}>
            <Image source={event.curator.avatar} style={styles.curatorAvatar} />
            <View  style={styles.curatorNameWrapper}>
              <Text style={styles.curatorName}>{event.curator.name}</Text>
              <Text style={styles.curatorRole}>{event.curator.role}</Text>
            </View>
          </View>
          <Pressable style={styles.writeToCuratorButton}>
            <Text style={styles.writeToCuratorText}>Написать наставнику</Text>
          </Pressable>
        </View>
      )}

      {/* Share Button */}
      <Pressable style={styles.shareButton}>
        <Text style={styles.shareButtonText}>Поделиться событием</Text>
        <ThemedText style={styles.shareButtonIcon}>
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.0961 11.2467H19.7603V22.203H5.10352V11.2467H8.76772M12.4319 2.66064L17.0381 7.26684M12.4319 2.66064L7.82569 7.26684M12.4319 2.66064V15.9086" stroke="#181818"/>
          </svg>

        </ThemedText>
      </Pressable>

      {/* Other Events Section */}
      <Text style={styles.otherEventsTitle}>ДРУГИЕ СОБЫТИЯ</Text>
      {otherEvents.map((item) => (
        <Pressable 
          key={item.id}
          style={styles.otherCard} 
          onPress={() => router.replace(`/(tabs)/events/${item.id}`)}
        >
          <Image source={item.image} style={styles.otherImage} resizeMode="cover" />
          <View style={styles.otherCardBody}>
            <Text style={styles.otherCardTitleText}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.otherDescription}>{item.description}</Text>
            ) : null}
          </View>
          <View style={styles.otherFooter}>
            <Text style={styles.otherFooterTime}>{item.time}</Text>
            <View style={styles.otherPriceContainer}>
              <Text style={styles.otherFooterPrice}>{item.price}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 24,
    marginHorizontal: 16,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 1,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
  },
  errorText: {
    padding: 24,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#181818',
  },
  mainCard: {
    backgroundColor: '#fff',
    marginTop: 60,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  mainImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#eee',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  mainCardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  mainTitle: {
    marginBottom: 14,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  mainDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  mainFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 0,
    borderColor: '#1E1E1E',
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 46,
  },
  mainFooterTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
    borderColor: '#1E1E1E',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  mainPriceContainer: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  mainFooterPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  registerButton: {
    backgroundColor: '#181818',
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 0,
    marginBottom: 24,
  },
  registerButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    fontWeight: '500',
    color: '#FFFFFF',
  },
  curatorSection: {
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: 24,
    width: '100%',
  },
  curatorSectionWrapper:{
    display: 'flex',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    width: '100%',
    borderBottomWidth: 0,
  },
  curatorAvatar: {
    width: 96,
    height: 96,
    borderRadius: 0,
    backgroundColor: '#eee',
    marginBottom: 0,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  curatorName: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  curatorNameWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'left',
    padding: 16,
  },
  curatorRole: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 16,
    textAlign: 'center',
  },
  writeToCuratorButton: {
    // paddingVertical: 10,
    // paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    height: 52,
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',

  },
  writeToCuratorText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textDecorationLine: 'none',
    
  },
  shareButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginHorizontal: 0,
    marginBottom: 32,
  },
  shareButtonIcon: {
    width: 80,
    height: 80,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    flexShrink: 0
  },
  shareButtonText: {
    fontSize: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
    width: '100%',
  },
  otherEventsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginHorizontal: 0,
    marginBottom: 16,
  },
  otherCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  otherImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#eee',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  otherCardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  otherCardTitleText: {
    marginBottom: 14,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  otherDescription: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  otherFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 0,
    borderColor: '#1E1E1E',
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 44,
  },
  otherFooterTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
 
  },
  otherPriceContainer: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  otherFooterPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
});

