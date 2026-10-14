"""
Kontoverwaltung für das Siedler-Browserspiel.

Nur Standardbibliothek:
- SQLite
- PBKDF2-HMAC-SHA256 für Passwort-Hashes
- zufällige, gehashte E-Mail-Verifizierungs- und Sitzungstoken
- SMTP mit TLS für Bestätigungs-E-Mails

SMTP-Konfiguration über Umgebungsvariablen:
  SMTP_HOST
  SMTP_PORT                 (Standard: 587)
  SMTP_USERNAME
  SMTP_PASSWORD
  SMTP_FROM                 (Standard: SMTP_USERNAME)
  SMTP_USE_SSL              ("1" für implizites TLS, z. B. Port 465)
  APP_BASE_URL              öffentliche HTTPS-Adresse der Spielseite,
                            z. B. https://spiel.example.de

Die Bestätigungs-E-Mail verlinkt auf:
  APP_BASE_URL/?verify=TOKEN

app.js wird später so erweitert, dass es diesen Token an den WebSocket-Server
sendet und danach den Parameter aus der URL entfernt.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import time
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "accounts.db"

SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
VERIFY_TTL_SECONDS = 24 * 60 * 60
PBKDF2_ITERATIONS = 600_000
USERNAME_RE = re.compile(r"^[\w-]{3,20}$", re.UNICODE)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Erstellt Tabellen, falls sie noch nicht existieren."""
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                email_verified INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                token_hash TEXT PRIMARY KEY,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS account_stats (
                account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
                games_played INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                total_victory_points INTEGER NOT NULL DEFAULT 0,
                last_played_at INTEGER
            );
            """
        )


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def _check_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds_text, salt_hex, digest_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(rounds_text)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, rounds
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _send_verification_email(email: str, username: str, token: str) -> None:
    host = os.environ.get("SMTP_HOST", "").strip()
    username_smtp = os.environ.get("SMTP_USERNAME", "").strip()
    password_smtp = os.environ.get("SMTP_PASSWORD", "")
    from_address = os.environ.get("SMTP_FROM", username_smtp).strip()
    app_base_url = os.environ.get("APP_BASE_URL", "").strip().rstrip("/")
    port = int(os.environ.get("SMTP_PORT", "587"))
    use_ssl = os.environ.get("SMTP_USE_SSL", "0") == "1"

    if not host or not username_smtp or not password_smtp or not from_address:
        raise RuntimeError(
            "E-Mail-Versand ist noch nicht konfiguriert. "
            "SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD und SMTP_FROM setzen."
        )
    if not app_base_url.startswith("https://"):
        raise RuntimeError(
            "APP_BASE_URL muss für die E-Mail-Bestätigung eine HTTPS-Adresse sein."
        )

    query = urlencode({"verify": token})
    verify_url = f"{app_base_url}/?{query}"

    message = EmailMessage()
    message["Subject"] = "COACHING – E-Mail-Adresse bestätigen"
    message["From"] = from_address
    message["To"] = email
    message.set_content(
        f"Hallo {username},\n\n"
        "bitte bestätige deine E-Mail-Adresse über diesen Link:\n\n"
        f"{verify_url}\n\n"
        "Der Link ist 24 Stunden gültig. Falls du dich nicht registriert hast, "
        "kannst du diese E-Mail ignorieren.\n"
    )

    context = ssl.create_default_context()
    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as smtp:
            smtp.login(username_smtp, password_smtp)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(username_smtp, password_smtp)
            smtp.send_message(message)


def register_account(username: str, email: str, password: str) -> dict:
    """
    Legt ein unbestätigtes Konto an und versendet die Bestätigungs-E-Mail.

    Rückgabe:
      {"ok": True, "message": "..."}
      {"ok": False, "error": "..."}
    """
    init_db()
    username = username.strip() if isinstance(username, str) else ""
    email = email.strip().lower() if isinstance(email, str) else ""

    if not USERNAME_RE.fullmatch(username):
        return {
            "ok": False,
            "error": "Der Username muss 3–20 Zeichen lang sein und darf Buchstaben, "
                     "Ziffern, Unterstriche und Bindestriche enthalten.",
        }
    if len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return {"ok": False, "error": "Bitte gib eine gültige E-Mail-Adresse ein."}
    if not isinstance(password, str) or len(password) < 10 or len(password) > 128:
        return {"ok": False, "error": "Das Passwort muss 10–128 Zeichen lang sein."}

    token = secrets.token_urlsafe(32)
    now = int(time.time())

    try:
        with _connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO accounts
                    (username, email, password_hash, email_verified, created_at)
                VALUES (?, ?, ?, 0, ?)
                """,
                (username, email, _password_hash(password), now),
            )
            account_id = cursor.lastrowid
            conn.execute(
                "INSERT INTO account_stats (account_id) VALUES (?)",
                (account_id,),
            )
            conn.execute(
                """
                INSERT INTO email_verification_tokens
                    (token_hash, account_id, expires_at)
                VALUES (?, ?, ?)
                """,
                (_token_hash(token), account_id, now + VERIFY_TTL_SECONDS),
            )
    except sqlite3.IntegrityError:
        return {
            "ok": False,
            "error": "Dieser Username oder diese E-Mail-Adresse ist bereits vergeben.",
        }

    try:
        _send_verification_email(email, username, token)
    except Exception as exc:
        # Konto und Token bleiben bestehen, damit wir später eine erneute
        # Bestätigungs-E-Mail anbieten können. Keine SMTP-Details an Clients geben.
        print(f"[accounts] Bestätigungs-E-Mail konnte nicht gesendet werden: {exc}")
        return {
            "ok": False,
            "error": "Konto wurde angelegt, aber die Bestätigungs-E-Mail konnte "
                     "nicht gesendet werden. SMTP-Konfiguration prüfen.",
        }

    return {
        "ok": True,
        "message": "Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.",
    }


def verify_email(token: str) -> dict:
    """Verifiziert ein Konto mit einem einmalig nutzbaren, ablaufenden Token."""
    init_db()
    if not isinstance(token, str) or not token or len(token) > 256:
        return {"ok": False, "error": "Ungültiger Bestätigungslink."}

    token_digest = _token_hash(token)
    now = int(time.time())
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT account_id, expires_at
            FROM email_verification_tokens
            WHERE token_hash = ?
            """,
            (token_digest,),
        ).fetchone()

        if row is None or row["expires_at"] < now:
            conn.execute(
                "DELETE FROM email_verification_tokens WHERE token_hash = ?",
                (token_digest,),
            )
            return {
                "ok": False,
                "error": "Der Bestätigungslink ist ungültig oder abgelaufen.",
            }

        conn.execute(
            "UPDATE accounts SET email_verified = 1 WHERE id = ?",
            (row["account_id"],),
        )
        conn.execute(
            "DELETE FROM email_verification_tokens WHERE token_hash = ?",
            (token_digest,),
        )

    return {"ok": True, "message": "E-Mail-Adresse erfolgreich bestätigt. Du kannst dich jetzt anmelden."}


def login(username: str, password: str) -> dict:
    """Prüft Username/Passwort und erzeugt eine Sitzung nur für bestätigte Konten."""
    init_db()
    username = username.strip() if isinstance(username, str) else ""
    if not isinstance(password, str) or not username:
        return {"ok": False, "error": "Username oder Passwort ist falsch."}

    with _connect() as conn:
        account = conn.execute(
            """
            SELECT id, username, password_hash, email_verified
            FROM accounts
            WHERE username = ? COLLATE NOCASE
            """,
            (username,),
        ).fetchone()

        if account is None or not _check_password(password, account["password_hash"]):
            return {"ok": False, "error": "Username oder Passwort ist falsch."}
        if not account["email_verified"]:
            return {"ok": False, "error": "Bitte bestätige zuerst deine E-Mail-Adresse."}

        raw_token = secrets.token_urlsafe(32)
        now = int(time.time())
        conn.execute(
            "DELETE FROM sessions WHERE expires_at < ?",
            (now,),
        )
        conn.execute(
            """
            INSERT INTO sessions (token_hash, account_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (_token_hash(raw_token), account["id"], now + SESSION_TTL_SECONDS, now),
        )

    return {
        "ok": True,
        "token": raw_token,
        "account_id": account["id"],
        "username": account["username"],
    }


def validate_session(token: str) -> dict | None:
    """Liefert die Kontodaten einer gültigen Sitzung oder None."""
    init_db()
    if not isinstance(token, str) or not token or len(token) > 256:
        return None

    now = int(time.time())
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT a.id, a.username, a.email_verified, s.expires_at
            FROM sessions s
            JOIN accounts a ON a.id = s.account_id
            WHERE s.token_hash = ?
            """,
            (_token_hash(token),),
        ).fetchone()

        if row is None:
            return None
        if row["expires_at"] < now or not row["email_verified"]:
            conn.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (_token_hash(token),),
            )
            return None

        return {
            "account_id": row["id"],
            "username": row["username"],
        }


def logout(token: str) -> None:
    """Widerruft eine Sitzung serverseitig."""
    if not isinstance(token, str) or not token:
        return
    init_db()
    with _connect() as conn:
        conn.execute(
            "DELETE FROM sessions WHERE token_hash = ?",
            (_token_hash(token),),
        )


def get_stats(account_id: int) -> dict:
    """Liefert dauerhaft gespeicherte Statistiken eines Kontos."""
    init_db()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT games_played, wins, losses, total_victory_points, last_played_at
            FROM account_stats WHERE account_id = ?
            """,
            (account_id,),
        ).fetchone()

    if row is None:
        return {
            "games_played": 0, "wins": 0, "losses": 0,
            "total_victory_points": 0, "last_played_at": None,
        }
    return dict(row)


def record_game_result(account_id: int, won: bool, victory_points: int = 0) -> None:
    """Speichert genau ein Spielergebnis; der Aufrufer muss Duplikate verhindern."""
    init_db()
    now = int(time.time())
    victory_points = max(0, min(int(victory_points), 100))
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO account_stats
                (account_id, games_played, wins, losses, total_victory_points, last_played_at)
            VALUES (?, 1, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                games_played = games_played + 1,
                wins = wins + excluded.wins,
                losses = losses + excluded.losses,
                total_victory_points = total_victory_points + excluded.total_victory_points,
                last_played_at = excluded.last_played_at
            """,
            (
                account_id,
                1 if won else 0,
                0 if won else 1,
                victory_points,
                now,
            ),
        )
