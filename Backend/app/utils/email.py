import os
import smtplib
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def _get_config():
    return {
        "host": os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("EMAIL_SMTP_PORT", "587")),
        "user": os.getenv("EMAIL_USERNAME", ""),
        "password": os.getenv("EMAIL_PASSWORD", ""),
        "from_addr": os.getenv("MAIL_FROM", ""),
    }


def _send(to_email: str, subject: str, html_body: str) -> bool:
    cfg = _get_config()

    print(f"\n📧 [EMAIL] Attempting to send to {to_email}", flush=True)
    print(f"   HOST: {cfg['host']}:{cfg['port']}", flush=True)
    print(f"   USER: {cfg['user']}", flush=True)
    print(f"   PASS: {'SET (' + str(len(cfg['password'])) + ' chars)' if cfg['password'] else 'MISSING'}", flush=True)
    print(f"   FROM: {cfg['from_addr']}", flush=True)

    if not cfg["user"] or not cfg["password"]:
        print("⚠️  [EMAIL] SMTP not configured — SKIPPED\n", flush=True)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from_addr"] or cfg["user"]
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        if cfg["port"] == 465:
            print("   → Using SMTP_SSL (port 465)", flush=True)
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15) as server:
                server.login(cfg["user"], cfg["password"])
                server.send_message(msg)
        else:
            print("   → Using STARTTLS (port 587)", flush=True)
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(cfg["user"], cfg["password"])
                server.send_message(msg)

        print(f"✅ [EMAIL] Sent successfully to {to_email}\n", flush=True)
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ [EMAIL] AUTH FAILED — App Password galat ya 2FA off", flush=True)
        print(f"   {e}\n", flush=True)
        return False
    except smtplib.SMTPException as e:
        print(f"❌ [EMAIL] SMTP ERROR: {e}\n", flush=True)
        return False
    except Exception as e:
        print(f"❌ [EMAIL] UNEXPECTED ERROR: {type(e).__name__}: {e}", flush=True)
        traceback.print_exc()
        print("", flush=True)
        return False


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