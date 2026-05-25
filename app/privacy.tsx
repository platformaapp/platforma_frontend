import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.mainTitle}>ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ СЕРВИСА p34</Text>
        <Text style={styles.subtitle}>Обработка персональных данных на платформе p34</Text>

        <Section heading="1. Общие положения">
          <P>
            1.1. Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки
            персональных данных пользователей платформы p34 Индивидуальным предпринимателем Якуниным Владиславом Александровичем (ОГРНИП 326344300061998,
            ИНН 344214640369, далее — «Оператор»).
          </P>
          <P>
            1.2. Политика разработана в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ
            «О персональных данных».
          </P>
          <P>
            1.3. Используя Платформу, вы подтверждаете согласие с настоящей Политикой. Если вы не согласны —
            пожалуйста, не используйте Платформу.
          </P>
        </Section>

        <Section heading="2. Состав персональных данных">
          <P>Оператор может обрабатывать следующие данные:</P>
          <Bullet>фамилия, имя, отчество;</Bullet>
          <Bullet>адрес электронной почты;</Bullet>
          <Bullet>номер телефона;</Bullet>
          <Bullet>аватар (фотография профиля) — по желанию пользователя;</Bullet>
          <Bullet>данные об оплаченных и посещённых мероприятиях;</Bullet>
          <Bullet>технические данные: IP-адрес, тип устройства, данные файлов cookie.</Bullet>
        </Section>

        <Section heading="3. Цели обработки">
          <P>Персональные данные обрабатываются в следующих целях:</P>
          <Bullet>регистрация и идентификация на Платформе;</Bullet>
          <Bullet>оказание информационно-посреднических услуг (бронирование, оплата, доступ к мероприятиям);</Bullet>
          <Bullet>обработка платежей через сервис ЮKassa;</Bullet>
          <Bullet>направление уведомлений, связанных с мероприятиями;</Bullet>
          <Bullet>поддержка пользователей;</Bullet>
          <Bullet>соблюдение требований законодательства РФ.</Bullet>
        </Section>

        <Section heading="4. Правовые основания обработки">
          <P>
            4.1. Обработка персональных данных осуществляется на основании:
          </P>
          <Bullet>согласия субъекта персональных данных (ст. 6, ч. 1, п. 1 Закона № 152-ФЗ);</Bullet>
          <Bullet>исполнения договора, стороной которого является субъект (ст. 6, ч. 1, п. 5);</Bullet>
          <Bullet>выполнения обязанностей, предусмотренных законодательством РФ.</Bullet>
        </Section>

        <Section heading="5. Передача данных третьим лицам">
          <P>
            5.1. Пользователь соглашается на передачу персональных данных третьим лицам, включая:
          </P>
          <Bullet>платёжные сервисы (в т. ч. ЮKassa) — для проведения платёжных операций;</Bullet>
          <Bullet>сервисы аналитики — для анализа использования Платформы;</Bullet>
          <Bullet>облачные провайдеры — для хранения и обработки данных;</Bullet>
          <Bullet>сервисы видеосвязи — для проведения онлайн-занятий и мероприятий;</Bullet>
          <Bullet>наставникам и организаторам — в объёме, необходимом для исполнения договора оказания услуг;</Bullet>
          <Bullet>государственным органам — по требованию, предусмотренному законодательством.</Bullet>
          <P>
            5.2. Передача данных осуществляется в объёме, необходимом для функционирования Сервиса. Персональные данные не продаются и не передаются в рекламных целях.
          </P>
        </Section>

        <Section heading="6. Хранение и защита данных">
          <P>
            6.1. Данные хранятся на серверах, расположенных на территории Российской Федерации, в соответствии
            с требованиями ст. 18.1 Закона № 152-ФЗ.
          </P>
          <P>
            6.2. Оператор применяет технические и организационные меры для защиты данных от несанкционированного
            доступа, изменения, раскрытия или уничтожения.
          </P>
          <P>
            6.3. Данные хранятся не дольше, чем это необходимо для достижения целей обработки, или до момента
            отзыва согласия пользователем.
          </P>
        </Section>

        <Section heading="7. Права пользователя">
          <P>Вы имеете право:</P>
          <Bullet>получить информацию об обработке ваших данных;</Bullet>
          <Bullet>потребовать исправления неточных данных;</Bullet>
          <Bullet>отозвать согласие на обработку данных;</Bullet>
          <Bullet>потребовать удаления ваших данных («право на забвение»);</Bullet>
          <Bullet>подать жалобу в Роскомнадзор.</Bullet>
          <P>
            Для реализации прав направьте запрос на email: v.yakunin2011@yandex.ru
          </P>
        </Section>

        <Section heading="8. Файлы cookie">
          <P>
            8.1. Платформа использует файлы cookie для корректной работы сессий авторизации и улучшения
            пользовательского опыта.
          </P>
          <P>
            8.2. Вы можете отключить cookie в настройках браузера, однако это может повлиять на
            функциональность Платформы.
          </P>
        </Section>

        <Section heading="9. Изменение политики">
          <P>
            9.1. Оператор вправе изменять настоящую Политику. Актуальная версия всегда доступна в приложении.
            Продолжение использования Платформы после изменений означает согласие с новой редакцией.
          </P>
        </Section>

        <Section heading="10. Контакты">
          <Row label="Наименование" value="ИП Якунин Владислав Александрович" />
          <Row label="ИНН" value="344214640369" />
          <Row label="ОГРНИП" value="326344300061998" />
          <Row label="Адрес" value="400007, Россия, Волгоградская обл., г. Волгоград, ул. Таращанцев, д. 8, кв. 1" />
          <Row label="Email" value="v.yakunin2011@yandex.ru" />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bullet}>— {children}</Text>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}:</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  mainTitle: { fontSize: 22, lineHeight: 30, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginTop: 4, marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionHeading: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', borderBottomWidth: 1, borderColor: '#1E1E1E', paddingBottom: 6, marginBottom: 10 },
  body: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 8 },
  bullet: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 5, paddingLeft: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  rowLabel: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#555', minWidth: 80, marginRight: 6 },
  rowValue: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', flex: 1 },
});
