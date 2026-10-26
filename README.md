# Learn French

Малко приложение за учене на френски: глаголи в présent, passé composé и futur proche с произношение, диалози, карти, игри (Двойки, Кога?, Être или avoir?, Чуй и разбери, 60 секунди, Числа и часове), диктовка, произношение и тест. При грешка в теста обяснява правилото и пита пак след няколко въпроса. Картите се връщат за преговор след 1, 3, 7, 16… дни.

Отваря се на https://stefanpetrov.github.io/learn-french/ (GitHub Pages от клона `main`).
На телефона: отвори адреса и избери „Добави към началния екран“. Работи и без интернет.

Файлове:
- `index.html`, `style.css` — страницата
- `data.js` — глаголите и изреченията за теста
- `app.js` — логиката (списък, карти с преговор навреме, тест, разделът „Игри“)
- `explain.js` — „Защо е грешно“: правилото зад грешния отговор
- `dictation.js` — диктовката
- `speaking.js` — произношението (разпознаване на говор и запис)
- `pairs.js` — играта „Двойки“
- `when.js` — играта „Кога?“ (думата за време решава времето)
- `etre-avoir.js` — играта „Être или avoir?“ (не `aux.js`: AUX е забранено име на файл в Windows)
- `listen.js` — играта „Чуй и разбери“
- `speed.js` — играта „60 секунди“
- `numbers.js` — играта „Числа и часове“ (septante и nonante или soixante-dix и quatre-vingt-dix)
- `dialogues.js`, `dialogues-data.js` — кратките диалози
- `manifest.webmanifest`, `icon*.png`, `icon.svg` — за инсталиране като приложение
- `fonts.css`, `fonts/` — шрифтовете Literata и Onest (SIL Open Font License), хостнати тук вместо от Google Fonts
- `analytics.js` — статистика с Google Analytics 4 само след съгласие (ID-то е в `GA_ID`)
- `progress.js` — „Запази прогреса“: инсталиране, известие за нова версия, пренос с файл или код
- `privacy.html` — страницата „Поверителност“
- `sw.js` — офлайн режим (при нови файлове смени `VERSION`)

## Статистика (Google Analytics 4)

Включена е с ID `G-1LZNKXXKV6` (`GA_ID` в `analytics.js`). Ако `GA_ID` е празно, няма банер и нищо не се зарежда от Google.
Посетителят вижда банер „Приемам / Отказвам“. Google се зарежда само след „Приемам“ (Consent Mode „basic“).

Преди да сложиш ID-то, в Google Analytics (на тези настройки разчита `privacy.html`):
1. Admin → Account settings → Data sharing settings: махни всички отметки.
2. Admin → Data streams → уеб потока → Enhanced measurement: изключено.
3. Admin → Data collection: Google signals изключено.
4. Admin → Data retention: event и user data 2 месеца, „Reset user data on new activity“ изключено.
5. По желание: Admin → Data collection → Granular location and device data collection изключено. Тогава в `privacy.html` смени „държава, регион и град“ на „държава и регион“.

Ако промениш текста на банера, целите или тези настройки, смени `CONSENT_KEY` (`statistika-v2` …), за да бъдат попитани всички отново, и обнови `privacy.html`.
