using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Cockpit.Application;

namespace Cockpit.Infrastructure.Persistence;

public sealed class SampleRow
{
    public string Key { get; set; } = "";
    public long Time { get; set; }
    public double? Value { get; set; }
    public string? Text { get; set; }
    public int Quality { get; set; }
    public long? Received { get; set; }
    public bool Retained { get; set; }
}
public sealed class EventRow
{
    public long Id { get; set; }
    public long Time { get; set; }
    public string Kind { get; set; } = "";
    public string Key { get; set; } = "";
    public string Message { get; set; } = "";
}
public sealed class StoreMetadata
{
    public int Id { get; set; }
    public string Source { get; set; } = "";
    public int SampleSeconds { get; set; }
}
public sealed class HistoryDb(DbContextOptions<HistoryDb> options) : DbContext(options)
{
    public DbSet<SampleRow> Samples => Set<SampleRow>();
    public DbSet<EventRow> Events => Set<EventRow>();
    public DbSet<StoreMetadata> Metadata => Set<StoreMetadata>();
    protected override void OnModelCreating(ModelBuilder model) => Configure(model);
    internal static void Configure(ModelBuilder model)
    {
        model.Entity<SampleRow>().ToTable("Samples").HasKey(x => new { x.Key, x.Time });
        model.Entity<SampleRow>().HasIndex(x => x.Time);
        model.Entity<EventRow>().ToTable("Events").HasKey(x => x.Id);
        model.Entity<EventRow>().HasIndex(x => new { x.Kind, x.Id });
        model.Entity<EventRow>().HasIndex(x => x.Time);
        model.Entity<StoreMetadata>().ToTable("Metadata").HasKey(x => x.Id);
    }
}

public sealed class HistoryDesignFactory : Microsoft.EntityFrameworkCore.Design.IDesignTimeDbContextFactory<HistoryDb>
{
    public HistoryDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<HistoryDb>().UseSqlite("Data Source=design-only.db").Options);
}
