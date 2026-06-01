#!/usr/bin/env python3

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://shchen0603.github.io/Personal-Website"
BASE_PAGES = [
    "",
    "research.html",
    "publications.html",
    "honors.html",
    "activities.html",
    "blog.html",
    "contact.html",
]
ALLOWED_RAW_ASSETS = {"assets/cardiovascular-epidemiology-hero-og.jpg"}
RAW_IMAGE_PATTERN = re.compile(r"\.(jpe?g|png|heic|heif|tiff?)$", re.I)

errors: list[str] = []
warnings: list[str] = []


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def write_text(relative_path: str, value: str) -> None:
    target = ROOT / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(value, encoding="utf-8")


def as_list(value):
    return value if isinstance(value, list) else []


def escape(value="") -> str:
    return html.escape(str(value), quote=True)


def render_text_with_breaks(value="") -> str:
    return escape(value).replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")


MARKDOWN_IMAGE_PATTERN = re.compile(r'^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$')


def is_safe_markdown_image_src(value="") -> bool:
    src = str(value or "").strip()
    return bool(src) and (not re.match(r"^[a-z][a-z0-9+.-]*:", src, re.I) or is_remote_url(src))


def render_inline_markdown(value="") -> str:
    output = escape(value)
    output = re.sub(r"`([^`]+)`", r"<code>\1</code>", output)
    output = re.sub(
        r"(^|[^!])\[([^\]]+)\]((?:\(https?://[^)\s]+\)|\(mailto:[^)\s]+\)))",
        lambda match: f'{match.group(1)}<a href="{match.group(3)[1:-1]}" rel="noreferrer">{match.group(2)}</a>',
        output,
    )
    output = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", output)
    output = re.sub(r"(^|[^*])\*([^*\n]+)\*", r"\1<em>\2</em>", output)
    return output


def render_markdown_image(src="", alt="", caption="") -> str:
    clean_src = str(src or "").strip()
    if not is_safe_markdown_image_src(clean_src):
        return ""
    caption_html = f"<figcaption>{render_inline_markdown(caption)}</figcaption>" if caption else ""
    return (
        '<figure class="article-inline-image">'
        f'<img src="{escape(nested_asset(clean_src))}" alt="{escape(alt)}" loading="lazy" decoding="async">'
        f"{caption_html}</figure>"
    )


def render_markdown_block(value="") -> str:
    lines = str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    output: list[str] = []
    paragraph: list[str] = []
    list_type: str | None = None
    list_items: list[str] = []
    quote_lines: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            output.append(f"<p>{'<br>'.join(render_inline_markdown(line) for line in paragraph)}</p>")
            paragraph = []

    def flush_list() -> None:
        nonlocal list_type, list_items
        if list_type and list_items:
            items = "".join(f"<li>{render_inline_markdown(item)}</li>" for item in list_items)
            output.append(f"<{list_type}>{items}</{list_type}>")
        list_type = None
        list_items = []

    def flush_quote() -> None:
        nonlocal quote_lines
        if quote_lines:
            output.append(f"<blockquote><p>{'<br>'.join(render_inline_markdown(line) for line in quote_lines)}</p></blockquote>")
            quote_lines = []

    def flush_all() -> None:
        flush_paragraph()
        flush_list()
        flush_quote()

    for line in lines:
        if not line.strip():
            flush_all()
            continue

        image = MARKDOWN_IMAGE_PATTERN.match(line.strip())
        if image:
            flush_all()
            output.append(render_markdown_image(image.group(2), image.group(1), image.group(3) or ""))
            continue

        heading = re.match(r"^(#{2,4})\s+(.+)$", line)
        if heading:
            flush_all()
            level = len(heading.group(1))
            text = re.sub(r"\s+#+\s*$", "", heading.group(2)).strip()
            output.append(f"<h{level}>{render_inline_markdown(text)}</h{level}>")
            continue

        unordered = re.match(r"^\s*[-*]\s+(.+)$", line)
        ordered = re.match(r"^\s*\d+\.\s+(.+)$", line)
        if unordered or ordered:
            current_type = "ul" if unordered else "ol"
            flush_paragraph()
            flush_quote()
            if list_type != current_type:
                flush_list()
                list_type = current_type
            list_items.append((unordered or ordered).group(1))
            continue

        quote_match = re.match(r"^\s*>\s?(.*)$", line)
        if quote_match:
            flush_paragraph()
            flush_list()
            quote_lines.append(quote_match.group(1))
            continue

        flush_list()
        flush_quote()
        paragraph.append(line)

    flush_all()
    return "".join(output)


def is_remote_url(value: str) -> bool:
    return bool(re.match(r"^https?://", str(value or ""), re.I))


def is_mailto(value: str) -> bool:
    return bool(re.match(r"^mailto:", str(value or ""), re.I))


def is_valid_url(value: str) -> bool:
    if not value:
        return True
    parsed = urlparse(str(value))
    return parsed.scheme in {"http", "https", "mailto"} and bool(parsed.scheme)


def is_valid_date(value: str) -> bool:
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(value or "")):
        return False
    try:
        dt.date.fromisoformat(str(value))
        return True
    except ValueError:
        return False


def is_year(value: str) -> bool:
    return bool(re.match(r"^\d{4}(?:-\d{4})?$", str(value or "")))


def add_error(message: str) -> None:
    errors.append(message)


def add_warning(message: str) -> None:
    warnings.append(message)


def local_asset_path(value: str) -> str:
    if not value or is_remote_url(value) or is_mailto(value) or str(value).startswith("#"):
        return ""
    return str(value).lstrip("/").split("#", 1)[0].split("?", 1)[0]


def check_required_string(value, label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        add_error(f"{label} is required.")


def check_date(value, label: str) -> None:
    if value and not is_valid_date(value):
        add_error(f"{label} should use YYYY-MM-DD.")


def check_year(value, label: str) -> None:
    if value and not is_year(value):
        add_error(f"{label} should use YYYY or YYYY-YYYY.")


def check_url(value, label: str) -> None:
    if value and not is_valid_url(value):
        add_error(f"{label} should be a valid http(s) or mailto URL.")


def check_local_asset(value, label: str) -> None:
    relative_path = local_asset_path(value)
    if relative_path and not (ROOT / relative_path).exists():
        add_error(f"{label} points to missing file: {relative_path}")


def markdown_image_sources(value="") -> list[str]:
    sources: list[str] = []
    for line in str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        image = MARKDOWN_IMAGE_PATTERN.match(line.strip())
        if image:
            sources.append(image.group(2))
    return sources


def check_unique_ids(items, label: str) -> None:
    seen: set[str] = set()
    for index, item in enumerate(as_list(items)):
        item_id = item.get("id") if isinstance(item, dict) else ""
        if not item_id:
            add_error(f"{label}[{index}] is missing id.")
            continue
        if item_id in seen:
            add_error(f"{label} has duplicate id: {item_id}")
        seen.add(item_id)


def blog_path(post: dict) -> str:
    return f"posts/{quote(str(post['id']))}.html"


def activity_path(activity: dict) -> str:
    return f"activities/{quote(str(activity['id']))}.html"


def site_url(relative_path: str) -> str:
    return f"{SITE_ORIGIN}/{relative_path}" if relative_path else f"{SITE_ORIGIN}/"


def nested_asset(value: str) -> str:
    return value if is_remote_url(value) else f"../{str(value).lstrip('/')}"


def absolute_asset_url(value: str) -> str:
    return value if is_remote_url(value) else site_url(str(value).lstrip("/"))


def activity_date_label(activity: dict) -> str:
    return activity.get("dateLabel") or activity.get("date") or activity.get("year") or ""


def activity_images(activity: dict) -> list[dict]:
    gallery = [
        {
            "src": image.get("src", ""),
            "alt": image.get("alt") or activity.get("imageAlt") or activity.get("title") or "Activity photo",
            "caption": image.get("caption") or "",
        }
        for image in as_list(activity.get("images"))
        if isinstance(image, dict) and image.get("src")
    ]
    if gallery:
        return gallery
    if activity.get("image"):
        return [{
            "src": activity["image"],
            "alt": activity.get("imageAlt") or activity.get("title") or "Activity photo",
            "caption": "",
        }]
    return []


def activity_body(activity: dict) -> list[str]:
    body = [part for part in as_list(activity.get("body")) if part]
    return body or ([activity["summary"]] if activity.get("summary") else [])


def build_blog_post_html(post: dict) -> str:
    title = post.get("title") or "Blog Post"
    excerpt = post.get("excerpt") or "Research notes and essays on cardiovascular epidemiology, medicine, and public health."
    canonical = site_url(blog_path(post))
    og_image = absolute_asset_url(post["image"]) if post.get("image") else site_url("assets/cardiovascular-epidemiology-hero-og.jpg")
    tags = [tag.get("label") or tag.get("slug") for tag in as_list(post.get("tags")) if isinstance(tag, dict) and (tag.get("label") or tag.get("slug"))]
    series = post.get("series") if isinstance(post.get("series"), dict) else {}
    series_label = series.get("label") or series.get("slug") or ""
    taxonomy_labels = [label for label in [series_label, *tags] if label]
    tag_spans = "".join(f'<span class="tag-button tag-static">{escape(tag)}</span>' for tag in taxonomy_labels)
    tags_html = f'<div class="post-tags" aria-label="文章系列與標籤">{tag_spans}</div>' if taxonomy_labels else ""
    hero_image = (
        f'<img class="article-image" src="{escape(nested_asset(post["image"]))}" alt="{escape(post.get("imageAlt") or title)}" loading="lazy" decoding="async">'
        if post.get("image") else ""
    )
    body = "".join(render_markdown_block(part) for part in as_list(post.get("body")))
    json_ld_data = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "description": excerpt,
        "datePublished": post.get("date") or "",
        "image": og_image,
        "url": canonical,
        "mainEntityOfPage": canonical,
        "author": {"@type": "Person", "name": "Szu-Han Chen", "url": f"{SITE_ORIGIN}/"},
        "publisher": {"@type": "Person", "name": "Szu-Han Chen", "url": f"{SITE_ORIGIN}/"},
        "keywords": ", ".join(taxonomy_labels),
    }
    if series_label:
        json_ld_data["articleSection"] = series_label
    json_ld = json.dumps(json_ld_data, ensure_ascii=False)

    return f"""<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{escape(title)} | 陳思翰 Szu-Han Chen</title>
    <meta name="description" content="{escape(excerpt)}">
    <link rel="canonical" href="{escape(canonical)}">
    <meta property="og:title" content="{escape(title)} | 陳思翰 Szu-Han Chen">
    <meta property="og:description" content="{escape(excerpt)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{escape(canonical)}">
    <meta property="og:image" content="{escape(og_image)}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Noto+Sans+TC:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">{json_ld}</script>
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token":"a8f57387064d4f27b1ba086354d6ac5f"}}'></script>
    <!-- End Cloudflare Web Analytics -->
    <script>(function(){{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){{document.documentElement.setAttribute("data-theme","dark")}}}})();</script>
  </head>
  <body data-page="blog" data-base-path="../">
    <a class="skip-link" href="#main">跳到主要內容</a>

    <header class="site-header" data-header></header>

    <main id="main">
      <article class="article">
        <header class="article-header">
          <a class="back-link" href="../blog.html">Back to Blog</a>
          <p class="post-category">{escape(post.get("dateLabel") or post.get("date") or "")}</p>
          <h1>{escape(title)}</h1>
          <p class="article-dek">{escape(excerpt)}</p>
          {tags_html}
        </header>
        <div class="article-body">
          {hero_image}
          {body}
        </div>
      </article>
    </main>

    <footer class="site-footer" data-footer></footer>

    <button class="back-to-top" data-back-to-top aria-label="回到頂部" title="回到頂部">↑</button>

    <script src="../site-config.js"></script>
    <script src="../script.js"></script>
  </body>
</html>
"""


def build_activity_html(activity: dict) -> str:
    title = activity.get("title") or "Activity"
    summary = activity.get("summary") or activity.get("meta") or "Activity notes by Szu-Han Chen."
    canonical = site_url(activity_path(activity))
    og_image = absolute_asset_url(activity["image"]) if activity.get("image") else site_url("assets/cardiovascular-epidemiology-hero-og.jpg")
    date_label = activity_date_label(activity)
    meta = activity.get("meta") or date_label or "Activity"
    compact_meta = meta
    if date_label and activity.get("year") and meta.startswith(f'{activity["year"]} · '):
        compact_meta = meta[len(f'{activity["year"]} · '):]
    body = "".join(
        render_markdown_block(part) if re.match(r"^[#>]", str(part).strip()) else f"<p>{render_text_with_breaks(part)}</p>"
        for part in activity_body(activity)
    )
    gallery = activity_images(activity)
    gallery_html = (
        """
      <div class="article-gallery" aria-label="活動照片">
        """
        + "".join(
            f"""
          <figure>
            <img src="{escape(nested_asset(image["src"]))}" alt="{escape(image.get("alt") or title)}" loading="lazy" decoding="async">
            {f'<figcaption>{escape(image.get("caption"))}</figcaption>' if image.get("caption") else ""}
          </figure>
        """
            for image in gallery
        )
        + """
      </div>
    """
        if gallery else ""
    )
    json_ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": summary,
        "datePublished": activity.get("date") or activity.get("year") or "",
        "image": og_image,
        "url": canonical,
        "mainEntityOfPage": canonical,
        "author": {"@type": "Person", "name": "Szu-Han Chen", "url": f"{SITE_ORIGIN}/"},
    }, ensure_ascii=False)

    return f"""<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{escape(title)} | Activities | 陳思翰 Szu-Han Chen</title>
    <meta name="description" content="{escape(summary)}">
    <link rel="canonical" href="{escape(canonical)}">
    <meta property="og:title" content="{escape(title)} | Activities | 陳思翰 Szu-Han Chen">
    <meta property="og:description" content="{escape(summary)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{escape(canonical)}">
    <meta property="og:image" content="{escape(og_image)}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Noto+Sans+TC:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">{json_ld}</script>
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token":"a8f57387064d4f27b1ba086354d6ac5f"}}'></script>
    <!-- End Cloudflare Web Analytics -->
    <script>(function(){{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){{document.documentElement.setAttribute("data-theme","dark")}}}})();</script>
  </head>
  <body data-page="activities" data-base-path="../">
    <a class="skip-link" href="#main">跳到主要內容</a>

    <header class="site-header" data-header></header>

    <main id="main">
      <article class="article">
        <header class="article-header">
          <a class="back-link" href="../activities.html">Back to Activities</a>
          <p class="post-category">{escape(f"{date_label} · {compact_meta}" if date_label else compact_meta)}</p>
          <h1>{escape(title)}</h1>
          <p class="article-dek">{render_text_with_breaks(summary)}</p>
        </header>
        <div class="article-body">
          {body}
          {gallery_html}
        </div>
      </article>
    </main>

    <footer class="site-footer" data-footer></footer>

    <button class="back-to-top" data-back-to-top aria-label="回到頂部" title="回到頂部">↑</button>

    <script src="../site-config.js"></script>
    <script src="../script.js"></script>
  </body>
</html>
"""


def build_sitemap_xml(content: dict) -> str:
    today = dt.date.today().isoformat()
    urls = list(BASE_PAGES)
    urls.extend(blog_path(post) for post in as_list(content.get("blogPosts")) if post.get("status") != "draft" and post.get("id"))
    urls.extend(activity_path(activity) for activity in as_list(content.get("activities")) if activity.get("id"))
    entries = "\n".join(
        f"  <url>\n    <loc>{site_url(url).replace('&', '&amp;')}</loc>\n    <lastmod>{today}</lastmod>\n  </url>"
        for url in urls
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}\n</urlset>\n'


def generate_static_files(content: dict) -> None:
    write_text("sitemap.xml", build_sitemap_xml(content))
    for post in as_list(content.get("blogPosts")):
        if post.get("status") != "draft" and post.get("id"):
            write_text(blog_path(post), build_blog_post_html(post))
    for activity in as_list(content.get("activities")):
        if activity.get("id"):
            write_text(activity_path(activity), build_activity_html(activity))


def check_content(content: dict) -> None:
    if not isinstance(content.get("homeHighlights"), list):
        add_error("homeHighlights should be an array.")
    for index, highlight in enumerate(as_list(content.get("homeHighlights"))):
        check_required_string(highlight.get("title"), f"homeHighlights[{index}].title")
        check_required_string(highlight.get("description"), f"homeHighlights[{index}].description")
        check_url(highlight.get("href"), f"homeHighlights[{index}].href")

    for key in ["blogTagOptions", "blogSeriesOptions"]:
        if not isinstance(content.get(key), list):
            add_error(f"{key} should be an array.")
        for index, option in enumerate(as_list(content.get(key))):
            check_required_string(option.get("slug"), f"{key}[{index}].slug")
            check_required_string(option.get("label"), f"{key}[{index}].label")

    if not isinstance(content.get("publications"), list):
        add_error("publications should be an array.")
    for index, publication in enumerate(as_list(content.get("publications"))):
        check_year(publication.get("year"), f"publications[{index}].year")
        check_required_string(publication.get("title"), f"publications[{index}].title")
        check_required_string(publication.get("authors"), f"publications[{index}].authors")
        check_required_string(publication.get("venue"), f"publications[{index}].venue")
        check_url(publication.get("doi"), f"publications[{index}].doi")
        for tag_index, tag in enumerate(as_list(publication.get("tags"))):
            check_required_string(tag.get("slug"), f"publications[{index}].tags[{tag_index}].slug")
            check_required_string(tag.get("label"), f"publications[{index}].tags[{tag_index}].label")
    if sum(1 for publication in as_list(content.get("publications")) if publication.get("featured")) > 1:
        add_warning("More than one publication is marked featured. The research page uses the first one.")

    honors = content.get("honors") or {}
    for key in ["awards", "talks", "presentations", "mediaCoverage", "services"]:
        if not isinstance(honors.get(key), list):
            add_error(f"honors.{key} should be an array.")
    for key in ["awards", "talks", "presentations", "mediaCoverage"]:
        for index, item in enumerate(as_list(honors.get(key))):
            check_required_string(item.get("title"), f"honors.{key}[{index}].title")
            check_year(item.get("year"), f"honors.{key}[{index}].year")
            check_date(item.get("date"), f"honors.{key}[{index}].date")
            for link_index, link in enumerate(as_list(item.get("links"))):
                check_required_string(link.get("label"), f"honors.{key}[{index}].links[{link_index}].label")
                check_url(link.get("href"), f"honors.{key}[{index}].links[{link_index}].href")
    for index, service in enumerate(as_list(honors.get("services"))):
        check_required_string(service.get("title"), f"honors.services[{index}].title")

    check_unique_ids(content.get("blogPosts"), "blogPosts")
    for index, post in enumerate(as_list(content.get("blogPosts"))):
        check_required_string(post.get("title"), f"blogPosts[{index}].title")
        check_required_string(post.get("excerpt"), f"blogPosts[{index}].excerpt")
        check_date(post.get("date"), f"blogPosts[{index}].date")
        if post.get("status") not in {"published", "draft"}:
            add_error(f"blogPosts[{index}].status should be published or draft.")
        if not as_list(post.get("body")):
            add_error(f"blogPosts[{index}].body should have at least one paragraph.")
        check_local_asset(post.get("image"), f"blogPosts[{index}].image")
        for body_index, body_part in enumerate(as_list(post.get("body"))):
            for image_index, image_src in enumerate(markdown_image_sources(body_part)):
                check_local_asset(image_src, f"blogPosts[{index}].body[{body_index}].images[{image_index}]")
        for tag_index, tag in enumerate(as_list(post.get("tags"))):
            check_required_string(tag.get("slug"), f"blogPosts[{index}].tags[{tag_index}].slug")
            check_required_string(tag.get("label"), f"blogPosts[{index}].tags[{tag_index}].label")
        if post.get("series"):
            series = post.get("series")
            if not isinstance(series, dict):
                add_error(f"blogPosts[{index}].series should be an object.")
            else:
                check_required_string(series.get("slug"), f"blogPosts[{index}].series.slug")
                check_required_string(series.get("label"), f"blogPosts[{index}].series.label")

    check_unique_ids(content.get("activities"), "activities")
    for index, activity in enumerate(as_list(content.get("activities"))):
        check_required_string(activity.get("title"), f"activities[{index}].title")
        check_required_string(activity.get("summary"), f"activities[{index}].summary")
        check_date(activity.get("date"), f"activities[{index}].date")
        check_year(activity.get("year"), f"activities[{index}].year")
        check_local_asset(activity.get("image"), f"activities[{index}].image")
        for image_index, image in enumerate(as_list(activity.get("images"))):
            check_required_string(image.get("src"), f"activities[{index}].images[{image_index}].src")
            check_local_asset(image.get("src"), f"activities[{index}].images[{image_index}].src")


def check_generated_files(content: dict) -> None:
    sitemap_path = ROOT / "sitemap.xml"
    sitemap = sitemap_path.read_text(encoding="utf-8") if sitemap_path.exists() else ""
    if not sitemap:
        add_error("sitemap.xml is missing.")
    for page in BASE_PAGES:
        url = site_url(page)
        if sitemap and url.replace("&", "&amp;") not in sitemap:
            add_error(f"sitemap.xml is missing {url}")
    for post in as_list(content.get("blogPosts")):
        if post.get("status") == "draft" or not post.get("id"):
            continue
        path = blog_path(post)
        url = site_url(path)
        if not (ROOT / path).exists():
            add_error(f"Missing generated blog page: {path}")
        if sitemap and url not in sitemap:
            add_error(f"sitemap.xml is missing {url}")
    for activity in as_list(content.get("activities")):
        if not activity.get("id"):
            continue
        path = activity_path(activity)
        url = site_url(path)
        if not (ROOT / path).exists():
            add_error(f"Missing generated activity page: {path}")
        if sitemap and url not in sitemap:
            add_error(f"sitemap.xml is missing {url}")
    if "activity.html?id=" in sitemap:
        add_warning("sitemap.xml still contains old activity.html?id=... URLs. Run python3 scripts/check_site.py --fix.")


def check_raw_assets() -> None:
    assets = ROOT / "assets"
    if not assets.exists():
        return
    for file in assets.rglob("*"):
        if not file.is_file():
            continue
        relative_path = file.relative_to(ROOT).as_posix()
        if RAW_IMAGE_PATTERN.search(relative_path) and relative_path not in ALLOWED_RAW_ASSETS:
            add_warning(f"{relative_path} looks like a raw image. Prefer optimized .webp files for public assets.")


def print_results() -> None:
    if warnings:
        print("\nWarnings:")
        for message in warnings:
            print(f"- {message}")
    if errors:
        print("\nErrors:", file=sys.stderr)
        for message in errors:
            print(f"- {message}", file=sys.stderr)
        print(f"\nSite check failed with {len(errors)} error(s).", file=sys.stderr)
        sys.exit(1)
    print(f"Site check passed{' with ' + str(len(warnings)) + ' warning(s)' if warnings else ''}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Check website content and generated static pages.")
    parser.add_argument("--fix", action="store_true", help="Regenerate sitemap, static blog pages, and static activity pages.")
    args = parser.parse_args()

    content = json.loads(read_text("data/site-content.json"))
    if args.fix:
        generate_static_files(content)
        print("Generated sitemap.xml, static blog pages, and static activity pages.")

    check_content(content)
    check_generated_files(content)
    check_raw_assets()
    print_results()


if __name__ == "__main__":
    main()
