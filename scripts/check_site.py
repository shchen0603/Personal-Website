#!/usr/bin/env python3

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://shchen0603.github.io/Personal-Website"
BASE_PAGES = [
    "",
    "about.html",
    "research.html",
    "publications.html",
    "honors.html",
    "speaking-media.html",
    "activities.html",
    "blog.html",
    "contact.html",
]
BLOG_INDEX_FALLBACK_START = "<!-- BLOG INDEX STATIC FALLBACK START -->"
BLOG_INDEX_FALLBACK_END = "<!-- BLOG INDEX STATIC FALLBACK END -->"
HOME_JSON_LD_START = "<!-- HOME JSON-LD START -->"
HOME_JSON_LD_END = "<!-- HOME JSON-LD END -->"
HOME_HIGHLIGHTS_STATIC_START = "<!-- HOME HIGHLIGHTS STATIC START -->"
HOME_HIGHLIGHTS_STATIC_END = "<!-- HOME HIGHLIGHTS STATIC END -->"
PUBLICATIONS_STATIC_START = "<!-- PUBLICATIONS STATIC FALLBACK START -->"
PUBLICATIONS_STATIC_END = "<!-- PUBLICATIONS STATIC FALLBACK END -->"
PUBLICATIONS_JSON_LD_START = "<!-- PUBLICATIONS JSON-LD START -->"
PUBLICATIONS_JSON_LD_END = "<!-- PUBLICATIONS JSON-LD END -->"
HONORS_AWARDS_STATIC_START = "<!-- HONORS AWARDS STATIC FALLBACK START -->"
HONORS_AWARDS_STATIC_END = "<!-- HONORS AWARDS STATIC FALLBACK END -->"
HONORS_JSON_LD_START = "<!-- HONORS JSON-LD START -->"
HONORS_JSON_LD_END = "<!-- HONORS JSON-LD END -->"
ABOUT_PUBLICATIONS_STATIC_START = "<!-- ABOUT PUBLICATIONS STATIC START -->"
ABOUT_PUBLICATIONS_STATIC_END = "<!-- ABOUT PUBLICATIONS STATIC END -->"
ABOUT_RECOGNITION_STATIC_START = "<!-- ABOUT RECOGNITION STATIC START -->"
ABOUT_RECOGNITION_STATIC_END = "<!-- ABOUT RECOGNITION STATIC END -->"
ABOUT_JSON_LD_START = "<!-- ABOUT JSON-LD START -->"
ABOUT_JSON_LD_END = "<!-- ABOUT JSON-LD END -->"
SPEAKING_TALKS_STATIC_START = "<!-- SPEAKING TALKS STATIC START -->"
SPEAKING_TALKS_STATIC_END = "<!-- SPEAKING TALKS STATIC END -->"
SPEAKING_PRESENTATIONS_STATIC_START = "<!-- SPEAKING PRESENTATIONS STATIC START -->"
SPEAKING_PRESENTATIONS_STATIC_END = "<!-- SPEAKING PRESENTATIONS STATIC END -->"
SPEAKING_POSTERS_STATIC_START = "<!-- SPEAKING POSTERS STATIC START -->"
SPEAKING_POSTERS_STATIC_END = "<!-- SPEAKING POSTERS STATIC END -->"
SPEAKING_MEDIA_STATIC_START = "<!-- SPEAKING MEDIA STATIC START -->"
SPEAKING_MEDIA_STATIC_END = "<!-- SPEAKING MEDIA STATIC END -->"
SPEAKING_MEDIA_JSON_LD_START = "<!-- SPEAKING MEDIA JSON-LD START -->"
SPEAKING_MEDIA_JSON_LD_END = "<!-- SPEAKING MEDIA JSON-LD END -->"
PUBLICATION_CATEGORY_OPTIONS = [
    {"slug": "journal-publications", "label": "Journal Publications"},
    {"slug": "published-conference-abstracts", "label": "Published Conference Abstracts"},
    {"slug": "journal-cover-features", "label": "Journal Cover Features"},
]
PUBLICATION_SELF_NAME_PATTERN = re.compile(r"\b(Szu[- ]?Han\s+Chen)\b", re.I)
INTENTIONAL_NOINDEX_PAGES = {
    "activity.html",
    "admin.html",
    "post.html",
    "posts/_template.html",
}
PLACEHOLDER_BLOG_TITLES = {"新文章", "New post", "Untitled post"}
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
    # Keep byte-for-byte parity with admin.js' escapeHtmlContent().  Python's
    # html.escape() uses &#x27; for apostrophes while the browser generator uses
    # &#039;; treating those equivalent entities as different made every page
    # look stale after publishing from the admin UI.
    return html.escape(str(value), quote=True).replace("&#x27;", "&#039;")


def render_text_with_breaks(value="") -> str:
    return escape(value).replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")


MARKDOWN_IMAGE_PATTERN = re.compile(r'^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$')
HTML_LINK_PATTERN = re.compile(r"""(?:href|src)=["']([^"']+)["']""", re.I)


def is_safe_markdown_image_src(value="") -> bool:
    src = str(value or "").strip()
    return bool(src) and (not re.match(r"^[a-z][a-z0-9+.-]*:", src, re.I) or is_remote_url(src))


def render_inline_markdown(value="") -> str:
    output = escape(value)
    output = re.sub(r"\\\((.+?)\\\)", r'<span class="math-inline">\\(\1\\)</span>', output)
    output = re.sub(r"`([^`]+)`", r"<code>\1</code>", output)
    output = re.sub(r"&lt;(sup|sub)&gt;(.+?)&lt;/\1&gt;", r"<\1>\2</\1>", output)
    output = re.sub(
        r"(^|[^!])\[([^\]]+)\]((?:\(https?://[^)\s]+\)|\(mailto:[^)\s]+\)))",
        lambda match: f'{match.group(1)}<a href="{match.group(3)[1:-1]}" rel="noreferrer">{match.group(2)}</a>',
        output,
    )
    output = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", output)
    output = re.sub(r"(^|[^*])\*([^*\n]+)\*", r"\1<em>\2</em>", output)
    return output


def split_markdown_table_row(line="") -> list[str]:
    trimmed = str(line or "").strip()
    if "|" not in trimmed:
        return []
    return [cell.strip() for cell in trimmed.strip("|").split("|")]


def get_markdown_table_alignments(line="") -> list[str] | None:
    cells = split_markdown_table_row(line)
    if len(cells) < 2:
        return None

    alignments: list[str] = []
    for cell in cells:
        if not re.match(r"^:?-{3,}:?$", cell):
            return None
        if cell.startswith(":") and cell.endswith(":"):
            alignments.append("center")
        elif cell.endswith(":"):
            alignments.append("right")
        else:
            alignments.append("left")
    return alignments


def render_markdown_table(header_cells: list[str], alignments: list[str], body_rows: list[list[str]]) -> str:
    column_count = len(header_cells)

    def normalize_cells(cells: list[str]) -> list[str]:
        return [(cells[index] if index < len(cells) else "") for index in range(column_count)]

    def alignment_attr(alignment: str | None) -> str:
        return f' class="is-{alignment}"' if alignment and alignment != "left" else ""

    header = "".join(
        f"<th{alignment_attr(alignments[index] if index < len(alignments) else None)}>{render_inline_markdown(cell)}</th>"
        for index, cell in enumerate(normalize_cells(header_cells))
    )
    body = "".join(
        "<tr>"
        + "".join(
            f"<td{alignment_attr(alignments[index] if index < len(alignments) else None)}>{render_inline_markdown(cell)}</td>"
            for index, cell in enumerate(normalize_cells(row))
        )
        + "</tr>"
        for row in body_rows
    )
    return (
        '<div class="article-table-wrap"><table class="article-table">'
        f"<thead><tr>{header}</tr></thead><tbody>{body}</tbody>"
        "</table></div>"
    )


def render_markdown_image(src="", alt="", caption="") -> str:
    clean_src = str(src or "").strip()
    if not is_safe_markdown_image_src(clean_src):
        return ""
    caption_html = f"<figcaption>{render_inline_markdown(caption)}</figcaption>" if caption else ""
    return f"""
      <figure class="article-inline-image">
        <img src="{escape(nested_asset(clean_src))}" alt="{escape(alt)}" loading="lazy" decoding="async">
        {caption_html}
      </figure>
    """


def render_markdown_block(value="") -> str:
    normalized = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return ""
    lines = normalized.split("\n")
    output: list[str] = []
    paragraph: list[str] = []
    list_stack: list[dict[str, object]] = []
    quote_lines: list[str] = []
    math_lines: list[str] | None = None

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            output.append(f"<p>{'<br>'.join(render_inline_markdown(line) for line in paragraph)}</p>")
            paragraph = []

    def close_list_level() -> None:
        if not list_stack:
            return
        current = list_stack.pop()
        if current.get("open_item"):
            output.append("</li>")
        output.append(f"</{current['type']}>")

    def flush_list() -> None:
        while list_stack:
            close_list_level()

    def open_list_level(list_type: str, indent: int) -> None:
        output.append(f"<{list_type}>")
        list_stack.append({"type": list_type, "indent": indent, "open_item": False})

    def add_list_item(list_type: str, indent: int, text: str) -> None:
        while list_stack and indent < int(list_stack[-1]["indent"]):
            close_list_level()

        if not list_stack or indent > int(list_stack[-1]["indent"]):
            open_list_level(list_type, indent)
        elif list_stack[-1]["type"] != list_type:
            close_list_level()
            open_list_level(list_type, indent)

        current = list_stack[-1]
        if current.get("open_item"):
            output.append("</li>")
        output.append(f"<li>{render_inline_markdown(text)}")
        current["open_item"] = True

    def flush_quote() -> None:
        nonlocal quote_lines
        if quote_lines:
            output.append(f"<blockquote><p>{'<br>'.join(render_inline_markdown(line) for line in quote_lines)}</p></blockquote>")
            quote_lines = []

    def flush_math() -> None:
        nonlocal math_lines
        if math_lines is not None:
            output.append(f'<div class="math-display">\\[{escape(chr(10).join(math_lines))}\\]</div>')
            math_lines = None

    def flush_all() -> None:
        flush_paragraph()
        flush_list()
        flush_quote()

    line_index = 0
    while line_index < len(lines):
        line = lines[line_index]
        if math_lines is not None:
            if line.strip() in {"$$", r"\]"}:
                flush_math()
                line_index += 1
                continue
            math_lines.append(line)
            line_index += 1
            continue

        if not line.strip():
            flush_all()
            line_index += 1
            continue

        if line.strip() in {"$$", r"\["}:
            flush_all()
            math_lines = []
            line_index += 1
            continue

        single_line_math = re.match(r"^\$\$(.+)\$\$$", line.strip()) or re.match(r"^\\\[(.+)\\\]$", line.strip())
        if single_line_math:
            flush_all()
            output.append(f'<div class="math-display">\\[{escape(single_line_math.group(1).strip())}\\]</div>')
            line_index += 1
            continue

        image = MARKDOWN_IMAGE_PATTERN.match(line.strip())
        if image:
            flush_all()
            output.append(render_markdown_image(image.group(2), image.group(1), image.group(3) or ""))
            line_index += 1
            continue

        table_alignments = get_markdown_table_alignments(lines[line_index + 1] if line_index + 1 < len(lines) else "")
        if len(split_markdown_table_row(line)) >= 2 and table_alignments:
            flush_all()
            header_cells = split_markdown_table_row(line)
            body_rows: list[list[str]] = []
            line_index += 2

            while line_index < len(lines) and lines[line_index].strip():
                row_cells = split_markdown_table_row(lines[line_index])
                if len(row_cells) < 2:
                    break
                body_rows.append(row_cells)
                line_index += 1

            output.append(render_markdown_table(header_cells, table_alignments, body_rows))
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            flush_all()
            level = min(max(len(heading.group(1)), 2), 6)
            text = re.sub(r"\s+#+\s*$", "", heading.group(2)).strip()
            output.append(f"<h{level}>{render_inline_markdown(text)}</h{level}>")
            line_index += 1
            continue

        unordered = re.match(r"^(\s*)[-*]\s+(.+)$", line)
        ordered = re.match(r"^(\s*)\d+\.\s+(.+)$", line)
        if unordered or ordered:
            current_type = "ul" if unordered else "ol"
            current_indent = len((unordered or ordered).group(1).replace("\t", "    "))
            current_text = (unordered or ordered).group(2)
            flush_paragraph()
            flush_quote()
            add_list_item(current_type, current_indent, current_text)
            line_index += 1
            continue

        quote_match = re.match(r"^\s*>\s?(.*)$", line)
        if quote_match:
            flush_paragraph()
            flush_list()
            quote_lines.append(quote_match.group(1))
            line_index += 1
            continue

        flush_list()
        flush_quote()
        paragraph.append(line)
        line_index += 1

    flush_all()
    flush_math()
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


def local_link_path(value: str, source_relative_path: str) -> str:
    link = str(value or "").strip()
    if not link or link.startswith("#"):
        return ""
    is_root_relative = False
    if link.startswith(f"{SITE_ORIGIN}/"):
        link = link[len(SITE_ORIGIN) + 1 :]
        is_root_relative = True
    elif re.match(r"^[a-z][a-z0-9+.-]*:", link, re.I):
        return ""
    link = link.split("#", 1)[0].split("?", 1)[0]
    if not link:
        return ""
    if link.startswith("/Personal-Website/"):
        link = link[len("/Personal-Website/") :]
        is_root_relative = True
    elif link.startswith("/"):
        link = link.lstrip("/")
        is_root_relative = True
    if not is_root_relative:
        link = (Path(source_relative_path).parent / link).as_posix()
    return posixpath.normpath(link)


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


def article_taxonomy_html(tags: list[str], series_label: str) -> str:
    rows = []

    if tags:
        tag_spans = "".join(f'<span class="tag-button tag-static">{escape(tag)}</span>' for tag in tags)
        rows.append(
            '<div class="article-taxonomy-row">'
            '<span class="article-taxonomy-label">標籤：</span>'
            f'<div class="article-taxonomy-items">{tag_spans}</div>'
            '</div>'
        )

    if series_label:
        rows.append(
            '<div class="article-taxonomy-row">'
            '<span class="article-taxonomy-label">系列：</span>'
            f'<div class="article-taxonomy-items"><span class="tag-button tag-static">{escape(series_label)}</span></div>'
            '</div>'
        )

    return (
        f'<div class="article-taxonomy" aria-label="文章系列與標籤">{"".join(rows)}</div>'
        if rows else ""
    )


def build_blog_post_html(post: dict) -> str:
    title = post.get("title") or "Blog Post"
    excerpt = post.get("excerpt") or "Research notes and essays on cardiovascular epidemiology, medicine, and public health."
    canonical = site_url(blog_path(post))
    og_image = absolute_asset_url(post["image"]) if post.get("image") else site_url("assets/cardiovascular-epidemiology-hero-og.jpg")
    tags = [tag.get("label") or tag.get("slug") for tag in as_list(post.get("tags")) if isinstance(tag, dict) and (tag.get("label") or tag.get("slug"))]
    series = post.get("series") if isinstance(post.get("series"), dict) else {}
    series_label = series.get("label") or series.get("slug") or ""
    taxonomy_labels = [label for label in [series_label, *tags] if label]
    tags_html = article_taxonomy_html(tags, series_label)
    hero_image = (
        f'<figure class="article-cover-image"><img class="article-image" src="{escape(nested_asset(post["image"]))}" alt="{escape(post.get("imageAlt") or title)}" loading="lazy" decoding="async"></figure>'
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
        "author": {"@type": "Person", "@id": f"{SITE_ORIGIN}/#person", "name": "Szu-Han Chen", "url": f"{SITE_ORIGIN}/"},
        "publisher": {"@type": "Person", "@id": f"{SITE_ORIGIN}/#person", "name": "Szu-Han Chen", "url": f"{SITE_ORIGIN}/"},
        "keywords": ", ".join(taxonomy_labels),
    }
    if series_label:
        json_ld_data["articleSection"] = series_label
    json_ld = json.dumps(json_ld_data, ensure_ascii=False, separators=(",", ":"))

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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&amp;family=Noto+Sans+TC:wght@400;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
    <link rel="stylesheet" href="../styles.css?v=20260612-nested-lists">
    <script type="application/ld+json">{json_ld}</script>
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token":"a8f57387064d4f27b1ba086354d6ac5f"}}'></script>
    <!-- End Cloudflare Web Analytics -->
    <script>(function(){{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){{document.documentElement.setAttribute("data-theme","dark")}}}})();</script>
    <script>(function(){{var l=localStorage.getItem("lang");if(l!=="en"&&l!=="zh-Hant"){{l=(navigator.language||navigator.userLanguage||"").toLowerCase().indexOf("zh")===0?"zh-Hant":"en";}}document.documentElement.setAttribute("lang",l);}})();</script>
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
        </header>
        <div class="article-body">
          {hero_image}
          {body}
        </div>
        {f'<footer class="article-footer">{tags_html}</footer>' if tags_html else ""}
      </article>
    </main>

    <footer class="site-footer" data-footer></footer>

    <button class="back-to-top" data-back-to-top aria-label="回到頂部" title="回到頂部">↑</button>

    <script src="../site-config.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
    <script src="../script.js?v=20260612-nested-lists"></script>
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
    if date_label and meta.startswith(f"{date_label} · "):
        compact_meta = meta[len(f"{date_label} · "):]
    elif date_label and activity.get("year") and meta.startswith(f'{activity["year"]} · '):
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
        "author": {"@type": "Person", "@id": f"{SITE_ORIGIN}/#person", "name": "Szu-Han Chen", "url": f"{SITE_ORIGIN}/"},
    }, ensure_ascii=False, separators=(",", ":"))

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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&amp;family=Noto+Sans+TC:wght@400;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">{json_ld}</script>
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token":"a8f57387064d4f27b1ba086354d6ac5f"}}'></script>
    <!-- End Cloudflare Web Analytics -->
    <script>(function(){{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){{document.documentElement.setAttribute("data-theme","dark")}}}})();</script>
    <script>(function(){{var l=localStorage.getItem("lang");if(l!=="en"&&l!=="zh-Hant"){{l=(navigator.language||navigator.userLanguage||"").toLowerCase().indexOf("zh")===0?"zh-Hant":"en";}}document.documentElement.setAttribute("lang",l);}})();</script>
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


def slugify(value="") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "item").strip().lower()).strip("-")
    return (slug[:72] or "item")


def publication_category(publication: dict) -> dict:
    aliases = {"peer-reviewed-journal-publications": "journal-publications"}
    selected_slug = aliases.get(slugify(publication.get("category") or ""), slugify(publication.get("category") or ""))
    selected = next((option for option in PUBLICATION_CATEGORY_OPTIONS if option["slug"] == selected_slug), None)
    if selected:
        return selected

    tag_slugs = {
        tag.get("slug") for tag in as_list(publication.get("tags"))
        if isinstance(tag, dict) and tag.get("slug")
    }
    if "cover-feature" in tag_slugs:
        return PUBLICATION_CATEGORY_OPTIONS[-1]
    if re.match(r"^abstract\b", str(publication.get("title") or ""), re.I):
        return PUBLICATION_CATEGORY_OPTIONS[1]
    return PUBLICATION_CATEGORY_OPTIONS[0]


def publication_groups(publications: list[dict]) -> list[dict]:
    groups = [dict(option, items=[]) for option in PUBLICATION_CATEGORY_OPTIONS]
    by_slug = {group["slug"]: group for group in groups}
    for publication in publications:
        by_slug[publication_category(publication)["slug"]]["items"].append(publication)
    return [group for group in groups if group["items"]]


def publication_author_html(authors="") -> str:
    return PUBLICATION_SELF_NAME_PATTERN.sub(r"<strong>\1</strong>", escape(authors), count=1)


def publication_doi_text(value="") -> str:
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", str(value or "").strip(), flags=re.I)
    return re.sub(r"^doi:\s*", "", doi, flags=re.I)


def build_publication_item_html(publication: dict) -> str:
    link = publication.get("doi") or publication.get("href") or "#"
    tags = [tag for tag in as_list(publication.get("tags")) if isinstance(tag, dict)]
    tag_slugs = " ".join(slugify(tag.get("slug") or tag.get("label") or "") for tag in tags)
    badges = []
    if publication.get("firstAuthor"):
        badges.append('<span class="author-role-badge author-role-first" title="First author">First author</span>')
    if publication.get("correspondingAuthor"):
        badges.append('<span class="author-role-badge author-role-corresponding" title="Corresponding author">Corresponding author</span>')
    badge_html = (
        f'<div class="author-role-badges" aria-label="作者身份">{"".join(badges)}</div>'
        if badges else ""
    )
    author_html = (
        f'<p class="publication-authors">{publication_author_html(publication.get("authors"))}</p>'
        if publication.get("authors") else ""
    )
    venue_html = (
        f'<p class="publication-venue">{escape(publication.get("venue"))}</p>'
        if publication.get("venue") else ""
    )
    doi_text = publication_doi_text(publication.get("doi"))
    doi_html = f'<p class="publication-doi">DOI: {escape(doi_text)}</p>' if doi_text else ""
    summary_html = (
        f'<p class="publication-summary">{escape(publication.get("summary"))}</p>'
        if publication.get("summary") else ""
    )
    tag_html = (
        '<div class="publication-tags" aria-label="著作標籤">'
        + "".join(
            f'<span class="tag-button tag-static">{escape(tag.get("label") or tag.get("slug") or "")}</span>'
            for tag in tags
        )
        + "</div>"
        if tags else ""
    )
    lines = [
        f'          <article class="publication-item" data-publication-item data-tags="{escape(tag_slugs)}">',
        f'            <p class="publication-year">{escape(publication.get("year"))}</p>',
        "            <div>",
        f'              <h3><a href="{escape(link)}" rel="noreferrer">{escape(publication.get("title"))}</a></h3>',
    ]
    lines.extend(f"              {part}" for part in [badge_html, author_html, venue_html, doi_html, summary_html, tag_html] if part)
    lines.extend(["            </div>", "          </article>"])
    return "\n".join(lines)


def build_publications_static_html(content: dict) -> str:
    groups = []
    for group in publication_groups(as_list(content.get("publications"))):
        note = (
            '          <p class="publication-group-note"><span data-lang="zh">於學術會議發表的摘要（非同儕審查全文）。</span><span data-lang="en">Conference abstracts presented at scientific meetings (not peer-reviewed full papers).</span></p>\n'
            if group["slug"] == "published-conference-abstracts" else ""
        )
        items = "\n".join(build_publication_item_html(publication) for publication in group["items"])
        groups.append(
            f'        <section class="publication-group" data-publication-group data-publication-group-slug="{escape(group["slug"])}">\n'
            '          <div class="publication-group-heading">\n'
            f'            <h3>{escape(group["label"])}</h3>\n'
            f"{note}"
            "          </div>\n"
            '          <div class="publication-list">\n'
            f"{items}\n"
            "          </div>\n"
            "        </section>"
        )
    return (
        f"        {PUBLICATIONS_STATIC_START}\n"
        + "\n".join(groups)
        + f"\n        {PUBLICATIONS_STATIC_END}"
    )


def publication_json_ld_data(content: dict) -> dict:
    publications = as_list(content.get("publications"))

    def item_data(publication: dict) -> dict:
        category = publication_category(publication)
        publication_type = "CreativeWork" if category["slug"] == "journal-cover-features" else "ScholarlyArticle"
        title = publication.get("title") or ""
        url = publication.get("doi") or publication.get("href") or site_url("publications.html")
        item = {
            "@type": publication_type,
            "@id": url,
            "name": title,
            "datePublished": publication.get("year") or "",
            "url": url,
            "isPartOf": publication.get("venue") or "",
            "genre": category["label"],
            "author": [
                {
                    "@type": "Person",
                    **(
                        {"@id": f"{SITE_ORIGIN}/#person"}
                        if PUBLICATION_SELF_NAME_PATTERN.fullmatch(name.strip().rstrip("."))
                        else {}
                    ),
                    "name": name.strip().rstrip("."),
                }
                for name in str(publication.get("authors") or "").split(",")
                if name.strip()
            ],
            "about": {"@id": f"{SITE_ORIGIN}/#person"},
            "mainEntityOfPage": site_url("publications.html"),
        }
        if publication_type == "ScholarlyArticle":
            item["headline"] = title
        if publication.get("doi"):
            item["identifier"] = publication.get("doi")
        if publication.get("tags"):
            item["keywords"] = [
                tag.get("label") or tag.get("slug")
                for tag in as_list(publication.get("tags"))
                if isinstance(tag, dict) and (tag.get("label") or tag.get("slug"))
            ]
        return item

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Publications of Szu-Han Chen",
        "itemListOrder": "https://schema.org/ItemListOrderDescending",
        "numberOfItems": len(publications),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "item": item_data(publication),
            }
            for index, publication in enumerate(publications, start=1)
        ],
    }


def build_publications_json_ld_html(content: dict) -> str:
    json_ld = json.dumps(publication_json_ld_data(content), ensure_ascii=False, separators=(",", ":"))
    return (
        f"    {PUBLICATIONS_JSON_LD_START}\n"
        f'    <script type="application/ld+json" data-jsonld-id="publications">{json_ld}</script>\n'
        f"    {PUBLICATIONS_JSON_LD_END}"
    )


def honor_date_label(item: dict) -> str:
    if item.get("dateLabel"):
        return str(item["dateLabel"])
    if item.get("date"):
        return str(item["date"]).replace("-", ".")
    return str(item.get("year") or "")


def build_item_links_html(item: dict, indent: str = "              ") -> str:
    links = [
        link for link in as_list(item.get("links"))
        if isinstance(link, dict) and str(link.get("href") or "").strip()
    ]
    if not links:
        return ""
    link_html = "".join(
        f'<a href="{escape(link.get("href"))}" rel="noreferrer">{escape(link.get("label") or "Source")}</a>'
        for link in links
    )
    return f'{indent}<div class="publication-links">{link_html}</div>\n'


def build_honor_item_html(item: dict) -> str:
    return (
        '          <article class="honor-item">\n'
        f'            <p class="honor-year">{escape(honor_date_label(item))}</p>\n'
        "            <div>\n"
        f'              <h3>{escape(item.get("title"))}</h3>\n'
        f'              <p>{escape(item.get("description"))}</p>\n'
        f"{build_item_links_html(item)}"
        "            </div>\n"
        "          </article>"
    )


def build_home_highlight_item_html(item: dict, index: int) -> str:
    delay_class = " reveal-delay-1" if index == 1 else " reveal-delay-2" if index == 2 else " reveal-delay-3" if index >= 3 else ""
    title = escape(item.get("title"))
    href = str(item.get("href") or "").strip()
    heading = (
        f'<h3><a href="{escape(href)}" rel="noreferrer">{title}</a></h3>'
        if href else f"<h3>{title}</h3>"
    )
    return (
        f'        <article class="highlight-card reveal{delay_class}">\n'
        f'          <p class="timeline-meta">{escape(item.get("meta"))}</p>\n'
        f"          {heading}\n"
        f'          <p>{escape(item.get("description"))}</p>\n'
        f"{build_item_links_html(item, indent='          ')}"
        "        </article>"
    )


def build_home_highlights_static_html(content: dict) -> str:
    items = "\n".join(
        build_home_highlight_item_html(item, index)
        for index, item in enumerate(as_list(content.get("homeHighlights")))
    )
    return (
        f"      {HOME_HIGHLIGHTS_STATIC_START}\n"
        f"{items}\n"
        f"      {HOME_HIGHLIGHTS_STATIC_END}"
    )


def build_honors_awards_static_html(content: dict) -> str:
    awards = as_list((content.get("honors") or {}).get("awards"))
    groups = []
    for scope, label in [("international", "International Awards"), ("domestic", "Domestic Awards")]:
        items = [award for award in awards if (award.get("scope") or "domestic").lower() == scope]
        if not items:
            continue
        item_html = "\n".join(build_honor_item_html(item) for item in items)
        groups.append(
            f'        <section class="honor-award-group" data-award-scope="{scope}">\n'
            f"          <h3>{label}</h3>\n"
            '          <div class="honor-list">\n'
            f"{item_html}\n"
            "          </div>\n"
            "        </section>"
        )
    return (
        f"        {HONORS_AWARDS_STATIC_START}\n"
        + "\n".join(groups)
        + f"\n        {HONORS_AWARDS_STATIC_END}"
    )


def honors_json_ld_data(content: dict) -> dict:
    awards = as_list((content.get("honors") or {}).get("awards"))
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Honors and Awards of Szu-Han Chen",
        "itemListOrder": "https://schema.org/ItemListOrderDescending",
        "numberOfItems": len(awards),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "item": {
                    "@type": "Thing",
                    "name": award.get("title") or "",
                    "description": " ".join(
                        part for part in [honor_date_label(award), award.get("description") or ""] if part
                    ),
                    "url": f'{site_url("honors.html")}#awards-title',
                    "about": {"@id": f"{SITE_ORIGIN}/#person"},
                },
            }
            for index, award in enumerate(awards, start=1)
        ],
    }


def build_honors_json_ld_html(content: dict) -> str:
    json_ld = json.dumps(honors_json_ld_data(content), ensure_ascii=False, separators=(",", ":"))
    return (
        f"    {HONORS_JSON_LD_START}\n"
        f'    <script type="application/ld+json" data-jsonld-id="honors">{json_ld}</script>\n'
        f"    {HONORS_JSON_LD_END}"
    )


def selected_about_publications(content: dict) -> list[dict]:
    return [
        publication for publication in as_list(content.get("publications"))
        if publication_category(publication)["slug"] == "journal-publications"
        and publication.get("firstAuthor")
    ][:3]


def selected_about_recognition(content: dict) -> list[dict]:
    awards = as_list((content.get("honors") or {}).get("awards"))
    return [award for award in awards if str(award.get("scope") or "").lower() == "international"][:3]


def build_static_item_block(start_marker: str, end_marker: str, items: list[dict], builder) -> str:
    item_html = "\n".join(builder(item) for item in items)
    return f"        {start_marker}\n{item_html}\n        {end_marker}"


def build_about_publications_static_html(content: dict) -> str:
    return build_static_item_block(
        ABOUT_PUBLICATIONS_STATIC_START,
        ABOUT_PUBLICATIONS_STATIC_END,
        selected_about_publications(content),
        build_publication_item_html,
    )


def build_about_recognition_static_html(content: dict) -> str:
    return build_static_item_block(
        ABOUT_RECOGNITION_STATIC_START,
        ABOUT_RECOGNITION_STATIC_END,
        selected_about_recognition(content),
        build_honor_item_html,
    )


def publication_category_counts(content: dict) -> dict[str, int]:
    counts = {option["slug"]: 0 for option in PUBLICATION_CATEGORY_OPTIONS}
    for publication in as_list(content.get("publications")):
        counts[publication_category(publication)["slug"]] += 1
    return counts


def replace_about_counts_html(template: str, content: dict) -> str:
    updated = template
    for key, count in publication_category_counts(content).items():
        pattern = re.compile(
            rf'(<strong data-about-count="{re.escape(key)}">)[^<]*(</strong>)'
        )
        updated, replacements = pattern.subn(rf"\g<1>{count}\g<2>", updated)
        if replacements < 1:
            raise ValueError(f'about.html is missing the static "{key}" publication count.')
    return updated


def person_json_ld_data(content: dict) -> dict:
    awards = as_list((content.get("honors") or {}).get("awards"))
    return {
        "@type": "Person",
        "@id": f"{SITE_ORIGIN}/#person",
        "name": "Szu-Han Chen",
        "alternateName": "陳思翰",
        "url": f"{SITE_ORIGIN}/",
        "mainEntityOfPage": site_url("about.html"),
        "image": site_url("assets/cardiovascular-epidemiology-hero-og.jpg"),
        "jobTitle": "Medical Student Researcher (MD Candidate)",
        "description": (
            "Medical student and MD candidate at National Yang Ming Chiao Tung University, "
            "research collaborator at Harvard T.H. Chan School of Public Health, and researcher "
            "in cardiovascular and nutritional epidemiology."
        ),
        "affiliation": [
            {
                "@type": "CollegeOrUniversity",
                "name": "National Yang Ming Chiao Tung University, School of Medicine",
                "url": "https://med.nycu.edu.tw/",
            },
            {
                "@type": "CollegeOrUniversity",
                "name": "Harvard T.H. Chan School of Public Health",
                "url": "https://www.hsph.harvard.edu/",
            },
        ],
        "knowsAbout": [
            "Cardiovascular Epidemiology",
            "Nutritional Epidemiology",
            "Cardiometabolic Health",
            "Heart Failure",
            "Hypertension",
            "Sodium and Vascular Risk",
            "Nutrition",
            "Metabolomics",
            "Preventive Cardiology",
        ],
        "award": [
            " — ".join(part for part in [award.get("title") or "", award.get("description") or ""] if part)
            for award in awards
        ],
        "subjectOf": [
            {
                "@type": "NewsArticle",
                "@id": "https://som.nycu.edu.tw/%E9%99%BD%E4%BA%A4%E5%A4%A7%E9%86%AB%E5%AD%B8%E9%99%A22026%E5%9C%8B%E9%9A%9B%E5%AD%B8%E8%A1%93%E7%A0%94%E8%A8%8E%E6%9C%83%E5%9C%93%E6%BB%BF%E8%90%BD%E5%B9%95%E3%80%80%E5%85%B1%E7%AF%89%E9%86%AB/news/",
                "name": "陽明交大醫學院2026國際學術研討會圓滿落幕　共築醫學研究新生態系",
                "url": "https://som.nycu.edu.tw/%E9%99%BD%E4%BA%A4%E5%A4%A7%E9%86%AB%E5%AD%B8%E9%99%A22026%E5%9C%8B%E9%9A%9B%E5%AD%B8%E8%A1%93%E7%A0%94%E8%A8%8E%E6%9C%83%E5%9C%93%E6%BB%BF%E8%90%BD%E5%B9%95%E3%80%80%E5%85%B1%E7%AF%89%E9%86%AB/news/",
                "datePublished": "2026-06-07",
                "inLanguage": "zh-Hant",
                "publisher": {
                    "@type": "CollegeOrUniversity",
                    "name": "National Yang Ming Chiao Tung University College of Medicine",
                    "url": "https://som.nycu.edu.tw/",
                },
            },
            {
                "@type": "NewsArticle",
                "@id": "https://ord.nycu.edu.tw/ord/ch/app/news/view?module=headnews&id=4518&serno=b848578f-c677-4dd7-bfc1-de2a419d06b7",
                "name": "「114學年度生醫學術論文研討會」獲獎名單與活動照",
                "url": "https://ord.nycu.edu.tw/ord/ch/app/news/view?module=headnews&id=4518&serno=b848578f-c677-4dd7-bfc1-de2a419d06b7",
                "datePublished": "2026-06-05",
                "inLanguage": "zh-Hant",
                "publisher": {
                    "@type": "CollegeOrUniversity",
                    "name": "National Yang Ming Chiao Tung University Office of Research and Development",
                    "url": "https://ord.nycu.edu.tw/ord/ch/index",
                },
            },
            {
                "@type": "NewsArticle",
                "@id": "https://med.nycu.edu.tw/med/ch/app/news/view?module=headnews&id=36202&serno=f7e81bda-0e49-499d-b5f8-3ea961b90ec1",
                "name": "狂賀! 醫師組五年級陳思翰同學榮獲2026亞洲職業衛生大會(ACOH 2026)口頭報告競賽冠軍!",
                "url": "https://med.nycu.edu.tw/med/ch/app/news/view?module=headnews&id=36202&serno=f7e81bda-0e49-499d-b5f8-3ea961b90ec1",
                "datePublished": "2026-08-10",
                "inLanguage": "zh-Hant",
                "publisher": {
                    "@type": "CollegeOrUniversity",
                    "name": "National Yang Ming Chiao Tung University School of Medicine",
                    "url": "https://med.nycu.edu.tw/",
                },
            },
            {
                "@type": "NewsArticle",
                "@id": "https://med.nycu.edu.tw/med/ch/app/news/view?module=headnews&id=36202&serno=6d0b3c22-9a21-4d44-9394-94d0df7cc38a",
                "name": "狂賀! 醫師組五年級陳思翰同學榮獲美國心臟協會 EPI | Lifestyle 2026 國際學者獎!",
                "url": "https://med.nycu.edu.tw/med/ch/app/news/view?module=headnews&id=36202&serno=6d0b3c22-9a21-4d44-9394-94d0df7cc38a",
                "datePublished": "2026-08-19",
                "inLanguage": "zh-Hant",
                "publisher": {
                    "@type": "CollegeOrUniversity",
                    "name": "National Yang Ming Chiao Tung University School of Medicine",
                    "url": "https://med.nycu.edu.tw/",
                },
            },
            {
                "@type": "NewsArticle",
                "@id": "https://newsroom.heart.org/news/extra-belly-weight-not-bmi-was-a-stronger-predictor-of-heart-failure-risk-inflammation",
                "name": "Extra belly weight, not BMI, was a stronger predictor of heart failure risk, inflammation",
                "url": "https://newsroom.heart.org/news/extra-belly-weight-not-bmi-was-a-stronger-predictor-of-heart-failure-risk-inflammation",
                "inLanguage": "en",
                "publisher": {
                    "@type": "Organization",
                    "name": "American Heart Association",
                    "url": "https://www.heart.org/",
                },
            },
        ],
        "sameAs": [
            "https://orcid.org/0009-0006-4557-9097",
            "https://scholar.google.com/citations?user=0CdlnrgAAAAJ&hl=zh-TW",
            "https://www.researchgate.net/profile/Szu-Han-Chen-7",
            "https://www.linkedin.com/in/szu-han-chen-med/",
            "https://github.com/shchen0603",
        ],
    }


def home_json_ld_data(content: dict) -> dict:
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{SITE_ORIGIN}/#website",
                "url": f"{SITE_ORIGIN}/",
                "name": "Szu-Han Chen · 陳思翰",
                "description": (
                    "Academic website of Szu-Han Chen, a medical student researcher in "
                    "cardiovascular and nutritional epidemiology."
                ),
                "inLanguage": ["zh-Hant", "en"],
                "about": {"@id": f"{SITE_ORIGIN}/#person"},
            },
            person_json_ld_data(content),
        ],
    }


def build_home_json_ld_html(content: dict) -> str:
    json_ld = json.dumps(home_json_ld_data(content), ensure_ascii=False, separators=(",", ":"))
    return (
        f"  {HOME_JSON_LD_START}\n"
        f'  <script type="application/ld+json" data-jsonld-id="home">{json_ld}</script>\n'
        f"  {HOME_JSON_LD_END}"
    )


def about_json_ld_data(content: dict) -> dict:
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "ProfilePage",
                "@id": f'{site_url("about.html")}#profile-page',
                "url": site_url("about.html"),
                "name": "About Szu-Han Chen (陳思翰)",
                "description": (
                    "Academic biography, affiliations, research focus, selected publications, "
                    "and recognition of Szu-Han Chen."
                ),
                "inLanguage": ["zh-Hant", "en"],
                "isPartOf": {"@id": f"{SITE_ORIGIN}/#website"},
                "mainEntity": {"@id": f"{SITE_ORIGIN}/#person"},
            },
            person_json_ld_data(content),
        ],
    }


def build_about_json_ld_html(content: dict) -> str:
    json_ld = json.dumps(about_json_ld_data(content), ensure_ascii=False, separators=(",", ":"))
    return (
        f"    {ABOUT_JSON_LD_START}\n"
        f'    <script type="application/ld+json" data-jsonld-id="about">{json_ld}</script>\n'
        f"    {ABOUT_JSON_LD_END}"
    )


def build_media_coverage_item_html(item: dict) -> str:
    links = []
    for link in as_list(item.get("links")):
        if not isinstance(link, dict):
            continue
        label = link.get("label") or "Coverage"
        href = str(link.get("href") or "").strip()
        if href:
            links.append(f'<a href="{escape(href)}" rel="noreferrer">{escape(label)}</a>')
        else:
            links.append(f'<span class="media-pending" title="連結待補">{escape(label)} <em>(link pending)</em></span>')
    links_html = (
        f'              <div class="publication-links">{"".join(links)}</div>\n'
        if links else ""
    )
    return (
        '          <li class="media-coverage-item">\n'
        "            <div>\n"
        f'              <h3>{escape(item.get("title"))}</h3>\n'
        f'              <p>{escape(item.get("description"))}</p>\n'
        f"{links_html}"
        "            </div>\n"
        "          </li>"
    )


def speaking_items(content: dict, key: str) -> list[dict]:
    return as_list((content.get("honors") or {}).get(key))


def build_speaking_static_html(content: dict, key: str, start_marker: str, end_marker: str) -> str:
    return build_static_item_block(
        start_marker,
        end_marker,
        speaking_items(content, key),
        build_honor_item_html,
    )


def build_speaking_media_static_html(content: dict) -> str:
    return build_static_item_block(
        SPEAKING_MEDIA_STATIC_START,
        SPEAKING_MEDIA_STATIC_END,
        speaking_items(content, "mediaCoverage"),
        build_media_coverage_item_html,
    )


def event_item_list_schema(name: str, items: list[dict], section_id: str) -> dict:
    return {
        "@type": "ItemList",
        "name": name,
        "numberOfItems": len(items),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "item": {
                    "@type": "Event",
                    "name": item.get("title") or "",
                    "description": item.get("description") or "",
                    "startDate": item.get("date") or item.get("year") or "",
                    "eventStatus": "https://schema.org/EventScheduled",
                    "performer": {"@id": f"{SITE_ORIGIN}/#person"},
                    "url": f'{site_url("speaking-media.html")}#{section_id}',
                },
            }
            for index, item in enumerate(items, start=1)
        ],
    }


def media_item_list_schema(items: list[dict]) -> dict:
    return {
        "@type": "ItemList",
        "name": "Research-related media coverage of Szu-Han Chen",
        "numberOfItems": len(items),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "item": {
                    "@type": "CreativeWork",
                    "name": item.get("title") or "",
                    "description": item.get("description") or "",
                    "url": next(
                        (
                            link.get("href") for link in as_list(item.get("links"))
                            if isinstance(link, dict) and link.get("href")
                        ),
                        f'{site_url("speaking-media.html")}#speaking-media-title',
                    ),
                    "about": {"@id": f"{SITE_ORIGIN}/#person"},
                },
            }
            for index, item in enumerate(items, start=1)
        ],
    }


def speaking_media_json_ld_data(content: dict) -> dict:
    talks = speaking_items(content, "talks")
    presentations = speaking_items(content, "presentations")
    posters = speaking_items(content, "posters")
    media = speaking_items(content, "mediaCoverage")
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": f'{site_url("speaking-media.html")}#collection-page',
        "url": site_url("speaking-media.html"),
        "name": "Speaking & Media | Szu-Han Chen (陳思翰)",
        "description": "Invited talks, conference presentations, and research-related media coverage of Szu-Han Chen.",
        "inLanguage": ["zh-Hant", "en"],
        "isPartOf": {"@id": f"{SITE_ORIGIN}/#website"},
        "about": {"@id": f"{SITE_ORIGIN}/#person"},
        "mainEntity": [
            event_item_list_schema("Invited talks and lectures", talks, "invited-talks-title"),
            event_item_list_schema("Conference oral presentations", presentations, "speaking-presentations-title"),
            event_item_list_schema("Moderated poster presentations", posters, "speaking-posters-title"),
            media_item_list_schema(media),
        ],
    }


def build_speaking_media_json_ld_html(content: dict) -> str:
    json_ld = json.dumps(speaking_media_json_ld_data(content), ensure_ascii=False, separators=(",", ":"))
    return (
        f"    {SPEAKING_MEDIA_JSON_LD_START}\n"
        f'    <script type="application/ld+json" data-jsonld-id="speaking-media">{json_ld}</script>\n'
        f"    {SPEAKING_MEDIA_JSON_LD_END}"
    )


def replace_generated_block(template: str, start_marker: str, end_marker: str, replacement: str, path: str) -> str:
    start = template.find(start_marker)
    end = template.find(end_marker)
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"{path} is missing generated-content markers: {start_marker}")
    end += len(end_marker)
    line_start = template.rfind("\n", 0, start) + 1
    line_end = template.find("\n", end)
    if not template[line_start:start].strip():
        start = line_start
    if line_end != -1:
        end = line_end
    return f"{template[:start]}{replacement}{template[end:]}"


def static_counts(content: dict) -> dict[str, int]:
    honors = content.get("honors") or {}
    return {
        "publications": len(as_list(content.get("publications"))),
        "awards": len(as_list(honors.get("awards"))),
        "appearances": sum(len(as_list(honors.get(key))) for key in ["talks", "presentations", "posters"]),
        "activities": len(as_list(content.get("activities"))),
    }


def replace_home_stats_html(template: str, content: dict) -> str:
    updated = template
    for key, count in static_counts(content).items():
        pattern = re.compile(
            rf'(<span class="stat-number" data-stat="{re.escape(key)}" data-count=")[^"]+(">)[^<]*(</span>)'
        )
        updated, replacements = pattern.subn(rf"\g<1>{count}\g<2>{count}\g<3>", updated, count=1)
        if replacements != 1:
            raise ValueError(f'index.html is missing the static "{key}" count.')
    return updated


def replace_collection_count_html(template: str, key: str, count: int, path: str) -> str:
    pattern = re.compile(
        rf'(<strong data-collection-count="{re.escape(key)}">)[^<]*(</strong>)'
    )
    updated, replacements = pattern.subn(rf"\g<1>{count}\g<2>", template)
    if replacements < 1:
        raise ValueError(f'{path} is missing the static "{key}" collection count.')
    return updated


def build_sitemap_xml(content: dict) -> str:
    urls = list(BASE_PAGES)
    urls.extend(blog_path(post) for post in as_list(content.get("blogPosts")) if post.get("status") != "draft" and post.get("id"))
    urls.extend(activity_path(activity) for activity in as_list(content.get("activities")) if activity.get("id"))
    # A build date is not a page modification date. Omit lastmod until the
    # content model records significant updates for each individual URL.
    entries = "\n".join(
        f"  <url>\n    <loc>{site_url(url).replace('&', '&amp;')}</loc>\n  </url>"
        for url in urls
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}\n</urlset>\n'


def published_blog_posts(content: dict) -> list[dict]:
    return [
        post for post in as_list(content.get("blogPosts"))
        if post.get("status") != "draft" and post.get("id")
    ]


def build_blog_index_fallback_html(content: dict) -> str:
    posts = published_blog_posts(content)

    if not posts:
        return (
            f"        {BLOG_INDEX_FALLBACK_START}\n"
            '        <p class="blog-note">More research notes coming soon.</p>\n'
            f"        {BLOG_INDEX_FALLBACK_END}"
        )

    rows = []
    for post in posts:
        date = post.get("date") or ""
        date_label = post.get("dateLabel") or date
        title = post.get("title") or ""
        excerpt = post.get("excerpt") or ""
        rows.append(
            '        <article class="post-row">\n'
            f'          <time datetime="{escape(date)}">{escape(date_label)}</time>\n'
            "          <div>\n"
            f'            <h2><a href="{escape(blog_path(post))}">{escape(title)}</a></h2>\n'
            f"            <p>{render_text_with_breaks(excerpt)}</p>\n"
            "          </div>\n"
            "        </article>"
        )

    return (
        f"        {BLOG_INDEX_FALLBACK_START}\n"
        + "\n".join(rows)
        + f"\n        {BLOG_INDEX_FALLBACK_END}"
    )


def replace_blog_index_fallback_html(template: str, content: dict) -> str:
    start = template.find(BLOG_INDEX_FALLBACK_START)
    end = template.find(BLOG_INDEX_FALLBACK_END)

    if start == -1 or end == -1 or end < start:
        raise ValueError("blog.html is missing blog index fallback markers.")

    end += len(BLOG_INDEX_FALLBACK_END)
    line_start = template.rfind("\n", 0, start) + 1
    line_end = template.find("\n", end)

    if not template[line_start:start].strip():
        start = line_start
    if line_end != -1:
        end = line_end

    return f"{template[:start]}{build_blog_index_fallback_html(content)}{template[end:]}"


def generate_static_files(content: dict) -> None:
    write_text("sitemap.xml", build_sitemap_xml(content))
    write_text("blog.html", replace_blog_index_fallback_html(read_text("blog.html"), content))
    publications_html = read_text("publications.html")
    publications_html = replace_generated_block(
        publications_html,
        PUBLICATIONS_STATIC_START,
        PUBLICATIONS_STATIC_END,
        build_publications_static_html(content),
        "publications.html",
    )
    publications_html = replace_generated_block(
        publications_html,
        PUBLICATIONS_JSON_LD_START,
        PUBLICATIONS_JSON_LD_END,
        build_publications_json_ld_html(content),
        "publications.html",
    )
    publications_html = replace_collection_count_html(
        publications_html,
        "publications",
        static_counts(content)["publications"],
        "publications.html",
    )
    write_text("publications.html", publications_html)

    honors_html = read_text("honors.html")
    honors_html = replace_generated_block(
        honors_html,
        HONORS_AWARDS_STATIC_START,
        HONORS_AWARDS_STATIC_END,
        build_honors_awards_static_html(content),
        "honors.html",
    )
    honors_html = replace_generated_block(
        honors_html,
        HONORS_JSON_LD_START,
        HONORS_JSON_LD_END,
        build_honors_json_ld_html(content),
        "honors.html",
    )
    honors_html = replace_collection_count_html(
        honors_html,
        "awards",
        static_counts(content)["awards"],
        "honors.html",
    )
    write_text("honors.html", honors_html)

    about_html = read_text("about.html")
    about_html = replace_generated_block(
        about_html,
        ABOUT_PUBLICATIONS_STATIC_START,
        ABOUT_PUBLICATIONS_STATIC_END,
        build_about_publications_static_html(content),
        "about.html",
    )
    about_html = replace_generated_block(
        about_html,
        ABOUT_RECOGNITION_STATIC_START,
        ABOUT_RECOGNITION_STATIC_END,
        build_about_recognition_static_html(content),
        "about.html",
    )
    about_html = replace_generated_block(
        about_html,
        ABOUT_JSON_LD_START,
        ABOUT_JSON_LD_END,
        build_about_json_ld_html(content),
        "about.html",
    )
    about_html = replace_about_counts_html(about_html, content)
    write_text("about.html", about_html)

    speaking_html = read_text("speaking-media.html")
    for key, start_marker, end_marker in [
        ("talks", SPEAKING_TALKS_STATIC_START, SPEAKING_TALKS_STATIC_END),
        ("presentations", SPEAKING_PRESENTATIONS_STATIC_START, SPEAKING_PRESENTATIONS_STATIC_END),
        ("posters", SPEAKING_POSTERS_STATIC_START, SPEAKING_POSTERS_STATIC_END),
    ]:
        speaking_html = replace_generated_block(
            speaking_html,
            start_marker,
            end_marker,
            build_speaking_static_html(content, key, start_marker, end_marker),
            "speaking-media.html",
        )
    speaking_html = replace_generated_block(
        speaking_html,
        SPEAKING_MEDIA_STATIC_START,
        SPEAKING_MEDIA_STATIC_END,
        build_speaking_media_static_html(content),
        "speaking-media.html",
    )
    speaking_html = replace_generated_block(
        speaking_html,
        SPEAKING_MEDIA_JSON_LD_START,
        SPEAKING_MEDIA_JSON_LD_END,
        build_speaking_media_json_ld_html(content),
        "speaking-media.html",
    )
    write_text("speaking-media.html", speaking_html)

    index_html = replace_home_stats_html(read_text("index.html"), content)
    index_html = replace_generated_block(
        index_html,
        HOME_HIGHLIGHTS_STATIC_START,
        HOME_HIGHLIGHTS_STATIC_END,
        build_home_highlights_static_html(content),
        "index.html",
    )
    index_html = replace_generated_block(
        index_html,
        HOME_JSON_LD_START,
        HOME_JSON_LD_END,
        build_home_json_ld_html(content),
        "index.html",
    )
    write_text("index.html", index_html)
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
        for link_index, link in enumerate(as_list(highlight.get("links"))):
            check_required_string(link.get("label"), f"homeHighlights[{index}].links[{link_index}].label")
            check_url(link.get("href"), f"homeHighlights[{index}].links[{link_index}].href")

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
    for key in ["awards", "talks", "presentations", "posters", "mediaCoverage", "services"]:
        if not isinstance(honors.get(key), list):
            add_error(f"honors.{key} should be an array.")
    for key in ["awards", "talks", "presentations", "posters", "mediaCoverage"]:
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
        if post.get("status") == "published" and str(post.get("title", "")).strip() in PLACEHOLDER_BLOG_TITLES:
            add_error(f"blogPosts[{index}].title is still a placeholder.")
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
    blog_index_path = ROOT / "blog.html"
    blog_index_html = blog_index_path.read_text(encoding="utf-8") if blog_index_path.exists() else ""
    publications_html = read_text("publications.html")
    honors_html = read_text("honors.html")
    about_html = read_text("about.html")
    speaking_html = read_text("speaking-media.html")
    index_html = read_text("index.html")
    robots = read_text("robots.txt")
    if not sitemap:
        add_error("sitemap.xml is missing.")
    if not blog_index_html:
        add_error("blog.html is missing.")
    elif build_blog_index_fallback_html(content) not in blog_index_html:
        add_error("blog.html static fallback is stale. Run python3 scripts/check_site.py --fix.")
    if build_publications_static_html(content) not in publications_html:
        add_error("publications.html static publication list is stale. Run python3 scripts/check_site.py --fix.")
    publication_count = len(as_list(content.get("publications")))
    if len(re.findall(r'<article class="publication-item"[^>]*data-publication-item', publications_html)) != publication_count:
        add_error("publications.html must contain every publication in its initial HTML response.")
    if re.search(r"正在載入著作清單|Loading publications", publications_html, re.I):
        add_error("publications.html still exposes a loading-only fallback to crawlers.")
    if build_publications_json_ld_html(content) not in publications_html:
        add_error("publications.html JSON-LD is stale. Run python3 scripts/check_site.py --fix.")
    if replace_collection_count_html(
        publications_html,
        "publications",
        static_counts(content)["publications"],
        "publications.html",
    ) != publications_html:
        add_error("publications.html visible publication count is stale. Run python3 scripts/check_site.py --fix.")
    if build_honors_awards_static_html(content) not in honors_html:
        add_error("honors.html static awards list is stale. Run python3 scripts/check_site.py --fix.")
    if build_honors_json_ld_html(content) not in honors_html:
        add_error("honors.html JSON-LD is stale. Run python3 scripts/check_site.py --fix.")
    if replace_collection_count_html(
        honors_html,
        "awards",
        static_counts(content)["awards"],
        "honors.html",
    ) != honors_html:
        add_error("honors.html visible awards count is stale. Run python3 scripts/check_site.py --fix.")
    if build_about_publications_static_html(content) not in about_html:
        add_error("about.html selected publications are stale. Run python3 scripts/check_site.py --fix.")
    if build_about_recognition_static_html(content) not in about_html:
        add_error("about.html selected recognition is stale. Run python3 scripts/check_site.py --fix.")
    if build_about_json_ld_html(content) not in about_html:
        add_error("about.html JSON-LD is stale. Run python3 scripts/check_site.py --fix.")
    if replace_about_counts_html(about_html, content) != about_html:
        add_error("about.html publication category counts are stale. Run python3 scripts/check_site.py --fix.")
    for key, start_marker, end_marker in [
        ("talks", SPEAKING_TALKS_STATIC_START, SPEAKING_TALKS_STATIC_END),
        ("presentations", SPEAKING_PRESENTATIONS_STATIC_START, SPEAKING_PRESENTATIONS_STATIC_END),
        ("posters", SPEAKING_POSTERS_STATIC_START, SPEAKING_POSTERS_STATIC_END),
    ]:
        if build_speaking_static_html(content, key, start_marker, end_marker) not in speaking_html:
            add_error(f"speaking-media.html {key} list is stale. Run python3 scripts/check_site.py --fix.")
    if build_speaking_media_static_html(content) not in speaking_html:
        add_error("speaking-media.html media list is stale. Run python3 scripts/check_site.py --fix.")
    if build_speaking_media_json_ld_html(content) not in speaking_html:
        add_error("speaking-media.html JSON-LD is stale. Run python3 scripts/check_site.py --fix.")
    if replace_home_stats_html(index_html, content) != index_html:
        add_error("index.html static statistics are stale. Run python3 scripts/check_site.py --fix.")
    if build_home_highlights_static_html(content) not in index_html:
        add_error("index.html static highlights are stale. Run python3 scripts/check_site.py --fix.")
    if build_home_json_ld_html(content) not in index_html:
        add_error("index.html Person/WebSite JSON-LD is stale. Run python3 scripts/check_site.py --fix.")
    for crawl_target in ["about.html", "speaking-media.html"]:
        if not re.search(rf'<a\b[^>]*href=["\']{re.escape(crawl_target)}["\']', index_html, re.I):
            add_error(f"index.html raw HTML should link directly to {crawl_target}.")
    person_data = person_json_ld_data(content)
    same_as = set(as_list(person_data.get("sameAs")))
    subject_urls = {
        subject.get("url")
        for subject in as_list(person_data.get("subjectOf"))
        if isinstance(subject, dict) and subject.get("url")
    }
    if same_as & subject_urls:
        add_error("Third-party coverage must use Person.subjectOf, not Person.sameAs.")
    required_subject_urls = {
        "https://med.nycu.edu.tw/med/ch/app/news/view?module=headnews&id=36202&serno=6d0b3c22-9a21-4d44-9394-94d0df7cc38a": "AHA",
        "https://med.nycu.edu.tw/med/ch/app/news/view?module=headnews&id=36202&serno=f7e81bda-0e49-499d-b5f8-3ea961b90ec1": "ACOH",
    }
    for subject_url, label in required_subject_urls.items():
        if subject_url not in subject_urls:
            add_error(f"Person.subjectOf is missing the official NYCU School of Medicine {label} coverage.")
    if not re.search(r"User-agent:\s*OAI-SearchBot\s+Allow:\s*/", robots, re.I):
        add_error("robots.txt should explicitly allow OAI-SearchBot.")
    if not re.search(r"User-agent:\s*\*\s+Allow:\s*/", robots, re.I):
        add_error("robots.txt should allow general crawlers, including Googlebot and Bingbot.")
    for page in BASE_PAGES:
        url = site_url(page)
        if sitemap and url.replace("&", "&amp;") not in sitemap:
            add_error(f"sitemap.xml is missing {url}")
        relative_path = "index.html" if not page else page
        page_html = read_text(relative_path)
        if not re.search(r"<title>[^<]+</title>", page_html, re.I):
            add_error(f"{relative_path} is missing a unique page title.")
        if not re.search(r'<meta\s+name="description"\s+content="[^"]+"', page_html, re.I):
            add_error(f"{relative_path} is missing a meta description.")
        canonical_match = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', page_html, re.I)
        if not canonical_match or canonical_match.group(1) != url:
            add_error(f"{relative_path} canonical must match its sitemap URL: {url}")
        if not re.search(r"<h1\b", page_html, re.I):
            add_error(f"{relative_path} is missing an H1.")
        if re.search(r'<meta\s+name="robots"[^>]*noindex', page_html, re.I):
            add_error(f"{relative_path} should be indexable but contains noindex.")
    for post in as_list(content.get("blogPosts")):
        if post.get("status") == "draft" or not post.get("id"):
            continue
        path = blog_path(post)
        url = site_url(path)
        post_path = ROOT / path
        if not post_path.exists():
            add_error(f"Missing generated blog page: {path}")
        elif post_path.read_text(encoding="utf-8") != build_blog_post_html(post):
            add_error(f"Generated blog page is stale: {path}. Run python3 scripts/check_site.py --fix.")
        if sitemap and url not in sitemap:
            add_error(f"sitemap.xml is missing {url}")
        if blog_index_html and path not in blog_index_html:
            add_error(f"blog.html static fallback is missing {path}")
    for activity in as_list(content.get("activities")):
        if not activity.get("id"):
            continue
        path = activity_path(activity)
        url = site_url(path)
        activity_page_path = ROOT / path
        if not activity_page_path.exists():
            add_error(f"Missing generated activity page: {path}")
        elif activity_page_path.read_text(encoding="utf-8") != build_activity_html(activity):
            add_error(f"Generated activity page is stale: {path}. Run python3 scripts/check_site.py --fix.")
        if sitemap and url not in sitemap:
            add_error(f"sitemap.xml is missing {url}")
    if "activity.html?id=" in sitemap:
        add_warning("sitemap.xml still contains old activity.html?id=... URLs. Run python3 scripts/check_site.py --fix.")
    for html_path in (ROOT / "posts").glob("*.html"):
        relative_path = html_path.relative_to(ROOT).as_posix()
        html = html_path.read_text(encoding="utf-8").lower()
        if relative_path not in {blog_path(post) for post in published_blog_posts(content)} and "noindex" not in html:
            add_error(f"Public orphan post page is not in blogPosts or sitemap: {relative_path}")
    for html_path in ROOT.rglob("*.html"):
        relative_path = html_path.relative_to(ROOT).as_posix()
        html = html_path.read_text(encoding="utf-8")
        if "noindex" in html.lower() and relative_path not in INTENTIONAL_NOINDEX_PAGES:
            add_error(f"Unexpected noindex tag in {relative_path}")
        for match in HTML_LINK_PATTERN.finditer(html):
            target_path = local_link_path(match.group(1), relative_path)
            if target_path and not (ROOT / target_path).exists():
                add_error(f"{relative_path} links to missing local file: {match.group(1)}")


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
    parser.add_argument("--fix", action="store_true", help="Regenerate sitemap, crawler-visible collection pages, and static post pages.")
    args = parser.parse_args()

    content = json.loads(read_text("data/site-content.json"))
    if args.fix:
        generate_static_files(content)
        print("Generated sitemap.xml, crawler-visible collection pages, and static post pages.")

    check_content(content)
    check_generated_files(content)
    check_raw_assets()
    print_results()


if __name__ == "__main__":
    main()
