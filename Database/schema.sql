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
    production_date TEXT NULL,
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
    production_date TEXT NULL,
    expiry_date TEXT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    scanned_at TEXT NULL,
    status INTEGER NOT NULL,
    compared_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_result_order_status ON comparison_results(order_id, status);
CREATE INDEX IF NOT EXISTS ix_result_order_time ON comparison_results(order_id, scanned_at DESC);
