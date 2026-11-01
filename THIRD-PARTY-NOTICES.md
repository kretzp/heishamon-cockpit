# Third-party notices

HeishaMon Cockpit includes third-party software. Those components retain their respective copyrights, license terms and notices; the project's MPL-2.0 notice does not replace them.

Supplied license texts, notices, package metadata and source references are collected in `third-party/`. `third-party/inventory.json` identifies the package versions and hashes of collected files. The collection includes development dependencies for source-build transparency; listing a package does not mean it is linked into every application artifact. `third-party/REVIEW.md` identifies packages that still require explicit notice review.

The shadcn components retain their MIT notice, preserved both alongside their source and in the collection. npm package metadata and NuGet nuspec files preserve authorship, declared license and upstream project references. Some packages omit a standalone license text; metadata alone must not be treated as the missing permission notice.

Regenerate the collection with `node tools/collect-third-party.mjs` after installing locked npm dependencies and restoring the required NuGet target runtimes. Use `NUGET_PACKAGES` if the cache is outside `.cache/nuget/packages`. Review the collection against the exact source snapshot and shipped artifacts before public distribution. The package builder includes this document and the collection in the installed application directory.

The owner has accepted the reviewed dependency licenses and origins. This records no replacement license for third-party material. Missing original notices must not be filled with invented copyright holders or dates.
