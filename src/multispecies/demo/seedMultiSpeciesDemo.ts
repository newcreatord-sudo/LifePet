import { demoId, demoRead, demoWrite } from "@/lib/demoDb";
import { MS_SEEDED_KEY, msKey } from "@/multispecies/data/msKeys";
import type { AlertRule, Device, DeviceBinding, Farm, Herd, Subject } from "@/multispecies/types";

function seeded() {
  return demoRead<string>(MS_SEEDED_KEY, "0") === "1";
}

export function ensureMultiSpeciesDemoSeed(ownerId: string) {
  if (seeded()) return;
  const now = Date.now();

  const farm: Farm = { id: demoId(), name: "Cascina San Martino", createdAt: now - 1000 * 60 * 60 * 24 * 60 };
  const herdA: Herd = { id: demoId(), farmId: farm.id, name: "Mandria A", createdAt: now - 1000 * 60 * 60 * 24 * 60 };
  const herdB: Herd = { id: demoId(), farmId: farm.id, name: "Mandria B", createdAt: now - 1000 * 60 * 60 * 24 * 40 };

  const petDog: Subject = {
    id: demoId(),
    type: "pet",
    species: "dog",
    displayName: "Luna",
    breed: "Meticcio",
    sex: "female",
    microchipNumber: "IT-DEMO-0001",
    ownerId,
    status: "normal",
    createdAt: now - 1000 * 60 * 60 * 24 * 20,
    updatedAt: now,
  };

  const petCat: Subject = {
    id: demoId(),
    type: "pet",
    species: "cat",
    displayName: "Milo",
    breed: "European",
    sex: "male",
    microchipNumber: "IT-DEMO-0002",
    ownerId,
    status: "normal",
    createdAt: now - 1000 * 60 * 60 * 24 * 40,
    updatedAt: now,
  };

  const cows: Subject[] = Array.from({ length: 50 }).map((_, idx) => {
    const herdId = idx % 2 === 0 ? herdA.id : herdB.id;
    const name = `Bov${String(idx + 1).padStart(3, "0")}`;
    const heat = idx % 17 === 0;
    return {
      id: demoId(),
      type: "livestock",
      species: "cow",
      displayName: name,
      sex: "female",
      reproductiveStatus: heat ? "in_heat" : "cycling",
      earTag: `IT-${farm.id.slice(0, 4).toUpperCase()}-${1000 + idx}`,
      farmTagNumber: `${2000 + idx}`,
      ownerId,
      farmId: farm.id,
      herdId,
      status: heat ? "attention" : "normal",
      createdAt: now - 1000 * 60 * 60 * 24 * (30 + idx),
      updatedAt: now,
    };
  });

  const sheep: Subject[] = Array.from({ length: 12 }).map((_, idx) => {
    return {
      id: demoId(),
      type: "livestock",
      species: "sheep",
      displayName: `Ovi${String(idx + 1).padStart(3, "0")}`,
      sex: idx % 2 === 0 ? "female" : "male",
      earTag: `IT-OV-${3000 + idx}`,
      ownerId,
      farmId: farm.id,
      herdId: herdA.id,
      status: "normal",
      createdAt: now - 1000 * 60 * 60 * 24 * (25 + idx),
      updatedAt: now,
    };
  });

  const goats: Subject[] = Array.from({ length: 8 }).map((_, idx) => {
    return {
      id: demoId(),
      type: "livestock",
      species: "goat",
      displayName: `Cap${String(idx + 1).padStart(3, "0")}`,
      sex: idx % 2 === 0 ? "female" : "male",
      earTag: `IT-CA-${4000 + idx}`,
      ownerId,
      farmId: farm.id,
      herdId: herdB.id,
      status: "normal",
      createdAt: now - 1000 * 60 * 60 * 24 * (22 + idx),
      updatedAt: now,
    };
  });

  const pigs: Subject[] = Array.from({ length: 10 }).map((_, idx) => {
    return {
      id: demoId(),
      type: "livestock",
      species: "pig",
      displayName: `Sui${String(idx + 1).padStart(3, "0")}`,
      sex: idx % 2 === 0 ? "female" : "male",
      farmTagNumber: `SU-${5000 + idx}`,
      ownerId,
      farmId: farm.id,
      herdId: herdA.id,
      status: "normal",
      createdAt: now - 1000 * 60 * 60 * 24 * (18 + idx),
      updatedAt: now,
    };
  });

  const horses: Subject[] = Array.from({ length: 4 }).map((_, idx) => {
    return {
      id: demoId(),
      type: "livestock",
      species: "horse",
      displayName: `Cav${String(idx + 1).padStart(3, "0")}`,
      sex: idx % 2 === 0 ? "female" : "male",
      microchipNumber: `IT-HR-${6000 + idx}`,
      ownerId,
      farmId: farm.id,
      herdId: herdB.id,
      status: "normal",
      createdAt: now - 1000 * 60 * 60 * 24 * (40 + idx),
      updatedAt: now,
    };
  });

  const subjects: Subject[] = [petDog, petCat, ...cows, ...sheep, ...goats, ...pigs, ...horses];

  const devices: Device[] = [];
  const bindings: DeviceBinding[] = [];

  function makeDevice(args: {
    adapterType: string;
    brand: string;
    model: string;
    category: Device["category"];
    connectivityType: Device["connectivityType"];
    subjectId: string;
    supportedMetrics: Device["supportedMetrics"];
    supportedAlerts: Device["supportedAlerts"];
  }) {
    const id = demoId();
    const d: Device = {
      id,
      brand: args.brand,
      model: args.model,
      adapterType: args.adapterType,
      category: args.category,
      connectivityType: args.connectivityType,
      batteryLevel: 78,
      signalStrength: 62,
      isOnline: true,
      lastSeenAt: now - 1000 * 30,
      supportedMetrics: args.supportedMetrics,
      supportedAlerts: args.supportedAlerts,
      metadata: {},
      status: "connected",
      createdAt: now - 1000 * 60 * 60 * 24 * 15,
      updatedAt: now,
    };
    devices.push(d);
    bindings.push({ id: demoId(), deviceId: id, subjectId: args.subjectId, boundAt: now - 1000 * 60 * 60 * 24 * 10 });
    return d;
  }

  makeDevice({
    adapterType: "TractiveAdapter",
    brand: "Tractive",
    model: "GPS Tracker",
    category: "gps_tracker",
    connectivityType: "lte",
    subjectId: petDog.id,
    supportedMetrics: ["location_lat", "location_lng", "speed", "activity_score", "sleep_duration", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["geofence_breach", "battery_low", "device_offline"],
  });

  makeDevice({
    adapterType: "GenericBluetoothHealthTagAdapter",
    brand: "Generic",
    model: "BLE Tag",
    category: "biometric_sensor",
    connectivityType: "bluetooth",
    subjectId: petCat.id,
    supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
    supportedAlerts: ["fever", "tachycardia", "battery_low", "device_offline"],
  });

  for (let i = 0; i < 50; i++) {
    const subjectId = cows[i].id;
    if (i % 3 === 0) {
      makeDevice({
        adapterType: "CowManagerAdapter",
        brand: "CowManager",
        model: "Ear Tag",
        category: "ear_tag",
        connectivityType: "gateway",
        subjectId,
        supportedMetrics: ["ear_temperature", "movement_activity", "inactivity_duration", "rumination_duration", "estrus_probability", "insemination_window_score", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["estrus_detected", "rumination_drop", "fever", "device_offline", "battery_low"],
      });
    } else {
      makeDevice({
        adapterType: "SmaxtecAdapter",
        brand: "Smaxtec",
        model: "Bolus",
        category: "bolus",
        connectivityType: "gateway",
        subjectId,
        supportedMetrics: ["inner_body_temperature", "rumination_score", "movement_activity", "illness_risk_score", "ph_value", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["illness_risk", "fever", "device_offline"],
      });
    }
  }

  for (const s of horses) {
    makeDevice({
      adapterType: "GenericGpsCollarAdapter",
      brand: "Generic",
      model: "GPS Collar",
      category: "gps_tracker",
      connectivityType: "lte",
      subjectId: s.id,
      supportedMetrics: ["location_lat", "location_lng", "speed", "geofence_status", "device_battery_level", "device_signal_strength", "device_online"],
      supportedAlerts: ["geofence_breach", "battery_low", "device_offline"],
    });
  }

  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (i % 2 === 0) {
      makeDevice({
        adapterType: "ManualFarmSensorAdapter",
        brand: "Manual",
        model: "Farm Intake",
        category: "clip",
        connectivityType: "gateway",
        subjectId: s.id,
        supportedMetrics: ["body_temperature", "movement_activity", "inactivity_duration", "eating_duration", "drinking_duration", "water_intake", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["manual_flag"],
      });
    } else {
      makeDevice({
        adapterType: "GenericBluetoothHealthTagAdapter",
        brand: "Generic",
        model: "BLE Health Tag",
        category: "biometric_sensor",
        connectivityType: "bluetooth",
        subjectId: s.id,
        supportedMetrics: ["heart_rate", "respiratory_rate", "body_temperature", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
        supportedAlerts: ["fever", "tachycardia", "battery_low", "device_offline"],
      });
    }
  }

  for (const s of goats) {
    makeDevice({
      adapterType: "GenericGpsCollarAdapter",
      brand: "Generic",
      model: "GPS Tag",
      category: "gps_tracker",
      connectivityType: "lte",
      subjectId: s.id,
      supportedMetrics: ["location_lat", "location_lng", "speed", "geofence_status", "activity_score", "device_battery_level", "device_signal_strength", "device_online"],
      supportedAlerts: ["geofence_breach", "battery_low", "device_offline"],
    });
  }

  for (const s of pigs) {
    makeDevice({
      adapterType: "ManualFarmSensorAdapter",
      brand: "Manual",
      model: "Farm Health",
      category: "clip",
      connectivityType: "gateway",
      subjectId: s.id,
      supportedMetrics: ["body_temperature", "movement_activity", "inactivity_duration", "water_intake", "ambient_temperature", "ambient_humidity", "device_battery_level", "device_signal_strength", "device_online"],
      supportedAlerts: ["manual_flag"],
    });
  }

  const rules: AlertRule[] = [
    {
      id: demoId(),
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "pet",
      metricType: "respiratory_rate",
      operator: ">=",
      threshold: 40,
      windowMinutes: 10,
      severity: "warning",
      category: "health",
      title: "Respirazione alta",
      description: "La frequenza respiratoria è sopra soglia.",
      recommendedActions: ["Riduci attività", "Controlla temperatura", "Se persiste contatta il veterinario"],
      createdAt: now - 1000 * 60 * 60,
    },
    {
      id: demoId(),
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "pet",
      metricType: "geofence_status",
      operator: "==",
      threshold: "breach",
      windowMinutes: 5,
      severity: "critical",
      category: "safety",
      title: "Uscita geofence",
      description: "Possibile fuga: geofence violato.",
      recommendedActions: ["Apri mappa", "Attiva modalità ricerca", "Contatta familiari"],
      createdAt: now - 1000 * 60 * 60,
    },
    {
      id: demoId(),
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "livestock",
      metricType: "geofence_status",
      operator: "==",
      threshold: "outside",
      windowMinutes: 5,
      severity: "critical",
      category: "safety",
      title: "Recinto digitale: uscita",
      description: "Animale fuori area consentita (recinto digitale).",
      recommendedActions: ["Verifica posizione", "Controlla recinzioni/gateway", "Ispeziona eventuale fuga"],
      createdAt: now - 1000 * 60 * 60,
    },
    {
      id: demoId(),
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "livestock",
      metricType: "inner_body_temperature",
      operator: ">=",
      threshold: 39.6,
      windowMinutes: 30,
      severity: "critical",
      category: "health",
      title: "Febbre sospetta",
      description: "Temperatura interna elevata.",
      recommendedActions: ["Controllo clinico", "Valuta isolamento", "Valuta terapia"],
      createdAt: now - 1000 * 60 * 60,
    },
    {
      id: demoId(),
      type: "threshold",
      enabled: true,
      scope: "type",
      subjectType: "livestock",
      metricType: "rumination_duration",
      operator: "<",
      threshold: 240,
      windowMinutes: 60,
      severity: "warning",
      category: "farm",
      title: "Calo ruminazione",
      description: "Ruminazione bassa nell'ultima ora.",
      recommendedActions: ["Verifica alimentazione", "Controlla eventuale stress", "Valuta visita"],
      createdAt: now - 1000 * 60 * 60,
    },
    {
      id: demoId(),
      type: "anomaly",
      enabled: true,
      scope: "type",
      subjectType: "livestock",
      metricType: "movement_activity",
      windowMinutes: 120,
      severity: "warning",
      category: "farm",
      title: "Attività anomala",
      description: "Attività diversa dal baseline recente.",
      recommendedActions: ["Verifica comportamento", "Controlla alimentazione/ruminazione"],
      createdAt: now - 1000 * 60 * 60,
    },
  ];

  demoWrite(msKey("farms"), [farm]);
  demoWrite(msKey("herds"), [herdA, herdB]);
  demoWrite(msKey("subjects"), subjects);
  demoWrite(msKey("devices"), devices);
  demoWrite(msKey("bindings"), bindings);
  demoWrite(msKey("rules"), rules);
  demoWrite(msKey("alerts"), []);
  demoWrite(msKey("notifications"), []);
  demoWrite(MS_SEEDED_KEY, "1");
}
