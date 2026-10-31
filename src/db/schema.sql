CREATE TABLE IF NOT EXISTS passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    document TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',

    CHECK (status IN ('ACTIVE', 'CANCELLED')),
    CHECK (LENGTH(TRIM(name)) > 0),
    CHECK (LENGTH(TRIM(document)) > 0)
);