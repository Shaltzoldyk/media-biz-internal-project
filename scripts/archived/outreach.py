import pandas as pd
import requests
import smtplib
import random
import time
import html
import re
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os

load_dotenv()

# =========================
# CONFIG
# =========================

API_KEY = os.getenv("API_KEY")
EMAIL = os.getenv("EMAIL")
PASSWORD = os.getenv("PASSWORD")

CSV_FILE = "yt_leads_finance_emails.csv"

MAX_EMAILS = 30

subjects = [
    "Scaling output",
    "Quick question",
    "About your editing workflow"
]

# =========================
# LOAD LEADS
# =========================

df = pd.read_csv(CSV_FILE)

# remove rows without email
df = df.dropna(subset=["Email"])

# ensure Status column exists
if "Status" not in df.columns:
    df["Status"] = ""

df["Status"] = df["Status"].astype(str)

# limit number of emails
df = df.head(MAX_EMAILS)

sent_emails = set()

# =========================
# EMAIL TEMPLATE
# =========================

template = """
Hey,

Saw your video "{recent_video}" doing well lately — nice pacing there.

Also noticed you pushed around {uploads} videos in the last 30 days; that’s serious publishing volume.

Quick question: are you still personally managing video edits, revisions, file transfers, and thumbnail iterations… or is that fully systemised?

Most creators at your volume hit workflow bottlenecks before they realise it.

We build backend post-production systems that remove that friction completely.

Worth a quick breakdown on how we’d structure yours?

— Shaltz
"""

# =========================
# CLEAN VIDEO TITLE
# =========================

def clean_title(title):

    title = html.unescape(title)
    title = re.sub(r"#\w+", "", title)
    title = " ".join(title.split())

    return title.strip()

# =========================
# GET CHANNEL ID
# =========================

def get_channel_id(channel_url):

    try:

        if "/channel/" in channel_url:
            return channel_url.split("/channel/")[1].split("/")[0]

    except:
        return None

    return None

# =========================
# GET BEST VIDEO
# =========================

def get_best_video(channel_url):

    try:

        channel_id = get_channel_id(channel_url)

        if not channel_id:
            return "one of your recent videos"

        last_month = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

        search_url = (
            "https://www.googleapis.com/youtube/v3/search?"
            f"key={API_KEY}&channelId={channel_id}"
            "&part=snippet"
            "&type=video"
            "&order=viewCount"
            "&maxResults=1"
            f"&publishedAfter={last_month}"
        )

        r = requests.get(search_url).json()

        if r.get("items"):
            title = r["items"][0]["snippet"]["title"]
            return clean_title(title)

        search_url = (
            "https://www.googleapis.com/youtube/v3/search?"
            f"key={API_KEY}&channelId={channel_id}"
            "&part=snippet"
            "&type=video"
            "&order=viewCount"
            "&maxResults=1"
        )

        r = requests.get(search_url).json()

        if r.get("items"):
            title = r["items"][0]["snippet"]["title"]
            return clean_title(title)

        return "one of your recent videos"

    except Exception as e:

        print("Video lookup error:", e)

        return "one of your recent videos"

# =========================
# CONNECT TO GMAIL
# =========================

server = smtplib.SMTP("smtp.gmail.com", 587)
server.starttls()
server.login(EMAIL, PASSWORD)

print("Connected to Gmail\n")

emails_sent_this_run = 0

# =========================
# SEND EMAILS
# =========================

for index, row in df.iterrows():

    status_value = str(row.get("Status")).strip().lower()

    if status_value in ["sent", "replied"]:
        continue

    name = row["Channel Name"]
    email_addr = str(row["Email"]).strip()
    uploads = row["Uploads Last 30d"]
    channel_url = row["Channel URL"]

    if email_addr in sent_emails:
        continue

    subject = random.choice(subjects)

    best_video = get_best_video(channel_url)

    body = template.format(
        uploads=uploads,
        recent_video=best_video
    )

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = EMAIL
    msg["To"] = email_addr

    try:

        server.sendmail(EMAIL, email_addr, msg.as_string())

        sent_emails.add(email_addr)

        df.at[index, "Status"] = "Sent"

        emails_sent_this_run += 1

        print(f"Email sent to: {name}")

    except Exception as e:

        print("Failed:", email_addr, e)

    delay = random.randint(40, 120)

    print("Waiting", delay, "seconds...\n")

    time.sleep(delay)

# =========================
# SAVE UPDATED CSV
# =========================

df.to_csv(CSV_FILE, index=False)

server.quit()

print(f"\nAll emails completed. {emails_sent_this_run} emails sent.")