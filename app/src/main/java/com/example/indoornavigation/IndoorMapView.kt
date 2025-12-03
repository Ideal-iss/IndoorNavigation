package com.example.indoornavigation

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import android.graphics.PointF
import android.os.Handler
import android.os.Looper

// Вне класса — виден только в этом файле
private data class Beacon(val x: Float, val y: Float, val name: String)

class IndoorMapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    var userX: Float = -1f
        private set
    var userY: Float = -1f
        private set

    var goalPosition: PointF? = null
        set(value) {
            field = value
            invalidate()
        }

    var path: List<PointF> = emptyList()
        set(value) {
            field = value
            invalidate()
        }

    private val beacons = listOf(
        Beacon(200f, 100f, "Beacon1"),
        Beacon(600f, 150f, "Beacon2"),
        Beacon(400f, 500f, "Beacon3")
    )

    private var animatedPath: List<PointF> = emptyList()
    private var currentStep = 0
    private var isAnimating = false
    private val animationHandler = Handler(Looper.getMainLooper())
    private val animationInterval: Long = 1000 // ms

    // Внутри класса IndoorMapView
    private var pulseRadius = 0f
    private var pulseAlpha = 255
    private var isPulsing = false
    private val pulseHandler = Handler(Looper.getMainLooper())
    private val pulseRunnable = object : Runnable {
        override fun run() {
            if (!isPulsing) return

            // Увеличиваем радиус и уменьшаем прозрачность
            pulseRadius += 2f
            pulseAlpha -= 6 // 255 / (300ms / 20ms) примерно 6 за шаг
            if (pulseAlpha < 0) pulseAlpha = 255 // сброс
            if (pulseRadius > 60f) pulseRadius = 0f // сброс

            invalidate() // перерисовать
            pulseHandler.postDelayed(this, 20) // 20 мс = 50 FPS
        }
    }
    private var directionAngle = 0f // угол в градусах
    private var goalPosition: PointF? = null
        set(value) {
            field = value
            updateDirectionAngle() // обновляем угол при смене цели
            invalidate()
        }
    private fun updateDirectionAngle() {
        if (userX >= 0 && userY >= 0) {
            val goal = goalPosition ?: return
            val deltaX = goal.x - userX
            val deltaY = goal.y - userY
            directionAngle = (Math.atan2(deltaY.toDouble(), deltaX.toDouble()) * 180 / Math.PI).toFloat()
        }
    }
    fun startPulseAnimation() {
        isPulsing = true
        pulseHandler.post(pulseRunnable)
    }

    fun stopPulseAnimation() {
        isPulsing = false
        pulseRadius = 0f
        pulseAlpha = 255
        invalidate()
    }
    fun updateUserPosition(x: Float, y: Float) {
        this.userX = x
        this.userY = y
        invalidate()
    }

    fun startAnimationAlongPath(newPath: List<PointF>) {
        if (newPath.size < 2) return
        animatedPath = newPath
        currentStep = 0
        isAnimating = true
        animateNextStep()
    }

    private fun animateNextStep() {
        if (!isAnimating || currentStep >= animatedPath.size) {
            isAnimating = false
            return
        }

        val nextPoint = animatedPath[currentStep]
        //updateUserPosition(nextPoint.x, nextPoint.y)

        currentStep++
        if (currentStep < animatedPath.size) {
            animationHandler.postDelayed({ animateNextStep() }, animationInterval)
        } else {
            isAnimating = false
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.WHITE)

        // Рисуем маршрут (если есть)
        if (path.size >= 2) {
            paint.color = Color.BLUE
            paint.strokeWidth = 6f
            paint.style = Paint.Style.STROKE
            for (i in 0 until path.size - 1) {
                canvas.drawLine(
                    path[i].x, path[i].y,
                    path[i + 1].x, path[i + 1].y,
                    paint
                )
            }
            paint.style = Paint.Style.FILL
        }

        // Рисуем маяки
        paint.color = Color.GREEN
        paint.strokeWidth = 4f
        for (b in beacons) {
            canvas.drawCircle(b.x, b.y, 15f, paint)
            paint.color = Color.BLACK
            paint.textSize = 30f
            canvas.drawText(b.name, b.x + 20, b.y + 10, paint)
            paint.color = Color.GREEN
        }

        // Рисуем цель
        goalPosition?.let {
            paint.color = Color.RED
            canvas.drawCircle(it.x, it.y, 25f, paint)
        }

        if (userX >= 0 && userY >= 0) {
            // Рисуем анимацию пульсации
            if (isPulsing) {
                val pulsePaint = Paint(paint).apply {
                    style = Paint.Style.STROKE
                    strokeWidth = 6f
                    color = Color.argb(pulseAlpha, 30, 136, 229) // тот же синий
                }
                canvas.drawCircle(userX, userY, pulseRadius, pulsePaint)
            }

            // Внешнее кольцо (постоянное)
            paint.color = Color.argb(128, 30, 136, 229) // #1E88E5 с прозрачностью
            canvas.drawCircle(userX, userY, 30f, paint)

            // Основной кружок
            paint.color = Color.parseColor("#1E88E5") // Приятный синий
            canvas.drawCircle(userX, userY, 20f, paint)

            // Внутренний кружок
            paint.color = Color.WHITE
            canvas.drawCircle(userX, userY, 8f, paint)

            // Подпись "Вы здесь"
            paint.color = Color.BLACK
            paint.textSize = 36f
            paint.textAlign = Paint.Align.CENTER
            canvas.drawText("Вы здесь", userX, userY - 40f, paint)
            paint.textAlign = Paint.Align.LEFT
        }
    }
}