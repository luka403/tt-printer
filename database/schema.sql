CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL DEFAULT 'tiktok',
    username TEXT NOT NULL,
    niche TEXT NOT NULL, -- 'motivation', 'reddit', 'aigirls', etc.
    status TEXT DEFAULT 'active',
    config JSON -- api keys, specific prompt tweaks
);

CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    niche TEXT NOT NULL,
    title TEXT,
    script_content TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'scripted', 'rendering', 'ready', 'published'
    file_path TEXT,
    metadata JSON, -- trends used, music used
    performance_stats JSON, -- views, likes (updated later)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    theme TEXT, -- specific theme/topic used
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS story_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    niche TEXT NOT NULL,
    theme TEXT,
    script_content TEXT,
    story_hash TEXT UNIQUE, -- Hash to prevent exact duplicates
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(niche, script_content)
);

CREATE TABLE IF NOT EXISTS trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT, -- 'reddit', 'tiktok'
    content TEXT,
    score REAL,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS video_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    scene_index INTEGER NOT NULL, -- Order of scene in video (0, 1, 2, ...)
    timestamp REAL NOT NULL, -- Start time in seconds
    duration REAL NOT NULL, -- Duration in seconds
    description TEXT, -- Human-readable scene description
    image_prompt TEXT, -- Prompt used for image generation
    image_path TEXT, -- Path to generated image file
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(video_id) REFERENCES videos(id)
);

CREATE TABLE IF NOT EXISTS hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    niche TEXT NOT NULL,
    hook_content TEXT NOT NULL,
    topic TEXT,
    video_id INTEGER,
    hook_type TEXT,
    word_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(video_id) REFERENCES videos(id),
    UNIQUE(niche, hook_content)
);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    niche TEXT NOT NULL DEFAULT 'did_you_know',
    fact_content TEXT NOT NULL,
    theme TEXT,
    fact_type TEXT,
    word_count INTEGER,
    video_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(video_id) REFERENCES videos(id),
    UNIQUE(niche, fact_content)
);

