# Архитектура аудиозахвата

## Границы компонентов

- `src/features/listen/audio/windowsAudioService.js` перечисляет устройства, управляет helper‑процессом и named pipe, отслеживает здоровье захвата и допускает один повтор для того же endpoint.
- `src/features/listen/audio/windowsAudioProtocol.js` разбирает бинарные кадры `WAP1` и ограничивает размер payload.
- `native/windows-audio-helper/` открывает точный WASAPI render endpoint в loopback‑режиме, выполняет downmix/resampling и формирует PCM16 кадры.
- `src/ui/listen/listenCapture.js` запрашивает точный микрофон, принимает системный PCM и выравнивает reference‑кадры для AEC.
- `src/features/common/featureBridge.js` предоставляет узкие IPC‑каналы и передаёт renderer структурированные health‑события.

## Поток данных

1. Settings сохраняет `microphoneDeviceId`, `systemAudioDeviceId` и `systemAudioMode`.
2. Main process запускает helper с точным `systemAudioDeviceId`; подмена Windows default запрещена.
3. Helper передаёт JSON‑статусы через stdout и framed PCM через именованный канал.
4. Main process передаёт PCM в STT и renderer вместе с временем поступления.
5. Renderer использует timestamp/arrival alignment для AEC и отклоняет устаревшие reference‑кадры.

## Тишина и отказ

Тишина является нормальным состоянием: helper раз в 100 мс передаёт нулевой PCM heartbeat. Отказом считаются невозможность открыть endpoint, остановка helper, повреждённый протокол или превышение health timeout. После единственного повтора того же endpoint приложение переходит в degraded‑состояние и показывает действия `Retry audio` и `Choose another device`.

Режим `chromium-default` существует только как явно выбранный аварийный fallback. Он не включается автоматически вместо сохранённого WASAPI endpoint.

Release‑сборка использует `electron-builder --publish never`: updater metadata включается в пакет, но публикация GitHub Release выполняется отдельным проверяемым шагом.
