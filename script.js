const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const year = document.querySelector("[data-year]");

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

const normalizeList = (value) => (Array.isArray(value) ? value : []);

const getPublishedPosts = (content) =>
  normalizeList(content.blogPosts).filter((post) => post.status !== "draft");

if (year) {
  year.textContent = new Date().getFullYear();
}

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
    <p class="honor-year">${escapeHTML(item.year || "")}</p>
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
  const image = activity.image
    ? `<img class="activity-photo" src="${escapeHTML(activity.image)}" alt="${escapeHTML(activity.imageAlt || activity.title || "活動照片")}">`
    : `<div class="activity-visual activity-visual-${escapeHTML(visualTheme)}" role="img" aria-label="${escapeHTML(activity.title || "活動")}活動視覺"><span>${escapeHTML(activity.visualLabel || activity.title || "Activity")}</span></div>`;

  return `
    <article class="activity-card${featuredClass}">
      ${image}
      <div class="activity-content">
        <p class="activity-meta">${escapeHTML(activity.meta || "")}</p>
        <h3>${escapeHTML(activity.title || "")}</h3>
        <p>${escapeHTML(activity.summary || "")}</p>
      </div>
    </article>
  `;
};

const renderActivityLogItem = (activity) => `
  <article>
    <time datetime="${escapeHTML(activity.year || "")}">${escapeHTML(activity.year || "")}</time>
    <div>
      <h3>${escapeHTML(activity.title || "")}</h3>
      <p>${escapeHTML(activity.summary || activity.meta || "")}</p>
    </div>
  </article>
`;

const renderBlogRow = (post) => `
  <article class="post-row">
    <time datetime="${escapeHTML(post.date || "")}">${escapeHTML(post.dateLabel || post.date || "")}</time>
    <div>
      <p class="post-category">${escapeHTML(post.category || "Blog")}</p>
      <h2><a href="post.html?id=${encodeURIComponent(post.id || "")}">${escapeHTML(post.title || "")}</a></h2>
      <p>${escapeHTML(post.excerpt || "")}</p>
    </div>
  </article>
`;

const renderHomePostCard = (post) => `
  <article class="post-card">
    <p class="post-meta">${escapeHTML(post.dateLabel || post.date || "")} · ${escapeHTML(post.category || "Blog")}</p>
    <h3><a href="post.html?id=${encodeURIComponent(post.id || "")}">${escapeHTML(post.title || "")}</a></h3>
    <p>${escapeHTML(post.excerpt || "")}</p>
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
    ? `<img class="article-image" src="${escapeHTML(post.image)}" alt="${escapeHTML(post.imageAlt || post.title)}">`
    : "";
  const body = normalizeList(post.body)
    .map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`)
    .join("");

  container.innerHTML = `
    <header class="article-header">
      <a class="back-link" href="blog.html">Back to Blog</a>
      <p class="post-category">${escapeHTML(post.dateLabel || post.date || "")} · ${escapeHTML(post.category || "Blog")}</p>
      <h1>${escapeHTML(post.title || "")}</h1>
      <p class="article-dek">${escapeHTML(post.excerpt || "")}</p>
    </header>
    <div class="article-body">
      ${image}
      ${body}
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

const renderContent = (content) => {
  const publications = normalizeList(content.publications);
  const publishedPosts = getPublishedPosts(content);
  const honors = content.honors || {};

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
    container.innerHTML = normalizeList(honors.awards).map(renderHonorItem).join("");
  });

  document.querySelectorAll("[data-render='honor-talks']").forEach((container) => {
    container.innerHTML = normalizeList(honors.talks).map(renderHonorItem).join("");
  });

  document.querySelectorAll("[data-render='honor-presentations']").forEach((container) => {
    container.innerHTML = normalizeList(honors.presentations).map(renderHonorItem).join("");
  });

  document.querySelectorAll("[data-render='honor-services']").forEach((container) => {
    container.innerHTML = normalizeList(honors.services).map(renderServiceCard).join("");
  });

  document.querySelectorAll("[data-render='activity-gallery']").forEach((container) => {
    container.innerHTML = normalizeList(content.activities).map(renderActivityCard).join("");
  });

  document.querySelectorAll("[data-render='activity-log']").forEach((container) => {
    container.innerHTML = normalizeList(content.activities)
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
  setupPublicationFilters();
};

const setupPublicationFilters = () => {
  const publicationItems = document.querySelectorAll("[data-publication-item]");
  const publicationFilters = document.querySelectorAll("[data-publication-filter]");
  const publicationEmpty = document.querySelector("[data-publication-empty]");

  if (!publicationItems.length || !publicationFilters.length) {
    return;
  }

  const setPublicationFilter = (tag) => {
    let visibleCount = 0;

    publicationItems.forEach((item) => {
      const tags = (item.dataset.tags || "").split(" ");
      const isVisible = tag === "all" || tags.includes(tag);

      item.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    publicationFilters.forEach((button) => {
      const isActive = button.dataset.publicationFilter === tag;

      button.classList.toggle("is-active", isActive);

      if (button.hasAttribute("aria-pressed")) {
        button.setAttribute("aria-pressed", String(isActive));
      }
    });

    if (publicationEmpty) {
      publicationEmpty.hidden = visibleCount > 0;
    }
  };

  publicationFilters.forEach((button) => {
    button.addEventListener("click", () => {
      setPublicationFilter(button.dataset.publicationFilter || "all");
    });
  });
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
