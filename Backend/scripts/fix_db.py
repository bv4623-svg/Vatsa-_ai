import sqlite3
conn = sqlite3.connect("vatsa.db")
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE users ADD COLUMN birth_month INTEGER")
    print("birth_month added")
except Exception as e:
    print(e)
try:
    cursor.execute("ALTER TABLE users ADD COLUMN birth_year INTEGER")
    print("birth_year added")
except Exception as e:
    print(e)
conn.commit()
conn.close()
print("Done")