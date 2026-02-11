import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { endpoints } from '@/constants/env';
import { getAuthRole, getAuthToken } from '@/lib/auth';
import { getCardLinked } from '@/lib/payments';
import { useWindowDimensions } from 'react-native';

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
    id: 'a1f2c3d4-1111-4a1b-9f1a-1a1a1a1a1a1a',
    title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?',
    subtitle: undefined,
    description: `Современное искусство часто кажется непонятным, провокационным или «слишком простым». Но за этой внешней неоднозначностью скрываются системы знаков, логики и контекста.
    Этот мастер-класс — не про искусствоведение, а про зрение. Мы научимся распознавать художественные жесты, читать работы как тексты и ощущать в них интонации. Через реальные примеры, диалоги и упражнения ты откроешь, что видеть — это навык. И что современное искусство не про сложность, а про внимание.
    `,
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
    id: 'b2e3f4a5-2222-4b2c-9f2b-2b2b2b2b2b2b',
    title: 'Как читать критику на кино и бороться с чувством «я ничего не понял»?',
    description: 'Обсудим с Егором Москвитяным может ли кино быть настоящим хобби, и как вообще начать в нем разбираться. Не выпуск, а мандари с сладкими косточками',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img1.png'),
    curator: {
      name: 'Андрей Осетров',
      role: 'Куратор, исследователь визуальной культуры',
      avatar: require('@/assets/images/avatar.png'),
    },
  },
  {
    id: 'c3f4a5b6-3333-4c3d-9f3c-3c3c3c3c3c3c',
    title: 'Как вовлечь своих подписчиков в создание контента и привлечь новых',
    description: 'Рассказал на фестивале G8 о своем опыте взаимодейсвия с подписчиками бренда и создания с их помощью целого усс. На себя посмотреть и вас показать',
    time: '15 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img2.png'),
    curator: {
      name: 'Андрей Осетров',
      role: 'Куратор, исследователь визуальной культуры',
      avatar: require('@/assets/images/avatar.png'),
    },
  },
  {
    id: 'd4a5b6c7-4444-4d4e-9f4d-4d4d4d4d4d4d',
    title: 'Типографика без пафоса',
    description: 'Практика в модульной сетке, гротесках и линий ритма. Дизайн, который не «кричит».',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img3.png'),
    curator: {
      name: 'Андрей Осетров',
      role: 'Куратор, исследователь визуальной культуры',
      avatar: require('@/assets/images/avatar.png'),
    },
  },
];

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = EVENTS.find((e) => e.id === id);
  const otherEvents = EVENTS.filter((e) => e.id !== id);
  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [isCardModalDoneVisible, setCardModalDoneVisible] = useState(false);
  const [isLinkTutorVisible, setLinkTutorVisible] = useState(false);
  const [isShareEventVisible, setShareEventVisible] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const { width } = useWindowDimensions();

  async function handleLinkNow() {
    const token = await getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setCardModalVisible(true);
    setIsShareCopied(false);
    setPayError('');
  }

  function handleLinkTutor() {
    setLinkTutorVisible(true);
    setIsShareCopied(false);
  }

  function handleShareEventTutor() {
    setIsShareCopied(false);
    setShareEventVisible(true);
  }

  async function handleGetPay() {
    if (isPaying) return;
    setIsPaying(true);
    setIsShareCopied(false);
    setPayError('');
    try {
      const [token, role, isLinked] = await Promise.all([
        getAuthToken(),
        getAuthRole(),
        getCardLinked(),
      ]);
      if (!token) {
        throw new Error('Для оплаты нужно войти в аккаунт');
      }
      if (role && role !== 'student') {
        throw new Error('Оплата доступна только для студентов');
      }
      if (!isLinked) {
        setCardModalVisible(false);
        router.push('/(tabs)/profile/payments');
        return;
      }

      const res = await fetch(endpoints.studentPayments, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: event.id }),
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        const message = typeof data === 'string' ? data : data?.message || 'Не удалось создать платеж';
        throw new Error(message);
      }

      const paymentId =
        data?.paymentId ||
        data?.payment_id ||
        data?.id ||
        data?.data?.paymentId ||
        data?.data?.payment_id ||
        data?.data?.id;
      const confirmationUrl =
        data?.confirmation?.confirmation_url ||
        data?.confirmation_url ||
        data?.confirmationUrl ||
        data?.payment?.confirmation?.confirmation_url ||
        data?.payment?.confirmation_url;
      let status = data?.status || data?.payment?.status;

      if (confirmationUrl) {
        await WebBrowser.openBrowserAsync(confirmationUrl);
      }

      if (paymentId) {
        const callbackRes = await fetch(
          `${endpoints.studentPaymentsCallback}?paymentId=${encodeURIComponent(paymentId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const callbackContentType = callbackRes.headers.get('content-type') || '';
        const callbackIsJson = callbackContentType.includes('application/json');
        const callbackData = callbackIsJson ? await callbackRes.json() : await callbackRes.text();
        if (!callbackRes.ok) {
          const message =
            typeof callbackData === 'string'
              ? callbackData
              : callbackData?.message || 'Не удалось подтвердить оплату';
          throw new Error(message);
        }
        status = callbackData?.status || callbackData?.payment?.status || status;
        if (callbackData?.paid === true || callbackData?.payment?.paid === true) {
          status = 'succeeded';
        }
      }

      const isPaid = status === 'succeeded' || status === 'success';
      if (!isPaid) {
        throw new Error('Оплата не подтверждена');
      }

      setCardModalVisible(false);
      setCardModalDoneVisible(true);
    } catch (e: any) {
      const rawMessage = e?.message ?? 'Не удалось оплатить';
      const message = rawMessage.toLowerCase().includes('token expired and refresh failed')
        ? 'Авторизуйтесь заново'
        : rawMessage;
      setPayError(message);
      Alert.alert('Ошибка оплаты', message);
    } finally {
      setIsPaying(false);
    }
  }

  function handleCloseCard() {
    // Здесь может быть вызов API для привязки карты
    // Пока закрываем попап и переходим к событиям
    setIsShareCopied(false);
    setCardModalDoneVisible(false);
    router.replace('/(tabs)/events');
    
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.1436 21.9004L7.22266 12.0103L17.1436 2.09918" stroke="#181818"/>
</svg>



          </ThemedText>
        </Pressable>
        <ThemedText style={styles.errorText}>Событие не найдено</ThemedText>
      </View>
    );
  }

  const eventUrl = Linking.createURL(`/events/${event.id}`);
  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(eventUrl);
    setIsShareCopied(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/events')}>
        <ThemedText>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.1436 21.9004L7.22266 12.0103L17.1436 2.09918" stroke="#181818"/>
</svg>


        </ThemedText>
      </Pressable>

      {/* Main Event Card */}
      <View style={styles.mainCard}>
        <Image source={event.image} style={styles.mainImage} resizeMode="cover" />
        <View style={styles.mainCardBody}>
          <Text style={styles.mainTitle}>{event.title}</Text>
          {event.description ? (
            <Text style={[styles.mainDescription, { whiteSpace: 'unset' }]}>{event.description}</Text>
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
      <Pressable style={styles.registerButton} onPress={handleLinkNow}>
        <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
      </Pressable>

      {/* Curator Section */}
      {event.curator && (
        <View style={styles.curatorSection}>
          <View style={styles.curatorSectionWrapper}>
            <Image source={event.curator.avatar} style={styles.curatorAvatar} />
            <View  style={[styles.curatorNameWrapper, { width: width - 96 - 32 - 16 }]}>
              <Text style={styles.curatorName}>{event.curator.name}</Text>
              <Text style={styles.curatorRole}>{event.curator.role}</Text>
            </View>
          </View>
          <Pressable style={styles.writeToCuratorButton} onPress={handleLinkTutor}>
            <Text style={styles.writeToCuratorText}>Написать наставнику</Text>
          </Pressable>
        </View>
      )}

      {/* Share Button */}
      <Pressable style={styles.shareButton} onPress={handleShareEventTutor}>
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
      <Modal
        transparent
        animationType="none"
        visible={isCardModalVisible}
        onRequestClose={() => setCardModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCardModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
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
            {payError ? (
              <Text style={styles.payErrorText}>{payError}</Text>
            ) : null}
            <Pressable
              style={[styles.modalPayButton, isPaying && styles.modalPayButtonDisabled]}
              onPress={handleGetPay}
              disabled={isPaying}
            >
              <Text style={styles.modalPayButtonText}>{isPaying ? 'Оплата...' : 'Оплатить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isShareEventVisible}
        onRequestClose={() => setShareEventVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShareEventVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Поделиться событием</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{eventUrl}</Text>
              
            </View>
            {isShareCopied ? (
              <Text style={styles.shareCopiedText}>Ссылка скопирована</Text>
            ) : null}
            <Pressable style={styles.modalPayButton} onPress={handleCopyLink}>
              <Text style={styles.modalPayButtonText}>Скопировать ссылку</Text>
            </Pressable>
            <Pressable style={[styles.writeToCuratorButton, {marginTop: 12}]} onPress={() => setShareEventVisible(false)}>
            <Text style={styles.writeToCuratorText}>Закрыть</Text>
          </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isCardModalDoneVisible}
        onRequestClose={() => setCardModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCardModalDoneVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Оплата прошла</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>
              Чек отправлен вам на почту. 
                <View style={{ paddingTop: 20 }}>
                Возврат возможен не позднее, чем за 24 часа до начала
                </View>
              </Text>
              
            </View>
            <Pressable style={styles.modalPayButton} onPress={handleCloseCard}>
              <Text style={styles.modalPayButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="none"
        visible={isLinkTutorVisible}
        onRequestClose={() => setLinkTutorVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLinkTutorVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Пожалуйста, проводите встречи на платформе</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>
              Мы оставили вам возможность связаться напрямую и уточнить нужные вопросы, но просим итоговые встречи проводить на нашей платформе. 
                <View style={{ paddingTop: 20 }}>
                Иначе мы обидимся и не будем с вами дружить.
                </View>
              </Text>
              
            </View>
            
            <Link href="https://t.me/p34forma" asChild>
                <Pressable style={styles.modalPayButton} onPress={handleCloseCard}>
                  <Text style={styles.modalPayButtonText}>Окей, давайте дружить</Text>
                </Pressable>
            </Link>
          </Pressable>
        </Pressable>
      </Modal>

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
    left: 0,
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
    fontFamily: 'Inter-Light',
    fontWeight: 700,
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
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    marginHorizontal: 0,
    marginBottom: 0,
  },

  // modalOverlay: {
  //   position: 'absolute',
  //   top: 0,
  //   left: 0,
  //   right: 0,
  //   bottom: 0,
  //   justifyContent: 'flex-end',
  // },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // modalSheet: {
  //   backgroundColor: '#fff',
  //   padding: 16,
  //   borderTopLeftRadius: 0,
  //   borderTopRightRadius: 0,
  //   gap: 12,
  // },
  modalTitle: {
    marginTop: 0,
    marginBottom: 8,
    fontFamily: 'Inter-Light',
    fontWeight: 700,
    fontSize: 28,
    textTransform: 'uppercase',
    fontStyle: 'normal',
    lineHeight: 36,
    letterSpacing: -1,
    color: '#181818',
    textAlign: 'left',
  },
  modalEventCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#FFFFFF',
  },
  modalEventTitle: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  modalEventFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#1E1E1E',
  },
  modalEventCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  modalEventCellRight: {
    borderLeftWidth: 1,
    borderColor: '#1E1E1E',
  },
  modalEventText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  modalPayButton: {
    marginTop: 16,
    backgroundColor: '#1E1E1E',
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPayButtonDisabled: {
    opacity: 0.6,
  },
  payErrorText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  modalPayButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  shareCopiedText: {
    marginTop: 4,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#181818',
  },

});

