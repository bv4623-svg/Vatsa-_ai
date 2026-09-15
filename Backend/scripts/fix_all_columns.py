import sqlite3

DB_NAME = "vatsa.db"  # ✅ असली डेटाबेस फाइल का नाम

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

# पहले चेक करो कि कौन-कौन से कॉलम पहले से मौजूद हैं
cursor.execute("PRAGMA table_info(users)")
existing_columns = [col[1] for col in cursor.fetchall()]
print(f"📋 पहले से मौजूद कॉलम: {existing_columns}")

# सभी संभावित गायब कॉलम (User मॉडल के हिसाब से)
columns_to_add = {
    "birth_month": "INTEGER",
    "birth_year": "INTEGER",
    "profile_completed": "INTEGER DEFAULT 0",
    "settings": "TEXT DEFAULT '{}'",  # JSON स्टोर करने के लिए
}

print("\n🛠️  गायब कॉलम ऐड किए जा रहे हैं...")
for col, col_type in columns_to_add.items():
    if col not in existing_columns:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
            print(f"✅ {col} कॉलम जुड़ गया")
        except Exception as e:
            print(f"⚠️ {col} ऐड करते वक्त एरर: {e}")
    else:
        print(f"ℹ️ {col} पहले से मौजूद है (कोई कार्रवाई नहीं)")

conn.commit()
conn.close()

print("\n🎉 सारे कॉलम चेक कर लिए गए हैं! अब बैकएंड रीस्टार्ट करें।")