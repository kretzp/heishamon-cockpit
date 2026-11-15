using Cockpit.Domain;

namespace Cockpit.Application;

public sealed record PlantModelOptions
{
    public int Zones { get; init; } = 1;
    public string Zone1 { get; init; } = "floor";
    public string Zone2 { get; init; } = "radiator";
    public bool Tank { get; init; } = true;
    public bool Buffer { get; init; }
    public bool Sensors { get; init; } = true;
    public bool Motion { get; init; } = true;
    public double Speed { get; init; } = 1;

    public void Validate()
    {
        if (Zones is not (1 or 2) || Zone1 is not ("floor" or "radiator") || Zone2 is not ("floor" or "radiator")
            || !double.IsFinite(Speed) || Speed is < .5 or > 2)
            throw new CommandRejected(422, "invalid_plant_model");
    }
}
