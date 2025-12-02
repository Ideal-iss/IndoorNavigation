# Схема базы данных для системы Bluetooth навигации в помещениях

## 1. Общее описание

Документ описывает структуру базы данных для хранения информации о BLE-маячках, помещениях, маршрутах и других данных, необходимых для работы системы Bluetooth навигации в помещениях.

## 2. Сущности и таблицы

### 2.1 Помещения (rooms)

Хранит информацию о помещениях, в которых осуществляется навигация.

```sql
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    floor_number INTEGER,
    building_name VARCHAR(255),
    map_image_url VARCHAR(500),
    width DECIMAL(10,2),  -- ширина помещения в метрах
    height DECIMAL(10,2), -- высота помещения в метрах
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 BLE-маячки (beacons)

Хранит информацию о BLE-маячках, установленных в помещениях.

```sql
CREATE TABLE beacons (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,  -- UUID маячка
    major INTEGER,                     -- Major значение
    minor INTEGER,                     -- Minor значение
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    x_coordinate DECIMAL(10,2),        -- координата X в помещении (в метрах)
    y_coordinate DECIMAL(10,2),        -- координата Y в помещении (в метрах)
    tx_power INTEGER,                  -- мощность передатчика (RSSI на 1м)
    beacon_type VARCHAR(50),           -- тип маячка (iBeacon, Eddystone и т.д.)
    battery_level INTEGER,             -- уровень заряда батареи (%)
    status VARCHAR(20) DEFAULT 'active', -- статус (active, inactive, maintenance)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 Точки интереса (points_of_interest)

Хранит информацию о точках интереса в помещениях (магазины, офисы, туалеты и т.д.).

```sql
CREATE TABLE points_of_interest (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    x_coordinate DECIMAL(10,2),
    y_coordinate DECIMAL(10,2),
    poi_type VARCHAR(50),              -- тип точки (shop, office, restroom и т.д.)
    floor_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 Маршруты (routes)

Хранит информацию о предопределенных маршрутах между точками в помещении.

```sql
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    start_point_x DECIMAL(10,2),
    start_point_y DECIMAL(10,2),
    end_point_x DECIMAL(10,2),
    end_point_y DECIMAL(10,2),
    path_data JSONB,                   -- JSON-данные о точках маршрута
    distance DECIMAL(10,2),            -- расстояние в метрах
    estimated_time INTEGER,            -- оценочное время в секундах
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.5 Граф помещения (room_graph)

Хранит информацию о графе помещения для алгоритмов маршрутизации.

```sql
CREATE TABLE room_graph (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    node_id VARCHAR(50) NOT NULL,      -- уникальный идентификатор узла
    x_coordinate DECIMAL(10,2),
    y_coordinate DECIMAL(10,2),
    node_type VARCHAR(50),             -- тип узла (corridor, room, entrance и т.д.)
    connected_nodes JSONB,             -- JSON-массив с идентификаторами связанных узлов
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.6 История перемещений (movement_history)

Хранит историю перемещений пользователей (опционально, для аналитики).

```sql
CREATE TABLE movement_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),              -- идентификатор пользователя
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    x_coordinate DECIMAL(10,2),
    y_coordinate DECIMAL(10,2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100)            -- идентификатор сессии
);
```

### 2.7 Пользователи (users)

Хранит информацию о пользователях системы (если требуется аутентификация).

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 3. Индексы

Для оптимизации производительности рекомендуется создать следующие индексы:

```sql
-- Индексы для таблицы beacons
CREATE INDEX idx_beacons_room_id ON beacons(room_id);
CREATE INDEX idx_beacons_coordinates ON beacons(x_coordinate, y_coordinate);
CREATE INDEX idx_beacons_uuid ON beacons(uuid);

-- Индексы для таблицы points_of_interest
CREATE INDEX idx_poi_room_id ON points_of_interest(room_id);
CREATE INDEX idx_poi_coordinates ON points_of_interest(x_coordinate, y_coordinate);
CREATE INDEX idx_poi_type ON points_of_interest(poi_type);

-- Индексы для таблицы routes
CREATE INDEX idx_routes_room_id ON routes(room_id);

-- Индексы для таблицы movement_history
CREATE INDEX idx_movement_timestamp ON movement_history(timestamp);
CREATE INDEX idx_movement_user_id ON movement_history(user_id);
CREATE INDEX idx_movement_room_id ON movement_history(room_id);
```

## 4. Связи между таблицами

- `beacons.room_id` → `rooms.id`
- `points_of_interest.room_id` → `rooms.id`
- `routes.room_id` → `rooms.id`
- `room_graph.room_id` → `rooms.id`
- `movement_history.room_id` → `rooms.id`

## 5. Примеры запросов

### 5.1 Получение всех маячков в помещении

```sql
SELECT * FROM beacons WHERE room_id = $roomId;
```

### 5.2 Получение координат маячков для алгоритма локализации

```sql
SELECT uuid, major, minor, x_coordinate, y_coordinate, tx_power 
FROM beacons 
WHERE room_id = $roomId;
```

### 5.3 Получение точек интереса в помещении

```sql
SELECT * FROM points_of_interest WHERE room_id = $roomId AND poi_type = $type;
```

## 6. Особенности реализации

- Использование JSONB для хранения сложных данных (маршруты, графы)
- Поддержка геометрических вычислений (при необходимости)
- Возможность масштабирования для многоэтажных зданий
- Учет особенностей помещения (препятствия, зоны с плохим покрытием)