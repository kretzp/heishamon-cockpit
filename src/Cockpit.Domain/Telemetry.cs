namespace Cockpit.Domain;

public enum Quality { Unknown, Valid, Stale, Invalid }
public enum Availability { Unknown, Online, Offline }
public enum SourceKind { Simulator, Mqtt }

public sealed record TelemetryValue(string Key, object? Value, string Unit, Quality Quality,
    DateTimeOffset? ReceivedAtUtc, DateTimeOffset? SourceTimestampUtc, bool Retained,
    string? SourceTopic, SourceKind SourceKind)
{
    public string? Alias { get; init; }
}

public sealed record Snapshot(long Revision, Guid InstanceId, DateTimeOffset GeneratedAtUtc,
    bool BrokerConnected, Availability DeviceAvailability, Quality TelemetryFreshness,
    IReadOnlyList<TelemetryValue> Values)
{
    public IReadOnlyList<TelemetryDiagnostic> Diagnostics { get; init; } = [];
}

public sealed record TelemetryDiagnostic(string Key, long Count, DateTimeOffset Time, string Message);

public sealed record Metric(string Key, string Unit, string Suffix, string Type, int MaxEnum = 0, bool Optional = false, int? Top = null);

public static class Catalog
{
    public const string NoError = "no error";
    public const string Celsius = "°C";
    public const string Kelvin = "K";
    public const string Watt = "W";
    public const string KilowattHour = "kWh";
    public const string Hour = "h";
    public const string Minute = "min";
    public const string Bar = "bar";
    public const string Rpm = "U/min";
    public const string Ampere = "A";
    public const string KilogramForcePerSquareCentimetre = "kgf/cm²";
    public static IReadOnlyList<Metric> Metrics { get; } = Array.AsReadOnly<Metric>(new Metric[] {
        new("flowTemperature", Celsius, "main/Main_Outlet_Temp", "number"),
        new("returnTemperature", Celsius, "main/Main_Inlet_Temp", "number"),
        new("outsideTemperature", Celsius, "main/Outside_Temp", "number"),
        new("dhwTemperature", Celsius, "main/DHW_Temp", "number"),
        new("dhwTargetTemperature", Celsius, "main/DHW_Target_Temp", "number"),
        new("waterFlow", "l/min", "main/Pump_Flow", "positive"),
        new("compressorFrequency", "Hz", "main/Compressor_Freq", "positive"),
        new("heatpumpState", "enum", "main/Heatpump_State", "enum", 1),
        new("operatingMode", "enum", "main/Operating_Mode_State", "enum", 8),
        new("heatingControlMode", "enum", "main/Heating_Mode", "enum", 1),
        new("internalHeaterState", "enum", "main/Internal_Heater_State", "enum", 1),
        new("indoorTemperature", Celsius, "main/Room_Thermostat_Temp", "number"),
        new("defrostState", "enum", "main/Defrosting_State", "enum", 1),
        new("threeWayValveState", "enum", "main/ThreeWay_Valve_State", "enum", 1),
        new("heatPowerConsumption", Watt, "extra/Heat_Power_Consumption_Extra", "positive"),
        new("coolPowerConsumption", Watt, "extra/Cool_Power_Consumption_Extra", "positive"),
        new("dhwPowerConsumption", Watt, "extra/DHW_Power_Consumption_Extra", "positive"),
        new("heatPowerProduction", Watt, "extra/Heat_Power_Production_Extra", "positive"),
        new("coolPowerProduction", Watt, "extra/Cool_Power_Production_Extra", "positive"),
        new("dhwPowerProduction", Watt, "extra/DHW_Power_Production_Extra", "positive"),
        new("zone1HeatRequest", "", "main/Z1_Heat_Request_Temp", "number"),
        new("zone1SensorMode", "enum", "main/Z1_Sensor_Settings", "enum", 2),
        new("operationsHours", Hour, "main/Operations_Hours", "counter"),
        new("operationsCounter", "", "main/Operations_Counter", "counter"),
        new("waterPressure", Bar, "main/Water_Pressure", "positive"),
        new("activeError", "", "main/Error", "error"),
        new("dhwHeatDelta", Kelvin, "main/DHW_Heat_Delta", "dhwDelta")
    }.Concat(HeatingCurve.Fields.Select(f => new Metric(f.Key, f.Unit, f.Topic, "curve"))).Concat([
        new Metric("mainTargetTemperature", Celsius, "main/Main_Target_Temp", "number"),
        new Metric("zonesState", "enum", "main/Zones_State", "enum", 2),
        new Metric("pumpSpeed", Rpm, "main/Pump_Speed", "positive", Optional: true, Top: 65),
        new Metric("fanSpeed", Rpm, "main/Fan1_Motor_Speed", "positive", Optional: true, Top: 62),
        new Metric("compressorCurrent", Ampere, "main/Compressor_Current", "positive", Optional: true, Top: 67),
        new Metric("highPressure", KilogramForcePerSquareCentimetre, "main/High_Pressure", "positive", Optional: true, Top: 64),
        new Metric("sterilizationState", "enum", "main/Sterilization_State", "enum", 1, Optional: true, Top: 69),
        new Metric("sterilizationTemperature", Celsius, "main/Sterilization_Temp", "positive", Optional: true, Top: 70),
        new Metric("sterilizationMaxTime", Minute, "main/Sterilization_Max_Time", "counter", Optional: true, Top: 71),
        new Metric("quietMode", "enum", "main/Quiet_Mode_Level", "enum", 3, Optional: true, Top: 18)
    ]).ToArray());
}
