package com.mazenmix.mxblueradar;

import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.ScanRecord;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.SparseArray;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class DeviceClassifier {
    private DeviceClassifier() {}

    public static String safeName(BluetoothDevice device, ScanRecord record) {
        String n = null;

        // 1) Prefer a user-assigned local alias when Android has one cached.
        if (Build.VERSION.SDK_INT >= 30) {
            try { n = device.getAlias(); } catch (SecurityException ignored) {}
        }

        // 2) Then use Android's cached remote Bluetooth name.
        if (isBlank(n)) {
            try { n = device.getName(); } catch (SecurityException ignored) {}
        }

        // 3) BLE Local Name from the advertisement is often the best passive source.
        if (isBlank(n) && record != null) n = record.getDeviceName();
        if (!isBlank(n)) return n.trim();

        // 4) If the device intentionally does not advertise a name, never show a useless
        //    "Unknown device" label. Resolve the strongest passive identity we can prove.
        String vendor = primaryManufacturer(record);
        String family = classFamily(device);
        if (!isBlank(vendor)) {
            if (!"Bluetooth".equals(family)) return vendor + " " + family;
            return vendor + (record != null ? " BLE device" : " Bluetooth device");
        }

        // 5) Classic Bluetooth often exposes a useful device class even when the name is late.
        if (!"Bluetooth".equals(family)) return "Bluetooth " + family;

        // 6) BLE privacy/random addressing means the MAC frequently cannot identify a vendor.
        //    Label it honestly instead of pretending the MAC reveals an exact model.
        String address = safeAddress(device);
        if (record != null && isLocallyAdministered(address)) return "Private BLE device";
        return record != null ? "BLE device" : "Bluetooth device";
    }

    /** Higher values mean the label is more specific/reliable. Used to avoid replacing a
     * real name learned later with a weaker inferred label on the next advertisement. */
    public static int nameQuality(String name) {
        if (isBlank(name) || "Unknown device".equals(name)) return 0;
        String n = name.trim();
        if ("BLE device".equals(n) || "Bluetooth device".equals(n) || "Private BLE device".equals(n)) return 1;
        if (n.endsWith(" BLE device") || n.endsWith(" Bluetooth device") ||
                n.startsWith("Bluetooth Phone") || n.startsWith("Bluetooth Computer") ||
                n.startsWith("Bluetooth Wearable") || n.startsWith("Bluetooth Audio / Video") ||
                n.startsWith("Bluetooth Imaging") || n.startsWith("Bluetooth Peripheral")) return 2;
        // Vendor + class fallback, e.g. "Apple Phone" / "Samsung Wearable".
        if (n.matches("^(Apple|Samsung|Microsoft|Google) (Phone|Computer|Wearable|Audio / Video|Imaging|Peripheral)$")) return 2;
        return 3;
    }

    private static String primaryManufacturer(ScanRecord record) {
        String summary = manufacturerSummary(record);
        if (isBlank(summary)) return "";
        int comma = summary.indexOf(',');
        String first = comma >= 0 ? summary.substring(0, comma) : summary;
        return first.startsWith("Company 0x") ? "" : first.trim();
    }

    private static String classFamily(BluetoothDevice device) {
        try {
            BluetoothClass c = device.getBluetoothClass();
            if (c != null) {
                switch (c.getMajorDeviceClass()) {
                    case BluetoothClass.Device.Major.AUDIO_VIDEO: return "Audio / Video";
                    case BluetoothClass.Device.Major.COMPUTER: return "Computer";
                    case BluetoothClass.Device.Major.PHONE: return "Phone";
                    case BluetoothClass.Device.Major.WEARABLE: return "Wearable";
                    case BluetoothClass.Device.Major.IMAGING: return "Imaging";
                    case BluetoothClass.Device.Major.PERIPHERAL: return "Peripheral";
                    default: break;
                }
            }
        } catch (SecurityException ignored) {}
        return "Bluetooth";
    }

    private static String safeAddress(BluetoothDevice device) {
        try {
            String a = device.getAddress();
            return a == null ? "" : a.trim();
        } catch (SecurityException ignored) {
            return "";
        }
    }

    private static boolean isLocallyAdministered(String address) {
        if (isBlank(address) || address.length() < 2) return false;
        try {
            int first = Integer.parseInt(address.substring(0, 2), 16);
            return (first & 0x02) != 0;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public static String kind(BluetoothDevice device, String name) {
        String l = name == null ? "" : name.toLowerCase(Locale.US);
        if (l.contains("airpods") || l.contains("buds") || l.contains("headphone") || l.contains("headset")) return "Audio";
        if (l.contains("watch") || l.contains("band") || l.contains("fit")) return "Wearable";
        if (l.contains("tv") || l.contains("bravia") || l.contains("roku")) return "TV / Media";
        if (l.contains("car") || l.contains("honda") || l.contains("toyota") || l.contains("bmw") || l.contains("mercedes")) return "Vehicle";
        if (l.contains("printer")) return "Printer";
        if (l.contains("keyboard") || l.contains("mouse")) return "Input";
        try {
            BluetoothClass c = device.getBluetoothClass();
            if (c != null) {
                switch (c.getMajorDeviceClass()) {
                    case BluetoothClass.Device.Major.AUDIO_VIDEO: return "Audio / Video";
                    case BluetoothClass.Device.Major.COMPUTER: return "Computer";
                    case BluetoothClass.Device.Major.PHONE: return "Phone";
                    case BluetoothClass.Device.Major.WEARABLE: return "Wearable";
                    case BluetoothClass.Device.Major.IMAGING: return "Imaging";
                    case BluetoothClass.Device.Major.PERIPHERAL: return "Peripheral";
                    default: break;
                }
            }
        } catch (SecurityException ignored) {}
        return "Bluetooth";
    }

    public static String manufacturerSummary(ScanRecord record) {
        if (record == null) return "";
        SparseArray<byte[]> data = record.getManufacturerSpecificData();
        if (data == null || data.size() == 0) return "";
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < data.size(); i++) {
            int id = data.keyAt(i);
            String vendor;
            switch (id) {
                case 0x004C: vendor = "Apple"; break;
                case 0x0075: vendor = "Samsung"; break;
                case 0x0006: vendor = "Microsoft"; break;
                case 0x00E0: vendor = "Google"; break;
                default: vendor = String.format(Locale.US, "Company 0x%04X", id); break;
            }
            labels.add(vendor);
        }
        return join(labels, ", ");
    }

    public static List<String> serviceUuids(ScanRecord record) {
        List<String> out = new ArrayList<>();
        if (record == null || record.getServiceUuids() == null) return out;
        for (ParcelUuid u : record.getServiceUuids()) out.add(u.getUuid().toString());
        return out;
    }

    public static String ghostFingerprint(ScanRecord record, String name) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            if (name != null) md.update(name.getBytes(StandardCharsets.UTF_8));
            if (record != null) {
                if (record.getServiceUuids() != null) {
                    for (ParcelUuid u : record.getServiceUuids()) md.update(u.toString().getBytes(StandardCharsets.UTF_8));
                }
                SparseArray<byte[]> m = record.getManufacturerSpecificData();
                if (m != null) {
                    for (int i = 0; i < m.size(); i++) {
                        md.update((byte) (m.keyAt(i) & 0xFF));
                        byte[] b = m.valueAt(i);
                        if (b != null) md.update(b, 0, Math.min(b.length, 12));
                    }
                }
            }
            byte[] hash = md.digest();
            StringBuilder sb = new StringBuilder("G-");
            for (int i = 0; i < 5; i++) sb.append(String.format(Locale.US, "%02X", hash[i]));
            return sb.toString();
        } catch (Exception e) {
            return "G-UNKNOWN";
        }
    }

    public static String stableKey(BluetoothDevice device, String fingerprint) {
        try {
            String address = device.getAddress();
            if (address != null && !address.isEmpty()) return address;
        } catch (SecurityException ignored) {}
        return fingerprint;
    }

    private static String join(List<String> values, String sep) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) b.append(sep);
            b.append(values.get(i));
        }
        return b.toString();
    }
}
