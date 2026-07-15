import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

# --- GMAIL SMTP CONFIGURATION ---
# IMPORTANT: To send email from Gmail via Python, you cannot use your regular password.
# You must generate a Google "App Password" (16 characters).
# Steps to get an App Password:
# 1. Go to your Google Account: https://myaccount.google.com/
# 2. Search for "App Passwords" or go to Security -> 2-Step Verification -> App Passwords.
# 3. Create an App Password for "Mail" / "Other" (give it a name like "Python Email Test").
# 4. Copy the generated 16-character code (e.g., "abcd efgh ijkl mnop").

SENDER_EMAIL = os.getenv("SENDER_EMAIL", "your_gmail_username@gmail.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "your_16_character_app_password")
RECEIVER_EMAIL = os.getenv("RECEIVER_EMAIL", "your_recipient_email@gmail.com")

def send_test_email():
    if "your_gmail_username" in SENDER_EMAIL or "your_16_character" in SENDER_PASSWORD:
        print("[WARNING] Please edit this file or set environment variables to configure your email settings.")
        print("Required:")
        print(f"  SENDER_EMAIL: {SENDER_EMAIL}")
        print(f"  SENDER_PASSWORD: [REDACTED]")
        print(f"  RECEIVER_EMAIL: {RECEIVER_EMAIL}")
        return

    # Create message
    message = MIMEMultipart()
    message["From"] = SENDER_EMAIL
    message["To"] = RECEIVER_EMAIL
    message["Subject"] = "Test Email from FSL Learning Tool Setup"

    body = """Hello!

This is a test email sent from your Python test script.
Your Gmail SMTP configuration is working successfully!

Best,
FSL Learning Tool Setup Script
"""
    message.attach(MIMEText(body, "plain"))

    try:
        # Gmail SMTP Server settings
        smtp_server = "smtp.gmail.com"
        port = 465 # SSL port
        
        print(f"Connecting to {smtp_server} via SSL (port {port})...")
        server = smtplib.SMTP_SSL(smtp_server, port)
        
        print("Logging in...")
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        
        print("Sending email...")
        server.sendmail(SENDER_EMAIL, RECEIVER_EMAIL, message.as_string())
        
        print("Email sent successfully!")
        server.quit()
        
    except Exception as e:
        print(f"\n[ERROR] Failed to send email. Details:\n{e}")
        print("\nTroubleshooting Tips:")
        print("1. Double-check your 16-character Google App Password (no spaces needed when pasting).")
        print("2. Ensure 2-Step Verification is enabled on your sender Google Account.")
        print("3. Check your internet connection and verify that port 465 is not blocked.")

if __name__ == "__main__":
    send_test_email()
