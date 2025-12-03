package com.example.indoornavigation

import android.graphics.PointF

/**
 * Выполняет геометрическую трилатерацию по трём маякам.
 *
 * Алгоритм основан на решении системы уравнений трёх окружностей.
 * Работает в любой системе координат (пиксели, метры и т.д.), если все входные данные согласованы.
 *
 * @param p1 Координаты первого маяка
 * @param r1 Расстояние до первого маяка
 * @param p2 Координаты второго маяка
 * @param r2 Расстояние до второго маяка
 * @param p3 Координаты третьего маяка
 * @param r3 Расстояние до третьего маяка
 * @return Оценка позиции пользователя в виде [PointF], или `null`, если решение невозможно
 *         (например, маяки коллинеарны или расстояния противоречивы).
 */
fun trilaterate(
    p1: PointF,
    r1: Double,
    p2: PointF,
    r2: Double,
    p3: PointF,
    r3: Double
): PointF? {
    // Преобразуем в Double для точных вычислений
    val x1 = p1.x.toDouble()
    val y1 = p1.y.toDouble()
    val x2 = p2.x.toDouble()
    val y2 = p2.y.toDouble()
    val x3 = p3.x.toDouble()
    val y3 = p3.y.toDouble()

    // Вычисляем вектор от p1 к p2
    val d = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1))
    if (d == 0.0) return null // маяки 1 и 2 совпадают

    // Единичный вектор в направлении от p1 к p2
    val ex = (x2 - x1) / d
    val ey = (y2 - y1) / d

    // Проекция вектора (p3 - p1) на ex
    val i = ex * (x3 - x1) + ey * (y3 - y1)
    if (i.isNaN()) return null

    // Расстояние от p3 до линии p1-p2 (в перпендикулярном направлении)
    val temp = (x3 - x1) * (x3 - x1) + (y3 - y1) * (y3 - y1) - i * i
    if (temp < 0) return null // невозможно (ошибка из-за шума)
    val j = Math.sqrt(temp)

    if (Math.abs(j) < 1e-6) return null // маяки коллинеарны

    // Координаты пользователя в локальной системе (относительно p1)
    val x = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
    val y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x

    // Преобразуем обратно в глобальную систему
    val resultX = x1 + x * ex - y * ey
    val resultY = y1 + x * ey + y * ex

    return PointF(resultX.toFloat(), resultY.toFloat())
}