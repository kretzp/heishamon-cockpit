namespace Cockpit.Domain;

public static class OneWire
{
    public const string KeyPrefix = "ds18b20_";
    public const string TopicPrefix = "1wire/";
    // Bound discovery independently of untrusted MQTT input and firmware limits.
    public const int MaximumSensors = 64;

    public static bool IsAddress(string address) => address.Length == 16 && address.All(char.IsAsciiHexDigit);

    public static Metric? FromSuffix(string suffix)
    {
        if (!suffix.StartsWith(TopicPrefix, StringComparison.Ordinal)) return null;
        var address = suffix[TopicPrefix.Length..];
        return IsAddress(address) ? new(KeyPrefix + address.ToLowerInvariant(), Catalog.Celsius, suffix, "ds18b20", Optional: true) : null;
    }

    public static Metric? FromKey(string key) => key.StartsWith(KeyPrefix, StringComparison.Ordinal)
        && IsAddress(key[KeyPrefix.Length..]) && key == key.ToLowerInvariant()
        ? new(key, Catalog.Celsius, TopicPrefix + key[KeyPrefix.Length..], "ds18b20", Optional: true) : null;
}
