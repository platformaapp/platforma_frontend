import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';


type RecordItem = {
  id: string;
  title: string;
  author: string;
  datetime: string;
  image: any;
};

const RECORDS: RecordItem[] = [
  {
    id: '1',
    title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?',
    author: 'Андрей Осетров',
    datetime: '15.06 ПН 20:00',
    image: require('@/assets/images/img.png'),
  },
  {
    id: '2',
    title: 'Личная встреча',
    author: 'Варвара Михайлова',
    datetime: '15.06 ПН 20:00',
    image: require('@/assets/images/avatar.png'),
  },
  {
    id: '3',
    title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?',
    author: 'Андрей Осетров',
    datetime: '15.06 ПН 20:00',
    image: require('@/assets/images/img.png'),
  },
];

export default function RecordsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>МОИ ЗАПИСИ</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {RECORDS.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Image source={item.image} style={styles.cardImage} />
              <View style={styles.cardTitleBox}>
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardAuthor}>{item.author}</Text>
              <Text style={styles.cardDate}>{item.datetime}</Text>
              <View style={styles.cardMenu}>
                <Text style={styles.cardMenuText}>•••</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomPanel}>
        <View style={styles.nextEventRow}>
          <Svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <Path d="M2 3H14L20 7V9L14 13H2V3Z" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round"/>
          </Svg>
          <Text style={styles.nextEventText}>До ближайшего события: 2 дня 3 часа и 15 минут</Text>
        </View>
        <Pressable style={styles.videoButton}>
          <Text style={styles.videoButtonText}>Открыть видео</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardImage: {
    width: 96,
    height: 96,
  },
  cardTitleBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  cardAuthor: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardDate: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardMenu: {
    width: 44,
    height: '100%',
    borderLeftWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  cardMenuText: {
    fontSize: 18,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  bottomPanel: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  nextEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  nextEventText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    flex: 1,
  },
  videoButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    height: 52,
  },
  videoButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
});
