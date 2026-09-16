"""
One-shot cleanup of test users + their conversations + memory.
Run: python -m scripts.cleanup_test_data
Prints what will be deleted, then deletes in a transaction.
"""
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.conversation import Conversation
from app.models.memory import Memory

TEST_PATTERNS = ["%test%@example.com", "%seal-test%", "%ai-test%", "%@test.com"]


def main():
    init_db()  # ensures every model is registered before querying (see app/database.py)
    db = SessionLocal()
    try:
        users = []
        for pat in TEST_PATTERNS:
            users.extend(db.query(User).filter(User.email.like(pat)).all())
        # dedupe
        users = list({u.id: u for u in users}.values())

        if not users:
            print("No test users found.")
            return

        print(f"Found {len(users)} test user(s):")
        for u in users:
            conv_count = db.query(Conversation).filter(Conversation.user_id == u.id).count()
            mem_count = db.query(Memory).filter(Memory.user_id == u.id).count()
            print(f"  - {u.email} (id={u.id}, {conv_count} convs, {mem_count} memories)")

        confirm = input("\nDelete all of the above? [y/N]: ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return

        for u in users:
            db.query(Conversation).filter(Conversation.user_id == u.id).delete()
            db.query(Memory).filter(Memory.user_id == u.id).delete()
            db.delete(u)
        db.commit()
        print(f"Deleted {len(users)} test user(s) and their data.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
