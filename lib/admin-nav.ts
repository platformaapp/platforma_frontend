import type { Router } from 'expo-router';

// router.back() требует настоящую историю навигации внутри SPA — если
// админ открыл страницу напрямую по ссылке/закладке, или просто обновил
// вкладку (F5), истории нет вообще, и router.back() молча ничего не делает
// (стрелка "назад" выглядит сломанной). canGoBack()/fallbackHref — тот же
// приём, что уже использовался в (auth)/login.web.tsx и about-us.tsx:
// при отсутствии истории переходим на заведомо правильную родительскую
// страницу вместо бездействия.
export function adminGoBack(router: Router, fallbackHref: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallbackHref as any);
}
