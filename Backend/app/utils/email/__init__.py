"""Email sending: one real SMTP mechanism (core._send), reused by every
template rather than each feature inventing its own client. Import from
here (app.utils.email) rather than the submodules directly, matching the
barrel pattern used elsewhere in this codebase (see app.services.library).
"""
from app.utils.email.core import _send
from app.utils.email.templates import send_otp_email, send_task_result_email, send_notification_email

__all__ = ["_send", "send_otp_email", "send_task_result_email", "send_notification_email"]
