import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { TutorSlotsModal } from '@/components/web/tutor-slots-modal';

/**
 * Прямой route на "Запись на встречу" — оставлен для расшаренных/прямых
 * ссылок на /explore/:id/slots (и для случая, когда зашли сюда, минуя
 * страницу наставника). Обычный путь — кнопка "Записаться" на самой
 * странице наставника (explore/[id].web.tsx) открывает тот же
 * TutorSlotsModal НЕ переходом по ссылке, а как настоящий Modal поверх
 * страницы — так страница наставника остаётся видна (затемнённой) позади,
 * а не пропадает (см. комментарий в tutor-slots-modal.tsx). Прямой заход
 * сюда по ссылке такого "фона позади" дать не может — предыдущего экрана
 * просто нет, это соответствует прежнему поведению для этого случая.
 */
export default function TutorSlotsRouteWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  function handleClose() {
    if (router.canGoBack()) router.back();
    else router.replace(`/(tabs)/explore/${id}` as any);
  }

  if (!id) return null;
  return <TutorSlotsModal tutorId={id} visible onClose={handleClose} />;
}
