import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

/** Иконки для веб-навигации (шапка десктопа / нижняя панель моб. версии) — по макету p(34). */

export function SquareIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Rect x="1" y="1" width="14" height="14" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

export function TriangleIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Polygon points="8,1.5 15,14.5 1,14.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Line x1="8" y1="1" x2="8" y2="15" stroke={color} strokeWidth="1.2" />
      <Line x1="1" y1="8" x2="15" y2="8" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

export function CircleIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

export function PencilIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M11 1.5L14.5 5L5 14.5H1.5V11L11 1.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </Svg>
  );
}
