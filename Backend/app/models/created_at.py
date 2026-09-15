import sqlite3
from datetime import datetime

conn = sqlite3.connect("vatsa.db")
cursor = conn.cursor()

# 1. बिना DEFAULT के कॉलम जोड़ें
try:
    cursor.execute("ALTER TABLE otps ADD COLUMN created_at TIMESTAMP")
    conn.commit()
    print("✅ Column 'created_at' added.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("ℹ️ Column already exists.")
    else:
        print("❌ Error:", e)
        conn.close()
        exit()

# 2. पुराने रिकॉर्ड्स में current timestamp डालें
cursor.execute("UPDATE otps SET created_at = ? WHERE created_at IS NULL", (datetime.utcnow().isoformat(),))
conn.commit()
print("✅ Existing rows updated.")
conn.close()