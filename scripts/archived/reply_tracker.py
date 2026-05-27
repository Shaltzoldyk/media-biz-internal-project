import imaplib
import email
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

# =========================
# CONFIG
# =========================

EMAIL = os.getenv("EMAIL")
PASSWORD = os.getenv("PASSWORD")

CSV_FILE = "yt_leads_finance_emails.csv"

# =========================
# CONNECT TO GMAIL
# =========================

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(EMAIL, PASSWORD)

df = pd.read_csv(CSV_FILE)

# ensure Status column exists
if "Status" not in df.columns:
    df["Status"] = ""

df["Status"] = df["Status"].astype(str)

print("Starting reply check...\n")

# =========================
# CHECK EACH EMAIL
# =========================

for index, row in df.iterrows():

    lead_email = str(row.get("Email", "")).strip().lower()

    if lead_email == "" or lead_email == "nan":
        continue

    print(f"{lead_email} - checking")

    # ---------------------
    # Check replies (Inbox)
    # ---------------------

    mail.select("inbox")

    status, messages = mail.search(None, f'(FROM "{lead_email}")')

    if messages[0]:

        ids = messages[0].split()

        if len(ids) > 0:

            df.at[index, "Status"] = "Replied"

            print(f"{lead_email} - replied")

            continue

    # ---------------------
    # Check sent emails
    # ---------------------

    mail.select('"[Gmail]/Sent Mail"')

    status, messages = mail.search(None, f'(TO "{lead_email}")')

    if messages[0]:

        ids = messages[0].split()

        if len(ids) > 0:

            status_value = str(df.at[index, "Status"]).strip().lower()

            if status_value == "" or status_value == "nan":

                df.at[index, "Status"] = "Sent"

                print(f"{lead_email} - sent detected")

    print(f"{lead_email} - checked\n")

# =========================
# SAVE FILE
# =========================

df.to_csv(CSV_FILE, index=False)

mail.logout()

print("Reply tracking complete.")