// ===== Site Chrome (shared header + footer) =====
const SITE_CONFIG = window.SITE_CONFIG || {};
const SITE_NAV_ITEMS = SITE_CONFIG.navItems || [
  { href: "index.html", label: "Home", page: "home" },
  { href: "publications.html", label: "Publications", page: "publications" },
  { href: "blog.html", label: "Blog", page: "blog" },
  { href: "honors.html", label: "Honors", page: "honors" },
  { href: "activities.html", label: "Activities", page: "activities" }
];

const SITE_FOOTER_LINKS = SITE_CONFIG.footerLinks || [
  { href: "research.html", label: "Research" },
  { href: "publications.html", label: "Publications" },
  { href: "honors.html", label: "Honors" },
  { href: "activities.html", label: "Activities" },
  { href: "blog.html", label: "Blog" },
  { href: "contact.html", label: "Contact" },
  { href: "https://orcid.org/0009-0006-4557-9097", label: "ORCID", external: true },
  { href: "https://scholar.google.com/citations?user=0CdlnrgAAAAJ&hl=zh-TW", label: "Google Scholar", external: true },
  { href: "https://github.com/shchen0603/Personal-Website", label: "GitHub", external: true }
];

const renderSiteChrome = () => {
  const header = document.querySelector("header.site-header[data-header]");
  const footer = document.querySelector("footer.site-footer[data-footer]");
  const currentPage = document.body?.dataset?.page || "";
  const base = document.body?.dataset?.basePath || "";
  const resolve = (href) => (/^https?:\/\//.test(href) || href.startsWith("mailto:") ? href : `${base}${href}`);

  if (header) {
    const tagline = header.dataset.tagline || "MD · Cardiovascular Epidemiology";
    const navHtml = SITE_NAV_ITEMS.map((item) => {
      const isCurrent = item.page === currentPage;
      const aria = isCurrent ? ' aria-current="page"' : "";

      return `<a href="${resolve(item.href)}"${aria}>${item.label}</a>`;
    }).join("\n        ");
    const contactCurrent = currentPage === "contact" ? ' aria-current="page"' : "";

    header.innerHTML = `
      <a class="brand" href="${resolve("index.html")}" aria-label="回到首頁">
        <span class="brand-mark" aria-hidden="true">SC</span>
        <span class="brand-text">
          <strong>陳思翰 · Szu-Han Chen</strong>
          <span>${tagline}</span>
        </span>
      </a>
      <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav">
        <span class="nav-toggle-line"></span>
        <span class="nav-toggle-line"></span>
        <span class="nav-toggle-line"></span>
        <span class="sr-only">開合選單</span>
      </button>
      <nav class="site-nav" id="site-nav" data-nav>
        ${navHtml}
        <a href="${resolve("contact.html")}"${contactCurrent}>Contact</a>
      </nav>
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="切換深色模式" title="切換深色模式">☀</button>
    `;
  }

  if (footer) {
    const linksHtml = SITE_FOOTER_LINKS.map((link) => {
      if (link.external) {
        return `<a href="${link.href}" rel="noreferrer">${link.label}</a>`;
      }

      return `<a href="${resolve(link.href)}">${link.label}</a>`;
    }).join("\n        ");

    footer.innerHTML = `
      <div class="footer-brand">
        <strong>陳思翰 Szu-Han Chen</strong>
        <p>MD candidate and cardiovascular epidemiology researcher focusing on cardiometabolic health, nutrition, obesity, hypertension, and heart failure.</p>
        <p>© <span data-year></span> All rights reserved.</p>
      </div>
      <nav class="footer-links" aria-label="Footer navigation">
        ${linksHtml}
      </nav>
    `;
  }
};

renderSiteChrome();

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const yearElements = document.querySelectorAll("[data-year]");

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });

const renderTextWithBreaks = (value = "") =>
  escapeHTML(value).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");

const renderInlineMarkdown = (value = "") => {
  let html = escapeHTML(value);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
    '<a href="$2" rel="noreferrer">$1</a>'
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return html;
};

const stripClosingHeadingMarkers = (value = "") =>
  String(value || "")
    .replace(/\s+#+\s*$/, "")
    .trim();

const renderMarkdownBlock = (value = "") => {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();

  if (!text) {
    return "";
  }

  const lines = text.split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let code = null;

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    html.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }

    html.push(`<${list.type}>${list.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  const flushQuote = () => {
    if (!quote.length) {
      return;
    }

    html.push(`<blockquote><p>${quote.map(renderInlineMarkdown).join("<br>")}</p></blockquote>`);
    quote = [];
  };

  const flushCode = () => {
    if (!code) {
      return;
    }

    html.push(`<pre><code>${escapeHTML(code.lines.join("\n"))}</code></pre>`);
    code = null;
  };

  const flushOpenBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  lines.forEach((line) => {
    const fence = line.match(/^\s*```/);

    if (fence) {
      if (code) {
        flushCode();
        return;
      }

      flushOpenBlocks();
      code = { lines: [] };
      return;
    }

    if (code) {
      code.lines.push(line);
      return;
    }

    if (!line.trim()) {
      flushOpenBlocks();
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      flushOpenBlocks();

      const level = Math.min(Math.max(heading[1].length, 2), 6);
      html.push(`<h${level}>${renderInlineMarkdown(stripClosingHeadingMarkers(heading[2]))}</h${level}>`);
      return;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unordered || ordered) {
      const type = unordered ? "ul" : "ol";

      flushParagraph();
      flushQuote();

      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }

      list.items.push(unordered ? unordered[1] : ordered[1]);
      return;
    }

    const quoteLine = line.match(/^\s*>\s?(.*)$/);

    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      return;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  });

  flushOpenBlocks();
  flushCode();

  return html.join("");
};

const normalizeList = (value) => (Array.isArray(value) ? value : []);

const getPublishedPosts = (content) =>
  normalizeList(content.blogPosts).filter((post) => post.status !== "draft");

const slugify = (value) =>
  String(value || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "item";

const getActivityId = (activity) =>
  activity.id || `${activity.date || activity.year || "activity"}-${slugify(activity.title)}`;

const getActivityHref = (activity) => {
  const id = getActivityId(activity);

  return id ? `activities/${encodeURIComponent(id)}.html` : "activities.html";
};

const getActivitySortTime = (activity) => {
  if (activity.date) {
    const parsed = Date.parse(activity.date);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const yearMatch = String(activity.year || activity.meta || "").match(/\d{4}/);
  const yearValue = yearMatch ? Number(yearMatch[0]) : 0;

  return yearValue ? Date.UTC(yearValue, 0, 1) : 0;
};

const getSortedActivities = (content) =>
  [...normalizeList(content.activities)].sort((first, second) => {
    const timeDifference = getActivitySortTime(second) - getActivitySortTime(first);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return String(first.title || "").localeCompare(String(second.title || ""));
  });

const getActivityDateLabel = (activity) =>
  activity.dateLabel || activity.date || activity.year || "";

const BLOG_TAG_OPTIONS = SITE_CONFIG.blogTagOptions || [
  { slug: "epidemiology-health-media-literacy", label: "流行病學與健康媒體識讀" },
  { slug: "health-prevention", label: "健康與預防" },
  { slug: "research-methods", label: "研究方法" },
  { slug: "research-notes", label: "研究筆記" },
  { slug: "academic-essay", label: "學術隨筆" }
];

const normalizeBlogTag = (tag) => {
  const source = typeof tag === "string" ? { slug: tag, label: tag } : tag || {};
  const slug = slugify(source.slug || source.label || "");
  const option = BLOG_TAG_OPTIONS.find((item) => item.slug === slug || item.label === source.label);
  const normalizedSlug = option?.slug || slug;

  return normalizedSlug
    ? {
        slug: normalizedSlug,
        label: option?.label || source.label || source.slug || normalizedSlug
      }
    : null;
};

const getBlogTags = (post) =>
  normalizeList(post.tags)
    .map(normalizeBlogTag)
    .filter(Boolean);

const honorCategoryUsesDate = (category) =>
  category === "talks" || category === "presentations";

const PUBLICATION_CATEGORY_OPTIONS = SITE_CONFIG.publicationCategoryOptions || [
  { slug: "peer-reviewed-journal-publications", label: "Peer-Reviewed Journal Publications" },
  { slug: "published-conference-abstracts", label: "Published Conference Abstracts" },
  { slug: "journal-cover-features", label: "Journal Cover Features" }
];
const PUBLICATION_TAG_GROUP_OPTIONS = SITE_CONFIG.publicationTagGroupOptions || ["Study Design", "Topics"];
const PUBLICATION_TAG_OPTIONS = SITE_CONFIG.publicationTagOptions || [
  { slug: "basic-science", label: "Basic Science", group: "Study Design" },
  { slug: "cohort-study", label: "Cohort Study", group: "Study Design" },
  { slug: "meta-analysis", label: "Meta-analysis", group: "Study Design" },
  { slug: "network-meta-analysis", label: "Meta-analysis", group: "Study Design" },
  { slug: "review", label: "Review", group: "Study Design" },
  { slug: "evidence-synthesis", label: "Review", group: "Study Design" },
  { slug: "methods", label: "Methods", group: "Study Design" },
  { slug: "heart-failure", label: "Heart Failure", group: "Topics" },
  { slug: "disability-health", label: "Disability", group: "Topics" },
  { slug: "nutrition", label: "Nutrition", group: "Topics" },
  { slug: "diabetes-care", label: "Diabetes", group: "Topics" },
  { slug: "metabolic-health", label: "Metabolic Health", group: "Topics" },
  { slug: "hypertension", label: "Hypertension", group: "Topics" },
  { slug: "ckm-health", label: "CKM Health", group: "Topics" },
  { slug: "cover-feature", label: "Cover Feature", group: "Topics" },
  { slug: "health-equity", label: "Health Equity", group: "Topics" },
  { slug: "health-services-research", label: "Health Services Research", group: "Topics" },
  { slug: "nationwide-data", label: "Nationwide Data", group: "Topics" },
  { slug: "rare-disease", label: "Rare Disease", group: "Topics" },
  { slug: "rehabilitation", label: "Rehabilitation", group: "Topics" },
  { slug: "mortality", label: "Mortality", group: "Topics" }
];

const getPublicationCategoryOption = (category) => {
  const slug = slugify(category || "");

  return PUBLICATION_CATEGORY_OPTIONS.find((option) => option.slug === slug) || null;
};

const inferPublicationCategory = (publication) => {
  const tags = normalizeList(publication.tags).map((tag) => tag.slug);

  if (tags.includes("cover-feature")) {
    return PUBLICATION_CATEGORY_OPTIONS[2];
  }

  if (/^abstract\b/i.test(publication.title || "")) {
    return PUBLICATION_CATEGORY_OPTIONS[1];
  }

  return PUBLICATION_CATEGORY_OPTIONS[0];
};

const getPublicationCategory = (publication) =>
  getPublicationCategoryOption(publication.category) || inferPublicationCategory(publication);

const getPublicationTagOption = (slug) =>
  PUBLICATION_TAG_OPTIONS.find((tag) => tag.slug === slug) || null;

const getPublicationTagGroup = (group) =>
  PUBLICATION_TAG_GROUP_OPTIONS.includes(group) ? group : "Topics";

const normalizePublicationTag = (tag) => {
  const source = typeof tag === "string" ? { slug: tag, label: tag } : tag || {};
  const slug = slugify(source.slug || source.label || "");
  const option = getPublicationTagOption(slug);

  return slug
    ? {
        slug,
        label: option?.label || source.label || source.slug || slug,
        group: getPublicationTagGroup(source.group || option?.group)
      }
    : null;
};

const getHonorDateLabel = (item) => {
  if (item.dateLabel) {
    return item.dateLabel;
  }

  if (item.date) {
    return String(item.date).replaceAll("-", ".");
  }

  return item.year || "";
};

const getHonorSortTime = (item) => {
  if (item.date) {
    const parsed = Date.parse(item.date);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const yearMatch = String(item.year || "").match(/\d{4}/);
  const yearValue = yearMatch ? Number(yearMatch[0]) : 0;

  return yearValue ? Date.UTC(yearValue, 0, 1) : 0;
};

const getSortedHonors = (items, category = "") => {
  const list = normalizeList(items);

  if (!honorCategoryUsesDate(category)) {
    return list;
  }

  return [...list].sort((first, second) => {
    const timeDifference = getHonorSortTime(second) - getHonorSortTime(first);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return String(first.title || "").localeCompare(String(second.title || ""));
  });
};

const getActivityImages = (activity) => {
  const images = normalizeList(activity.images)
    .map((image) => (typeof image === "string" ? { src: image } : image))
    .filter((image) => image && image.src);
  const cover = activity.image;

  if (cover && !images.some((image) => image.src === cover)) {
    images.unshift({
      src: cover,
      alt: activity.imageAlt || activity.title || "活動照片"
    });
  }

  return images;
};

const getActivityCover = (activity) =>
  activity.image || getActivityImages(activity)[0]?.src || "";

const getActivityBody = (activity) => {
  const body = normalizeList(activity.body);

  if (body.length) {
    return body;
  }

  return String(activity.summary || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
};

yearElements.forEach((el) => {
  el.textContent = new Date().getFullYear();
});

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const renderTags = (tags = [], options = {}) => {
  const interactive = options.interactive !== false;
  const tagName = interactive ? "button" : "span";
  const type = interactive ? " type=\"button\"" : "";
  const staticClass = interactive ? "" : " tag-static";

  return normalizeList(tags)
    .map(normalizePublicationTag)
    .filter(Boolean)
    .map((tag) => {
      const slug = escapeHTML(tag.slug || "");
      const label = escapeHTML(tag.label || tag.slug || "");
      const group = escapeHTML(slugify(getPublicationTagGroup(tag.group)));
      const filterAttributes = interactive
        ? ` data-publication-filter="${slug}" data-publication-filter-group="${group}" aria-pressed="false"`
        : "";

      return `<${tagName} class="tag-button${staticClass}"${type}${filterAttributes}>${label}</${tagName}>`;
    })
    .join("");
};

const PUBLICATION_SELF_NAME_PATTERN = /\b(Szu[- ]?Han\s+Chen)\b/i;

const renderAuthorListWithEmphasis = (authors = "") => {
  const escaped = escapeHTML(authors);

  return escaped.replace(PUBLICATION_SELF_NAME_PATTERN, "<strong>$1</strong>");
};

const renderAuthorRoleBadges = (publication) => {
  const badges = [];

  if (publication.firstAuthor) {
    badges.push('<span class="author-role-badge author-role-first" title="First author">First author</span>');
  }

  if (publication.correspondingAuthor) {
    badges.push('<span class="author-role-badge author-role-corresponding" title="Corresponding author">Corresponding author</span>');
  }

  return badges.length
    ? `<div class="author-role-badges" aria-label="作者身份">${badges.join("")}</div>`
    : "";
};

const getDoiText = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");

const renderPublicationItem = (publication, options = {}) => {
  const link = publication.doi || publication.href || "#";
  const tags = normalizeList(publication.tags);
  const tagMarkup = tags.length
    ? `<div class="publication-tags" aria-label="著作標籤">${renderTags(tags, { interactive: options.interactiveTags !== false })}</div>`
    : "";
  const itemAttributes = options.filterable
    ? ` data-publication-item data-tags="${escapeHTML(tags.map((tag) => tag.slug).join(" "))}"`
    : "";
  const authorBadges = renderAuthorRoleBadges(publication);
  const summary = publication.summary
    ? `<p class="publication-summary">${escapeHTML(publication.summary)}</p>`
    : "";
  const doiText = getDoiText(publication.doi);
  const doiMarkup = doiText
    ? `<p class="publication-doi">DOI: ${escapeHTML(doiText)}</p>`
    : "";

  return `
    <article class="publication-item${options.cta ? " publication-cta" : ""}"${itemAttributes}>
      <p class="publication-year">${escapeHTML(publication.year || "")}</p>
      <div>
        <h3><a href="${escapeHTML(link)}" rel="noreferrer">${escapeHTML(publication.title || "")}</a></h3>
        ${authorBadges}
        ${publication.authors ? `<p class="publication-authors">${renderAuthorListWithEmphasis(publication.authors)}</p>` : ""}
        ${publication.venue ? `<p class="publication-venue">${escapeHTML(publication.venue)}</p>` : ""}
        ${doiMarkup}
        ${summary}
        ${tagMarkup}
      </div>
    </article>
  `;
};

const getPublicationGroups = (publications) => {
  const groups = new Map(
    PUBLICATION_CATEGORY_OPTIONS.map((category) => [
      category.slug,
      { ...category, items: [] }
    ])
  );

  publications.forEach((publication) => {
    const category = getPublicationCategory(publication);

    groups.get(category.slug).items.push(publication);
  });

  return [...groups.values()].filter((group) => group.items.length);
};

const renderPublicationGroup = (group) => `
  <section class="publication-group" data-publication-group data-publication-group-slug="${escapeHTML(group.slug)}">
    <div class="publication-group-heading">
      <h3>${escapeHTML(group.label)}</h3>
      ${group.slug === "published-conference-abstracts" ? '<p class="publication-group-note">Conference abstracts presented at scientific meetings (not peer-reviewed full papers).</p>' : ""}
    </div>
    <div class="publication-list">
      ${group.items.map((publication) => renderPublicationItem(publication, { filterable: true })).join("")}
    </div>
  </section>
`;

const renderHonorItem = (item) => `
  <article class="honor-item">
    <p class="honor-year">${escapeHTML(getHonorDateLabel(item))}</p>
    <div>
      <h3>${escapeHTML(item.title || "")}</h3>
      <p>${escapeHTML(item.description || "")}</p>
    </div>
  </article>
`;

const HONORS_LOAD_MORE_LIMIT = 3;
const HONORS_LOAD_MORE_RENDER_TARGETS = [
  "honor-awards",
  "honor-talks",
  "honor-presentations",
  "media-coverage",
  "honor-services"
];

const setupHonorsLoadMore = () => {
  HONORS_LOAD_MORE_RENDER_TARGETS.forEach((target) => {
    document.querySelectorAll(`[data-render='${target}']`).forEach((container) => {
      const items = [...container.children].filter((child) =>
        child.matches(".honor-item, .media-coverage-item, .service-list-block")
      );
      const parent = container.parentElement;
      const previousControl = parent?.querySelector(`[data-honors-load-more='${target}']`);

      if (previousControl) {
        previousControl.remove();
      }

      if (items.length <= HONORS_LOAD_MORE_LIMIT) {
        items.forEach((item) => {
          item.hidden = false;
        });
        container.dataset.honorsExpanded = "false";
        return;
      }

      if (!container.id) {
        container.id = `honors-${target}`;
      }

      let expanded = container.dataset.honorsExpanded === "true";
      const button = document.createElement("button");
      button.className = "honors-load-more";
      button.type = "button";
      button.dataset.honorsLoadMore = target;
      button.setAttribute("aria-controls", container.id);

      const update = () => {
        const hiddenCount = Math.max(0, items.length - HONORS_LOAD_MORE_LIMIT);

        items.forEach((item, index) => {
          item.hidden = !expanded && index >= HONORS_LOAD_MORE_LIMIT;
        });

        button.textContent = expanded ? "show less..." : "load more...";
        button.setAttribute("aria-label", expanded ? "Show fewer items" : `Load ${hiddenCount} more items`);
        button.setAttribute("aria-expanded", String(expanded));
        container.dataset.honorsExpanded = String(expanded);
      };

      button.addEventListener("click", () => {
        expanded = !expanded;
        update();
      });

      update();
      container.insertAdjacentElement("afterend", button);
    });
  });
};

const renderHomeHighlight = (highlight, index) => {
  const delayClass = index === 1 ? " reveal-delay-1" : index === 2 ? " reveal-delay-2" : index >= 3 ? " reveal-delay-3" : "";
  const title = escapeHTML(highlight.title || "");
  const href = String(highlight.href || "").trim();
  const heading = href
    ? `<h3><a href="${escapeHTML(href)}" rel="noreferrer">${title}</a></h3>`
    : `<h3>${title}</h3>`;

  return `
    <article class="highlight-card reveal${delayClass}">
      <p class="timeline-meta">${escapeHTML(highlight.meta || "")}</p>
      ${heading}
      <p>${escapeHTML(highlight.description || "")}</p>
    </article>
  `;
};

const renderMediaCoverageItem = (item) => {
  const links = normalizeList(item.links)
    .map((link) => {
      const label = escapeHTML(link.label || "Coverage");
      const href = String(link.href || "").trim();

      if (!href) {
        return `<span class="media-pending" title="連結待補">${label} <em>(link pending)</em></span>`;
      }

      return `<a href="${escapeHTML(href)}" rel="noreferrer">${label}</a>`;
    })
    .join("");

  return `
    <li class="media-coverage-item">
      <div>
        <h3>${escapeHTML(item.title || "")}</h3>
        <p>${escapeHTML(item.description || "")}</p>
        ${links ? `<div class="publication-links">${links}</div>` : ""}
      </div>
    </li>
  `;
};

const renderServiceCard = (item) => {
  const links = normalizeList(item.links)
    .map((link) => `<a href="${escapeHTML(link.href || "#")}" rel="noreferrer">${escapeHTML(link.label || "Link")}</a>`)
    .join("");
  const items = normalizeList(item.items)
    .map((entry) => `<li>${escapeHTML(typeof entry === "string" ? entry : entry.label || entry.title || "")}</li>`)
    .join("");
  const memberships = normalizeList(item.memberships)
    .map((entry) => {
      const membership = typeof entry === "string" ? { label: entry } : entry;
      const period = membership.period
        ? `<span class="service-period">${escapeHTML(membership.period)}</span>`
        : "";

      return `<li>${period}<span>${escapeHTML(membership.label || membership.title || "")}</span></li>`;
    })
    .join("");

  return `
    <section class="service-list-block">
      <h3>${escapeHTML(item.title || "")}</h3>
      ${item.description ? `<p>${escapeHTML(item.description || "")}</p>` : ""}
      ${items ? `<ul class="service-bullet-list">${items}</ul>` : ""}
      ${memberships ? `<ul class="service-membership-list">${memberships}</ul>` : ""}
      ${links ? `<div class="publication-links">${links}</div>` : ""}
    </section>
  `;
};

const renderActivityCard = (activity) => {
  const featuredClass = activity.featured ? " activity-card-featured" : "";
  const visualTheme = activity.visualTheme || "poa";
  const cover = getActivityCover(activity);
  const href = getActivityHref(activity);
  const image = cover
    ? `<img class="activity-photo" src="${escapeHTML(cover)}" alt="${escapeHTML(activity.imageAlt || activity.title || "活動照片")}" loading="lazy" decoding="async">`
    : `<div class="activity-visual activity-visual-${escapeHTML(visualTheme)}" role="img" aria-label="${escapeHTML(activity.title || "活動")}活動視覺"><span>${escapeHTML(activity.visualLabel || activity.title || "Activity")}</span></div>`;

  return `
    <article class="activity-card${featuredClass}">
      <a class="activity-media-link" href="${href}" aria-label="閱讀 ${escapeHTML(activity.title || "活動")} 完整紀錄">
        ${image}
      </a>
      <div class="activity-content">
        <p class="activity-meta">${escapeHTML(activity.meta || "")}</p>
        <h3><a href="${href}">${escapeHTML(activity.title || "")}</a></h3>
        <p>${renderTextWithBreaks(activity.summary || "")}</p>
        <a class="activity-read-more" href="${href}">Read full notes</a>
      </div>
    </article>
  `;
};

const renderActivityLogItem = (activity) => `
  <article>
    <time datetime="${escapeHTML(activity.date || activity.year || "")}">${escapeHTML(getActivityDateLabel(activity))}</time>
    <div>
      <h3><a href="${escapeHTML(getActivityHref(activity))}">${escapeHTML(activity.title || "")}</a></h3>
      <p>${renderTextWithBreaks(activity.summary || activity.meta || "")}</p>
    </div>
  </article>
`;

const renderBlogTagButtons = (tags = [], options = {}) => {
  const interactive = options.interactive !== false;
  const tagName = interactive ? "button" : "span";
  const type = interactive ? " type=\"button\"" : "";
  const staticClass = interactive ? "" : " tag-static";

  return normalizeList(tags)
    .map((tag) => {
      const slug = escapeHTML(tag.slug);
      const attributes = interactive ? ` data-blog-tag-filter="${slug}" aria-pressed="false"` : "";

      return `<${tagName} class="tag-button${staticClass}"${type}${attributes}>${escapeHTML(tag.label)}</${tagName}>`;
    })
    .join("");
};

const getBlogFilters = () => {
  const tags = new Map();

  BLOG_TAG_OPTIONS.forEach((tag) => {
    tags.set(tag.slug, tag);
  });

  return {
    tags: [...tags.values()]
  };
};

const renderBlogFilters = (posts) => {
  const { tags } = getBlogFilters(posts);

  if (!tags.length) {
    return "";
  }

  return `
    <div class="blog-filter" aria-label="篩選文章">
      <div class="blog-filter-group">
        <p>標籤</p>
        <div>
          <button class="tag-button is-active" type="button" data-blog-tag-filter="all" aria-pressed="true">全部</button>
          ${renderBlogTagButtons(tags)}
        </div>
      </div>
    </div>
  `;
};

const getBlogPostHref = (post) =>
  post && post.id ? `posts/${encodeURIComponent(post.id)}.html` : "blog.html";

const renderBlogRow = (post) => {
  const tags = getBlogTags(post);

  return `
    <article class="post-row" data-blog-post data-tags="${escapeHTML(tags.map((tag) => tag.slug).join(" "))}">
      <time datetime="${escapeHTML(post.date || "")}">${escapeHTML(post.dateLabel || post.date || "")}</time>
      <div>
        <h2><a href="${escapeHTML(getBlogPostHref(post))}">${escapeHTML(post.title || "")}</a></h2>
        <p>${renderTextWithBreaks(post.excerpt || "")}</p>
        ${tags.length ? `<div class="post-tags" aria-label="文章標籤">${renderBlogTagButtons(tags)}</div>` : ""}
      </div>
    </article>
  `;
};

const renderHomePostCard = (post) => `
  <article class="post-card">
    <p class="post-meta">${escapeHTML(post.dateLabel || post.date || "")}</p>
    <h3><a href="${escapeHTML(getBlogPostHref(post))}">${escapeHTML(post.title || "")}</a></h3>
    <p>${renderTextWithBreaks(post.excerpt || "")}</p>
  </article>
`;

const renderBlogNote = () => `<p class="blog-note">More research notes coming soon.</p>`;

const SITE_ORIGIN = SITE_CONFIG.siteOrigin || "https://shchen0603.github.io/Personal-Website";

const injectJsonLd = (id, data) => {
  if (typeof document === "undefined" || !data) {
    return;
  }

  let script = document.querySelector(`script[type="application/ld+json"][data-jsonld-id="${id}"]`);

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.jsonldId = id;
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
};

const updateSocialMeta = ({ title, description, url, image }) => {
  if (typeof document === "undefined") {
    return;
  }

  const setAttribute = (selector, attribute, value) => {
    const element = document.querySelector(selector);

    if (element && typeof value === "string" && value) {
      element.setAttribute(attribute, value);
    }
  };

  if (title) {
    setAttribute("meta[data-og-title]", "content", title);
  }

  if (description) {
    setAttribute("meta[name='description']", "content", description);
    setAttribute("meta[data-og-description]", "content", description);
  }

  if (url) {
    setAttribute("link[data-canonical]", "href", url);
    setAttribute("meta[data-og-url]", "content", url);
  }

  if (image) {
    setAttribute("meta[data-og-image]", "content", image);
  }
};

const renderBlogPost = (content) => {
  const container = document.querySelector("[data-render='blog-post']");

  if (!container) {
    return;
  }

  const postId = new URLSearchParams(window.location.search).get("id");
  const post = normalizeList(content.blogPosts).find((item) => item.id === postId && item.status !== "draft");

  if (!post) {
    container.innerHTML = `
      <header class="article-header">
        <a class="back-link" href="blog.html">Back to Blog</a>
        <p class="post-category">Blog</p>
        <h1>找不到這篇文章</h1>
        <p class="article-dek">這篇文章可能尚未發布，或網址中的 id 不正確。</p>
      </header>
    `;
    return;
  }

  document.title = `${post.title} | 陳思翰 Szu-Han Chen`;

  const fullTitle = `${post.title} | 陳思翰 Szu-Han Chen`;
  const canonicalUrl = post.id
    ? `${SITE_ORIGIN}/posts/${encodeURIComponent(post.id)}.html`
    : `${SITE_ORIGIN}/blog.html`;
  const ogImage = post.image
    ? (/^https?:\/\//.test(post.image) ? post.image : `${SITE_ORIGIN}/${post.image.replace(/^\//, "")}`)
    : `${SITE_ORIGIN}/assets/cardiovascular-epidemiology-hero-og.jpg`;

  updateSocialMeta({
    title: fullTitle,
    description: post.excerpt || "",
    url: canonicalUrl,
    image: ogImage
  });

  injectJsonLd("blog-post", {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title || "",
    "description": post.excerpt || "",
    "datePublished": post.date || "",
    "image": ogImage,
    "url": canonicalUrl,
    "mainEntityOfPage": canonicalUrl,
    "author": {
      "@type": "Person",
      "name": "Szu-Han Chen",
      "url": `${SITE_ORIGIN}/`
    },
    "publisher": {
      "@type": "Person",
      "name": "Szu-Han Chen",
      "url": `${SITE_ORIGIN}/`
    },
    "keywords": getBlogTags(post).map((tag) => tag.label).join(", ")
  });

  const image = post.image
    ? `<img class="article-image" src="${escapeHTML(post.image)}" alt="${escapeHTML(post.imageAlt || post.title)}" loading="lazy" decoding="async">`
    : "";
  const body = normalizeList(post.body)
    .map(renderMarkdownBlock)
    .join("");

  container.innerHTML = `
    <header class="article-header">
      <a class="back-link" href="blog.html">Back to Blog</a>
      <p class="post-category">${escapeHTML(post.dateLabel || post.date || "")}</p>
      <h1>${escapeHTML(post.title || "")}</h1>
      <p class="article-dek">${renderTextWithBreaks(post.excerpt || "")}</p>
      ${getBlogTags(post).length ? `<div class="post-tags" aria-label="文章標籤">${renderBlogTagButtons(getBlogTags(post), { interactive: false })}</div>` : ""}
    </header>
    <div class="article-body">
      ${image}
      ${body}
    </div>
  `;
};

const renderActivityPost = (content) => {
  const container = document.querySelector("[data-render='activity-post']");

  if (!container) {
    return;
  }

  const activityId = new URLSearchParams(window.location.search).get("id");
  const activity = normalizeList(content.activities).find((item) => getActivityId(item) === activityId);

  if (!activity) {
    container.innerHTML = `
      <header class="article-header">
        <a class="back-link" href="activities.html">Back to Activities</a>
        <p class="post-category">Activities</p>
        <h1>找不到這篇活動紀錄</h1>
        <p class="article-dek">這篇活動紀錄可能尚未發布，或網址中的 id 不正確。</p>
      </header>
    `;
    return;
  }

  document.title = `${activity.title} | Activities | 陳思翰 Szu-Han Chen`;

  const fullActivityTitle = `${activity.title} | Activities | 陳思翰 Szu-Han Chen`;
  const activityCanonical = `${SITE_ORIGIN}/${getActivityHref(activity)}`;
  const activityOgImage = activity.image
    ? (/^https?:\/\//.test(activity.image) ? activity.image : `${SITE_ORIGIN}/${activity.image.replace(/^\//, "")}`)
    : `${SITE_ORIGIN}/assets/cardiovascular-epidemiology-hero-og.jpg`;

  updateSocialMeta({
    title: fullActivityTitle,
    description: activity.summary || activity.meta || "",
    url: activityCanonical,
    image: activityOgImage
  });

  const dateLabel = getActivityDateLabel(activity);
  const meta = activity.meta || dateLabel || "Activity";
  const compactMeta = dateLabel && activity.year && meta.startsWith(`${activity.year} · `)
    ? meta.slice(`${activity.year} · `.length)
    : meta;
  const body = getActivityBody(activity)
    .map((paragraph) => /^[#>]/.test(String(paragraph).trim()) ? renderMarkdownBlock(paragraph) : `<p>${renderTextWithBreaks(paragraph)}</p>`)
    .join("");
  const images = getActivityImages(activity);
  const gallery = images.length
    ? `
      <div class="article-gallery" aria-label="活動照片">
        ${images.map((image) => `
          <figure>
            <img src="${escapeHTML(image.src)}" alt="${escapeHTML(image.alt || activity.imageAlt || activity.title || "活動照片")}" loading="lazy" decoding="async">
            ${image.caption ? `<figcaption>${escapeHTML(image.caption)}</figcaption>` : ""}
          </figure>
        `).join("")}
      </div>
    `
    : "";

  container.innerHTML = `
    <header class="article-header">
      <a class="back-link" href="activities.html">Back to Activities</a>
      <p class="post-category">${escapeHTML(dateLabel ? `${dateLabel} · ${compactMeta}` : compactMeta)}</p>
      <h1>${escapeHTML(activity.title || "")}</h1>
      <p class="article-dek">${renderTextWithBreaks(activity.summary || "")}</p>
    </header>
    <div class="article-body">
      ${body}
      ${gallery}
    </div>
  `;
};

const getPublicationTagFilters = (publications) => {
  const preferredOrder = [
    "basic-science",
    "cohort-study",
    "meta-analysis",
    "network-meta-analysis",
    "review",
    "heart-failure",
    "disability-health",
    "diabetes-care",
    "nutrition",
    "metabolic-health",
    "hypertension",
    "ckm-health",
    "cover-feature",
    "health-equity",
    "health-services-research",
    "evidence-synthesis",
    "methods",
    "nationwide-data"
  ];
  const tags = new Map();

  publications.forEach((publication) => {
    normalizeList(publication.tags).forEach((tag) => {
      const normalized = normalizePublicationTag(tag);

      if (normalized && !tags.has(normalized.slug)) {
        tags.set(normalized.slug, normalized);
      }
    });
  });

  const ordered = preferredOrder
    .filter((slug) => tags.has(slug))
    .map((slug) => tags.get(slug));
  const remaining = [...tags.values()]
    .filter((tag) => !preferredOrder.includes(tag.slug))
    .sort((first, second) => first.label.localeCompare(second.label));

  return [...ordered, ...remaining];
};

const getPublicationTagFilterGroups = (publications) => {
  const groups = new Map(PUBLICATION_TAG_GROUP_OPTIONS.map((group) => [group, []]));

  getPublicationTagFilters(publications).forEach((tag) => {
    groups.get(getPublicationTagGroup(tag.group)).push(tag);
  });

  return [...groups.entries()]
    .map(([label, tags]) => ({ label, key: slugify(label), tags }))
    .filter((group) => group.tags.length);
};

const publicationState = {
  studyDesign: "all",
  topics: "all",
  query: ""
};

const blogState = {
  tag: "all"
};

const renderContent = (content) => {
  const publications = normalizeList(content.publications);
  const publishedPosts = getPublishedPosts(content);
  const honors = content.honors || {};
  const activities = getSortedActivities(content);
  const awardHonors = normalizeList(honors.awards);
  const talkHonors = getSortedHonors(honors.talks, "talks");
  const presentationHonors = getSortedHonors(honors.presentations, "presentations");
  const mediaCoverage = getSortedHonors(honors.mediaCoverage, "mediaCoverage");
  const homeHighlights = normalizeList(content.homeHighlights);

  document.querySelectorAll("[data-render='home-highlights']").forEach((container) => {
    if (homeHighlights.length) {
      container.innerHTML = homeHighlights.map(renderHomeHighlight).join("");
    }
  });
  const stats = {
    publications: publications.length,
    awards: awardHonors.length,
    appearances: talkHonors.length + presentationHonors.length,
    activities: activities.length
  };

  if (document.querySelector("[data-publication-list]") && publications.length) {
    injectJsonLd("publications", {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Publications of Szu-Han Chen",
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "numberOfItems": publications.length,
      "itemListElement": publications.map((publication, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "ScholarlyArticle",
          "headline": publication.title || "",
          "datePublished": publication.year || "",
          "url": publication.doi || publication.href || `${SITE_ORIGIN}/publications.html`,
          "isPartOf": publication.venue || "",
          "author": (publication.authors || "")
            .split(/,\s*/)
            .filter(Boolean)
            .map((name) => ({ "@type": "Person", "name": name.replace(/\.$/, "") }))
        }
      }))
    });
  }

  document.querySelectorAll("[data-stat]").forEach((element) => {
    const key = element.dataset.stat;
    const value = Number(stats[key]);

    if (!Number.isNaN(value)) {
      element.dataset.count = String(value);
      element.textContent = String(value);
    }
  });

  document.querySelectorAll("[data-render='publication-filters']").forEach((container) => {
    const groups = getPublicationTagFilterGroups(publications);
    const filterGroups = groups.map((group) => `
      <div class="publication-filter-group">
        <p>${escapeHTML(group.label)}</p>
        <div>
          <button class="tag-button is-active" type="button" data-publication-filter-group="${escapeHTML(group.key)}" data-publication-filter="all" aria-pressed="true">All</button>
          ${group.tags.map((tag) => `<button class="tag-button" type="button" data-publication-filter-group="${escapeHTML(group.key)}" data-publication-filter="${escapeHTML(tag.slug)}" aria-pressed="false">${escapeHTML(tag.label)}</button>`).join("")}
        </div>
      </div>
    `);

    container.innerHTML = filterGroups.join("");
  });

  document.querySelectorAll("[data-render='publications']").forEach((container) => {
    container.innerHTML = getPublicationGroups(publications).map(renderPublicationGroup).join("");
  });

  document.querySelectorAll("[data-render='featured-publications']").forEach((container) => {
    const featured = publications.find((publication) => publication.featured) || publications[0];
    const items = featured ? [renderPublicationItem(featured, { interactiveTags: false })] : [];

    items.push(`
      <article class="publication-item publication-cta">
        <p class="publication-year">All</p>
        <div>
          <h3><a href="publications.html">View all publications</a></h3>
          <p>完整清單包含目前 ORCID public record 中的已發表著作，並依年份排序與主題標籤整理。</p>
          <div class="publication-links" aria-label="著作連結">
            <a href="publications.html">Publications</a>
            <a href="https://orcid.org/0009-0006-4557-9097" rel="noreferrer">ORCID</a>
          </div>
        </div>
      </article>
    `);

    container.innerHTML = items.join("");
  });

  document.querySelectorAll("[data-render='honor-awards']").forEach((container) => {
    container.innerHTML = awardHonors.map(renderHonorItem).join("");
  });

  document.querySelectorAll("[data-render='honor-talks']").forEach((container) => {
    container.innerHTML = talkHonors.map(renderHonorItem).join("");
  });

  document.querySelectorAll("[data-render='honor-presentations']").forEach((container) => {
    container.innerHTML = presentationHonors.map(renderHonorItem).join("");
  });

  document.querySelectorAll("[data-render='media-coverage']").forEach((container) => {
    container.innerHTML = mediaCoverage.map(renderMediaCoverageItem).join("");
  });

  document.querySelectorAll("[data-render='honor-services']").forEach((container) => {
    container.innerHTML = normalizeList(honors.services).map(renderServiceCard).join("");
  });

  document.querySelectorAll("[data-render='activity-gallery']").forEach((container) => {
    container.innerHTML = activities.map(renderActivityCard).join("");
  });

  document.querySelectorAll("[data-render='activity-log']").forEach((container) => {
    container.innerHTML = activities
      .filter((activity) => activity.log)
      .map(renderActivityLogItem)
      .join("");
  });

  document.querySelectorAll("[data-render='blog-index']").forEach((container) => {
    const rows = publishedPosts.map(renderBlogRow).join("");
    const note = publishedPosts.length < 2 ? renderBlogNote() : "";

    container.innerHTML = rows
      ? `${renderBlogFilters(publishedPosts)}<div class="blog-post-list" data-blog-post-list>${rows}</div><p class="blog-empty" data-blog-empty hidden>目前沒有符合篩選條件的文章。</p>${note}`
      : renderBlogNote();
  });

  document.querySelectorAll("[data-render='home-posts']").forEach((container) => {
    container.innerHTML = publishedPosts.slice(0, 2).map(renderHomePostCard).join("");
  });

  renderBlogPost(content);
  renderActivityPost(content);
  setupPublicationFilters();
  setupBlogFilters();
  setupHonorsLoadMore();
  setupScrollReveal();
};

const setupBlogFilters = () => {
  const posts = document.querySelectorAll("[data-blog-post]");
  const tagFilters = document.querySelectorAll("[data-blog-tag-filter]");
  const empty = document.querySelector("[data-blog-empty]");

  if (!posts.length) {
    return;
  }

  const applyBlogFilters = () => {
    let visibleCount = 0;

    posts.forEach((post) => {
      const tags = (post.dataset.tags || "").split(" ").filter(Boolean);
      const matchesTag = blogState.tag === "all" || tags.includes(blogState.tag);
      const isVisible = matchesTag;

      post.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    tagFilters.forEach((button) => {
      const isActive = button.dataset.blogTagFilter === blogState.tag;

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (empty) {
      empty.hidden = visibleCount > 0;
    }
  };

  tagFilters.forEach((button) => {
    if (button.dataset.blogTagBound === "true") {
      return;
    }

    button.dataset.blogTagBound = "true";
    button.addEventListener("click", () => {
      blogState.tag = button.dataset.blogTagFilter || "all";
      applyBlogFilters();
    });
  });

  applyBlogFilters();
};

const setupPublicationFilters = () => {
  const publicationItems = document.querySelectorAll("[data-publication-item]");
  const publicationFilters = document.querySelectorAll("[data-publication-filter]");
  const publicationGroups = document.querySelectorAll("[data-publication-group]");
  const publicationEmpty = document.querySelector("[data-publication-empty]");
  const searchInput = document.querySelector("[data-publication-search]");

  if (!publicationItems.length) {
    return;
  }

  const getPublicationFilterStateKey = (group) =>
    group === "study-design" ? "studyDesign" : "topics";

  const applyPublicationFilters = () => {
    let visibleCount = 0;

    publicationItems.forEach((item) => {
      const tags = (item.dataset.tags || "").split(" ");
      const text = item.textContent.toLowerCase();
      const matchesStudyDesign = publicationState.studyDesign === "all" || tags.includes(publicationState.studyDesign);
      const matchesTopic = publicationState.topics === "all" || tags.includes(publicationState.topics);
      const matchesQuery = !publicationState.query || text.includes(publicationState.query);
      const isVisible = matchesStudyDesign && matchesTopic && matchesQuery;

      item.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    publicationGroups.forEach((group) => {
      group.hidden = ![...group.querySelectorAll("[data-publication-item]")]
        .some((item) => !item.hidden);
    });

    publicationFilters.forEach((button) => {
      const stateKey = getPublicationFilterStateKey(button.dataset.publicationFilterGroup || "topics");
      const isActive = button.dataset.publicationFilter === publicationState[stateKey];

      button.classList.toggle("is-active", isActive);

      if (button.hasAttribute("aria-pressed")) {
        button.setAttribute("aria-pressed", String(isActive));
      }
    });

    if (publicationEmpty) {
      publicationEmpty.hidden = visibleCount > 0;
      publicationEmpty.textContent = publicationState.studyDesign !== "all" || publicationState.topics !== "all" || publicationState.query
        ? "目前沒有符合搜尋或篩選條件的著作。"
        : "目前沒有可顯示的著作。";
    }
  };

  publicationFilters.forEach((button) => {
    if (button.dataset.publicationBound === "true") {
      return;
    }

    button.dataset.publicationBound = "true";
    button.addEventListener("click", () => {
      const stateKey = getPublicationFilterStateKey(button.dataset.publicationFilterGroup || "topics");
      publicationState[stateKey] = button.dataset.publicationFilter || "all";
      applyPublicationFilters();
    });
  });

  if (searchInput && searchInput.dataset.publicationSearchBound !== "true") {
    searchInput.dataset.publicationSearchBound = "true";
    searchInput.addEventListener("input", () => {
      publicationState.query = searchInput.value.toLowerCase().trim();
      applyPublicationFilters();
    });
  }

  publicationState.query = searchInput ? searchInput.value.toLowerCase().trim() : publicationState.query;
  applyPublicationFilters();
};

const loadSiteContent = async () => {
  if (!document.querySelector("[data-render]")) {
    setupPublicationFilters();
    return;
  }

  try {
    const response = await fetch("data/site-content.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Content request failed: ${response.status}`);
    }

    renderContent(await response.json());
  } catch (error) {
    console.warn("Site content could not be loaded. Static fallback content is still visible.", error);
    setupPublicationFilters();
  }
};

// ===== Dark Mode Toggle =====
const setupThemeToggle = () => {
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  const updateIcon = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    toggles.forEach((btn) => {
      btn.textContent = isDark ? "☾" : "☀";
    });
  };
  updateIcon();
  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const newTheme = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      updateIcon();
    });
  });
};
setupThemeToggle();

// ===== Scroll Reveal Animations =====
let scrollRevealObserver = null;

const showRevealElement = (element) => {
  element.classList.add("is-visible");

  if (element.dataset.revealReadyBound === "true") {
    return;
  }

  element.dataset.revealReadyBound = "true";

  let readyTimer = 0;

  const markReady = () => {
    element.classList.add("reveal-ready");
    element.removeEventListener("transitionend", handleTransitionEnd);

    if (readyTimer) {
      window.clearTimeout(readyTimer);
    }
  };

  const handleTransitionEnd = (event) => {
    if (event.target === element && (event.propertyName === "opacity" || event.propertyName === "transform")) {
      markReady();
    }
  };

  element.addEventListener("transitionend", handleTransitionEnd);
  readyTimer = window.setTimeout(markReady, 1300);
};

const setupScrollReveal = () => {
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    document.querySelectorAll(".reveal").forEach((el) => {
      el.classList.add("is-visible", "reveal-ready");
    });
    return;
  }

  if (!scrollRevealObserver) {
    scrollRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            showRevealElement(entry.target);
            scrollRevealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }

  document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
    if (el.dataset.revealBound === "true") {
      return;
    }

    el.dataset.revealBound = "true";
    scrollRevealObserver.observe(el);
  });
};
setupScrollReveal();

// ===== Back to Top Button =====
const setupBackToTop = () => {
  const btn = document.querySelector("[data-back-to-top]");
  if (!btn) return;
  const toggle = () => {
    btn.classList.toggle("is-visible", window.scrollY > 500);
  };
  window.addEventListener("scroll", toggle, { passive: true });
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  toggle();
};
setupBackToTop();

// ===== Publication Search =====
// ===== Stat Counter Animation =====
const setupStatCounters = () => {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (prefersReduced || isNaN(target)) {
      el.textContent = target;
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      el.textContent = current;
    }, 40);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((el) => observer.observe(el));
};
loadSiteContent().finally(setupStatCounters);
