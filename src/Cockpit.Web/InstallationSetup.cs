using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;

public static class InstallationSetup
{
    public static bool ReadYesNo(string label, TextReader input, TextWriter output)
    {
        while (true)
        {
            output.Write($"{label} (yes/y/no/n) [no]: ");
            var answer = input.ReadLine() ?? throw new EndOfStreamException("Interactive input ended; setup was cancelled.");
            switch (answer.Trim().ToLowerInvariant())
            {
                case "y": case "yes": case "j": case "ja": return true;
                case "": case "n": case "no": case "nein": return false;
                default: output.WriteLine("Invalid value. Enter yes/y or no/n, or press Enter for no."); break;
            }
        }
    }

    private static bool Confirm(string label) => ReadYesNo(label, Console.In, Console.Out);

    public static bool ReadControlConsent(bool anonymous, TextReader input, TextWriter output)
    {
        var question = anonymous
            ? "Your MQTT broker allows anonymous access. Anyone who can reach it may be able to read data and send heat-pump commands. Do you accept these security risks and enable heat-pump control at your own risk?"
            : "Allow heat-pump control?";
        if (!ReadYesNo(question, input, output)) return false;
        output.WriteLine("Control requires a compatible Panasonic WH-SDC0509L3E5 / WH-WDG05LE5 installation and verified firmware. See documentation/SUPPORTED-DEVICES.md.");
        var confirmed = ReadYesNo("Confirm the device and installation match this profile", input, output) &&
            ReadYesNo("Confirm you have checked other controllers for conflicting changes", input, output) &&
            (anonymous || ReadYesNo("Authorize the configured MQTT credentials for control", input, output));
        if (!confirmed) output.WriteLine("Control was not authorized. Installation will continue read-only.");
        return confirmed;
    }

    private static string Prompt(string label, string? fallback = null)
    {
        Console.Write(fallback is null ? $"{label}: " : $"{label} [{fallback}]: ");
        var value = Console.ReadLine() ?? throw new InvalidOperationException("Interactive input required.");
        return value.Length == 0 && fallback is not null ? fallback : value;
    }
    private static string Secret(string label)
    {
        Console.Write(label + ": "); var value = new StringBuilder();
        while (true) { var key = Console.ReadKey(true); if (key.Key == ConsoleKey.Enter) break; if (key.Key == ConsoleKey.Backspace) { if (value.Length > 0) value.Length--; } else if (!char.IsControl(key.KeyChar)) value.Append(key.KeyChar); }
        Console.WriteLine(); return value.ToString();
    }
    public static void Run(string root, string usersPath, MqttSettingsStore mqtt)
    {
        var localConfig = Path.Combine(root, "appsettings.Local.json");
        if (File.Exists(localConfig) || File.Exists(usersPath) || mqtt.Read().Revision != 0)
            throw new InvalidOperationException("Existing configuration or accounts found; installation will not overwrite them.");
        Console.WriteLine("Configure a new HeishaMon Cockpit installation. No broker connection will be opened.");
        var username = Prompt("Administrator username");
        var password = Secret("Administrator password (12–128 characters)");
        if (password != Secret("Repeat administrator password")) throw new InvalidOperationException("Passwords do not match; nothing was configured.");
        var host = Prompt("MQTT broker host");
        if (!int.TryParse(Prompt("MQTT broker port", "1883"), out var port)) throw new InvalidOperationException("Invalid broker port.");
        var prefix = Prompt("HeishaMon topic base", "panasonic_heat_pump");
        var tls = Confirm("Use TLS for MQTT?");
        var brokerUser = Prompt("MQTT username (leave empty for anonymous)");
        var brokerPassword = brokerUser.Length == 0 ? null : Secret("MQTT password");
        if (!int.TryParse(Prompt("Web interface port", "5080"), out var webPort) || webPort is < 1024 or > 65535)
            throw new InvalidOperationException("Web interface port must be between 1024 and 65535.");
        var anonymous = brokerUser.Length == 0;
        var allowControl = ReadControlConsent(anonymous, Console.In, Console.Out);
        var brokerInput = new MqttSettingsInput(host, port, prefix, tls, brokerUser.Length == 0 ? "clear" : "replace", brokerUser, brokerPassword, 0);
        var options = new Cockpit.Infrastructure.MqttReadOptions { Host = host, Port = port, Prefix = prefix, UseTls = tls, LiveReadOnly = true, Username = brokerUser.Length == 0 ? null : brokerUser, Password = brokerPassword };
        options.Validate();
        if (password.Length is < 12 or > 128 || string.IsNullOrWhiteSpace(username) || username.Length > 64 || username.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not ('.' or '_' or '-')))
            throw new InvalidOperationException("Invalid administrator username or password; nothing was configured.");
        if (brokerUser.Length > 0 && (brokerUser.Length > 256 || brokerUser.Any(char.IsControl) || string.IsNullOrEmpty(brokerPassword) || brokerPassword.Length > 1024))
            throw new InvalidOperationException("Invalid broker credentials; nothing was configured.");
        var dataDir = Path.Combine(root, "data"); Directory.CreateDirectory(dataDir);
        using var rsa = RSA.Create(3072);
        var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var names = new SubjectAlternativeNameBuilder(); names.AddDnsName("localhost"); names.AddIpAddress(IPAddress.Loopback); names.AddIpAddress(IPAddress.IPv6Loopback);
        foreach (var address in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()
            .Where(network => network.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up)
            .SelectMany(network => network.GetIPProperties().UnicastAddresses)
            .Select(unicast => unicast.Address)
            .Where(address => address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !IPAddress.IsLoopback(address))
            .Distinct()) names.AddIpAddress(address);
        request.CertificateExtensions.Add(names.Build());
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false));
        using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddYears(2));
        var certificatePath = Path.Combine(dataDir, "localhost.pfx");
        var fileOptions = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None };
        if (!OperatingSystem.IsWindows()) fileOptions.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
        using (var file = new FileStream(certificatePath, fileOptions)) { file.Write(cert.Export(X509ContentType.Pfx, "")); file.Flush(true); }
        new UserStore(usersPath).CreateInitialAdmin(username, password);
        mqtt.Save(brokerInput);
        if (allowControl)
            new ControlSetupStore(Path.Combine(dataDir, "mqtt.db.control.json"))
                .Save(new(true, Cockpit.Domain.HeatingCurve.Profile, true, !anonymous, true, 0, anonymous), "mqtt", options, false);
        using (var file = new FileStream(localConfig, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            JsonSerializer.Serialize(file, new { Source = "mqtt", LocalPort = webPort, Access = new { RequireLogin = true, LocalHttps = true, ListenAddress = "0.0.0.0" }, Settings = new { Enabled = true } });
        Console.WriteLine($"Setup complete. Start the application explicitly and open https://localhost:{webPort}/.");
        Console.WriteLine("The self-signed certificate contains the current IPv4 addresses. Verify its fingerprint before trusting it on any client.");
    }
}
