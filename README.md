# Whisper App

Whisper App — настольный AI‑ассистент для Windows с раздельным захватом микрофона и системного звука. Версия 1.7.1 позволяет независимо выбрать входной микрофон и конкретное устройство вывода Windows, показывает состояние аудиозахвата и не скрывает отказ системного звука.

## Возможности

- независимый выбор микрофона через MediaDevices;
- выбор точного Windows render endpoint для системного звука;
- нативный WASAPI loopback helper без зависимости от Stereo Mix;
- корректный многоканальный downmix и преобразование в PCM 16 кГц mono;
- heartbeat‑кадры при тишине, чтобы отсутствие звука не считалось отказом;
- один автоматический повтор для того же endpoint без незаметной подмены устройства;
- видимое degraded‑состояние, ручной повтор и переход в настройки;
- явный аварийный режим захвата устройства Windows по умолчанию;
- NSIS‑установщик Windows x64.

## Системные требования

Для запуска:

- Windows 10/11 x64.

Для сборки:

- Node.js 22 и npm;
- Visual Studio 2022 Build Tools;
- MSVC x64 C++ toolchain и Windows SDK;
- PowerShell 5.1 или новее.

## Быстрый старт для разработчика

```powershell
git clone https://github.com/Krazzer00/Whisper-App.git
cd Whisper-App
npm ci
npm test
npm run build
```

Запуск в режиме разработки:

```powershell
npx electron .
```

Сборка установщика:

```powershell
npm run dist:win
```

Результат появится в `dist/Whisper-Setup-1.7.1-audio-devices.exe`.

## Структура проекта

```text
Whisper-App/
├── src/                         Electron main/preload, сервисы и UI
├── native/windows-audio-helper  C++ WASAPI loopback helper
├── scripts/                     сборка renderer и native helper
├── test/                        unit, contract и hardware integration tests
├── public/                      HTML, CSS и ресурсы Electron UI
├── whisper_web/                 vendored web/backend runtime inputs
├── build/                       метаданные electron-builder/updater
├── docs/                        архитектура, спецификации и планы
└── .github/workflows/           Windows CI
```

Каталог `whisper_web` содержит восстановленные скомпилированные runtime‑ресурсы: исходники более высокого уровня для них отсутствуют. Они намеренно хранятся в репозитории как vendored inputs, чтобы проект собирался автономно.

## Как устроен системный звук

Главный процесс перечисляет активные Windows render endpoints и запускает отдельный C++ helper с точным сохранённым endpoint ID. Helper открывает WASAPI loopback, приводит входной формат к PCM16 16 кГц mono и передаёт кадры через named pipe. Управляющие статусы идут по JSON/stdout.

При реальной тишине helper продолжает передавать нулевые heartbeat‑кадры. При отключении выбранного устройства приложение показывает ошибку и предлагает повторить захват либо выбрать другое устройство. Оно не переключает endpoint незаметно. Дополнительные сведения: [архитектура аудиозахвата](docs/architecture/audio-capture.md).

## Настройки окружения

Скопируйте `.env.example` в `.env` только для локальной разработки. Не добавляйте токены или закрытые ключи в `.env.example` и не коммитьте `.env`.

```env
NODE_ENV=development
WHISPER_WEB_URL=http://localhost:3000
```

## Проверки

```powershell
npm test
npm run build:native
npm run build:renderer
npm run pack:win
```

Hardware integration test последовательно открывает два разных активных WASAPI‑выхода. Для его выполнения на машине должны присутствовать как минимум два активных render endpoint; на headless CI без аудиоустройств эта проверка явно помечается как пропущенная.
Команда `npm test` перед запуском тестов автоматически собирает native helper, поэтому проверка работает и после чистого клонирования.

## Установка и SmartScreen

Скачайте установщик из GitHub Releases и запустите его. Сборка 1.7.1 не подписана коммерческим Authenticode‑сертификатом, поэтому Windows SmartScreen может показать предупреждение «Неизвестный издатель». Сверяйте SHA‑256 с контрольной суммой в описании релиза.

## Устранение неполадок

- Если устройство отсутствует в списке, включите его в настройках звука Windows и нажмите «Refresh devices».
- Если сохранённый endpoint отключён, выберите другой или подключите прежнее устройство и нажмите «Retry audio».
- Если микрофон не виден, проверьте разрешение Windows на доступ настольных приложений к микрофону.
- Режим `Emergency — Windows default` использует системное устройство по умолчанию и включается только вручную.
- Логи запуска Electron следует проверять до переустановки: приложение сообщает структурированную причину degraded‑состояния.

## Релиз 1.7.1

Релиз включает независимый выбор источников аудио и исправление ложного отказа системного звука при тишине. Полное описание находится в [заметках релиза](docs/releases/v1.7.1.md).

## Лицензия

Проект распространяется по лицензии [GNU GPL v3](LICENSE).
