-- Jobs table
CREATE TABLE IF NOT EXISTS job (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,                -- Type/category of job
    payload TEXT NOT NULL,             -- JSON payload string
    state TEXT NOT NULL CHECK (
        state IN ('pending', 'processing', 'completed', 'failed', 'dead')
    ) DEFAULT 'pending',
    error_message TEXT,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    runs_after DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    -- Worker that claimed the job (optional)
    locked_by TEXT,
    locked_at DATETIME,

    -- Optional retry metadata
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5
);


