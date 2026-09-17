"""Share links: a random unguessable token stored on the item itself, not
a separate signed-URL scheme, so revoking is one column write and listing
"is this shared" needs no join."""
import secrets
from typing import Optional
from sqlalchemy.orm import Session

from app.models.library_item import LibraryItem


def create_share_link(db: Session, item: LibraryItem) -> str:
    if item.share_token:
        return item.share_token
    item.share_token = secrets.token_urlsafe(32)
    db.commit()
    return item.share_token


def revoke_share_link(db: Session, item: LibraryItem) -> None:
    item.share_token = None
    db.commit()


def get_by_share_token(db: Session, token: str) -> Optional[LibraryItem]:
    return db.query(LibraryItem).filter(LibraryItem.share_token == token).first()
