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
    id: 'a1f2c3d4-1111-4a1b-9f1a-1a1a1a1a1a1a',
    title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?',
    subtitle: undefined,
    description: `Современное искусство часто кажется непонятным, провокационным или «слишком простым». Но за этой внешней неоднозначностью скрываются системы знаков, логики и контекста.
    Этот мастер-класс — не про искусствоведение, а про зрение. Мы научимся распознавать художественные жесты, читать работы как тексты и ощущать в них интонации. Через реальные примеры, диалоги и упражнения ты откроешь, что видеть — это навык. И что современное искусство не про сложность, а про внимание.`,
    time: 'Через час',
    price: '500 ₽',
    image: require('@/assets/images/img.png'),
  },
  {
    id: 'b2e3f4a5-2222-4b2c-9f2b-2b2b2b2b2b2b',
    title: 'Как читать критику на кино и бороться с чувством «я ничего не понял»?',
    description: 'Обсудим с Егором Москвитяным может ли кино быть настоящим хобби, и как вообще начать в нем разбираться. Не выпуск, а мандари с сладкими косточками',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img1.png'),
  },
  {
    id: 'c3f4a5b6-3333-4c3d-9f3c-3c3c3c3c3c3c',
    title: 'Как вовлечь своих подписчиков в создание контента и привлечь новых',
    description: 'Рассказал на фестивале G8 о своем опыте взаимодейсвия с подписчиками бренда и создания с их помощью целого усс. На себя посмотреть и вас показать',
    time: '15 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img2.png'),
  },
  {
    id: 'd4a5b6c7-4444-4d4e-9f4d-4d4d4d4d4d4d',
    title: 'Типографика без пафоса',
    description: 'Практика в модульной сетке, гротесках и линий ритма. Дизайн, который не «кричит».',
    time: '13 июня 20:00',
    price: '800 ₽',
    image: require('@/assets/images/img3.png'),
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
                <Text style={styles.description} numberOfLines={4} ellipsizeMode="tail">
                  {item.description}
                </Text>
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
    fontSize: 28,
    fontWeight: 'regular',
    lineHeight: 36,
    fontFamily: 'Inter-Light',
    color: '#181818',
  },
  card: {
    backgroundColor: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  image: {
    width: '100%',
    height: 220,
    backgroundColor: '#eee',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  cardTitleText: {
    marginBottom: 14,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter-Light',
    fontWeight: 700,
    color: '#1E1E1E',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  footer: {
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
  footerTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  priceContainer: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  footerPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
    
  },
  listContent: {
    paddingBottom: 16,
  },
});


