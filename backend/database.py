import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crowdguard.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create cameras table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        stream_url TEXT NOT NULL,
        stream_label TEXT NOT NULL,
        max_capacity INTEGER NOT NULL DEFAULT 15,
        zone_id TEXT NOT NULL,
        active INTEGER DEFAULT 1
    )
    """)
    
    # 2. Create live_metrics table with composite primary key (camera_id, zone_id)
    cursor.execute("DROP TABLE IF EXISTS live_metrics")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS live_metrics (
        camera_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        zone_id TEXT NOT NULL,
        person_count INTEGER NOT NULL DEFAULT 0,
        density REAL NOT NULL DEFAULT 0.0,
        trend TEXT NOT NULL DEFAULT 'stable',
        rolling_average REAL DEFAULT 0.0,
        growth_rate REAL DEFAULT 0.0,
        sustained_congestion_sec REAL DEFAULT 0.0,
        speed REAL DEFAULT -1.0,
        stagnation_index REAL DEFAULT -1.0,
        average_detection_conf REAL DEFAULT 1.0,
        tracking_stability REAL DEFAULT 1.0,
        PRIMARY KEY (camera_id, zone_id)
    )
    """)
    
    # 3. Create alerts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        zone_id TEXT NOT NULL,
        zone_name TEXT NOT NULL,
        title TEXT NOT NULL,
        risk_level TEXT NOT NULL DEFAULT 'green',
        timestamp TEXT NOT NULL,
        date_time TEXT NOT NULL,
        message TEXT NOT NULL,
        stream_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'NEW',
        congestion TEXT NOT NULL DEFAULT '0%',
        count INTEGER NOT NULL DEFAULT 0,
        prediction TEXT,
        explanation TEXT,
        recommendation TEXT,
        confidence REAL DEFAULT 1.0
    )
    """)
    
    # 4. Create dispatches table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dispatches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        zone TEXT NOT NULL,
        message TEXT NOT NULL,
        zone_id TEXT NOT NULL
    )
    """)
    
    # 5. Create reviews table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_accurate INTEGER NOT NULL,
        notes TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)
    
    conn.commit()
    
    # Database seeding disabled to allow manual clean slate testing.
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
