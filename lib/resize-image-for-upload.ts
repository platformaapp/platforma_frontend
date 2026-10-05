import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * Фото с телефона/камеры часто 3000-4000px и несколько мегабайт — ни бэкенд,
 * ни фронтенд нигде не генерируют уменьшенные превью, поэтому КАЖДЫЙ блок на
 * сайте (даже маленький тамбнейл в ленте) грузит оригинал целиком — это и
 * есть основная причина, почему картинки долго прогружаются. Уменьшаем перед
 * загрузкой на сервер: длинной стороне достаточно 1600px — с запасом хватает
 * под самый крупный блок на сайте (featured-обложка события на /events).
 */
const MAX_DIMENSION = 1600;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function resizeImageForUpload(uri: string): Promise<string> {
  try {
    const { width, height } = await getImageSize(uri);
    const longSide = Math.max(width, height);
    if (longSide > 0 && longSide <= MAX_DIMENSION) return uri; // уже достаточно маленькое

    const resize = height > width ? { height: MAX_DIMENSION } : { width: MAX_DIMENSION };
    const result = await manipulateAsync(uri, [{ resize }], { compress: 0.8, format: SaveFormat.JPEG });
    return result.uri;
  } catch {
    return uri; // не удалось определить размер/отресайзить — грузим как есть, не блокируем пользователя
  }
}
