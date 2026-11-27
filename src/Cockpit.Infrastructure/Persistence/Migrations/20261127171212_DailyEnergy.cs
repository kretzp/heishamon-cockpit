using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cockpit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DailyEnergy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DailyEnergy",
                columns: table => new
                {
                    Date = table.Column<string>(type: "TEXT", nullable: false),
                    Payload = table.Column<string>(type: "TEXT", nullable: false),
                    ElectricalSource = table.Column<string>(type: "TEXT", nullable: false),
                    MaxGapSeconds = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyEnergy", x => x.Date);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyEnergy");
        }
    }
}
