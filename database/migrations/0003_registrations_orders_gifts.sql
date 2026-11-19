CREATE TABLE gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    modality_id INTEGER NOT NULL REFERENCES modalities(id) ON DELETE CASCADE,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL UNIQUE,
    price_paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    claimed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_gifts_event ON gifts(event_id);
CREATE INDEX idx_gifts_status ON gifts(status);

CREATE TABLE registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    modality_id INTEGER NOT NULL REFERENCES modalities(id) ON DELETE CASCADE,
    locator TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    birth_date TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    document_id TEXT NOT NULL DEFAULT '',
    province TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    club_id INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    club_name TEXT NOT NULL DEFAULT '',
    dynamic_data TEXT NOT NULL DEFAULT '{}',
    base_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
    gift_id INTEGER REFERENCES gifts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_registrations_modality ON registrations(modality_id);
CREATE INDEX idx_registrations_status ON registrations(status);
CREATE INDEX idx_registrations_email ON registrations(email);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
    gift_id INTEGER REFERENCES gifts(id) ON DELETE CASCADE,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'card',
    reference TEXT NOT NULL DEFAULT '',
    payer_name TEXT NOT NULL DEFAULT '',
    payer_email TEXT NOT NULL DEFAULT '',
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_orders_registration ON orders(registration_id);
CREATE INDEX idx_orders_gift ON orders(gift_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
