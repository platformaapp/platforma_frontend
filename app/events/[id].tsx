import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    image: require('@/assets/images/react-logo.png'),
    curator: {
      name: 'Андрей Осетров',
      role: 'Куратор, исследователь визуальной культуры',
      avatar: require('@/assets/images/react-logo.png'),
    },
  },
  {
    id: '2',
    title: 'Как читать критику на кино и бороться с чувством «я ничего не понял»?',
    description: 'Обсудим с Егором Москвитяным может ли кино быть настоящим хобби, и как вообще начать в нем разбираться. Не выпуск, а мандари с сладкими косточками',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/partial-react-logo.png'),
  },
  {
    id: '3',
    title: 'Как вовлечь своих подписчиков в создание контента и привлечь новых',
    description: 'Рассказал на фестивале G8 о своем опыте взаимодейсвия с подписчиками бренда и создания с их помощью целого усс. На себя посмотреть и вас показать',
    time: '15 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/react-logo.png'),
  },
  {
    id: '4',
    title: 'Типографика без пафоса',
    description: 'Практика в модульной сетке, гротесках и линий ритма. Дизайн, который не «кричит».',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/splash-icon.png'),
  },
];

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = EVENTS.find((e) => e.id === id);
  const otherEvents = EVENTS.filter((e) => e.id !== id);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

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
    <>
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
        <Pressable style={styles.registerButton} onPress={() => setIsRegistrationOpen(true)}>
          <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
        </Pressable>

        {/* Curator Section */}
        {event.curator && (
          <View style={styles.curatorSection}>
            <Image source={event.curator.avatar} style={styles.curatorAvatar} />
            <Text style={styles.curatorName}>{event.curator.name}</Text>
            <Text style={styles.curatorRole}>{event.curator.role}</Text>
            <Pressable style={styles.writeToCuratorButton}>
              <Text style={styles.writeToCuratorText}>Написать наставнику</Text>
            </Pressable>
          </View>
        )}

        {/* Share Button */}
        <Pressable style={styles.shareButton}>
          <Text style={styles.shareButtonText}>Поделиться событием</Text>
          <ThemedText>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6.66667L10 1.66667M15 6.66667L10 11.6667M15 6.66667H5C3.89543 6.66667 3 7.5621 3 8.66667V15.3333C3 16.4379 3.89543 17.3333 5 17.3333H12.3333C13.4379 17.3333 14.3333 16.4379 14.3333 15.3333V6.66667" stroke="#181818" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </Pressable>

        {/* Other Events Section */}
        <Text style={styles.otherEventsTitle}>ДРУГИЕ СОБЫТИЯ</Text>
        {otherEvents.map((item) => (
          <Pressable 
            key={item.id}
            style={styles.otherCard} 
            onPress={() => router.replace(`/events/${item.id}`)}
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

      <Modal
        transparent
        animationType="slide"
        visible={isRegistrationOpen}
        onRequestClose={() => setIsRegistrationOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsRegistrationOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>РЕГИСТРАЦИЯ</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{event.title}</Text>
              <View style={styles.modalEventFooter}>
                <View style={styles.modalEventCell}>
                  <Text style={styles.modalEventText}>{event.time}</Text>
                </View>
                <View style={[styles.modalEventCell, styles.modalEventCellRight]}>
                  <Text style={styles.modalEventText}>{event.price}</Text>
                </View>
              </View>
            </View>
            <Pressable style={styles.modalPayButton}>
              <Text style={styles.modalPayButtonText}>Оплатить</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 24,
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
    marginBottom: 16,
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
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  mainDescription: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  mainFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 46,
  },
  mainFooterTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mainPriceContainer: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    marginHorizontal: 16,
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
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  curatorAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
    marginBottom: 12,
  },
  curatorName: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  curatorRole: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 16,
    textAlign: 'center',
  },
  writeToCuratorButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  writeToCuratorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textDecorationLine: 'underline',
  },
  shareButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFCFCF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 32,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  otherEventsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  otherCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    marginHorizontal: 16,
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
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  otherDescription: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  otherFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
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
  },
  otherFooterPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    gap: 12,
  },
  modalTitle: {
    marginTop: 0,
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 36,
    letterSpacing: -2,
    color: '#181818',
    textAlign: 'left',
  },
  modalEventCard: {
    borderWidth: 1,
    borderColor: 'rgba(24, 24, 24, 1.0)',
    borderRadius: 0,
    backgroundColor: '#fff',
  },
  modalEventTitle: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  modalEventFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: 'rgba(24, 24, 24, 1.0)',
  },
  modalEventCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  modalEventCellRight: {
    borderLeftWidth: 1,
    borderColor: 'rgba(24, 24, 24, 1.0)',
  },
  modalEventText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    color: '#181818',
  },
  modalPayButton: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
    backgroundColor: '#111',
    borderColor: 'rgba(24, 24, 24, 1.0)',
  },
  modalPayButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 20,
    color: '#FAFAFA',
  },
});

