import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

/** Стрелка "назад" — общая иконка вместо текстового "←" по всему сайту. */
export function BackArrowIcon({ width = 28, height = 27 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 28 27" fill="none">
      <Line x1="0" y1="13.6328" x2="28" y2="13.6328" stroke="black" strokeWidth="2.5" />
      <Path d="M1 12.8828L13 0.882812" stroke="black" strokeWidth="2.5" />
      <Path d="M1 13.8828L13 25.8828" stroke="black" strokeWidth="2.5" />
    </Svg>
  );
}
