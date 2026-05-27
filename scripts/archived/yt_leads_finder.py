import requests
import pandas as pd
from datetime import datetime, timedelta
import math
import time
from dotenv import load_dotenv
import os
import re

load_dotenv()

# =============================
# CONFIG
# =============================

API_KEY = os.getenv("API_KEY")
BASE_URL = "https://www.googleapis.com/youtube/v3"

REGION = "US"
RELEVANCE_LANGUAGE = "en"

MAX_SEARCH_PAGES = 10
MAX_CHANNELS_EVALUATED = 250

HEADERS = {"User-Agent": "Mozilla/5.0"}

EMAIL_REGEX = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"

# =============================
# INPUT SECTION
# =============================

print("\n🎯 YouTube Lead Finder (Efficient + High Quality)\n")

KEYWORD = input("Keyword to search: ").strip()
MIN_SUBS = int(input("Minimum subscribers: ").strip())
MAX_SUBS = int(input("Maximum subscribers: ").strip())

MIN_UPLOADS_30D = int(input("Minimum uploads in last 30 days: ").strip())

min_avg_views_input = input("Minimum average views (optional, press Enter to skip): ").strip()
MIN_AVG_VIEWS = int(min_avg_views_input) if min_avg_views_input else 0


# =============================
# EMAIL HELPERS
# =============================

def extract_email(text):

    if not text:
        return None

    matches = re.findall(EMAIL_REGEX, text)

    if matches:
        return matches[0]

    return None


def scrape_website_for_email(url):

    try:
        r = requests.get(url, timeout=5, headers=HEADERS)

        email = extract_email(r.text)

        if email:
            return email

    except:
        return None

    return None


# =============================
# SEARCH CHANNELS
# =============================

def search_channels(keyword):

    all_channels = set()
    next_page_token = None

    for page in range(MAX_SEARCH_PAGES):

        print(f"🔍 Fetching search page {page + 1}")

        params = {
            "part": "snippet",
            "q": keyword,
            "type": "video",
            "order": "date",
            "maxResults": 50,
            "relevanceLanguage": RELEVANCE_LANGUAGE,
            "regionCode": REGION,
            "key": API_KEY
        }

        if next_page_token:
            params["pageToken"] = next_page_token

        res = requests.get(f"{BASE_URL}/search", params=params).json()

        for item in res.get("items", []):
            all_channels.add(item["snippet"]["channelId"])

        next_page_token = res.get("nextPageToken")

        if not next_page_token:
            break

        time.sleep(0.2)

    return list(all_channels)


# =============================
# API HELPERS
# =============================

def get_channel_details_batch(channel_ids):

    channels_data = []

    for i in range(0, len(channel_ids), 50):

        batch = channel_ids[i:i+50]

        params = {
            "part": "statistics,contentDetails,snippet",
            "id": ",".join(batch),
            "key": API_KEY
        }

        res = requests.get(f"{BASE_URL}/channels", params=params).json()

        channels_data.extend(res.get("items", []))

        time.sleep(0.2)

    return channels_data


def get_recent_videos(playlist_id):

    params = {
        "part": "snippet",
        "playlistId": playlist_id,
        "maxResults": 50,
        "key": API_KEY
    }

    res = requests.get(f"{BASE_URL}/playlistItems", params=params).json()

    return res.get("items", [])


def get_video_stats(video_ids):

    if not video_ids:
        return []

    params = {
        "part": "statistics",
        "id": ",".join(video_ids),
        "key": API_KEY
    }

    res = requests.get(f"{BASE_URL}/videos", params=params).json()

    return res.get("items", [])


# =============================
# SOCIAL LINK EXTRACTION
# =============================

def extract_social_links(description):

    website = None
    instagram = None
    twitter = None
    linktree = None

    urls = re.findall(r"(https?://[^\s]+)", description)

    for url in urls:

        if "instagram.com" in url:
            instagram = url

        elif "twitter.com" in url or "x.com" in url:
            twitter = url

        elif "linktr.ee" in url:
            linktree = url

        else:
            website = url

    return website, instagram, twitter, linktree


# =============================
# MAIN LOGIC
# =============================

def run():

    channels = search_channels(KEYWORD)

    print(f"\n🔎 Found {len(channels)} unique channels\n")

    channels = channels[:MAX_CHANNELS_EVALUATED]

    channels_data = get_channel_details_batch(channels)

    leads = []

    for channel in channels_data:

        try:

            subs = int(channel["statistics"].get("subscriberCount", 0))

            if subs < MIN_SUBS or subs > MAX_SUBS:
                continue

            description = channel["snippet"].get("description", "")

            email = extract_email(description)

            website, instagram, twitter, linktree = extract_social_links(description)

            if not email and website:
                email = scrape_website_for_email(website)

            uploads_playlist = channel["contentDetails"]["relatedPlaylists"]["uploads"]

            videos = get_recent_videos(uploads_playlist)

            cutoff = datetime.utcnow() - timedelta(days=30)

            recent_count = 0
            video_ids = []
            last_upload_date = None

            for vid in videos:

                published = datetime.strptime(
                    vid["snippet"]["publishedAt"],
                    "%Y-%m-%dT%H:%M:%SZ"
                )

                if not last_upload_date:
                    last_upload_date = published

                if published > cutoff:
                    recent_count += 1

                video_ids.append(vid["snippet"]["resourceId"]["videoId"])

            if recent_count < MIN_UPLOADS_30D:
                continue

            stats = get_video_stats(video_ids[:10])

            views = [int(v["statistics"].get("viewCount", 0)) for v in stats]

            avg_views = sum(views) / len(views) if views else 0

            if avg_views < MIN_AVG_VIEWS:
                continue

            contact_bonus = 0

            if email:
                contact_bonus += 2
            elif website:
                contact_bonus += 1

            score = (
                recent_count * 3 +
                math.log10(subs) * 2 +
                (avg_views / 10000) +
                contact_bonus
            )

            leads.append({
                "Channel Name": channel["snippet"]["title"],
                "Channel URL": f"https://youtube.com/channel/{channel['id']}",
                "Subscribers": subs,
                "Uploads Last 30d": recent_count,
                "Avg Views (Last 10)": int(avg_views),
                "Last Upload": last_upload_date.strftime("%Y-%m-%d") if last_upload_date else "",
                "Email": email,
                "Website": website,
                "Instagram": instagram,
                "Twitter": twitter,
                "Linktree": linktree,
                "Score": round(score, 2),
                "Status": ""
            })

            print(f"✔ Qualified: {channel['snippet']['title']}")

        except Exception as e:
            print("⚠ Error:", e)

    df = pd.DataFrame(leads)

    if df.empty:
        print("\n❌ No leads matched your filters.")
        return

    df = df.sort_values(by="Score", ascending=False)

    keyword_clean = KEYWORD.replace(" ", "_")

    df_with_email = df[df["Email"].notna() & (df["Email"] != "")]
    df_without_email = df[df["Email"].isna() | (df["Email"] == "")]

    email_file = f"yt_leads_{keyword_clean}_emails.csv"
    no_email_file = f"yt_leads_{keyword_clean}_no_emails.csv"

    df_with_email.to_csv(email_file, index=False)
    df_without_email.to_csv(no_email_file, index=False)

    print(f"\n✅ Leads with emails: {len(df_with_email)} → {email_file}")
    print(f"📭 Leads without emails: {len(df_without_email)} → {no_email_file}")


if __name__ == "__main__":
    run()