using System.IO;
using Microsoft.Data.Sqlite;

namespace TraceMatch.Data;

public sealed class AppDatabase
{
    private readonly string _connectionString;

    public AppDatabase()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TraceMatch");
        Directory.CreateDirectory(dir);
        _connectionString = $"Data Source={Path.Combine(dir, "tracematch.db")}";
    }

    public SqliteConnection CreateConnection() => new(_connectionString);

    public async Task InitializeAsync()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();
        await using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON;";
        await pragma.ExecuteNonQueryAsync();

        var schemaPath = Path.Combine(AppContext.BaseDirectory, "Database", "schema.sql");
        var schema = File.Exists(schemaPath)
            ? await File.ReadAllTextAsync(schemaPath)
            : EmbeddedSchema.Sql;
        await using var command = connection.CreateCommand();
        command.CommandText = schema;
        await command.ExecuteNonQueryAsync();
    }
}

internal static class EmbeddedSchema
{
    public const string Sql = """
CREATE TABLE IF NOT EXISTS acceptance_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    supplier TEXT NOT NULL,
    operator TEXT NOT NULL,
    created_at TEXT NOT NULL,
    remark TEXT NULL
);
CREATE TABLE IF NOT EXISTS shipment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    trace_code TEXT NOT NULL,
    drug_name TEXT NULL,
    specification TEXT NULL,
    batch_number TEXT NULL,
    manufacturer TEXT NULL,
    expiry_date TEXT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_shipment_order_code ON shipment_items(order_id, trace_code);
CREATE TABLE IF NOT EXISTS scan_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    trace_code TEXT NOT NULL,
    scanned_at TEXT NULL,
    source_file TEXT NULL,
    FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_scan_order_code ON scan_records(order_id, trace_code);
CREATE INDEX IF NOT EXISTS ix_scan_order_time ON scan_records(order_id, scanned_at DESC);
CREATE TABLE IF NOT EXISTS comparison_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    trace_code TEXT NOT NULL,
    drug_name TEXT NULL,
    specification TEXT NULL,
    batch_number TEXT NULL,
    manufacturer TEXT NULL,
    expiry_date TEXT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    scanned_at TEXT NULL,
    status INTEGER NOT NULL,
    compared_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_result_order_status ON comparison_results(order_id, status);
CREATE INDEX IF NOT EXISTS ix_result_order_time ON comparison_results(order_id, scanned_at DESC);
""";
}
