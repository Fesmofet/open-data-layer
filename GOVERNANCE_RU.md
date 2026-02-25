# Governance в проекте (русское описание)

Этот документ описывает, как работает governance в системе консенсуса апдейтов объектов на Hive.

## 1) Зачем нужен governance

Governance определяет:

- кто может управлять ролями;
- как выбираются доверенные участники;
- какие операции должны быть отклонены до применения;
- как обеспечить детерминированный результат при reindex.

## 2) Пространства событий

В системе используются `custom_json` события:

- `od.governance.v1` — управление governance (`create_committee`, `grant_role`, `revoke_role`);
- `od.objects.v1` — создание объектов;
- `od.updates.v1` — создание апдейтов и голосование за апдейты.

## 3) Bootstrap governance (первичная инициализация)

### Root of trust

На старте индексер имеет заранее заданный `bootstrap_allowlist` (список доверенных аккаунтов).

### Единственный `create_committee`

`create_committee` может быть принят только один раз:

1. Пока `governance_initialized = false`, события читаются в каноническом порядке.
2. Первый валидный `create_committee` от аккаунта из `bootstrap_allowlist` фиксирует genesis.
3. После этого `governance_initialized = true`, сохраняется `genesis_tx_id`.
4. Любой следующий `create_committee` отклоняется с `DUPLICATE_GENESIS`.

Это исключает повторную инициализацию governance.

## 4) Кто считается участником governance

Для всех правил, где требуется проверка по governance-участникам:

- члены комитета (`create_committee.members`);
- аккаунты с активными governance-ролями (выданными через `grant_role` и не отозванными `revoke_role`).

Итог:

`governance participants = committee members + governance-role holders`.

## 5) Роли и управление доступом

Роли назначаются и отзываются через события:

- `grant_role` — назначить роль;
- `revoke_role` — отозвать роль.

Роли используются в двух местах:

1. Для проверки прав на governance-операции.
2. Для учета голоса в `update_vote` (голос учитывается только при валидной роли на момент события).

## 6) Правило muted list для create-операций

Для `object_create` и `update_create` действует обязательная pre-check логика:

1. Для `creator` проверяется, находится ли он в muted list **любого** governance participant.
2. Проверка выполняется на **момент события** (`event_time` / block time), а не по текущему состоянию.
3. Если muted найден хотя бы у одного участника governance, операция отклоняется с:
   - `CREATOR_MUTED_BY_GOVERNANCE`.

Важно: эта проверка делается **до** бизнес-валидаций (уникальность, ссылочная целостность и т.д.), чтобы причина reject была однозначной.

На `update_vote` это правило не распространяется.

## 7) Детерминизм и порядок применения

События применяются в каноническом порядке:

`(block_num, trx_index, op_index, transaction_id)`.

Это гарантирует:

- одинаковый результат при повторном reindex;
- стабильные причины reject;
- одинаковую materialized state на одинаковом наборе блоков.

## 8) Связь governance и модели апдейтов

Governance влияет на апдейты так:

- через роли определяет, какие `update_vote` вообще засчитываются;
- через muted-rule блокирует `object_create`/`update_create` от нежелательных `creator`;
- через комитет и bootstrap защищает систему от повторной или несанкционированной инициализации.

## 9) Основные reject-коды governance-сценариев

- `DUPLICATE_GENESIS` — повторный `create_committee`;
- `UNAUTHORIZED_GOVERNANCE_OP` — неавторизованная governance-операция;
- `CREATOR_MUTED_BY_GOVERNANCE` — creator в muted list хотя бы одного governance participant;
- `ROLE_REQUIRED` — голос не засчитан из-за отсутствия валидной роли;
- `INVALID_GOVERNANCE_PAYLOAD` / `INVALID_OBJECT_PAYLOAD` / `INVALID_UPDATE_PAYLOAD` — невалидный payload.

## 10) Короткий итог

Governance в этой модели — это детерминированный слой правил поверх событий Hive:

- один genesis-комитет;
- прозрачное управление ролями;
- pre-check muted list для create-операций;
- проверка на block time для воспроизводимости;
- единые reject-коды для аудита и отладки.
