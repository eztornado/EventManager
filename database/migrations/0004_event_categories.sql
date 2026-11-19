ALTER TABLE events ADD COLUMN category TEXT NOT NULL DEFAULT 'sports';

CREATE INDEX idx_events_category ON events(category);
