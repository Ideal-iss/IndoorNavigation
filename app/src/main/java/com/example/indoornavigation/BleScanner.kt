package com.example.indoornavigation

import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi

class BleScanner(
    private val context: Context,
    private val onBeaconDetected: (beaconAddress: String, rssi: Int) -> Unit,
    private val targetUuid: String = "B9407F30-F5F8-466E-AFF9-25556B57FE6D"
) {

    private val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    private val scanner = bluetoothAdapter?.bluetoothLeScanner

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    fun startScanning(durationMs: Long = 3000) {
        val scanCallback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult?) {
                super.onScanResult(callbackType, result)
                result?.let { scanResult ->
                    val device = scanResult.device
                    val rssi = scanResult.rssi
                    val scanRecord = scanResult.scanRecord ?: return

                    // Проверяем, есть ли нужный UUID в advertisement
                    onBeaconDetected(device.address, rssi)
                }
            }
        }

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanner?.startScan(null, settings, scanCallback)

        // Автоматически остановить через durationMs
        android.os.Handler(context.mainLooper).postDelayed({
            scanner?.stopScan(scanCallback)
        }, durationMs)
    }
}