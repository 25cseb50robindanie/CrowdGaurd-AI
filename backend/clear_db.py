import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crowdguard.db')

def clear_tables():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for table in ['cameras', 'live_metrics', 'alerts', 'dispatches', 'reviews']:
        cur.execute(f'DELETE FROM {table};')
    conn.commit()
    conn.close()
    print('Runtime tables cleared')

if __name__ == '__main__':
    clear_tables()
