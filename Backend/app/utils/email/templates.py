from typing import Optional
from app.utils.email.core import _send


def send_otp_email(to_email: str, otp: str, purpose: str = "signup") -> bool:
    title = "Verify your email" if purpose == "signup" else "Reset your password"
    subject = f"Vatsa AI — {title}"

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;
                background:#0a0a0a;color:#fff;padding:32px;border-radius:16px;">
      <h1 style="color:#10b981;margin:0 0 8px;">Vatsa AI</h1>
      <p style="color:#888;margin:0 0 24px;font-size:13px;">{title}</p>
      <p style="font-size:15px;">Your one-time password is:</p>
      <div style="background:#111;border:1px solid #222;border-radius:12px;
                  padding:20px;text-align:center;margin:20px 0;">
        <span style="font-size:36px;letter-spacing:12px;font-weight:bold;
                     color:#10b981;">{otp}</span>
      </div>
      <p style="color:#888;font-size:13px;">
        This code expires in <b>5 minutes</b>. Don't share it with anyone.
      </p>
      <p style="color:#555;font-size:11px;margin-top:32px;">
        If you didn't request this, ignore this email.
      </p>
    </div>
    """
    return _send(to_email, subject, html)


def send_task_result_email(to_email: str, task_title: str, success: bool, error: Optional[str] = None) -> bool:
    status_text = "completed successfully" if success else "failed"
    subject = f"Vatsa AI — Scheduled task {status_text}: {task_title}"
    detail = f'<p style="color:#ef4444;font-size:13px;">{error}</p>' if error else ""

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;
                background:#0a0a0a;color:#fff;padding:32px;border-radius:16px;">
      <h1 style="color:#10b981;margin:0 0 8px;">Vatsa AI</h1>
      <p style="color:#888;margin:0 0 24px;font-size:13px;">Scheduled task update</p>
      <p style="font-size:15px;">Your scheduled task <b>"{task_title}"</b> {status_text}.</p>
      {detail}
      <p style="color:#555;font-size:11px;margin-top:32px;">
        View the result in your Library at Vatsa AI.
      </p>
    </div>
    """
    return _send(to_email, subject, html)
