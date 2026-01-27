import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

type EventItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  time: string;
  price: string;
  image: any;
};

const EVENTS: EventItem[] = [
  {
    id: '1',
    title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?',
    subtitle: undefined,
    description: 'Пообщался об этом с Настей Четвериковой из «Искусство для пацанчиков» искусствоведом Женей Гут. Сформировали коалицию надежды',
    time: 'Через час',
    price: '500 ₽',
    image: require('@/assets/images/react-logo.png'),
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

export default function EventsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>БЛИЖАЙШИЕ СОБЫТИЯ</Text>
      <FlatList
        data={EVENTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable 
            style={styles.card} 
            onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}
          >
            <Image source={item.image} style={styles.image} resizeMode="cover" />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleText}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.description}>{item.description}</Text>
              ) : null}
            </View>
            <View style={styles.footer}>
              <Text style={styles.footerTime}>{item.time}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.footerPrice}>{item.price}</Text>
              </View>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
  },
  titleText: {
    marginBottom: 12,
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  card: {
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#eee',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  cardTitleText: {
    marginBottom: 12,
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 28,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4A4A4A',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  footerTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  priceContainer: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  footerPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 16,
  },
});


