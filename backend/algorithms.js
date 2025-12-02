/**
 * Алгоритмы для системы Bluetooth навигации в помещениях
 * 
 * Данный файл содержит реализации основных алгоритмов:
 * - Определение местоположения по RSSI данным
 * - Фильтрация RSSI сигнала
 * - Построение маршрута (A* алгоритм)
 * - Трилатерация для определения координат
 */

class LocationAlgorithms {
    /**
     * Расчет расстояния по значению RSSI
     * @param {number} rssi - Уровень сигнала
     * @param {number} txPower - Мощность передатчика (RSSI на 1 метре)
     * @param {number} n - Коэффициент затухания сигнала (обычно от 2 до 4)
     * @returns {number} Оценочное расстояние в метрах
     */
    static calculateDistanceFromRSSI(rssi, txPower, n = 2) {
        if (rssi === 0) {
            return -1; // Не могу рассчитать расстояние
        }
        
        const ratio = rssi / txPower;
        if (ratio < 1) {
            // Если сигнал сильнее, чем на 1 метре, используем простую эвристику
            return Math.pow(10, (txPower - rssi) / (10 * n));
        } else {
            // Если сигнал слабее, чем на 1 метре
            return Math.pow(10, (txPower - rssi) / (10 * n));
        }
    }

    /**
     * Фильтрация RSSI с помощью скользящего среднего
     * @param {Array<number>} rssiValues - Массив значений RSSI
     * @param {number} windowSize - Размер окна для усреднения
     * @returns {number} Отфильтрованное значение RSSI
     */
    static movingAverageFilter(rssiValues, windowSize = 5) {
        if (rssiValues.length === 0) return 0;
        
        const valuesToUse = rssiValues.slice(-windowSize);
        const sum = valuesToUse.reduce((acc, val) => acc + val, 0);
        return sum / valuesToUse.length;
    }

    /**
     * Простой фильтр Калмана для RSSI
     * @param {number} measurement - Текущее измерение RSSI
     * @param {Object} kalmanParams - Параметры фильтра
     * @returns {Object} Обновленное значение и параметры фильтра
     */
    static kalmanFilter(measurement, kalmanParams = { estimate: 0, error: 1 }) {
        // Параметры фильтра
        const processNoise = 0.1;  // Уровень шума процесса
        const measurementNoise = 0.5;  // Уровень шума измерений
        
        // Прогноз
        const prediction = kalmanParams.estimate;
        const predictionError = kalmanParams.error + processNoise;
        
        // Коэффициент Калмана
        const kalmanGain = predictionError / (predictionError + measurementNoise);
        
        // Обновление
        const estimate = prediction + kalmanGain * (measurement - prediction);
        const error = (1 - kalmanGain) * predictionError;
        
        return {
            estimate: estimate,
            error: error,
            kalmanParams: { estimate: estimate, error: error }
        };
    }

    /**
     * Трилатерация для определения координат пользователя
     * @param {Array<Object>} beacons - Массив объектов маячков {x, y, distance}
     * @returns {Object|null} Объект с координатами {x, y} или null
     */
    static trilateration(beacons) {
        if (beacons.length < 3) {
            return null; // Для трилатерации нужно минимум 3 маячка
        }

        // Берем первые 3 маячка для вычисления
        const b1 = beacons[0];
        const b2 = beacons[1];
        const b3 = beacons[2];

        // Метод трилатерации для 3-х точек
        // Решаем систему уравнений:
        // (x - x1)² + (y - y1)² = d1²
        // (x - x2)² + (y - y2)² = d2²
        // (x - x3)² + (y - y3)² = d3²

        // Преобразуем в систему линейных уравнений
        const A = 2 * (b2.x - b1.x);
        const B = 2 * (b2.y - b1.y);
        const C = b1.x * b1.x - b2.x * b2.x + b1.y * b1.y - b2.y * b2.y + b2.distance * b2.distance - b1.distance * b1.distance;

        const D = 2 * (b3.x - b2.x);
        const E = 2 * (b3.y - b2.y);
        const F = b2.x * b2.x - b3.x * b3.x + b2.y * b2.y - b3.y * b3.y + b3.distance * b3.distance - b2.distance * b2.distance;

        // Решаем систему
        const x = (C * E - F * B) / (E * A - B * D);
        const y = (C * D - A * F) / (B * D - A * E);

        return { x: x, y: y };
    }

    /**
     * Многомерная трилатерация с использованием метода наименьших квадратов
     * для улучшения точности при наличии более 3 маячков
     * @param {Array<Object>} beacons - Массив объектов маячков {x, y, distance}
     * @returns {Object|null} Объект с координатами {x, y} или null
     */
    static multilateration(beacons) {
        if (beacons.length < 3) {
            return null;
        }

        // Если только 3 маячка, используем простую трилатерацию
        if (beacons.length === 3) {
            return this.trilateration(beacons);
        }

        // Для более чем 3 маячков используем метод наименьших квадратов
        // Аппроксимируем координаты с учетом всех доступных данных

        // Начальное приближение - результат трилатерации первых 3 маячков
        const initialEstimate = this.trilateration(beacons.slice(0, 3));
        if (!initialEstimate) return null;

        // Улучшаем оценку с учетом всех маячков
        let x = initialEstimate.x;
        let y = initialEstimate.y;

        // Итеративное улучшение оценки (упрощенная версия метода)
        for (let iteration = 0; iteration < 10; iteration++) {
            let sumX = 0, sumY = 0, sumWeight = 0;

            for (const beacon of beacons) {
                const distanceToBeacon = Math.sqrt(Math.pow(x - beacon.x, 2) + Math.pow(y - beacon.y, 2));
                const weight = 1 / (1 + Math.abs(distanceToBeacon - beacon.distance)); // Обратный вес ошибки
                
                sumX += weight * beacon.x;
                sumY += weight * beacon.y;
                sumWeight += weight;
            }

            if (sumWeight > 0) {
                x = sumX / sumWeight;
                y = sumY / sumWeight;
            }
        }

        return { x: x, y: y };
    }
}

class RouteAlgorithms {
    /**
     * Реализация алгоритма A* для построения маршрута
     * @param {Object} start - Начальная точка {x, y}
     * @param {Object} goal - Конечная точка {x, y}
     * @param {Array<Object>} graph - Граф помещения
     * @returns {Array<Object>} Массив точек маршрута
     */
    static aStar(start, goal, graph) {
        // Узлы графа должны быть представлены в формате:
        // { id, x, y, connectedNodes: [id1, id2, ...] }
        
        // Создаем узлы с дополнительной информацией для A*
        const nodes = new Map();
        graph.forEach(node => {
            nodes.set(node.id, {
                ...node,
                gScore: Infinity,    // Стоимость пути от старта
                fScore: Infinity,    // gScore + heuristic
                cameFrom: null       // Предыдущий узел в пути
            });
        });

        // Находим ближайшие узлы к начальной и конечной точкам
        const startNode = this.findClosestNode(start, graph);
        const goalNode = this.findClosestNode(goal, graph);

        if (!startNode || !goalNode) {
            return []; // Не удалось найти подходящие узлы
        }

        const startNodeInfo = nodes.get(startNode.id);
        const goalNodeInfo = nodes.get(goalNode.id);

        startNodeInfo.gScore = 0;
        startNodeInfo.fScore = this.heuristicCostEstimate(startNode, goalNode);

        const openSet = new Set([startNode.id]);
        const closedSet = new Set();

        while (openSet.size > 0) {
            // Находим узел с минимальным fScore
            let currentId = null;
            let lowestFScore = Infinity;

            for (const id of openSet) {
                const node = nodes.get(id);
                if (node.fScore < lowestFScore) {
                    lowestFScore = node.fScore;
                    currentId = id;
                }
            }

            if (currentId === goalNode.id) {
                // Построили маршрут, восстанавливаем путь
                return this.reconstructPath(nodes, goalNode.id);
            }

            openSet.delete(currentId);
            closedSet.add(currentId);

            const currentNode = nodes.get(currentId);
            const connectedNodeIds = currentNode.connectedNodes || [];

            for (const neighborId of connectedNodeIds) {
                if (closedSet.has(neighborId)) continue;

                const neighborNode = nodes.get(neighborId);
                const tentativeGScore = currentNode.gScore + 
                    this.distanceBetween(currentNode, neighborNode);

                if (!openSet.has(neighborId)) {
                    openSet.add(neighborId);
                } else if (tentativeGScore >= neighborNode.gScore) {
                    continue;
                }

                neighborNode.cameFrom = currentId;
                neighborNode.gScore = tentativeGScore;
                neighborNode.fScore = neighborNode.gScore + 
                    this.heuristicCostEstimate(neighborNode, goalNode);
            }
        }

        return []; // Маршрут не найден
    }

    /**
     * Находит ближайший узел графа к заданной точке
     * @param {Object} point - Точка {x, y}
     * @param {Array<Object>} graph - Граф помещения
     * @returns {Object} Ближайший узел
     */
    static findClosestNode(point, graph) {
        let closestNode = null;
        let minDistance = Infinity;

        for (const node of graph) {
            const distance = Math.sqrt(
                Math.pow(point.x - node.x, 2) + 
                Math.pow(point.y - node.y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        }

        return closestNode;
    }

    /**
     * Эвристическая оценка стоимости пути между двумя узлами
     * @param {Object} node1 - Первый узел
     * @param {Object} node2 - Второй узел
     * @returns {number} Оценка стоимости
     */
    static heuristicCostEstimate(node1, node2) {
        return Math.sqrt(
            Math.pow(node1.x - node2.x, 2) + 
            Math.pow(node1.y - node2.y, 2)
        );
    }

    /**
     * Фактическое расстояние между двумя узлами
     * @param {Object} node1 - Первый узел
     * @param {Object} node2 - Второй узел
     * @returns {number} Расстояние
     */
    static distanceBetween(node1, node2) {
        return Math.sqrt(
            Math.pow(node1.x - node2.x, 2) + 
            Math.pow(node1.y - node2.y, 2)
        );
    }

    /**
     * Восстанавливает путь из узлов
     * @param {Map} nodes - Карта узлов
     * @param {string} goalId - ID конечного узла
     * @returns {Array<Object>} Массив точек маршрута
     */
    static reconstructPath(nodes, goalId) {
        const path = [];
        let currentId = goalId;

        while (currentId !== null) {
            const node = nodes.get(currentId);
            path.unshift({ x: node.x, y: node.y });
            currentId = node.cameFrom;
        }

        return path;
    }
}

// Экспорт классов для использования в других модулях
module.exports = {
    LocationAlgorithms,
    RouteAlgorithms
};