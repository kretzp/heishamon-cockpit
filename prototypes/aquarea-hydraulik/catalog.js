// Snapshot of the local metric catalog; demo metadata only.
window.aquareaCatalog = [
  {
    "key": "flowTemperature",
    "label": "Vorlauftemperatur",
    "unit": "°C",
    "topic": "main/Main_Outlet_Temp",
    "group": "Hydraulik"
  },
  {
    "key": "returnTemperature",
    "label": "Rücklauftemperatur",
    "unit": "°C",
    "topic": "main/Main_Inlet_Temp",
    "group": "Hydraulik"
  },
  {
    "key": "outsideTemperature",
    "label": "Außentemperatur",
    "unit": "°C",
    "topic": "main/Outside_Temp",
    "group": "Außeneinheit"
  },
  {
    "key": "dhwTemperature",
    "label": "Warmwassertemperatur",
    "unit": "°C",
    "topic": "main/DHW_Temp",
    "group": "Warmwasser"
  },
  {
    "key": "dhwTargetTemperature",
    "label": "Warmwasser-Soll",
    "unit": "°C",
    "topic": "main/DHW_Target_Temp",
    "group": "Warmwasser"
  },
  {
    "key": "waterFlow",
    "label": "Wasserdurchfluss",
    "unit": "l/min",
    "topic": "main/Pump_Flow",
    "group": "Hydraulik"
  },
  {
    "key": "compressorFrequency",
    "label": "Verdichterfrequenz",
    "unit": "Hz",
    "topic": "main/Compressor_Freq",
    "group": "Außeneinheit"
  },
  {
    "key": "heatpumpState",
    "label": "Wärmepumpenstatus",
    "unit": "enum",
    "topic": "main/Heatpump_State",
    "group": "Betrieb"
  },
  {
    "key": "operatingMode",
    "label": "Gewählte Betriebsart",
    "unit": "enum",
    "topic": "main/Operating_Mode_State",
    "group": "Betrieb"
  },
  {
    "key": "heatingControlMode",
    "label": "Heizregelung",
    "unit": "enum",
    "topic": "main/Heating_Mode",
    "group": "Betrieb"
  },
  {
    "key": "internalHeaterState",
    "label": "Interner Heizstabstatus",
    "unit": "enum",
    "topic": "main/Internal_Heater_State",
    "group": "Betrieb"
  },
  {
    "key": "indoorTemperature",
    "label": "Raumtemperatur",
    "unit": "°C",
    "topic": "main/Room_Thermostat_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "defrostState",
    "label": "Abtaustatus",
    "unit": "enum",
    "topic": "main/Defrosting_State",
    "group": "Betrieb"
  },
  {
    "key": "threeWayValveState",
    "label": "3-Wege-Ventil",
    "unit": "enum",
    "topic": "main/ThreeWay_Valve_State",
    "group": "Hydraulik"
  },
  {
    "key": "heatPowerConsumption",
    "label": "Heizen · Leistungsaufnahme",
    "unit": "W",
    "topic": "extra/Heat_Power_Consumption_Extra",
    "group": "Energie"
  },
  {
    "key": "coolPowerConsumption",
    "label": "Kühlen · Leistungsaufnahme",
    "unit": "W",
    "topic": "extra/Cool_Power_Consumption_Extra",
    "group": "Energie"
  },
  {
    "key": "dhwPowerConsumption",
    "label": "Warmwasser · Leistungsaufnahme",
    "unit": "W",
    "topic": "extra/DHW_Power_Consumption_Extra",
    "group": "Warmwasser"
  },
  {
    "key": "heatPowerProduction",
    "label": "Heizen · Leistungsabgabe",
    "unit": "W",
    "topic": "extra/Heat_Power_Production_Extra",
    "group": "Energie"
  },
  {
    "key": "coolPowerProduction",
    "label": "Kühlen · Leistungsabgabe",
    "unit": "W",
    "topic": "extra/Cool_Power_Production_Extra",
    "group": "Energie"
  },
  {
    "key": "dhwPowerProduction",
    "label": "Warmwasser · Leistungsabgabe",
    "unit": "W",
    "topic": "extra/DHW_Power_Production_Extra",
    "group": "Warmwasser"
  },
  {
    "key": "zone1HeatRequest",
    "label": "Zone 1 Heizanforderung",
    "unit": "",
    "topic": "main/Z1_Heat_Request_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "zone1SensorMode",
    "label": "Zone 1 Sensormodus",
    "unit": "enum",
    "topic": "main/Z1_Sensor_Settings",
    "group": "Heizkreise"
  },
  {
    "key": "operationsHours",
    "label": "Betriebsstunden",
    "unit": "h",
    "topic": "main/Operations_Hours",
    "group": "Betrieb"
  },
  {
    "key": "operationsCounter",
    "label": "Verdichterstarts",
    "unit": "",
    "topic": "main/Operations_Counter",
    "group": "Betrieb"
  },
  {
    "key": "waterPressure",
    "label": "Wasserdruck",
    "unit": "bar",
    "topic": "main/Water_Pressure",
    "group": "Hydraulik"
  },
  {
    "key": "activeError",
    "label": "Fehlerstatus",
    "unit": "",
    "topic": "main/Error",
    "group": "Betrieb"
  },
  {
    "key": "dhwHeatDelta",
    "label": "Warmwasser-Hysterese",
    "unit": "K",
    "topic": "main/DHW_Heat_Delta",
    "group": "Warmwasser"
  },
  {
    "key": "mainTargetTemperature",
    "label": "Vorlauf-Solltemperatur",
    "unit": "°C",
    "topic": "main/Main_Target_Temp",
    "group": "Hydraulik"
  },
  {
    "key": "zonesState",
    "label": "Aktive Zonen",
    "unit": "enum",
    "topic": "main/Zones_State",
    "group": "Heizkreise"
  },
  {
    "key": "pumpSpeed",
    "label": "Pumpendrehzahl",
    "unit": "U/min",
    "topic": "main/Pump_Speed",
    "group": "Hydraulik"
  },
  {
    "key": "fanSpeed",
    "label": "Lüfterdrehzahl",
    "unit": "U/min",
    "topic": "main/Fan1_Motor_Speed",
    "group": "Außeneinheit"
  },
  {
    "key": "compressorCurrent",
    "label": "Verdichterstrom",
    "unit": "A",
    "topic": "main/Compressor_Current",
    "group": "Außeneinheit"
  },
  {
    "key": "highPressure",
    "label": "Kältemittel-Hochdruck",
    "unit": "kgf/cm²",
    "topic": "main/High_Pressure",
    "group": "Kältekreis"
  },
  {
    "key": "sterilizationState",
    "label": "Sterilisation aktiv",
    "unit": "enum",
    "topic": "main/Sterilization_State",
    "group": "Warmwasser"
  },
  {
    "key": "sterilizationTemperature",
    "label": "Sterilisationstemperatur",
    "unit": "°C",
    "topic": "main/Sterilization_Temp",
    "group": "Warmwasser"
  },
  {
    "key": "sterilizationMaxTime",
    "label": "Sterilisationsdauer",
    "unit": "min",
    "topic": "main/Sterilization_Max_Time",
    "group": "Warmwasser"
  },
  {
    "key": "relayOne",
    "label": "Relais 1",
    "unit": "enum",
    "topic": "gpio/relay/one/state",
    "group": "Erweiterung"
  },
  {
    "key": "relayTwo",
    "label": "Relais 2",
    "unit": "enum",
    "topic": "gpio/relay/two/state",
    "group": "Erweiterung"
  },
  {
    "key": "quietMode",
    "label": "Flüstermodus",
    "unit": "enum",
    "topic": "main/Quiet_Mode_Level",
    "group": "Betrieb"
  },
  {
    "key": "heatPumpModel",
    "label": "Aquarea-Modell",
    "unit": "",
    "topic": "main/Heat_Pump_Model",
    "group": "Betrieb"
  },
  {
    "key": "curveXCold",
    "label": "Außen niedrig",
    "unit": "°C",
    "topic": "main/Z1_Heat_Curve_Outside_Low_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "curveYCold",
    "label": "Vorlauf hoch",
    "unit": "°C",
    "topic": "main/Z1_Heat_Curve_Target_High_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "curveXWarm",
    "label": "Außen hoch",
    "unit": "°C",
    "topic": "main/Z1_Heat_Curve_Outside_High_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "curveYWarm",
    "label": "Vorlauf niedrig",
    "unit": "°C",
    "topic": "main/Z1_Heat_Curve_Target_Low_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "heatDelta",
    "label": "Heiz-ΔT",
    "unit": "K",
    "topic": "main/Heat_Delta",
    "group": "Heizkreise"
  },
  {
    "key": "heatingOffTemperature",
    "label": "Heizung aus ab",
    "unit": "°C",
    "topic": "main/Heating_Off_Outdoor_Temp",
    "group": "Heizkreise"
  },
  {
    "key": "discharge",
    "label": "Heißgastemperatur",
    "topic": "Zuordnung noch zu prüfen",
    "unit": "",
    "group": "Kältekreis",
    "planned": true
  },
  {
    "key": "lowPressure",
    "label": "Kältemittel-Niederdruck",
    "topic": "Modell- und Firmwareprüfung offen",
    "unit": "",
    "group": "Kältekreis",
    "planned": true
  },
  {
    "key": "expansion",
    "label": "Expansionsventil",
    "topic": "Zuordnung noch zu prüfen",
    "unit": "",
    "group": "Kältekreis",
    "planned": true
  },
  {
    "key": "zone2Flow",
    "label": "Zone 2 Wassertemperatur",
    "topic": "Katalog-Erweiterung erforderlich",
    "unit": "",
    "group": "Heizkreise",
    "planned": true
  },
  {
    "key": "bufferTemperature",
    "label": "Puffertemperatur",
    "topic": "Externer Fühler · Zuordnung erforderlich",
    "unit": "",
    "group": "Erweiterung",
    "planned": true
  },
  {
    "key": "dallas",
    "label": "Dallas / 1-Wire",
    "topic": "Dynamischer Bestandskanal · Modellzuordnung geplant",
    "unit": "",
    "group": "Erweiterung",
    "planned": true
  },
  {
    "key": "s0",
    "label": "Externe Strommessung",
    "topic": "Bestandsfunktion · Modellzuordnung geplant",
    "unit": "",
    "group": "Energie",
    "planned": true
  }
];
