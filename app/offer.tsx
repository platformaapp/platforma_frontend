import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OfferScreen() {
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
        <Text style={styles.mainTitle}>ПУБЛИЧНАЯ ОФЕРТА</Text>
        <Text style={styles.subtitle}>Договор оказания информационно-посреднических услуг</Text>

        <Section heading="1. Общие положения">
          <P>
            1.1. Настоящий документ является публичной офертой (далее — «Оферта») Якунина Владислава Александровича
            (самозанятый, ИНН 344214640369, далее — «Оператор»), адресованной любому дееспособному физическому лицу.
          </P>
          <P>
            1.2. Оператор управляет онлайн-платформой p34 (далее — «Платформа»), размещённой по адресу в сети Интернет,
            и предоставляет пользователям информационно-посреднические услуги: техническую возможность размещения
            мероприятий, бронирования, оплаты и участия в онлайн-формате.
          </P>
          <P>
            1.3. Оператор не является исполнителем образовательных, творческих или консультационных услуг. Все
            мероприятия проводятся независимыми наставниками и организаторами (далее — «Наставники»), которые
            самостоятельно определяют содержание, программу и стоимость своих мероприятий.
          </P>
          <P>
            1.4. Акцептом настоящей Оферты является регистрация на Платформе или оплата мероприятия. С этого момента
            Оферта считается заключённой между Оператором и Пользователем.
          </P>
        </Section>

        <Section heading="2. Предмет договора">
          <P>
            2.1. Оператор обязуется оказывать Пользователю следующие информационно-посреднические услуги:
          </P>
          <Bullet>предоставление доступа к Платформе и её функциям;</Bullet>
          <Bullet>техническое обеспечение бронирования мест на мероприятиях;</Bullet>
          <Bullet>приём и передачу платежей за мероприятия в пользу Наставников;</Bullet>
          <Bullet>предоставление технического доступа к онлайн-формату мероприятий (ссылка/видеосвязь).</Bullet>
          <P>
            2.2. Оказание указанных услуг не означает, что Оператор гарантирует качество, содержание или
            результат мероприятий: ответственность за них несут Наставники.
          </P>
        </Section>

        <Section heading="3. Порядок оплаты">
          <P>
            3.1. Оплата мероприятий осуществляется через сервис ЮKassa (ООО «ЮKassa», свидетельство ЦБ РФ
            № 3510) до начала мероприятия.
          </P>
          <P>
            3.2. Оператор действует как агент по приёму платежей: принимает денежные средства от Пользователя
            и перечисляет их Наставнику за вычетом агентского вознаграждения Платформы.
          </P>
          <P>
            3.3. Стоимость каждого мероприятия указана на его странице и включает агентское вознаграждение.
          </P>
          <P>
            3.4. Все расчёты производятся в российских рублях.
          </P>
        </Section>

        <Section heading="4. Возврат денежных средств">
          <P>
            4.1. Пользователь вправе отказаться от участия и запросить возврат не позднее чем за 24 часа до
            начала мероприятия. Для этого необходимо обратиться на электронную почту v.yakunin2011@yandex.ru.
          </P>
          <P>
            4.2. Возврат осуществляется в течение 10 рабочих дней на реквизиты, с которых была произведена оплата.
          </P>
          <P>
            4.3. При отмене или переносе мероприятия Наставником Пользователю возвращается полная стоимость
            в течение 5 рабочих дней.
          </P>
          <P>
            4.4. Возврат после начала мероприятия или менее чем за 24 часа до него не производится, если иное
            не согласовано с Наставником.
          </P>
        </Section>

        <Section heading="5. Права и обязанности сторон">
          <P>5.1. Оператор обязуется:</P>
          <Bullet>обеспечивать бесперебойную работу Платформы в разумных пределах;</Bullet>
          <Bullet>принимать и передавать платежи в установленные сроки;</Bullet>
          <Bullet>предоставлять техническую поддержку по вопросам работы Платформы.</Bullet>
          <P>5.2. Пользователь обязуется:</P>
          <Bullet>предоставлять достоверные данные при регистрации;</Bullet>
          <Bullet>не передавать данные учётной записи третьим лицам;</Bullet>
          <Bullet>соблюдать правила поведения на мероприятиях, установленные Наставниками.</Bullet>
        </Section>

        <Section heading="6. Ограничение ответственности">
          <P>
            6.1. Оператор не несёт ответственности за качество, полноту и результат образовательных или иных
            услуг, оказываемых Наставниками.
          </P>
          <P>
            6.2. Оператор не несёт ответственности за технические сбои на стороне Наставника или
            провайдеров связи.
          </P>
          <P>
            6.3. Ответственность Оператора перед Пользователем ограничена стоимостью оплаченного мероприятия.
          </P>
        </Section>

        <Section heading="7. Персональные данные">
          <P>
            7.1. Регистрируясь на Платформе, Пользователь выражает согласие на обработку персональных данных
            в соответствии с Политикой конфиденциальности, размещённой в приложении.
          </P>
          <P>
            7.2. Персональные данные обрабатываются исключительно в целях оказания услуг, предусмотренных
            настоящей Офертой.
          </P>
        </Section>

        <Section heading="8. Срок действия и изменение оферты">
          <P>
            8.1. Оферта вступает в силу с момента акцепта и действует бессрочно.
          </P>
          <P>
            8.2. Оператор вправе изменить условия Оферты, опубликовав новую редакцию в приложении. Продолжение
            использования Платформы после изменений означает согласие с ними.
          </P>
        </Section>

        <Section heading="9. Реквизиты Оператора">
          <Row label="Оператор" value="Якунин Владислав Александрович" />
          <Row label="Статус" value="Самозанятый (плательщик НПД)" />
          <Row label="ИНН" value="344214640369" />
          <Row label="Email" value="v.yakunin2011@yandex.ru" />
          <Row label="Телефон" value="+7 905 390 12 93" />
          <Row label="Банк" value="Альфа-Банк" />
          <Row label="Расч. счёт" value="40817810404981038195" />
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
  rowLabel: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#555', minWidth: 110, marginRight: 6 },
  rowValue: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', flex: 1 },
});
