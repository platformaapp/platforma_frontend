import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type IconProps = { color: string; size?: number };

/**
 * Иконки для веб-навигации (шапка десктопа / нижняя панель моб. версии).
 * Формы взяты с навбара https://vladyakunin.ru/ (по позиции пунктов слева
 * направо), подписи меню — свои, оставлены как были. Компоненты и их имена
 * не переименовывал — их дергают site-header.tsx/mobile-bottom-nav.tsx.
 */

/** Стрелка вверх-вправо — было у "Обо мне". У нас: События. */
export function SquareIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 12.5L12.5 3.5M12.5 3.5H5.8M12.5 3.5V10.2" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Цветок/россыпь лепестков — было у "Проекты". У нас: Наставники. */
export function TriangleIcon({ color, size = 16 }: IconProps) {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {petals.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 8 + Math.cos(rad) * 3.4;
        const cy = 8 + Math.sin(rad) * 3.4;
        return <Circle key={deg} cx={cx} cy={cy} r="3.1" stroke={color} strokeWidth="0.9" />;
      })}
    </Svg>
  );
}

/** Два перекрывающихся круга — было у "Подход". У нас: Мои записи. */
export function PlusIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx="6.4" cy="8" r="5.3" stroke={color} strokeWidth="1.2" />
      <Circle cx="9.6" cy="8" r="5.3" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

/** Спираль — было у "Блог". У нас: Журнал. */
export function CircleIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 8C8 8.83 8.67 9.5 9.5 9.5C10.6 9.5 11.5 8.6 11.5 7.5C11.5 6.12 10.38 5 9 5C7.34 5 6 6.34 6 8C6 9.93 7.57 11.5 9.5 11.5C11.71 11.5 13.5 9.71 13.5 7.5C13.5 4.96 11.54 3 9 3C6.24 3 4 5.24 4 8C4 11.03 6.47 13.5 9.5 13.5"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Колючая звёздчатая россыпь — было у "AI". У нас: Личный кабинет. */
export function PencilIcon({ color, size = 16 }: IconProps) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const inner = 2.4;
        const outer = deg % 60 === 0 ? 7 : 5.4;
        const x1 = 8 + Math.cos(rad) * inner;
        const y1 = 8 + Math.sin(rad) * inner;
        const x2 = 8 + Math.cos(rad) * outer;
        const y2 = 8 + Math.sin(rad) * outer;
        return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" strokeLinecap="round" />;
      })}
    </Svg>
  );
}
