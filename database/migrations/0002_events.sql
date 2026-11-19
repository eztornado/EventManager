CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id INTEGER REFERENCES organizers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    venue TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    province TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'España',
    cover_image_url TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL DEFAULT '',
    registration_deadline TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Programada',
    max_participants INTEGER,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_status ON events(status);

CREATE TABLE modalities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    distance_km REAL,
    start_time TEXT NOT NULL DEFAULT '',
    max_participants INTEGER,
    base_price REAL NOT NULL DEFAULT 0,
    dynamic_fields TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_modalities_event ON modalities(event_id);

CREATE TABLE price_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modality_id INTEGER NOT NULL REFERENCES modalities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    starts_at TEXT NOT NULL DEFAULT '',
    ends_at TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_price_tiers_modality ON price_tiers(modality_id);

CREATE TABLE coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    modality_id INTEGER REFERENCES modalities(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'percent',
    value REAL NOT NULL DEFAULT 0,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    valid_from TEXT NOT NULL DEFAULT '',
    valid_until TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_coupons_event ON coupons(event_id);
