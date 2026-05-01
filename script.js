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

const honorCategoryUsesDate = (category) =>
  category === "talks" || category === "presentations";

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
    .map((tag) => {
      const slug = escapeHTML(tag.slug || "");
      const label = escapeHTML(tag.label || tag.slug || "");

      return `<${tagName} class="tag-button${staticClass}"${type} data-publication-filter="${slug}">${label}</${tagName}>`;
    })
    .join("");
};

const renderPublicationItem = (publication, options = {}) => {
  const link = publication.doi || publication.href || "#";
  const tags = normalizeList(publication.tags);
  const tagMarkup = tags.length
    ? `<div class="publication-tags" aria-label="論文標籤">${renderTags(tags, { interactive: options.interactiveTags !== false })}</div>`
    : "";
  const itemAttributes = options.filterable
    ? ` data-publication-item data-tags="${escapeHTML(tags.map((tag) => tag.slug).join(" "))}"`
    : "";

  return `
    <article class="publication-item${options.cta ? " publication-cta" : ""}"${itemAttributes}>
      <p class="publication-year">${escapeHTML(publication.year || "")}</p>
      <div>
        <h3><a href="${escapeHTML(link)}" rel="noreferrer">${escapeHTML(publication.title || "")}</a></h3>
        ${publication.authors ? `<p class="publication-authors">${escapeHTML(publication.authors)}</p>` : ""}
        ${publication.venue ? `<p class="publication-venue">${escapeHTML(publication.venue)}</p>` : ""}
        ${tagMarkup}
        ${link && link !== "#"
          ? `<div class="publication-links" aria-label="論文連結"><a href="${escapeHTML(link)}" rel="noreferrer">DOI</a></div>`
          : ""}
      </div>
    </article>
  `;
};

const renderHonorItem = (item) => `
  <article class="honor-item">
    <p class="honor-year">${escapeHTML(getHonorDateLabel(item))}</p>
    <div>
      <h3>${escapeHTML(item.title || "")}</h3>
      <p>${escapeHTML(item.description || "")}</p>
    </div>
  </article>
`;

const renderServiceCard = (item) => {
  const links = normalizeList(item.links)
    .map((link) => `<a href="${escapeHTML(link.href || "#")}" rel="noreferrer">${escapeHTML(link.label || "Link")}</a>`)
    .join("");

  return `
    <article class="service-card">
      <h3>${escapeHTML(item.title || "")}</h3>
      <p>${escapeHTML(item.description || "")}</p>
      ${links ? `<div class="publication-links">${links}</div>` : ""}
    </article>
  `;
};

const renderActivityCard = (activity) => {
  const featuredClass = activity.featured ? " activity-card-featured" : "";
  const visualTheme = activity.visualTheme || "poa";
  const cover = getActivityCover(activity);
  const href = `activity.html?id=${encodeURIComponent(getActivityId(activity))}`;
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
      <h3><a href="activity.html?id=${encodeURIComponent(getActivityId(activity))}">${escapeHTML(activity.title || "")}</a></h3>
      <p>${renderTextWithBreaks(activity.summary || activity.meta || "")}</p>
    </div>
  </article>
`;

const renderBlogRow = (post) => `
  <article class="post-row">
    <time datetime="${escapeHTML(post.date || "")}">${escapeHTML(post.dateLabel || post.date || "")}</time>
    <div>
      <p class="post-category">${escapeHTML(post.category || "Blog")}</p>
      <h2><a href="post.html?id=${encodeURIComponent(post.id || "")}">${escapeHTML(post.title || "")}</a></h2>
      <p>${renderTextWithBreaks(post.excerpt || "")}</p>
    </div>
  </article>
`;

const renderHomePostCard = (post) => `
  <article class="post-card">
    <p class="post-meta">${escapeHTML(post.dateLabel || post.date || "")} · ${escapeHTML(post.category || "Blog")}</p>
    <h3><a href="post.html?id=${encodeURIComponent(post.id || "")}">${escapeHTML(post.title || "")}</a></h3>
    <p>${renderTextWithBreaks(post.excerpt || "")}</p>
  </article>
`;

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

  const image = post.image
    ? `<img class="article-image" src="${escapeHTML(post.image)}" alt="${escapeHTML(post.imageAlt || post.title)}" loading="lazy" decoding="async">`
    : "";
  const body = normalizeList(post.body)
    .map((paragraph) => `<p>${renderTextWithBreaks(paragraph)}</p>`)
    .join("");

  container.innerHTML = `
    <header class="article-header">
      <a class="back-link" href="blog.html">Back to Blog</a>
      <p class="post-category">${escapeHTML(post.dateLabel || post.date || "")} · ${escapeHTML(post.category || "Blog")}</p>
      <h1>${escapeHTML(post.title || "")}</h1>
      <p class="article-dek">${renderTextWithBreaks(post.excerpt || "")}</p>
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

  const dateLabel = getActivityDateLabel(activity);
  const meta = activity.meta || dateLabel || "Activity";
  const compactMeta = dateLabel && activity.year && meta.startsWith(`${activity.year} · `)
    ? meta.slice(`${activity.year} · `.length)
    : meta;
  const body = getActivityBody(activity)
    .map((paragraph) => `<p>${renderTextWithBreaks(paragraph)}</p>`)
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
    "heart-failure",
    "ckm-health",
    "disability-health",
    "health-equity",
    "health-services-research",
    "diabetes-care",
    "nutrition",
    "evidence-synthesis",
    "methods",
    "nationwide-data"
  ];
  const tags = new Map();

  publications.forEach((publication) => {
    normalizeList(publication.tags).forEach((tag) => {
      if (tag.slug && !tags.has(tag.slug)) {
        tags.set(tag.slug, tag.label || tag.slug);
      }
    });
  });

  const ordered = preferredOrder
    .filter((slug) => tags.has(slug))
    .map((slug) => ({ slug, label: tags.get(slug) }));
  const remaining = [...tags.entries()]
    .filter(([slug]) => !preferredOrder.includes(slug))
    .map(([slug, label]) => ({ slug, label }));

  return [...ordered, ...remaining];
};

const publicationState = {
  tag: "all",
  query: ""
};

const renderContent = (content) => {
  const publications = normalizeList(content.publications);
  const publishedPosts = getPublishedPosts(content);
  const honors = content.honors || {};
  const activities = getSortedActivities(content);
  const awardHonors = normalizeList(honors.awards);
  const talkHonors = getSortedHonors(honors.talks, "talks");
  const presentationHonors = getSortedHonors(honors.presentations, "presentations");
  const stats = {
    publications: publications.length,
    awards: awardHonors.length,
    appearances: talkHonors.length + presentationHonors.length,
    activities: activities.length
  };

  document.querySelectorAll("[data-stat]").forEach((element) => {
    const key = element.dataset.stat;
    const value = Number(stats[key]);

    if (!Number.isNaN(value)) {
      element.dataset.count = String(value);
      element.textContent = String(value);
    }
  });

  document.querySelectorAll("[data-render='publication-filters']").forEach((container) => {
    const filters = getPublicationTagFilters(publications);
    const buttons = [
      "<button class=\"tag-button is-active\" type=\"button\" data-publication-filter=\"all\" aria-pressed=\"true\">All</button>",
      ...filters.map((tag) => `<button class="tag-button" type="button" data-publication-filter="${escapeHTML(tag.slug)}" aria-pressed="false">${escapeHTML(tag.label)}</button>`)
    ];

    container.innerHTML = buttons.join("");
  });

  document.querySelectorAll("[data-render='publications']").forEach((container) => {
    container.innerHTML = publications.map((publication) => renderPublicationItem(publication, { filterable: true })).join("");
  });

  document.querySelectorAll("[data-render='publication-features']").forEach((container) => {
    container.innerHTML = normalizeList(content.publicationFeatures)
      .map((feature) => renderPublicationItem(feature, { cta: true, interactiveTags: false }))
      .join("");
  });

  document.querySelectorAll("[data-render='featured-publications']").forEach((container) => {
    const featured = publications.find((publication) => publication.featured) || publications[0];
    const items = featured ? [renderPublicationItem(featured, { interactiveTags: false })] : [];

    items.push(`
      <article class="publication-item publication-cta">
        <p class="publication-year">All</p>
        <div>
          <h3><a href="publications.html">View all publications</a></h3>
          <p>完整清單包含目前 ORCID public record 中的已發表論文，並依年份排序與主題標籤整理。</p>
          <div class="publication-links" aria-label="論文連結">
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
    container.innerHTML = publishedPosts.map(renderBlogRow).join("");
  });

  document.querySelectorAll("[data-render='home-posts']").forEach((container) => {
    container.innerHTML = publishedPosts.slice(0, 2).map(renderHomePostCard).join("");
  });

  renderBlogPost(content);
  renderActivityPost(content);
  setupPublicationFilters();
};

const setupPublicationFilters = () => {
  const publicationItems = document.querySelectorAll("[data-publication-item]");
  const publicationFilters = document.querySelectorAll("[data-publication-filter]");
  const publicationEmpty = document.querySelector("[data-publication-empty]");
  const searchInput = document.querySelector("[data-publication-search]");

  if (!publicationItems.length) {
    return;
  }

  const applyPublicationFilters = () => {
    let visibleCount = 0;

    publicationItems.forEach((item) => {
      const tags = (item.dataset.tags || "").split(" ");
      const text = item.textContent.toLowerCase();
      const matchesTag = publicationState.tag === "all" || tags.includes(publicationState.tag);
      const matchesQuery = !publicationState.query || text.includes(publicationState.query);
      const isVisible = matchesTag && matchesQuery;

      item.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    publicationFilters.forEach((button) => {
      const isActive = button.dataset.publicationFilter === publicationState.tag;

      button.classList.toggle("is-active", isActive);

      if (button.hasAttribute("aria-pressed")) {
        button.setAttribute("aria-pressed", String(isActive));
      }
    });

    if (publicationEmpty) {
      publicationEmpty.hidden = visibleCount > 0;
      publicationEmpty.textContent = publicationState.tag !== "all" || publicationState.query
        ? "目前沒有符合搜尋或篩選條件的論文。"
        : "目前沒有可顯示的論文。";
    }
  };

  publicationFilters.forEach((button) => {
    if (button.dataset.publicationBound === "true") {
      return;
    }

    button.dataset.publicationBound = "true";
    button.addEventListener("click", () => {
      publicationState.tag = button.dataset.publicationFilter || "all";
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

loadSiteContent();

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
const setupScrollReveal = () => {
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
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
setupStatCounters();
