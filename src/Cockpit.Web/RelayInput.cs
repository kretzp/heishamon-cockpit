using System.Text.Json.Serialization;

public sealed record RelayInput([property: JsonRequired] int Value);
