import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

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
    description: 'Побобщался об этом с Настей четверековой из «Искуство для пацанчиков» искусствоведом Женей Гут. Сформировали коллекцию надежды',
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
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>БЛИЖАЙШИЕ СОБЫТИЯ</Text>
      <FlatList
        data={EVENTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={item.image} style={styles.image} resizeMode="cover" />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleText}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.description}>{item.description}</Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{item.time}</Text>
                <Text style={styles.metaPrice}>{item.price}</Text>
              </View>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  },
  card: {
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: '#fff',
  },
  image: {
    width: undefined,
    height: 180,
    backgroundColor: '#eee',
    alignSelf: 'stretch',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTitle: {
    marginBottom: 4,
  },
  cardTitleText: {
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  description: {
    marginTop: 6,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
  },
  metaPrice: {
    fontSize: 12,
  },
  separator: {
    height: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
});


