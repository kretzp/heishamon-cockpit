using System.Text.Json;
namespace Cockpit.Domain;

public sealed record CurveValues(double XCold, double YCold, double XWarm, double YWarm, double HeatDelta, double HeatingOffTemperature)
{
    [System.Text.Json.Serialization.JsonIgnore]
    public double[] Numbers => [XCold,YCold,XWarm,YWarm,HeatDelta,HeatingOffTemperature];
}
public sealed record CurveField(string Property, string Key, string Label, string Topic, int Minimum, int Maximum, string Unit, string Part, int Top);
public static class HeatingCurve
{
    public const string Profile = "aquarea-l-wh-wdg";
    public static IReadOnlyList<CurveField> Fields { get; } = Array.AsReadOnly<CurveField>([
        new("xCold","curveXCold","Außen niedrig","main/Z1_Heat_Curve_Outside_Low_Temp",-20,15,Catalog.Celsius,"curve",32),
        new("yCold","curveYCold","Vorlauf hoch","main/Z1_Heat_Curve_Target_High_Temp",20,75,Catalog.Celsius,"curve",29),
        new("xWarm","curveXWarm","Außen hoch","main/Z1_Heat_Curve_Outside_High_Temp",-20,15,Catalog.Celsius,"curve",31),
        new("yWarm","curveYWarm","Vorlauf niedrig","main/Z1_Heat_Curve_Target_Low_Temp",20,75,Catalog.Celsius,"curve",30),
        new("heatDelta","heatDelta","Heiz-ΔT","main/Heat_Delta",1,15,Catalog.Kelvin,"delta",23),
        new("heatingOffTemperature","heatingOffTemperature","Heizung aus ab","main/Heating_Off_Outdoor_Temp",5,35,Catalog.Celsius,"cutoff",77)
    ]);
    public static Dictionary<string,string> Validate(CurveValues value)
    {
        var errors=new Dictionary<string,string>();
        for(var i=0;i<Fields.Count;i++) {
            var f=Fields[i];var n=value.Numbers[i];
            if(!double.IsFinite(n)||n!=Math.Truncate(n)||n<f.Minimum||n>f.Maximum)
                errors[f.Property]=$"Ganze Zahl von {f.Minimum} bis {f.Maximum} {f.Unit} erforderlich.";
        }
        if(value.XCold>=value.XWarm) errors["xWarm"]="Außen hoch muss größer als Außen niedrig sein.";
        if(value.YCold<value.YWarm) errors["yWarm"]="Vorlauf niedrig darf Vorlauf hoch nicht überschreiten.";
        return errors;
    }
    public static double Calculate(CurveValues c,double outside)
    {
        if(Validate(c).Count>0||!double.IsFinite(outside)) throw new ArgumentException("Invalid curve.");
        return outside<=c.XCold?c.YCold:outside>=c.XWarm?c.YWarm:c.YCold+(outside-c.XCold)*Slope(c);
    }
    public static double Slope(CurveValues c) => c.XCold<c.XWarm ? (c.YWarm-c.YCold)/(c.XWarm-c.XCold) : throw new ArgumentException("Invalid curve.");
    public static string Payload(string part,CurveValues c)
    {
        if(Validate(c).Count>0) throw new CommandRejected(422,"invalid_curve");
        return part switch {
            "curve"=>JsonSerializer.Serialize(new { zone1=new { heat=new { target=new { high=c.YCold,low=c.YWarm },outside=new { low=c.XCold,high=c.XWarm } } } }),
            "delta"=>c.HeatDelta.ToString(System.Globalization.CultureInfo.InvariantCulture),
            "cutoff"=>c.HeatingOffTemperature.ToString(System.Globalization.CultureInfo.InvariantCulture),
            _=>throw new CommandRejected(422,"invalid_curve_part")
        };
    }
    public static string Command(string part) => part switch { "curve"=>"SetCurves","delta"=>"SetFloorHeatDelta","cutoff"=>"SetHeatingOffOutdoorTemp",_=>throw new CommandRejected(422,"invalid_curve_part") };
    public static CurveValues? Read(Snapshot s) {
        var numbers=Fields.Select(f=>s.Values.Single(v=>v.Key==f.Key).Value).ToArray();
        return numbers.All(n=>n is double)?new((double)numbers[0]!, (double)numbers[1]!, (double)numbers[2]!, (double)numbers[3]!, (double)numbers[4]!, (double)numbers[5]!):null;
    }
}
public enum CurveState { Validated, Running, ObservedMatchingState, Partial, TimedOut, Failed, Cancelled }
public enum CurvePartState { Pending, Sending, Waiting, ObservedMatchingState, TimedOut, Failed, Skipped, Cancelled }
public sealed record CurvePart(string Name, CurvePartState State, DateTimeOffset? SentUtc=null, string Reason="");
public sealed record CurveRequest(Guid IdempotencyKey, string ExpectedStateRevision, CurveValues Desired);
public sealed record CurveRecord(Guid Id, Guid IdempotencyKey, string User, string Source, CurveValues OldValues, CurveValues Desired,
    string ExpectedStateRevision, string GuardRevision, CurveState State, DateTimeOffset CreatedUtc, DateTimeOffset UpdatedUtc,
    IReadOnlyList<CurvePart> Parts, IReadOnlyList<TelemetryValue> Observed, string Reason="");
public sealed record CurveContext(string ExpectedStateRevision, CurveValues? Current, IReadOnlyList<CurveField> Fields, bool Available, string Reason, int TimeoutSeconds, string Source);
