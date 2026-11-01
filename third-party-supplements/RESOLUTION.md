# Supplemental notice resolution

Seventeen of the original nineteen flagged records have been resolved by preserving actual upstream texts or the embedded package notice. Sources and exact package associations are in `sources.json`; the collector copies these texts into each relevant notice directory and hashes them in the inventory.

| Original entries | Resolution |
| --- | --- |
| Humanizer.Core 2.14.1 | License from the exact repository commit in the nuspec, including Inflector and ByteSize attributions |
| Microsoft.Data.Sqlite.Core and seven EntityFrameworkCore packages 10.0.12 | Original EF Core v10.0.12 MIT text |
| Mono.TextTemplating 3.0.0 | Original license at the exact nuspec repository commit |
| Four SQLitePCLRaw packages 2.1.12 | Original Apache-2.0 text at upstream tag v2.1.12; package copyright remains in the preserved nuspec |
| SignalR 10.0.11 | Original ASP.NET Core v10.0.11 license |
| Rolldown Windows binding 1.2.16 | Original v1.2.16 license and third-party license text |
| imurmurhash 0.1.4 | Complete MIT license and Gary Court/Jens Taylor copyright already embedded in the preserved package README |

## Owner-confirmed historical notices

`size-sensor` 1.0.3 declares ISC and identifies hustcc, but its versioned source and package do not provide a complete original copyright/permission notice. `tr46` 0.0.3 declares MIT and its later upstream license names Sebastian Mayr; this is not proof that the later file is the original 0.0.3 notice. Its generated Unicode 8.0.0 table additionally needs the applicable historical data notice if redistributed. The previous provenance review records the detailed evidence. The owner accepted provenance and license choices; no new original upstream notice has been obtained in this step.

No copyright year, original copyright text or historical permission grant has been invented. On 1 November 2026 Peter Kretz confirmed his independent checks: size-sensor 1.0.3 is ISC and tr46 0.0.3 is MIT. He explicitly declared publication item 3 complete. The collector records these as owner-confirmed and no longer flags them as open. This is an owner decision, not a claim that the historical upstream files were newly discovered.

## Runtime comparison

All three targets were restored with their runtime-specific lockfiles and published self-contained. `third-party/runtime-audit.json` records dependency-to-notice mappings and hashes of the native SQLite binaries for win-x64, linux-x64 and linux-arm64. Every non-project dependency in those three deps files maps to a collected notice record. The two npm license confirmations are recorded separately from the .NET runtime audit.
