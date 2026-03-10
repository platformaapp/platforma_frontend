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
const SLOT_HORIZONTAL_PADDING = 16;
const SLOT_WIDTH =
  (SCREEN_WIDTH - SLOT_HORIZONTAL_PADDING * 2 - SLOT_GAP * (SLOT_COLS - 1)) / SLOT_COLS;

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
  const statuses: SlotItem['status'][] = ['available', 'available', 'pending', 'available', 'available'];

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
  };

  const handleBook = async () => {
    if (!selectedSlot || isBooking) return;
    setIsBooking(true);
    try {
      await bookTutorSlot(selectedSlot.id);
      setShowSlots(false);
      setSelectedSlot(null);
      Alert.alert('Успешно', 'Вы записались на встречу!');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось забронировать слот');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCloseSlots = () => {
    setShowSlots(false);
    setSelectedSlot(null);
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

      {/* ─── SLOT SELECTION MODAL ─────────────────────────────────────── */}
      <Modal
        visible={showSlots && selectedSlot === null}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseSlots}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          {/* Tutor photo at top of modal */}
          <Image source={imageSource} style={styles.modalHeroImage} resizeMode="cover" />

          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>СВОБОДНЫЕ СЛОТЫ{'\n'}ДЛЯ ЗАПИСИ</Text>

            {/* Slot grid */}
            <View style={styles.slotGrid}>
              {slots.map((slot) => {
                const isAvailable = slot.status === 'available';
                const isPending = slot.status === 'pending';
                const isBooked = slot.status === 'booked';
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
            </View>

            <Pressable style={styles.modalCloseButton} onPress={handleCloseSlots}>
              <Text style={styles.modalCloseButtonText}>Закрыть</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      {/* ─── BOOKING CONFIRMATION MODAL ───────────────────────────────── */}
      <Modal
        visible={selectedSlot !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedSlot(null)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          {/* Tutor photo */}
          <Image source={imageSource} style={styles.modalHeroImage} resizeMode="cover" />

          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>ПОДТВЕРЖДЕНИЕ{'\n'}ЗАПИСИ</Text>

            {/* Booking card */}
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
              style={[styles.payButton, isBooking && styles.payButtonDisabled]}
              onPress={handleBook}
              disabled={isBooking}
            >
              <Text style={styles.payButtonText}>
                {isBooking ? 'Оплата...' : 'Оплатить'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => { setSelectedSlot(null); }}
            >
              <Text style={styles.modalCloseButtonText}>Назад</Text>
            </Pressable>
          </View>
        </ScrollView>
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

  // Buttons
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

  // ─── Modal ────────────────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    paddingBottom: 40,
  },
  modalHeroImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: '#E5E5E5',
  },
  modalBody: {
    paddingHorizontal: SLOT_HORIZONTAL_PADDING,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
    color: '#181818',
    marginBottom: 24,
    letterSpacing: -1,
  },

  // Slot grid
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLOT_GAP,
    marginBottom: 24,
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

  // Close button
  modalCloseButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalCloseButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // Booking card
  bookingCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 24,
  },
  bookingCardTop: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  bookingCardName: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  bookingCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
  },
  bookingCardDateTime: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  bookingCardDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#1E1E1E',
  },
  bookingCardPrice: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'right',
  },

  // Pay button
  payButton: {
    backgroundColor: '#111',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
