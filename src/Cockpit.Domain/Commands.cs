namespace Cockpit.Domain;

public enum CommandState { Draft, Validated, Sent, ObservedMatchingState, TimedOut, Failed, Cancelled }
public sealed record CommandRequest(Guid IdempotencyKey, string CommandType, double DesiredValue, string ExpectedStateRevision);
public sealed record CommandRecord(Guid Id, Guid IdempotencyKey, string User, string CommandType,
    double OldValue, double DesiredValue, double? ObservedValue, string ExpectedStateRevision,
    CommandState State, DateTimeOffset CreatedUtc, DateTimeOffset UpdatedUtc, DateTimeOffset? SentUtc,
    string Reason, string Source = "simulator");
public sealed record CommandContext(string ExpectedStateRevision, double? CurrentValue, bool Available,
    int Minimum = 40, int Maximum = 60, int Step = 1, string Unit = Catalog.Celsius)
{
    public string Source { get; init; } = "simulator";
    public int TimeoutSeconds { get; init; } = 20;
    public DateTimeOffset? ExpiresUtc { get; init; }
    public int? RemainingSends { get; init; }
}
public sealed class CommandRejected(int status, string code) : Exception(code)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}

public sealed record SimulatorParameter(string CommandType, string Key, string Label, int Minimum, int Maximum, string Unit, int Step = 1)
{
    public static readonly SimulatorParameter SterilizationStart = new("startSterilization", "sterilizationState", "Sterilisation einmalig starten", 1, 1, "");
    public static readonly SimulatorParameter[] SterilizationSettings = [
        new("setSterilizationTemperature", "sterilizationTemperature", "Sterilisationstemperatur", 55, 75, Catalog.Celsius),
        new("setSterilizationMaxTime", "sterilizationMaxTime", "Sterilisation – maximale Dauer", 5, 60, Catalog.Minute, 5)
    ];
    // Application range for room heating; not the equipment's full operating range.
    public static readonly SimulatorParameter[] Extended = [
        new("setIndoorTemperature", "zone1HeatRequest", "Innen-Soll (Heizen, Zone 1)", 16, 28, Catalog.Celsius),
        new("setQuietMode", "quietMode", "Flüstermodus", 0, 3, ""),
        new("setOperatingMode", "operatingMode", "Betriebsart", 0, 6, "")
    ];
    public static double? Comparable(string type, double? value) => type == "setOperatingMode" ? value switch { 7 => 2, 8 => 6, _ => value } : value;
    public static readonly SimulatorParameter[] All = [
        new("setDhwTemperature", "dhwTargetTemperature", "Warmwasser-Soll", 40, 60, Catalog.Celsius),
        new("setDhwHeatDelta", "dhwHeatDelta", "Warmwasser-Einschaltdifferenz", -12, -2, Catalog.Kelvin)
    ];
    public static SimulatorParameter Find(string type) => All.SingleOrDefault(p => p.CommandType == type) ?? throw new CommandRejected(422,"invalid_command");
}
