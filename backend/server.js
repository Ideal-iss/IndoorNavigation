/**
 * Основной серверный файл для системы Bluetooth навигации в помещениях
 * 
 * Этот файл инициализирует Express-приложение и устанавливает основные маршруты
 * для взаимодействия с мобильным приложением и обработки данных от BLE-маячков
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Импорт алгоритмов
const { LocationAlgorithms, RouteAlgorithms } = require('./algorithms');

// Инициализация приложения
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Защита заголовков
app.use(cors()); // Поддержка CORS
app.use(express.json({ limit: '10mb' })); // Поддержка JSON в body
app.use(express.urlencoded({ extended: true }));

// Простая проверка работоспособности сервера
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'BLE Indoor Navigation Backend'
    });
});

// Маршрут для определения местоположения пользователя
app.post('/api/v1/location', (req, res) => {
    try {
        const { beacons, userId } = req.body;

        // Проверка обязательных параметров
        if (!beacons || !Array.isArray(beacons) || beacons.length === 0) {
            return res.status(400).json({ 
                error: 'Требуется массив данных о маячках' 
            });
        }

        // Подготовка данных для алгоритма локализации
        const processedBeacons = beacons.map(beacon => {
            // Получение координат маячка из базы данных (заглушка)
            // В реальной реализации нужно получить координаты из БД по UUID
            const beaconCoordinates = getBeaconCoordinates(beacon.uuid);
            
            if (!beaconCoordinates) {
                console.warn(`Маячок с UUID ${beacon.uuid} не найден в базе данных`);
                return null;
            }

            // Расчет расстояния по RSSI
            const distance = LocationAlgorithms.calculateDistanceFromRSSI(
                beacon.rssi, 
                beacon.txPower || -59, // Значение по умолчанию
                2 // Коэффициент затухания
            );

            return {
                x: beaconCoordinates.x,
                y: beaconCoordinates.y,
                distance: distance
            };
        }).filter(Boolean); // Убираем null значения

        if (processedBeacons.length < 3) {
            return res.status(400).json({ 
                error: 'Недостаточно данных от маячков для определения местоположения' 
            });
        }

        // Вычисление координат пользователя
        const userLocation = LocationAlgorithms.multilateration(processedBeacons);

        if (!userLocation) {
            return res.status(500).json({ 
                error: 'Не удалось вычислить местоположение пользователя' 
            });
        }

        // Возвращаем результат
        res.status(200).json({
            location: userLocation,
            accuracy: calculateAccuracy(processedBeacons),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Ошибка при определении местоположения:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

// Маршрут для построения маршрута
app.get('/api/v1/route', (req, res) => {
    try {
        const { start_x, start_y, end_x, end_y, roomId } = req.query;

        // Проверка обязательных параметров
        if (!start_x || !start_y || !end_x || !end_y) {
            return res.status(400).json({ 
                error: 'Требуются параметры start_x, start_y, end_x, end_y' 
            });
        }

        // Получение графа помещения из базы данных (заглушка)
        // В реальной реализации нужно получить граф из БД по roomId
        const roomGraph = getRoomGraph(roomId);

        if (!roomGraph) {
            return res.status(404).json({ 
                error: `Граф помещения с ID ${roomId} не найден` 
            });
        }

        // Определение начальной и конечной точек
        const start = { x: parseFloat(start_x), y: parseFloat(start_y) };
        const goal = { x: parseFloat(end_x), y: parseFloat(end_y) };

        // Построение маршрута с использованием A* алгоритма
        const route = RouteAlgorithms.aStar(start, goal, roomGraph);

        if (route.length === 0) {
            return res.status(404).json({ 
                error: 'Маршрут не найден' 
            });
        }

        // Возвращаем результат
        res.status(200).json({
            route: route,
            distance: calculateRouteDistance(route),
            estimated_time: estimateTravelTime(route),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Ошибка при построении маршрута:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

// Маршрут для получения точек интереса
app.get('/api/v1/poi', (req, res) => {
    try {
        const { roomId, type } = req.query;

        // Получение точек интереса из базы данных (заглушка)
        // В реальной реализации нужно получить данные из БД
        const pois = getPoiByRoomAndType(roomId, type);

        res.status(200).json({
            pois: pois,
            count: pois.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Ошибка при получении точек интереса:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

// Маршрут для получения информации о помещениях
app.get('/api/v1/rooms', (req, res) => {
    try {
        // Получение списка помещений из базы данных (заглушка)
        // В реальной реализации нужно получить данные из БД
        const rooms = getAllRooms();

        res.status(200).json({
            rooms: rooms,
            count: rooms.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Ошибка при получении списка помещений:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

// Маршрут для получения информации о маячках
app.get('/api/v1/beacons', (req, res) => {
    try {
        const { roomId } = req.query;

        // Получение списка маячков из базы данных (заглушка)
        // В реальной реализации нужно получить данные из БД
        const beacons = getBeaconsByRoom(roomId);

        res.status(200).json({
            beacons: beacons,
            count: beacons.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Ошибка при получении списка маячков:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

// Заглушки для функций работы с базой данных
// В реальной реализации эти функции будут взаимодействовать с БД

function getBeaconCoordinates(uuid) {
    // Заглушка - в реальной реализации получать координаты из БД
    // по UUID маячка
    const mockBeacons = {
        '123e4567-e89b-12d3-a456-426614174000': { x: 5.0, y: 5.0 },
        '123e4567-e89b-12d3-a456-426614174001': { x: 10.0, y: 5.0 },
        '123e4567-e89b-12d3-a456-426614174002': { x: 5.0, y: 10.0 },
        '123e4567-e89b-12d3-a456-426614174003': { x: 10.0, y: 10.0 }
    };
    
    return mockBeacons[uuid] || null;
}

function getRoomGraph(roomId) {
    // Заглушка - в реальной реализации получать граф из БД
    // по ID помещения
    return [
        { id: 'node1', x: 0, y: 0, connectedNodes: ['node2', 'node3'] },
        { id: 'node2', x: 5, y: 0, connectedNodes: ['node1', 'node4'] },
        { id: 'node3', x: 0, y: 5, connectedNodes: ['node1', 'node4'] },
        { id: 'node4', x: 5, y: 5, connectedNodes: ['node2', 'node3', 'node5'] },
        { id: 'node5', x: 10, y: 5, connectedNodes: ['node4'] }
    ];
}

function getPoiByRoomAndType(roomId, type) {
    // Заглушка - в реальной реализации получать POI из БД
    return [
        { id: 1, name: 'Кафе', x: 6.0, y: 6.0, type: 'cafe' },
        { id: 2, name: 'Туалет', x: 8.0, y: 3.0, type: 'restroom' },
        { id: 3, name: 'Выход', x: 10.0, y: 10.0, type: 'exit' }
    ];
}

function getAllRooms() {
    // Заглушка - в реальной реализации получать помещения из БД
    return [
        { id: 1, name: 'Этаж 1', description: 'Первый этаж здания', floor_number: 1 },
        { id: 2, name: 'Этаж 2', description: 'Второй этаж здания', floor_number: 2 }
    ];
}

function getBeaconsByRoom(roomId) {
    // Заглушка - в реальной реализации получать маячки из БД
    return [
        { id: 1, uuid: '123e4567-e89b-12d3-a456-426614174000', x: 5.0, y: 5.0 },
        { id: 2, uuid: '123e4567-e89b-12d3-a456-426614174001', x: 10.0, y: 5.0 },
        { id: 3, uuid: '123e4567-e89b-12d3-a456-426614174002', x: 5.0, y: 10.0 }
    ];
}

// Вспомогательные функции

function calculateAccuracy(beacons) {
    // Простая оценка точности на основе количества и расстояний до маячков
    if (beacons.length === 0) return Infinity;
    
    const avgDistance = beacons.reduce((sum, beacon) => sum + beacon.distance, 0) / beacons.length;
    const accuracy = avgDistance / beacons.length * 10; // Грубая эвристика
    
    return Math.min(accuracy, 10); // Ограничиваем максимальной погрешностью 10 метров
}

function calculateRouteDistance(route) {
    if (route.length < 2) return 0;
    
    let distance = 0;
    for (let i = 1; i < route.length; i++) {
        const dx = route[i].x - route[i-1].x;
        const dy = route[i].y - route[i-1].y;
        distance += Math.sqrt(dx * dx + dy * dy);
    }
    
    return distance;
}

function estimateTravelTime(route) {
    const distance = calculateRouteDistance(route);
    const walkingSpeed = 1.4; // м/с
    return Math.round((distance / walkingSpeed) * 10) / 10; // в секундах
}

// Обработка 404 ошибок
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Глобальный обработчик ошибок
app.use((error, req, res, next) => {
    console.error('Необработанная ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Сервис: BLE Indoor Navigation Backend`);
    console.log(`Время запуска: ${new Date().toISOString()}`);
});

module.exports = app;