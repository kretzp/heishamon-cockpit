namespace Cockpit.Domain;

public sealed record HeatPumpModel(string? RawIdentifier, string? DisplayName, bool Known);

public static class HeatPumpModels
{
    private sealed record Model(int? LegacyId, string Identifier, string Name);
    // Model facts from HeishaMon HeatPumpType.md, revision ad7804eb02779f48ed8bf397861474ce608d8bbb.
    // https://github.com/heishamon/HeishaMon/blob/ad7804eb02779f48ed8bf397861474ce608d8bbb/HeatPumpType.md
    private static readonly Model[] Models =
    [
        new(0, "E2 CF 0B 13 33 32 D1 0C 16 33", "Panasonic WH-MDC05H3E5"),
        new(1, "E2 CF 0B 14 33 42 D1 0B 17 33", "Panasonic WH-MDC07H3E5"),
        new(2, "E2 CF 0D 77 09 12 D0 0B 05 11", "Panasonic WH-SXC09H3E5 / WH-UX09HE5"),
        new(3, "E2 CF 0C 88 05 12 D0 0B 97 05", "Panasonic WH-SDC09H3E8 / WH-UD09HE8"),
        new(4, "E2 CF 0D 85 05 12 D0 0C 94 05", "Panasonic WH-SXC09H3E8 / WH-UX09HE8"),
        new(5, "E2 CF 0D 86 05 12 D0 0C 95 05", "Panasonic WH-SXC12H9E8 / WH-UX12HE8"),
        new(6, "E2 CF 0D 87 05 12 D0 0C 96 05", "Panasonic WH-SXC16H9E8 / WH-UX16HE8"),
        new(7, "E2 CE 0D 71 81 72 CE 0C 92 81", "Panasonic WH-SDC05H3E5 / WH-UD05HE5"),
        new(8, "62 D2 0B 43 54 42 D2 0B 72 66", "Panasonic WH-SDC0709J3E5 / WH-UD09JE5"),
        new(9, "C2 D3 0B 33 65 B2 D3 0B 94 65", "Panasonic WH-MDC05J3E5"),
        new(10, "E2 CF 0B 15 33 42 D1 0B 18 33", "Panasonic WH-MDC09H3E5"),
        new(11, "E2 CF 0B 41 34 82 D1 0B 31 35", "Panasonic WH-MXC09H3E5"),
        new(12, "62 D2 0B 45 54 42 D2 0B 47 55", "Panasonic WH-ADC0309J3E5 / WH-UD09JE5"),
        new(13, "E2 CF 0C 74 09 12 D0 0D 95 05", "Panasonic WH-ADC0916H9E8 / WH-UX12HE8"),
        new(14, "E2 CF 0B 82 05 12 D0 0C 91 05", "Panasonic WH-SQC09H3E8 / WH-UQ09HE8"),
        new(15, "E2 CF 0C 55 14 12 D0 0B 15 08", "Panasonic WH-SDC09H3E5 / WH-UD09HE5"),
        new(16, "E2 CF 0C 43 00 12 D0 0B 15 08", "Panasonic WH-ADC0309H3E5 / WH-UD09HE5"),
        new(17, "62 D2 0B 45 54 32 D2 0C 45 55", "Panasonic WH-ADC0309J3E5 / WH-UD05JE5"),
        new(18, "62 D2 0B 43 54 42 D2 0C 46 55", "Panasonic WH-SDC0709J3E5 / WH-UD07JE5"),
        new(19, "E2 CF 0C 54 14 12 D0 0B 14 08", "Panasonic WH-SDC07H3E5-1 / WH-UD07HE5-1"),
        new(20, "C2 D3 0B 34 65 B2 D3 0B 95 65", "Panasonic WH-MDC07J3E5"),
        new(21, "C2 D3 0B 35 65 B2 D3 0B 96 65", "Panasonic WH-MDC09J3E5"),
        new(22, "62 D2 0B 41 54 32 D2 0C 45 55", "Panasonic WH-SDC0305J3E5 / WH-UD05JE5"),
        new(23, "32 D4 0B 87 84 73 90 0C 84 84", "Panasonic WH-MXC09J3E8"),
        new(24, "32 D4 0B 88 84 73 90 0C 85 84", "Panasonic WH-MXC12J9E8"),
        new(25, "E2 CF 0B 75 09 12 D0 0C 06 11", "Panasonic WH-ADC1216H6E5 / WH-UD12HE5"),
        new(26, "42 D4 0B 83 71 42 D2 0C 46 55", "Panasonic WH-ADC0309J3E5C / WH-UD07JE5"),
        new(27, "C2 D3 0C 34 65 B2 D3 0B 95 65", "Panasonic WH-MDC07J3E5"),
        new(28, "C2 D3 0C 33 65 B2 D3 0B 94 65", "Panasonic WH-MDC05J3E5"),
        new(29, "E2 CF 0B 83 05 12 D0 0D 92 05", "Panasonic WH-SQC12H9E8 / WH-UQ12HE8"),
        new(30, "E2 CF 0C 78 09 12 D0 0B 06 11", "Panasonic WH-SXC12H6E5 / WH-UX12HE5"),
        new(31, "C2 D3 0C 35 65 B2 D3 0B 96 65", "Panasonic WH-MDC09J3E5"),
        new(32, "32 D4 0B 99 77 62 90 0B 01 78", "Panasonic WH-MXC09J3E5"),
        new(33, "42 D4 0B 15 76 12 D0 0B 10 11", "Panasonic WH-ADC1216H6E5C / WH-UD12HE5"),
        new(34, "E2 D5 0C 29 99 83 92 0C 28 98", "Panasonic WH-ADC0509L3E5 / WH-WDG07LE5"),
        new(35, "E2 CF 0D 85 05 12 D0 0E 94 05", "Panasonic WH-SXC09H3E8 / WH-UX09HE8"),
        new(36, "E2 D5 0D 36 99 02 D6 0F 67 95", "Panasonic WH-ADC0309K3E5AN / WH-UDZ07KE5"),
        new(37, "E2 D5 0B 08 95 02 D6 0E 66 95", "Panasonic WH-SDC0309K3E5 / WH-UDZ05KE5"),
        new(38, "E2 D5 0B 34 99 83 92 0C 29 98", "Panasonic WH-SDC0509L3E5 / WH-WDG09LE5"),
        new(39, "E2 CF 0C 89 05 12 D0 0C 98 05", "Panasonic WH-SDC12H9E8 / WH-UD12HE8"),
        new(40, "E2 D5 0B 08 95 02 D6 0E 67 95", "Panasonic WH-SDC0309K3E5 / WH-UDZ07KE5"),
        new(41, "E2 CF 0C 74 09 12 D0 0C 96 05", "Panasonic WH-ADC0916H9E8 / WH-UX16HE8"),
        new(42, "E2 CF 0C 74 09 12 D0 0E 95 05", "Panasonic WH-ADC0912H9E8 / WH-UX12HE8"),
        new(43, "32 D4 0B 89 84 73 90 0C 86 84", "Panasonic WH-MXC16J9E8"),
        new(44, "32 D4 0B 00 78 62 90 0B 02 78", "Panasonic WH-MXC12J6E5"),
        new(45, "E2 CF 0B 82 05 12 D0 0D 91 05", "Panasonic WH-SQC09H3E8 / WH-UQ09HE8"),
        new(46, "E2 D5 0D 99 94 02 D6 0D 68 95", "Panasonic WH-ADC0309K3E5 / WH-UDZ09KE5"),
        new(47, "E2 CF 0C 74 09 12 D0 0C 95 05", "Panasonic WH-ADC0916H9E8 / WH-UX12HE8"),
        new(48, "E2 D5 0B 34 99 83 92 0C 28 98", "Panasonic WH-SDC0509L3E5 / WH-WDG07LE5"),
        new(49, "E2 CF 0D 77 09 12 D0 0C 05 11", "Panasonic WH-SXC09H3E5 / WH-UX09HE5"),
        new(50, "E2 CF 0B 44 34 12 D0 0C 34 35", "Panasonic WH-MXC12H9E8"),
        new(51, "E2 D5 0C 67 00 83 92 0C 27 98", "Panasonic WH-ADC0509L3E5AN / WH-WDG05LE5"),
        new(52, "E2 D5 0B 34 99 83 92 0C 27 98", "Panasonic WH-SDC0509L3E5 / WH-WDG05LE5"),
        new(53, "42 D4 0B 83 71 32 D2 0C 44 55", "Panasonic WH-ADC0309J3E5C / WH-UD03JE5"),
        new(54, "E2 CF 0C 74 09 12 D0 0E 94 05", "Panasonic WH-ADC0916H9E8 / WH-UX09HE8"),
        new(55, "12 D7 0D 98 11 33 94 0C 83 10", "Panasonic WH-ADC0316M9E8AN2 / WH-WXG09ME8"),
        new(56, "E2 D5 0B 08 95 02 D6 0F 67 95", "Panasonic WH-SDC0309K3E5 / WH-UDZ07KE5"),
        new(57, "E2 D5 0D 36 99 02 D6 10 66 95", "Panasonic WH-ADC0309K3E5AN / WH-UDZ05KE5"),
        new(58, "E2 D5 0F 99 94 02 D6 10 68 95", "Panasonic WH-ADC0309K3E5 / WH-UDZ09KE5"),
        new(59, "E2 D5 0C 67 00 83 92 0C 28 98", "Panasonic WH-ADC0509L3E5AN / WH-WDG07LE5"),
        new(60, "E2 CF 0D 86 05 12 D0 0E 95 05", "Panasonic WH-SXC12H9E8 / WH-UX12HE8"),
        new(61, "12 D7 0C 98 14 35 94 0D 83 10", "Panasonic WH-SDC0316M9E8 / WH-WXG09ME8"),
        new(62, "E2 D5 0C 08 95 02 D6 10 67 95", "Panasonic WH-SDC0309K3E5 / WH-UDZ07KE5"),
        new(63, "C2 D3 0D 35 65 B2 D3 0B 96 65", "Panasonic WH-MDC09J3E5-1"),
        new(64, "E2 D5 0C 29 99 83 92 0C 29 98", "Panasonic WH-ADC0509L3E5 / WH-WDG09LE5"),
        new(65, "62 D2 0B 45 54 42 D2 0B 72 66", "Panasonic WH-ADC0309J3E5 / WH-UD09JE5-1"),
        new(66, "E2 CF 0B 82 09 12 D0 0B 10 11", "Panasonic WH-SDC12H6E5 / WH-UD12HE5"),
        new(67, "42 D4 0B 83 71 32 D2 0C 45 55", "Panasonic WH-ADC0309J3E5C / WH-UD05JE5"),
        new(68, "12 D7 0B 47 19 37 94 0E 83 10", "Panasonic WH-ADC0316M9E83 / WH-WXG09ME8"),
        new(69, "E2 D5 0D 00 09 43 D6 0E 07 09", "Panasonic WH-SDC09K3E8 / WH-UDZ09KE8"),
        new(70, "E2 CF 0B 84 05 12 D0 0B 93 05", "Panasonic WH-SQC16H9E8 / WH-UQ16HE8"),
        new(71, "E2 D5 0B 35 99 83 92 0D 29 98", "Panasonic WH-SDC0509L6E5 / WH-WDG09LE5"),
        new(72, "12 D7 0B 98 14 35 94 0D 83 10", "Panasonic WH-SDC0316M9E8 / WH-WXG09ME8"),
        new(73, "E2 CF 0C 77 09 12 D0 0B 05 11", "Panasonic WH-SXC09H3E5 / WH-UX09HE5"),
        new(74, "C2 D3 0D 33 65 B2 D3 0B 94 65", "Panasonic WH-MDC05J3E5"),
        new(75, "12 D7 0D 98 14 37 94 0E 84 10", "Panasonic WH-SDC0316M9E8 / WH-WXG12ME8"),
        new(76, "12 D7 0D 98 11 39 94 0F 84 10", "Panasonic WH-ADC0316M9E8AN2 / WH-WXG12ME8"),
        new(77, "12 D7 0D 85 11 37 94 0E 84 10", "Panasonic WH-WXG12ME8"),
        new(78, "E2 D5 0B 34 99 83 92 0D 29 98", "Panasonic WH-SDC0509L3E5 / WH-WDG09LE5"),
        new(79, "E2 D5 0B 12 95 02 D6 0F 70 95", "Panasonic WH-SXC12K6E5 / WH-UXZ12KE5"),
        new(80, "12 D7 0C 98 14 33 94 0C 83 10", "Panasonic WH-SDC0316M9E8 / WH-WXG09ME8"),
        new(81, "E2 D5 0D 99 94 02 D6 10 67 95", "Panasonic WH-ADC0309K3E5 / WH-UDZ07KE5"),
        new(82, "E2 D5 0F 36 99 02 D6 10 68 95", "Panasonic WH-ADC0309K3E5AN / WH-UDZ09KE5"),
        new(83, "42 D4 0B 83 71 42 D2 0B 72 66", "Panasonic WH-ADC0309J3E5C / WH-UD09JE5-1"),
        new(84, "E2 D5 0D 13 95 43 D6 0D 71 95", "Panasonic WH-SXC09K3E8 / WH-UXZ09KE8"),
        new(85, "E2 D5 0B 15 95 43 D6 0D 72 95", "Panasonic WH-SXC12K9E8 / WH-UXZ12KE8"),
        new(86, "E2 D5 0C 00 09 43 D6 0D 07 09", "Panasonic WH-SDC09K3E8 / WH-UDZ09KE8"),
        new(87, "12 D7 0D 98 14 39 94 0F 83 10", "Panasonic WH-SDC0316M9E8 / WH-WXG09ME8"),
        new(88, "E2 D5 0C 67 00 83 92 0D 29 98", "Panasonic WH-ADC0509L3E5AN / WH-WDG09LE5"),
        new(89, "12 D7 0C 98 14 35 94 0D 84 10", "Panasonic WH-SDC0316M9E8 / WH-WXG12ME8"),
        new(90, "E2 D5 0D 99 94 02 D6 0F 68 95", "Panasonic WH-ADC0309K3E5 / WH-UDZ09KE5"),
        // Additional model facts supplied by the operator, 2026-11-18 (IDs 91–95).
        new(91, "E2 D5 0B 34 99 83 92 0D 27 98", "Panasonic WH-SDC0509L3E5 / WH-WDG05LE5"),
        new(92, "12 D7 0E 85 11 39 94 0F 85 10", "Panasonic WH-WXG16ME8"),
        new(93, "E2 D5 0D 15 95 43 D6 0E 72 95", "Panasonic WH-SXC12K9E8 / WH-UXZ12KE8"),
        new(94, "E2 D5 0C 29 99 83 92 0D 29 98", "Panasonic WH-ADC0509L3E5 / WH-WDG09LE5"),
        new(95, "E2 D5 0D 08 95 02 D6 10 67 95", "Panasonic WH-SDC0309K3E5 / WH-UDZ07KE5"),
    ];

    public static HeatPumpModel Resolve(string? identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier)) return new(null, null, false);
        var raw = identifier.Trim();
        var normalized = string.Join(" ", raw.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
        var model = Models.FirstOrDefault(m => m.Identifier == normalized
            || m.LegacyId?.ToString(System.Globalization.CultureInfo.InvariantCulture) == raw);
        return new(raw, model?.Name ?? raw, model is not null);
    }
}
