using System.Globalization;
using System.Text.Json;
using Cockpit.Application;
using Microsoft.EntityFrameworkCore;

namespace Cockpit.Infrastructure.Persistence;

public sealed partial class SqliteHistoryStore
{
    private readonly SemaphoreSlim dailyEnergy = new(1, 1);

    public async Task<EnergyResult> EnergyAsync(int year, int maxPairSeconds, DateTimeOffset now, CancellationToken token)
    {
        if (year < 1971 || year > TimeZoneInfo.ConvertTime(now, EnergyCalendar.Berlin).Year || maxPairSeconds is < 0 or > 3600)
            throw new HistoryRequestException("invalid_year", "Bitte ein Jahr ab 1971 bis zum aktuellen Jahr wählen.");
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30)); token = deadline.Token;
        await dailyEnergy.WaitAsync(token);
        try
        {
            var first = new DateOnly(year, 1, 1);
            var count = DateTime.IsLeapYear(year) ? 366 : 365;
            var days = Enumerable.Range(0, count).Select(i => {
                var date = first.AddDays(i);
                var from = EnergyCalendar.Midnight(date); var to = EnergyCalendar.Midnight(date.AddDays(1));
                return new EnergyDay(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), from, to, null,
                    0, (to - from).TotalSeconds, from > now ? "future" : to > now ? "current" : "missing");
            }).ToArray();
            await using var db = new HistoryDb(options);
            var prefix = year.ToString(CultureInfo.InvariantCulture) + "-";
            var saved = await db.DailyEnergy.AsNoTracking().Where(x => x.Date.StartsWith(prefix)).ToListAsync(token);
            var cached = saved.ToDictionary(x => x.Date);
            var sources = new HashSet<string>();
            int? maxGap = null;
            var pending = new List<DailyEnergyRow>();
            for (var i = 0; i < count;)
            {
                if (cached.TryGetValue(days[i].Date, out var row) && days[i].To <= now)
                {
                    days[i] = JsonSerializer.Deserialize<EnergyDay>(row.Payload)!;
                    if (row.ElectricalSource != "none")
                    {
                        sources.Add(row.ElectricalSource);
                        maxGap = Math.Max(maxGap ?? 0, row.MaxGapSeconds ?? 0);
                    }
                    i++; continue;
                }
                if (days[i].From > now) { i++; continue; }
                var start = i++;
                while (i < count && days[i].From <= now && !cached.ContainsKey(days[i].Date)) i++;
                var result = await CalculateEnergyAsync(year, maxPairSeconds, now, days[start].From, days[i - 1].To, token);
                if (result.ElectricalSource != "none")
                {
                    sources.Add(result.ElectricalSource);
                    maxGap = Math.Max(maxGap ?? 0, result.MaxGapSeconds ?? 0);
                }
                for (var j = start; j < i; j++)
                {
                    days[j] = result.Days[j];
                    if (days[j].To <= now)
                        pending.Add(new() { Date = days[j].Date, Payload = JsonSerializer.Serialize(days[j]),
                            ElectricalSource = result.ElectricalSource, MaxGapSeconds = result.MaxGapSeconds });
                }
            }
            if (pending.Count > 0)
            {
                await writer.WaitAsync(token);
                try { db.DailyEnergy.AddRange(pending); await db.SaveChangesAsync(token); }
                finally { writer.Release(); }
            }
            return new(year, source, "kWh", "Europe/Berlin", days) {
                ElectricalSource = sources.Count > 1 || sources.Contains("mixed") ? "mixed" : sources.SingleOrDefault() ?? "heishamon-extra",
                MaxGapSeconds = maxGap is > 0 ? maxGap : null };
        }
        finally { dailyEnergy.Release(); }
    }
}
