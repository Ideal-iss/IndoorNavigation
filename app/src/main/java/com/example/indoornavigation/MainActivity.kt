package com.example.indoornavigation

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import android.graphics.PointF
import kotlin.math.pow
import com.example.indoornavigation.trilaterate // ← убедитесь, что функция доступна

class MainActivity : AppCompatActivity() {

    private lateinit var mapView: IndoorMapView
    private lateinit var statusText: TextView
    private lateinit var scanButton: Button
    private val bluetoothAdapter by lazy { BluetoothAdapter.getDefaultAdapter() }

    // Универсальный запрос разрешений
    private val permissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions[Manifest.permission.BLUETOOTH_SCAN] == true &&
                    permissions[Manifest.permission.BLUETOOTH_CONNECT] == true
        } else {
            permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        }
        if (granted) {
            simulateBeaconData() // ← сразу переходим к симуляции
        } else {
            statusText.text = "Разрешения отклонены. Без них BLE не работает."
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        mapView = findViewById(R.id.indoorMapView)
        statusText = findViewById(R.id.statusText)
        scanButton = findViewById(R.id.scanButton)

        // Обработка клика — выбор цели
        // В onCreate()
        mapView.setOnTouchListener { _, event ->
            if (event.action == android.view.MotionEvent.ACTION_DOWN) {
                val goal = PointF(event.x, event.y)

                // Текущая позиция пользователя (должна быть определена трилатерацией ранее)
                if (mapView.userX < 0 || mapView.userY < 0) {
                    statusText.text = "Сначала определите свою позицию"
                    return@setOnTouchListener true
                }

                val start = PointF(mapView.userX, mapView.userY)
                val simplePath = listOf(start, goal) // прямая линия

                mapView.goalPosition = goal
                mapView.path = simplePath
                mapView.startAnimationAlongPath(simplePath)
            }
            true
        }

        scanButton.setOnClickListener {
            requestRequiredPermissions()
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        permissionRequest.launch(permissions)
    }

    // === СИМУЛЯЦИЯ ===
    private fun simulateBeaconData() {
        statusText.text = "Имитация данных от маяков..."

        // Искусственные данные
        val fakeBeaconData = mapOf(
            "AA:BB:CC:11:22:33" to -55,
            "AA:BB:CC:44:55:66" to -68,
            "AA:BB:CC:77:88:99" to -80
        )

        // Координаты маяков (в пикселях) — должны совпадать с IndoorMapView
        val beaconPositions = mapOf(
            "AA:BB:CC:11:22:33" to PointF(200f, 100f),  // ← у вас в IndoorMapView: Beacon1 = (200,100)
            "AA:BB:CC:44:55:66" to PointF(600f, 150f),  // Beacon2
            "AA:BB:CC:77:88:99" to PointF(400f, 500f)   // Beacon3
        )

        // Преобразуем RSSI → расстояние
        val distances = fakeBeaconData.mapValues { (_, rssi) -> rssiToDistance(rssi) }

        // Получаем три точки и расстояния
        val p1 = beaconPositions["AA:BB:CC:11:22:33"]!!
        val p2 = beaconPositions["AA:BB:CC:44:55:66"]!!
        val p3 = beaconPositions["AA:BB:CC:77:88:99"]!!

        val d1 = distances["AA:BB:CC:11:22:33"]!!
        val d2 = distances["AA:BB:CC:44:55:66"]!!
        val d3 = distances["AA:BB:CC:77:88:99"]!!

        // Геометрическая трилатерация
        val estimatedPos = trilaterate(p1, d1, p2, d2, p3, d3)

        if (estimatedPos != null) {
            mapView.updateUserPosition(estimatedPos.x, estimatedPos.y)
            statusText.text = "Позиция: (${estimatedPos.x.toInt()}, ${estimatedPos.y.toInt()})"
        } else {
            statusText.text = "Ошибка трилатерации"
        }
    }
    private fun buildRouteToGoal(goalX: Float, goalY: Float) {
        // Установить цель
        mapView.goalPosition = android.graphics.PointF(goalX, goalY)

        // Текущая позиция пользователя (из трилатерации)
        // Для демо — будем считать, что текущая позиция известна
        // В реальности: userX, userY должны быть сохранены после трилатерации
        val currentX = mapView.userX
        val currentY = mapView.userY

        if (currentX < 0 || currentY < 0) {
            statusText.text = "Сначала определите свою позицию"
            return
        }

        // Простейший маршрут — прямая линия (для начала)
        val path = listOf(
            android.graphics.PointF(currentX, currentY),
            android.graphics.PointF(goalX, goalY)
        )

        mapView.path = path

        // Запустить анимацию движения
        mapView.startAnimationAlongPath(path)
    }
    private fun rssiToDistance(rssi: Int, txPower: Int = -59): Double {
        if (rssi == 0) return 10.0
        return 10.0.pow((txPower - rssi) / (10.0 * 2.0))
    }
}