import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { bookTutorSlot } from '@/lib/api/tutor';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Slot grid: 5 columns with gaps
const SLOT_COLS = 5;
const SLOT_GAP = 6;
const SLOT_PADDING = 16;
const SLOT_WIDTH =
  (SCREEN_WIDTH - SLOT_PADDING * 2 - SLOT_GAP * (SLOT_COLS - 1)) / SLOT_COLS;

type SlotItem = {
  id: string;
  date: string; // DD.MM
  time: string; // HH:mm
  status: 'available' | 'booked' | 'pending';
};

// Demo slots — backend does not yet expose a public tutor slots endpoint.
// TODO: replace with GET /api/student/tutor/{id}/slots when backend adds it.
function generateDemoSlots(tutorId: string): SlotItem[] {
  const base = new Date();
  const slots: SlotItem[] = [];
  const times = ['18:00', '20:00'];
  const statuses: SlotItem['status'][] = [
    'available', 'available', 'pending', 'available', 'available',
    'pending', 'available', 'available', 'available', 'available',
  ];

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const d = new Date(base);
    d.setDate(d.getDate() + dayOffset);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateStr = `${day}.${month}`;

    times.forEach((time, ti) => {
      const idx = (dayOffset - 1) * times.length + ti;
      slots.push({
        id: `${tutorId}-${dayOffset}-${time}`,
        date: dateStr,
        time,
        status: statuses[idx % statuses.length],
      });
    });
  }
  return slots;
}

export default function TutorCardScreen() {
  const router = useRouter();
  const { id, fullName, bio, avatarUrl } = useLocalSearchParams<{
    id: string;
    fullName: string;
    bio?: string;
    avatarUrl?: string;
  }>();

  const [showSlots, setShowSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  const slots = generateDemoSlots(id ?? 'demo');
  const imageSource = avatarUrl ? { uri: avatarUrl } : PLACEHOLDER_AVATAR;
  const displayName = fullName ?? 'Наставник';
  const displayBio = bio ?? '';

  const handleSelectSlot = (slot: SlotItem) => {
    if (slot.status !== 'available') return;
    setSelectedSlot(slot);
    setShowSlots(false);
  };

  const handleBook = async () => {
    if (!selectedSlot || isBooking) return;
    setIsBooking(true);
    try {
      await bookTutorSlot(selectedSlot.id);
      setSelectedSlot(null);
      Alert.alert('Успешно', 'Вы записались на встречу!');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось забронировать слот');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>

      {/* Hero photo */}
      <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />

      {/* Name and role */}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{displayName}</Text>
        {displayBio ? (
          <Text style={styles.roleText} numberOfLines={2}>{displayBio}</Text>
        ) : null}
      </View>

      {/* Bio / About */}
      {displayBio ? (
        <View style={styles.bioSection}>
          <Text style={styles.bioText}>{displayBio}</Text>
        </View>
      ) : null}

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Стоимость консультации</Text>
        <Text style={styles.priceValue}>2 500 ₽ в час</Text>
      </View>

      {/* CTA buttons */}
      <Pressable style={styles.primaryButton} onPress={() => setShowSlots(true)}>
        <Text style={styles.primaryButtonText}>Записаться на встречу</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Написать наставнику</Text>
      </Pressable>

      {/* Share row */}
      <View style={styles.shareRow}>
        <Text style={styles.shareText}>Поделиться профилем</Text>
        <View style={styles.shareIconBox}>
          <Text style={styles.shareIcon}>↑</Text>
        </View>
      </View>

      {/* ─── SLOT SELECTION — bottom sheet ──────────────────────────────── */}
      <Modal
        transparent
        animationType="none"
        visible={showSlots}
        onRequestClose={() => setShowSlots(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowSlots(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>СВОБОДНЫЕ СЛОТЫ{'\n'}ДЛЯ ЗАПИСИ</Text>

            {/* Slot grid — scrollable if many rows */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.slotScroll}
              contentContainerStyle={styles.slotGrid}
            >
              {slots.map((slot) => {
                const isAvailable = slot.status === 'available';
                const isPending = slot.status === 'pending';
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => handleSelectSlot(slot)}
                    style={[
                      styles.slotCard,
                      !isAvailable && styles.slotCardUnavailable,
                    ]}
                  >
                    {isPending && (
                      <View style={styles.slotBadge}>
                        <Text style={styles.slotBadgeText}>?</Text>
                      </View>
                    )}
                    <Text style={[styles.slotDate, !isAvailable && styles.slotTextMuted]}>
                      {slot.date}
                    </Text>
                    <Text style={[styles.slotTime, !isAvailable && styles.slotTextMuted]}>
                      {slot.time}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.sheetSecondaryButton} onPress={() => setShowSlots(false)}>
              <Text style={styles.sheetSecondaryButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── BOOKING CONFIRMATION — bottom sheet ────────────────────────── */}
      <Modal
        transparent
        animationType="none"
        visible={selectedSlot !== null}
        onRequestClose={() => setSelectedSlot(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedSlot(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>ПОДТВЕРЖДЕНИЕ{'\n'}ЗАПИСИ</Text>

            {/* Booking card — mirrors the event detail card style */}
            <View style={styles.bookingCard}>
              <View style={styles.bookingCardTop}>
                <Text style={styles.bookingCardName}>{displayName}</Text>
              </View>
              <View style={styles.bookingCardBottom}>
                <Text style={styles.bookingCardDateTime}>
                  {selectedSlot?.date} {selectedSlot?.time}
                </Text>
                <View style={styles.bookingCardDivider} />
                <Text style={styles.bookingCardPrice}>2 500 ₽</Text>
              </View>
            </View>

            <Pressable
              style={[styles.sheetPrimaryButton, isBooking && styles.sheetPrimaryButtonDisabled]}
              onPress={handleBook}
              disabled={isBooking}
            >
              <Text style={styles.sheetPrimaryButtonText}>
                {isBooking ? 'Оплата...' : 'Оплатить'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.sheetSecondaryButton}
              onPress={() => { setSelectedSlot(null); setShowSlots(true); }}
            >
              <Text style={styles.sheetSecondaryButtonText}>Назад</Text>
            </Pressable>
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
    paddingBottom: 40,
  },

  // Back button
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    lineHeight: 30,
    color: '#181818',
    marginTop: -2,
  },

  // Hero photo
  heroImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.1,
    backgroundColor: '#E5E5E5',
  },

  // Name section
  nameRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  name: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // Bio section
  bioSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  bioText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // Price row
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  priceLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  priceValue: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // CTA buttons
  primaryButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#111',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
  secondaryButton: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 52,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // Share row
  shareRow: {
    marginTop: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
  },
  shareText: {
    flex: 1,
    paddingLeft: 16,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  shareIconBox: {
    width: 52,
    height: 52,
    borderLeftWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 18,
    color: '#181818',
  },

  // ─── Bottom sheet shared styles ──────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sheetTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
    fontWeight: '700',
    fontSize: 28,
    textTransform: 'uppercase',
    lineHeight: 34,
    letterSpacing: -1,
    color: '#181818',
    textAlign: 'left',
  },
  sheetPrimaryButton: {
    marginTop: 16,
    backgroundColor: '#1E1E1E',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonDisabled: {
    opacity: 0.6,
  },
  sheetPrimaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  sheetSecondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  sheetSecondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // Slot grid
  slotScroll: {
    maxHeight: 280,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLOT_GAP,
    paddingBottom: 4,
  },
  slotCard: {
    width: SLOT_WIDTH,
    height: SLOT_WIDTH * 0.9,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    position: 'relative',
  },
  slotCardUnavailable: {
    backgroundColor: '#F5F5F5',
    borderColor: '#C8C8C8',
  },
  slotBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9B9B9B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  slotBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    color: '#9B9B9B',
  },
  slotDate: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
  },
  slotTime: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
    marginTop: 2,
  },
  slotTextMuted: {
    color: '#9B9B9B',
  },

  // Booking confirmation card
  bookingCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#FFFFFF',
  },
  bookingCardTop: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  bookingCardName: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  bookingCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
  },
  bookingCardDateTime: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  bookingCardDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#1E1E1E',
  },
  bookingCardPrice: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
    textAlign: 'right',
  },
});
