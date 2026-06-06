using Microsoft.Data.Sqlite;
using TraceMatch.Models;

namespace TraceMatch.Data;

public sealed class AcceptanceRepository
{
    private readonly AppDatabase _database;

    public AcceptanceRepository(AppDatabase database) => _database = database;

    public async Task<AcceptanceOrder> CreateOrderAsync(AcceptanceOrder order)
    {
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
INSERT INTO acceptance_orders(order_number, supplier, operator, created_at, remark)
VALUES($order_number, $supplier, $operator, $created_at, $remark)
RETURNING id;
""";
        command.Parameters.AddWithValue("$order_number", order.OrderNumber);
        command.Parameters.AddWithValue("$supplier", order.Supplier);
        command.Parameters.AddWithValue("$operator", order.Operator);
        command.Parameters.AddWithValue("$created_at", order.CreatedAt.ToString("O"));
        command.Parameters.AddWithValue("$remark", (object?)order.Remark ?? DBNull.Value);
        order.Id = (long)(await command.ExecuteScalarAsync() ?? 0L);
        return order;
    }

    public async Task<IReadOnlyList<AcceptanceOrder>> GetRecentOrdersAsync()
    {
        var orders = new List<AcceptanceOrder>();
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
SELECT id, order_number, supplier, operator, created_at, remark
FROM acceptance_orders
ORDER BY datetime(created_at) DESC
LIMIT 100;
""";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            orders.Add(new AcceptanceOrder
            {
                Id = reader.GetInt64(0),
                OrderNumber = reader.GetString(1),
                Supplier = reader.GetString(2),
                Operator = reader.GetString(3),
                CreatedAt = DateTime.Parse(reader.GetString(4)),
                Remark = reader.IsDBNull(5) ? null : reader.GetString(5)
            });
        }

        return orders;
    }

    public async Task ReplaceShipmentItemsAsync(long orderId, IEnumerable<ShipmentItem> items)
    {
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await DeleteByOrderAsync(connection, "shipment_items", orderId);
        await DeleteByOrderAsync(connection, "comparison_results", orderId);

        foreach (var item in items)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = (SqliteTransaction)transaction;
            command.CommandText = """
INSERT INTO shipment_items(order_id, trace_code, drug_name, specification, batch_number, manufacturer, expiry_date, quantity)
VALUES($order_id, $trace_code, $drug_name, $specification, $batch_number, $manufacturer, $expiry_date, $quantity);
""";
            command.Parameters.AddWithValue("$order_id", orderId);
            command.Parameters.AddWithValue("$trace_code", item.TraceCode);
            command.Parameters.AddWithValue("$drug_name", (object?)item.DrugName ?? DBNull.Value);
            command.Parameters.AddWithValue("$specification", (object?)item.Specification ?? DBNull.Value);
            command.Parameters.AddWithValue("$batch_number", (object?)item.BatchNumber ?? DBNull.Value);
            command.Parameters.AddWithValue("$manufacturer", (object?)item.Manufacturer ?? DBNull.Value);
            command.Parameters.AddWithValue("$expiry_date", (object?)item.ExpiryDate ?? DBNull.Value);
            command.Parameters.AddWithValue("$quantity", item.Quantity);
            await command.ExecuteNonQueryAsync();
        }

        await transaction.CommitAsync();
    }

    public async Task ReplaceScanRecordsAsync(long orderId, IEnumerable<ScanRecord> records)
    {
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await DeleteByOrderAsync(connection, "scan_records", orderId);
        await DeleteByOrderAsync(connection, "comparison_results", orderId);

        foreach (var record in records)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = (SqliteTransaction)transaction;
            command.CommandText = """
INSERT INTO scan_records(order_id, trace_code, scanned_at, source_file)
VALUES($order_id, $trace_code, $scanned_at, $source_file);
""";
            command.Parameters.AddWithValue("$order_id", orderId);
            command.Parameters.AddWithValue("$trace_code", record.TraceCode);
            command.Parameters.AddWithValue("$scanned_at", record.ScannedAt?.ToString("O") ?? (object)DBNull.Value);
            command.Parameters.AddWithValue("$source_file", (object?)record.SourceFile ?? DBNull.Value);
            await command.ExecuteNonQueryAsync();
        }

        await transaction.CommitAsync();
    }

    public async Task<IReadOnlyList<ShipmentItem>> GetShipmentItemsAsync(long orderId)
    {
        var items = new List<ShipmentItem>();
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
SELECT id, order_id, trace_code, drug_name, specification, batch_number, manufacturer, expiry_date, quantity
FROM shipment_items
WHERE order_id = $order_id;
""";
        command.Parameters.AddWithValue("$order_id", orderId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(new ShipmentItem
            {
                Id = reader.GetInt64(0),
                OrderId = reader.GetInt64(1),
                TraceCode = reader.GetString(2),
                DrugName = reader.IsDBNull(3) ? null : reader.GetString(3),
                Specification = reader.IsDBNull(4) ? null : reader.GetString(4),
                BatchNumber = reader.IsDBNull(5) ? null : reader.GetString(5),
                Manufacturer = reader.IsDBNull(6) ? null : reader.GetString(6),
                ExpiryDate = reader.IsDBNull(7) ? null : reader.GetString(7),
                Quantity = reader.GetDecimal(8)
            });
        }

        return items;
    }

    public async Task<IReadOnlyList<ScanRecord>> GetScanRecordsAsync(long orderId)
    {
        var records = new List<ScanRecord>();
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
SELECT id, order_id, trace_code, scanned_at, source_file
FROM scan_records
WHERE order_id = $order_id
ORDER BY datetime(scanned_at) DESC, id DESC;
""";
        command.Parameters.AddWithValue("$order_id", orderId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            records.Add(new ScanRecord
            {
                Id = reader.GetInt64(0),
                OrderId = reader.GetInt64(1),
                TraceCode = reader.GetString(2),
                ScannedAt = reader.IsDBNull(3) ? null : DateTime.Parse(reader.GetString(3)),
                SourceFile = reader.IsDBNull(4) ? null : reader.GetString(4)
            });
        }

        return records;
    }

    public async Task SaveComparisonResultsAsync(long orderId, IEnumerable<ComparisonResult> results)
    {
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await DeleteByOrderAsync(connection, "comparison_results", orderId);

        foreach (var result in results)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = (SqliteTransaction)transaction;
            command.CommandText = """
INSERT INTO comparison_results(order_id, trace_code, drug_name, specification, batch_number, manufacturer, expiry_date, quantity, scanned_at, status, compared_at)
VALUES($order_id, $trace_code, $drug_name, $specification, $batch_number, $manufacturer, $expiry_date, $quantity, $scanned_at, $status, $compared_at);
""";
            command.Parameters.AddWithValue("$order_id", orderId);
            command.Parameters.AddWithValue("$trace_code", result.TraceCode);
            command.Parameters.AddWithValue("$drug_name", (object?)result.DrugName ?? DBNull.Value);
            command.Parameters.AddWithValue("$specification", (object?)result.Specification ?? DBNull.Value);
            command.Parameters.AddWithValue("$batch_number", (object?)result.BatchNumber ?? DBNull.Value);
            command.Parameters.AddWithValue("$manufacturer", (object?)result.Manufacturer ?? DBNull.Value);
            command.Parameters.AddWithValue("$expiry_date", (object?)result.ExpiryDate ?? DBNull.Value);
            command.Parameters.AddWithValue("$quantity", result.Quantity);
            command.Parameters.AddWithValue("$scanned_at", result.ScannedAt?.ToString("O") ?? (object)DBNull.Value);
            command.Parameters.AddWithValue("$status", (int)result.Status);
            command.Parameters.AddWithValue("$compared_at", DateTime.Now.ToString("O"));
            await command.ExecuteNonQueryAsync();
        }

        await transaction.CommitAsync();
    }

    public async Task<IReadOnlyList<ComparisonResult>> GetComparisonResultsAsync(long orderId)
    {
        var results = new List<ComparisonResult>();
        await using var connection = _database.CreateConnection();
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
SELECT id, order_id, trace_code, drug_name, specification, batch_number, manufacturer, expiry_date, quantity, scanned_at, status
FROM comparison_results
WHERE order_id = $order_id
ORDER BY scanned_at IS NULL, datetime(scanned_at) DESC, id DESC;
""";
        command.Parameters.AddWithValue("$order_id", orderId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new ComparisonResult
            {
                Id = reader.GetInt64(0),
                OrderId = reader.GetInt64(1),
                TraceCode = reader.GetString(2),
                DrugName = reader.IsDBNull(3) ? null : reader.GetString(3),
                Specification = reader.IsDBNull(4) ? null : reader.GetString(4),
                BatchNumber = reader.IsDBNull(5) ? null : reader.GetString(5),
                Manufacturer = reader.IsDBNull(6) ? null : reader.GetString(6),
                ExpiryDate = reader.IsDBNull(7) ? null : reader.GetString(7),
                Quantity = reader.GetDecimal(8),
                ScannedAt = reader.IsDBNull(9) ? null : DateTime.Parse(reader.GetString(9)),
                Status = (TraceCodeStatus)reader.GetInt32(10)
            });
        }

        return results;
    }

    private static async Task DeleteByOrderAsync(SqliteConnection connection, string table, long orderId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"DELETE FROM {table} WHERE order_id = $order_id;";
        command.Parameters.AddWithValue("$order_id", orderId);
        await command.ExecuteNonQueryAsync();
    }
}
