import sqlite3
import re

DB = "vatsa.db"

def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # 1. Rename old table
    cur.execute("ALTER TABLE otps RENAME TO otps_old")
    print("✅ Renamed otps to otps_old")

    # 2. Create new table with correct schema (no `code` column)
    cur.execute("""
        CREATE TABLE otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            purpose TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            is_verified BOOLEAN DEFAULT 0,
            is_used BOOLEAN DEFAULT 0,
            attempts INTEGER DEFAULT 0,
            resend_count INTEGER DEFAULT 0,
            verification_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✅ Created new otps table (without `code` column)")

    # 3. Copy data from old to new (map old `code` to new `code_hash`)
    #    If old `code` had plain text, we'll keep it as is; but new model expects hash.
    #    We'll put the old code into code_hash (it will still work for old records
    #    if they were plain, but new ones will be hashed. Alternatively, we can set
    #    code_hash = NULL for old records, but NOT NULL constraint, so we set to empty string.
    #    To be safe, we copy old code to code_hash.
    cur.execute("""
        INSERT INTO otps (
            id, email, code_hash, purpose, expires_at,
            is_verified, is_used, attempts, resend_count,
            verification_token, created_at, updated_at
        )
        SELECT
            id, email, code, purpose, expires_at,
            is_verified, is_used, attempts, resend_count,
            verification_token, created_at, updated_at
        FROM otps_old
    """)
    print("✅ Copied data from otps_old to new otps")

    # 4. Drop old table
    cur.execute("DROP TABLE otps_old")
    print("✅ Dropped old table otps_old")

    conn.commit()
    conn.close()
    print("🎉 Migration complete! Your otps table is now compatible with the new model.")

if __name__ == "__main__":
    main()