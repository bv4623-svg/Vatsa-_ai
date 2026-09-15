import sqlite3
from datetime import datetime

conn = sqlite3.connect("vatsa.db")
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE otps ADD COLUMN created_at TIMESTAMP")
    conn.commit()
    print("✅ Column 'created_at' added successfully.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("ℹ️ Column already exists.")
    else:
        print("❌ Error:", e)
        conn.close()
        exit()

# पुराने रिकॉर्ड्स को अपडेट करें
cursor.execute("UPDATE otps SET created_at = ? WHERE created_at IS NULL", (datetime.utcnow().isoformat(),))
conn.commit()
print("✅ Existing rows updated with current timestamp.")
conn.close()