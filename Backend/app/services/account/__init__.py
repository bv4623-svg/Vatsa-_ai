"""Account/Settings-finalization service layer: 2FA, API keys, OAuth
account linking, data export, soft/hard account deletion, history
retention, in-app+email notifications, and session revocation. Import
from here rather than the submodules directly, matching the barrel
pattern used elsewhere in this codebase (see app.services.library).
"""
from app.services.account.twofactor import (
    generate_totp_secret,
    generate_qr_data_uri,
    verify_totp_code,
    generate_backup_codes,
    hash_backup_codes,
    consume_backup_code,
)
from app.services.account.api_keys import generate_api_key, verify_api_key
from app.services.account.connections import create_link_state_token, decode_link_state_token, upsert_connection
from app.services.account.export import build_account_export_zip
from app.services.account.deletion import soft_delete_account, hard_delete_expired_accounts, HARD_DELETE_GRACE_DAYS
from app.services.account.retention import enforce_history_retention
from app.services.account.notify import notify_user, notify_quota_warning
from app.services.account.sessions import sign_out_other_devices
from app.services.account.scheduler_jobs import register_account_jobs

__all__ = [
    "generate_totp_secret", "generate_qr_data_uri", "verify_totp_code",
    "generate_backup_codes", "hash_backup_codes", "consume_backup_code",
    "generate_api_key", "verify_api_key",
    "create_link_state_token", "decode_link_state_token", "upsert_connection",
    "build_account_export_zip",
    "soft_delete_account", "hard_delete_expired_accounts", "HARD_DELETE_GRACE_DAYS",
    "enforce_history_retention",
    "notify_user", "notify_quota_warning",
    "sign_out_other_devices",
    "register_account_jobs",
]
