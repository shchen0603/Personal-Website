const adminApp = document.querySelector("[data-admin-app]");

if (adminApp) {
  const SITE_CONFIG = window.SITE_CONFIG || {};
  const state = {
    rootHandle: null,
    content: null,
    section: "blogPosts",
    honorCategory: "awards",
    selectedIndex: 0,
    dirty: false,
    publishing: false,
    baseContent: null,
    quickImageFile: null,
    pendingAssetUploads: new Map()
  };

  const status = adminApp.querySelector("[data-admin-status]");
  const openFolderButton = adminApp.querySelector("[data-admin-open-folder]");
  const saveButton = adminApp.querySelector("[data-admin-save]");
  const publishCurrentContentButton = adminApp.querySelector("[data-admin-publish-github]");
  const newButton = adminApp.querySelector("[data-admin-new]");
  const deleteButton = adminApp.querySelector("[data-admin-delete]");
  const list = adminApp.querySelector("[data-admin-list]");
  const editor = adminApp.querySelector("[data-admin-editor]");
  const tabs = adminApp.querySelectorAll("[data-admin-section]");
  const honorCategoryField = adminApp.querySelector(".admin-honor-category");
  const honorCategorySelect = adminApp.querySelector("[data-admin-honor-category]");
  const quickForm = adminApp.querySelector("[data-quick-form]");
  const quickType = adminApp.querySelector("[data-quick-type]");
  const quickFields = adminApp.querySelector("[data-quick-fields]");
  const quickSaveLocalButton = adminApp.querySelector("[data-quick-save-local]");
  const quickPublishGitHubButton = adminApp.querySelector("[data-quick-publish-github]");
  const githubOwner = adminApp.querySelector("[data-github-owner]");
  const githubRepo = adminApp.querySelector("[data-github-repo]");
  const githubBranch = adminApp.querySelector("[data-github-branch]");
  const githubToken = adminApp.querySelector("[data-github-token]");

  const setStatus = (message, tone = "") => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const syncContentActionButtons = () => {
    const saveDisabled = !state.content || !state.dirty || state.publishing;
    const publishDisabled = !state.content || !state.dirty || state.publishing;
    const editorSaveButtons = adminApp.querySelectorAll("[data-editor-save]");
    const editorPublishButtons = adminApp.querySelectorAll("[data-editor-publish-github]");

    [saveButton, ...editorSaveButtons].forEach((button) => {
      button.disabled = saveDisabled;
    });

    [publishCurrentContentButton, ...editorPublishButtons].forEach((button) => {
      button.disabled = publishDisabled;
    });

    quickSaveLocalButton.disabled = !state.content || state.publishing;
    quickPublishGitHubButton.disabled = !state.content || state.publishing;
  };

  const setDirty = (dirty) => {
    state.dirty = dirty;
    syncContentActionButtons();
  };

  const setPublishing = (publishing) => {
    state.publishing = publishing;
    syncContentActionButtons();
  };

  const cloneContent = (content) => JSON.parse(JSON.stringify(content || {}));

  const normalizeContent = (content) => {
    content.blogPosts ||= [];
    normalizeBlogTaxonomyContent(content);
    sortHonorCollections(content.honors ||= {});
    sortActivities(content.activities ||= []);

    return content;
  };

  const getCanonicalContent = (content) => JSON.stringify(normalizeContent(cloneContent(content)));

  const decodeBase64Content = (value = "") => {
    const binary = window.atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  };

  const getFriendlyPublishError = (error) => {
    const rawMessage = error?.message || "";
    let details = null;

    try {
      details = JSON.parse(rawMessage);
    } catch {
      details = null;
    }

    const message = details?.message || rawMessage;

    if (/Resource not accessible by personal access token/i.test(message)) {
      return "GitHub token 權限不足。請重新產生或編輯 fine-grained token：Repository access 選 Personal-Website，Repository permissions 的 Contents 設為 Read and write，然後把新 token 貼回 GitHub 發布設定。";
    }

    if (/Bad credentials/i.test(message)) {
      return "GitHub token 無效或已過期。請重新產生 token，並確認沒有多貼空白。";
    }

    if (/not a fast forward|Reference update failed|GitHub 上的內容已經有新版本/i.test(message)) {
      return "GitHub 上的內容已經有新版本。請先執行 git pull 或重新載入 admin，確認內容後再發布，避免覆蓋另一邊的修改。";
    }

    if (/GitHub API 連線逾時/i.test(message)) {
      return message;
    }

    return rawMessage || "請檢查設定與權限。";
  };

  const slugify = (value) =>
    String(value || "item")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "item";

  const normalizeBlogPostId = (value = "") =>
    String(value || "")
      .trim()
      .replace(/^posts\//i, "")
      .replace(/\.html$/i, "")
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90);

  const getSuggestedBlogPostId = (title = "", date = new Date().toISOString().slice(0, 10)) => {
    const titleSlug = slugify(title);
    const suffix = titleSlug && titleSlug !== "item" ? titleSlug : "blog";

    return normalizeBlogPostId(`${date}-${suffix}`);
  };

  const getExistingBlogPostIds = (content, excludedPost = null) =>
    new Set(
      adminNormalizeList(content?.blogPosts)
        .filter((post) => post !== excludedPost)
        .map((post) => normalizeBlogPostId(post?.id).toLowerCase())
        .filter(Boolean)
    );

  const isDefaultBlogPostId = (value = "") =>
    /^post-\d{4}-\d{2}-\d{2}$/i.test(normalizeBlogPostId(value));

  const isBlogPostIdTaken = (id, content, excludedPost = null) =>
    getExistingBlogPostIds(content, excludedPost).has(normalizeBlogPostId(id).toLowerCase());

  const requestBlogPostId = (post, content, options = {}) => {
    const date = post?.date || new Date().toISOString().slice(0, 10);
    const suggestedId = getSuggestedBlogPostId(post?.title || "新文章", date);
    const existingIds = getExistingBlogPostIds(content, options.excludedPost || null);
    const currentId = normalizeBlogPostId(post?.id || "");
    const defaultId = options.forceSuggestion || !currentId || isDefaultBlogPostId(currentId)
      ? suggestedId
      : currentId;

    while (true) {
      const rawId = window.prompt(
        "請設定這篇 blog 的文章 ID。這會成為網址 posts/<ID>.html；建議使用英文、數字與 hyphen。",
        defaultId
      );

      if (rawId === null) {
        return "";
      }

      const id = normalizeBlogPostId(rawId);

      if (!id) {
        window.alert("文章 ID 不能空白，請重新輸入。");
        continue;
      }

      if (existingIds.has(id.toLowerCase())) {
        window.alert(`文章 ID 已經存在：${id}\n請換一個 ID，避免產生重複網址。`);
        continue;
      }

      return id;
    }
  };

  const requestQuickBlogPostId = (formData, content) => {
    const today = new Date().toISOString().slice(0, 10);
    const post = {
      id: getSuggestedBlogPostId(formData.get("title") || "新文章", today),
      date: today,
      title: formData.get("title") || "新文章"
    };

    return requestBlogPostId(post, content, { forceSuggestion: true });
  };

  const ensurePublishedBlogPostIds = (content) => {
    for (const post of adminNormalizeList(content?.blogPosts)) {
      if (!post || post.status === "draft") {
        continue;
      }

      const currentId = String(post.id || "");
      const normalizedId = normalizeBlogPostId(currentId);
      const needsPrompt =
        !normalizedId ||
        normalizedId !== currentId ||
        isDefaultBlogPostId(normalizedId) ||
        isBlogPostIdTaken(normalizedId, content, post);

      if (!needsPrompt) {
        continue;
      }

      const id = requestBlogPostId(post, content, {
        excludedPost: post,
        forceSuggestion: isDefaultBlogPostId(normalizedId) || isBlogPostIdTaken(normalizedId, content, post)
      });

      if (!id) {
        return false;
      }

      post.id = id;
    }

    return true;
  };

  const adminNormalizeList = (value) => (Array.isArray(value) ? value : []);

  const formatDateForDisplay = (date) => String(date || "").replaceAll("-", ".");
  const honorCategoryUsesDate = (category) =>
    category === "talks" || category === "presentations";
  const PUBLICATION_CATEGORY_OPTIONS = SITE_CONFIG.publicationCategoryOptions || [
    { slug: "journal-publications", label: "Journal Publications" },
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
  const DEFAULT_BLOG_TAG_OPTIONS = SITE_CONFIG.blogTagOptions || [
    { slug: "epidemiology-health-media-literacy", label: "流行病學與健康媒體識讀" },
    { slug: "health-prevention", label: "健康與預防" },
    { slug: "research-methods", label: "研究方法" },
    { slug: "research-notes", label: "研究筆記" },
    { slug: "academic-essay", label: "學術隨筆" }
  ];
  const DEFAULT_BLOG_SERIES_OPTIONS = SITE_CONFIG.blogSeriesOptions || [];
  const HEIC_MIME_TYPES = new Set([
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence"
  ]);
  const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;
  const HEIC_OUTPUT_MIME = "image/jpeg";
  const HEIC_OUTPUT_QUALITY = 0.9;
  const OPTIMIZED_IMAGE_MIME = "image/webp";
  const OPTIMIZED_IMAGE_EXTENSION = "webp";
  const OPTIMIZED_IMAGE_QUALITY = 0.82;
  const OPTIMIZED_IMAGE_MAX_DIMENSION = 1920;
  const NORMAL_IMAGE_ORIENTATION = 1;
  const IMAGE_ORIENTATION_ROTATES_DIMENSIONS = new Set([5, 6, 7, 8]);

  const getFileBaseName = (fileName = "") => fileName.replace(/\.[^.]+$/, "") || "image";

  const getFileExtension = (fileName = "", fallback = OPTIMIZED_IMAGE_EXTENSION) => {
    const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);

    return match?.[1] || fallback;
  };

  const isHeicFile = (file) => {
    if (!file) {
      return false;
    }

    const type = String(file.type || "").toLowerCase();

    return HEIC_MIME_TYPES.has(type) || HEIC_EXTENSION_PATTERN.test(String(file.name || ""));
  };

  const getConvertedUploadCount = (uploads = []) =>
    adminNormalizeList(uploads).filter((upload) => upload?.wasConverted).length;

  const getUploadProcessingSummary = (uploads = []) => {
    const uploadList = adminNormalizeList(uploads).filter(Boolean);

    if (!uploadList.length) {
      return "";
    }

    const convertedCount = getConvertedUploadCount(uploadList);

    return ` 已壓縮成 WebP 並移除 EXIF/GPS metadata。${convertedCount ? `其中 ${convertedCount} 張 HEIC/HEIF 已先自動轉檔。` : ""}`;
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

  const sortActivities = (activities) => {
    activities.sort((first, second) => {
      const timeDifference = getActivitySortTime(second) - getActivitySortTime(first);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return String(first.title || "").localeCompare(String(second.title || ""));
    });
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

  const sortHonorItems = (items, category) => {
    if (!honorCategoryUsesDate(category)) {
      return;
    }

    items.sort((first, second) => {
      const timeDifference = getHonorSortTime(second) - getHonorSortTime(first);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return String(first.title || "").localeCompare(String(second.title || ""));
    });
  };

  const sortHonorCollections = (honors = {}) => {
    sortHonorItems(honors.talks ||= [], "talks");
    sortHonorItems(honors.presentations ||= [], "presentations");
    sortHonorItems(honors.mediaCoverage ||= [], "mediaCoverage");
  };

  const getCollection = () => {
    if (!state.content) {
      return [];
    }

    if (state.section === "honors") {
      state.content.honors ||= {};
      state.content.honors[state.honorCategory] ||= [];
      return state.content.honors[state.honorCategory];
    }

    state.content[state.section] ||= [];
    return state.content[state.section];
  };

  const getCurrentItem = () => getCollection()[state.selectedIndex] || null;

  const getDirectoryHandle = async (path, create = false) => {
    const parts = path.split("/").filter(Boolean);
    let directory = state.rootHandle;

    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create });
    }

    return directory;
  };

  const getFileHandle = async (path, create = false) => {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop();
    const directory = parts.length ? await getDirectoryHandle(parts.join("/"), create) : state.rootHandle;

    return directory.getFileHandle(fileName, { create });
  };

  const readContentFile = async () => {
    const fileHandle = await getFileHandle("data/site-content.json");
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  };

  const writeContentFile = async () => {
    const fileHandle = await getFileHandle("data/site-content.json", true);
    const writable = await fileHandle.createWritable();

    await writable.write(`${JSON.stringify(state.content, null, 2)}\n`);
    await writable.close();
  };

  const SITE_ORIGIN = SITE_CONFIG.siteOrigin || "https://shchen0603.github.io/Personal-Website";
  const getStaticBlogPath = (post) => `posts/${encodeURIComponent(post.id)}.html`;
  const getStaticActivityPath = (activity) => `activities/${encodeURIComponent(activity.id)}.html`;
  const BLOG_INDEX_FALLBACK_START = "<!-- BLOG INDEX STATIC FALLBACK START -->";
  const BLOG_INDEX_FALLBACK_END = "<!-- BLOG INDEX STATIC FALLBACK END -->";

  const buildSitemapXml = (content) => {
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      "",
      "research.html",
      "publications.html",
      "honors.html",
      "activities.html",
      "blog.html",
      "contact.html"
    ];

    adminNormalizeList(content.blogPosts)
      .filter((post) => post && post.status !== "draft" && post.id)
      .forEach((post) => {
        urls.push(getStaticBlogPath(post));
      });

    adminNormalizeList(content.activities)
      .filter((activity) => activity && activity.id)
      .forEach((activity) => {
        urls.push(getStaticActivityPath(activity));
      });

    const entries = urls
      .map((path) => {
        const loc = path ? `${SITE_ORIGIN}/${path}` : `${SITE_ORIGIN}/`;
        const safeLoc = loc.replace(/&/g, "&amp;");

        return `  <url>\n    <loc>${safeLoc}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  };

  const writeSitemapFile = async () => {
    if (!state.rootHandle || !state.content) {
      return;
    }

    const fileHandle = await getFileHandle("sitemap.xml", true);
    const writable = await fileHandle.createWritable();

    await writable.write(buildSitemapXml(state.content));
    await writable.close();
  };

  const getPublishedBlogPosts = (content) =>
    adminNormalizeList(content?.blogPosts)
      .filter((post) => post && post.status !== "draft" && post.id);

  const buildBlogIndexFallbackHtml = (content) => {
    const posts = getPublishedBlogPosts(content);

    if (!posts.length) {
      return [
        `        ${BLOG_INDEX_FALLBACK_START}`,
        '        <p class="blog-note">More research notes coming soon.</p>',
        `        ${BLOG_INDEX_FALLBACK_END}`
      ].join("\n");
    }

    const rows = posts.map((post) => {
      const date = post.date || "";
      const dateLabel = post.dateLabel || date;
      const title = post.title || "";
      const excerpt = post.excerpt || "";

      return [
        '        <article class="post-row">',
        `          <time datetime="${escapeHtmlContent(date)}">${escapeHtmlContent(dateLabel)}</time>`,
        "          <div>",
        `            <h2><a href="${escapeHtmlContent(getStaticBlogPath(post))}">${escapeHtmlContent(title)}</a></h2>`,
        `            <p>${escapeHtmlContent(excerpt).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>")}</p>`,
        "          </div>",
        "        </article>"
      ].join("\n");
    });

    return [
      `        ${BLOG_INDEX_FALLBACK_START}`,
      rows.join("\n"),
      `        ${BLOG_INDEX_FALLBACK_END}`
    ].join("\n");
  };

  const replaceBlogIndexFallbackHtml = (template, content) => {
    let start = template.indexOf(BLOG_INDEX_FALLBACK_START);
    let end = template.indexOf(BLOG_INDEX_FALLBACK_END);

    if (start === -1 || end === -1 || end < start) {
      throw new Error("blog.html is missing static fallback markers.");
    }

    end += BLOG_INDEX_FALLBACK_END.length;

    const lineStart = template.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = template.indexOf("\n", end);

    if (!template.slice(lineStart, start).trim()) {
      start = lineStart;
    }

    if (lineEnd !== -1) {
      end = lineEnd;
    }

    return [
      template.slice(0, start),
      buildBlogIndexFallbackHtml(content),
      template.slice(end)
    ].join("");
  };

  const readBlogIndexTemplate = async () => {
    if (state.rootHandle) {
      const fileHandle = await getFileHandle("blog.html");
      const file = await fileHandle.getFile();
      return file.text();
    }

    const response = await fetch("blog.html", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Unable to read blog.html: HTTP ${response.status}`);
    }

    return response.text();
  };

  const buildBlogIndexHtml = async (content) =>
    replaceBlogIndexFallbackHtml(await readBlogIndexTemplate(), content);

  const writeBlogIndexFile = async () => {
    if (!state.rootHandle || !state.content) {
      return;
    }

    const fileHandle = await getFileHandle("blog.html", true);
    const nextHtml = replaceBlogIndexFallbackHtml(await readBlogIndexTemplate(), state.content);
    const writable = await fileHandle.createWritable();

    await writable.write(nextHtml);
    await writable.close();
  };

  const utf8ToBase64 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  };

  const escapeHtmlContent = (value = "") =>
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

  const MARKDOWN_IMAGE_PATTERN = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$/;

  const isSafeMarkdownImageSrc = (value = "") => {
    const src = String(value || "").trim();

    return Boolean(src) && (!/^[a-z][a-z0-9+.-]*:/i.test(src) || /^https?:\/\//i.test(src));
  };

  const renderMarkdownImageForStatic = (src = "", alt = "", caption = "") => {
    const cleanSrc = String(src || "").trim();

    if (!isSafeMarkdownImageSrc(cleanSrc)) {
      return "";
    }

    return `
      <figure class="article-inline-image">
        <img src="${escapeHtmlContent(getNestedAssetPath(cleanSrc))}" alt="${escapeHtmlContent(alt)}" loading="lazy" decoding="async">
        ${caption ? `<figcaption>${renderInlineMarkdownForStatic(caption)}</figcaption>` : ""}
      </figure>
    `;
  };

  const renderInlineMarkdownForStatic = (value = "") => {
    let html = escapeHtmlContent(value);

    html = html.replace(/\\\((.+?)\\\)/g, '<span class="math-inline">\\($1\\)</span>');
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/&lt;(sup|sub)&gt;(.+?)&lt;\/\1&gt;/g, "<$1>$2</$1>");
    html = html.replace(
      /(^|[^!])\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
      '$1<a href="$3" rel="noreferrer">$2</a>'
    );
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

    return html;
  };

  const splitMarkdownTableRowForStatic = (line = "") => {
    const trimmed = String(line || "").trim();

    if (!trimmed.includes("|")) {
      return [];
    }

    return trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  };

  const getMarkdownTableAlignmentsForStatic = (line = "") => {
    const cells = splitMarkdownTableRowForStatic(line);

    if (cells.length < 2) {
      return null;
    }

    const alignments = cells.map((cell) => {
      if (!/^:?-{3,}:?$/.test(cell)) {
        return null;
      }

      if (cell.startsWith(":") && cell.endsWith(":")) {
        return "center";
      }

      if (cell.endsWith(":")) {
        return "right";
      }

      return "left";
    });

    return alignments.includes(null) ? null : alignments;
  };

  const renderMarkdownTableForStatic = (headerCells = [], alignments = [], bodyRows = []) => {
    const columnCount = headerCells.length;
    const normalizeCells = (cells) =>
      Array.from({ length: columnCount }, (_, index) => cells[index] || "");
    const alignmentClass = (alignment) => (alignment && alignment !== "left" ? ` class="is-${alignment}"` : "");
    const header = normalizeCells(headerCells)
      .map((cell, index) => `<th${alignmentClass(alignments[index])}>${renderInlineMarkdownForStatic(cell)}</th>`)
      .join("");
    const body = bodyRows
      .map((row) => `<tr>${normalizeCells(row).map((cell, index) => `<td${alignmentClass(alignments[index])}>${renderInlineMarkdownForStatic(cell)}</td>`).join("")}</tr>`)
      .join("");

    return `<div class="article-table-wrap"><table class="article-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const renderMarkdownBlockForStatic = (value = "") => {
    const text = String(value || "").replace(/\r\n?/g, "\n").trim();

    if (!text) {
      return "";
    }

    const lines = text.split("\n");
    const html = [];
    let paragraph = [];
    let listStack = [];
    let quote = [];
    let math = null;

    const flushParagraph = () => {
      if (!paragraph.length) {
        return;
      }

      html.push(`<p>${paragraph.map(renderInlineMarkdownForStatic).join("<br>")}</p>`);
      paragraph = [];
    };

    const closeListLevel = () => {
      if (!listStack.length) {
        return;
      }

      const current = listStack.pop();

      if (current.openItem) {
        html.push("</li>");
      }

      html.push(`</${current.type}>`);
    };

    const flushList = () => {
      while (listStack.length) {
        closeListLevel();
      }
    };

    const openListLevel = (type, indent) => {
      html.push(`<${type}>`);
      listStack.push({ type, indent, openItem: false });
    };

    const addListItem = (type, indent, text) => {
      while (listStack.length && indent < listStack[listStack.length - 1].indent) {
        closeListLevel();
      }

      if (!listStack.length || indent > listStack[listStack.length - 1].indent) {
        openListLevel(type, indent);
      } else if (listStack[listStack.length - 1].type !== type) {
        closeListLevel();
        openListLevel(type, indent);
      }

      const current = listStack[listStack.length - 1];

      if (current.openItem) {
        html.push("</li>");
      }

      html.push(`<li>${renderInlineMarkdownForStatic(text)}`);
      current.openItem = true;
    };

    const flushQuote = () => {
      if (!quote.length) {
        return;
      }

      html.push(`<blockquote><p>${quote.map(renderInlineMarkdownForStatic).join("<br>")}</p></blockquote>`);
      quote = [];
    };

    const flushMath = () => {
      if (!math) {
        return;
      }

      html.push(`<div class="math-display">\\[${escapeHtmlContent(math.lines.join("\n"))}\\]</div>`);
      math = null;
    };

    const flushOpenBlocks = () => {
      flushParagraph();
      flushList();
      flushQuote();
    };

    let lineIndex = 0;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (math) {
        if (line.trim() === "$$" || line.trim() === "\\]") {
          flushMath();
          lineIndex += 1;
          continue;
        }

        math.lines.push(line);
        lineIndex += 1;
        continue;
      }

      if (!line.trim()) {
        flushOpenBlocks();
        lineIndex += 1;
        continue;
      }

      if (line.trim() === "$$" || line.trim() === "\\[") {
        flushOpenBlocks();
        math = { lines: [] };
        lineIndex += 1;
        continue;
      }

      const singleLineMath = line.trim().match(/^\$\$(.+)\$\$$/) || line.trim().match(/^\\\[(.+)\\\]$/);

      if (singleLineMath) {
        flushOpenBlocks();
        html.push(`<div class="math-display">\\[${escapeHtmlContent(singleLineMath[1].trim())}\\]</div>`);
        lineIndex += 1;
        continue;
      }

      const image = line.trim().match(MARKDOWN_IMAGE_PATTERN);

      if (image) {
        flushOpenBlocks();
        html.push(renderMarkdownImageForStatic(image[2], image[1], image[3] || ""));
        lineIndex += 1;
        continue;
      }

      const tableAlignments = getMarkdownTableAlignmentsForStatic(lines[lineIndex + 1] || "");

      if (splitMarkdownTableRowForStatic(line).length >= 2 && tableAlignments) {
        flushOpenBlocks();

        const headerCells = splitMarkdownTableRowForStatic(line);
        const bodyRows = [];
        lineIndex += 2;

        while (lineIndex < lines.length && lines[lineIndex].trim()) {
          const rowCells = splitMarkdownTableRowForStatic(lines[lineIndex]);

          if (rowCells.length < 2) {
            break;
          }

          bodyRows.push(rowCells);
          lineIndex += 1;
        }

        html.push(renderMarkdownTableForStatic(headerCells, tableAlignments, bodyRows));
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);

      if (heading) {
        flushOpenBlocks();

        const level = Math.min(Math.max(heading[1].length, 2), 6);

        html.push(`<h${level}>${renderInlineMarkdownForStatic(heading[2].replace(/\s+#+\s*$/, "").trim())}</h${level}>`);
        lineIndex += 1;
        continue;
      }

      const unordered = line.match(/^(\s*)[-*]\s+(.+)$/);
      const ordered = line.match(/^(\s*)\d+\.\s+(.+)$/);

      if (unordered || ordered) {
        const type = unordered ? "ul" : "ol";
        const indent = (unordered || ordered)[1].replace(/\t/g, "    ").length;
        const itemText = (unordered || ordered)[2];

        flushParagraph();
        flushQuote();
        addListItem(type, indent, itemText);
        lineIndex += 1;
        continue;
      }

      const quoteLine = line.match(/^\s*>\s?(.*)$/);

      if (quoteLine) {
        flushParagraph();
        flushList();
        quote.push(quoteLine[1]);
        lineIndex += 1;
        continue;
      }

      flushList();
      flushQuote();
      paragraph.push(line);
      lineIndex += 1;
    }

    flushOpenBlocks();
    flushMath();

    return html.join("");
  };

  const isExternalUrl = (value = "") => /^https?:\/\//i.test(value);
  const getNestedAssetPath = (value = "") =>
    isExternalUrl(value) ? value : `../${String(value || "").replace(/^\/+/, "")}`;
  const getAbsoluteAssetUrl = (value = "") =>
    isExternalUrl(value) ? value : `${SITE_ORIGIN}/${String(value || "").replace(/^\/+/, "")}`;
  const getStaticActivityDateLabel = (activity) =>
    activity.dateLabel || activity.date || activity.year || "";
  const getStaticActivityBody = (activity) => {
    const body = adminNormalizeList(activity.body).filter(Boolean);

    return body.length ? body : [activity.summary || ""].filter(Boolean);
  };
  const getStaticActivityImages = (activity) => {
    const images = adminNormalizeList(activity.images)
      .filter((image) => image && image.src)
      .map((image) => ({
        src: image.src,
        alt: image.alt || activity.imageAlt || activity.title || "活動照片",
        caption: image.caption || ""
      }));

    if (images.length) {
      return images;
    }

    return activity.image
      ? [{ src: activity.image, alt: activity.imageAlt || activity.title || "活動照片", caption: "" }]
      : [];
  };

  const buildBlogPostHtml = (post) => {
    if (!post || !post.id) {
      return "";
    }

    const renderStaticArticleTaxonomy = (tags, series) => {
      const rows = [
        tags.length
          ? `<div class="article-taxonomy-row"><span class="article-taxonomy-label">標籤：</span><div class="article-taxonomy-items">${tags.map((tag) => `<span class="tag-button tag-static">${escapeHtmlContent(tag)}</span>`).join("")}</div></div>`
          : "",
        series
          ? `<div class="article-taxonomy-row"><span class="article-taxonomy-label">系列：</span><div class="article-taxonomy-items"><span class="tag-button tag-static">${escapeHtmlContent(series)}</span></div></div>`
          : ""
      ].filter(Boolean).join("");

      return rows
        ? `<div class="article-taxonomy" aria-label="文章系列與標籤">${rows}</div>`
        : "";
    };

    const title = post.title || "Blog Post";
    const excerpt = post.excerpt || "Research notes and essays on cardiovascular epidemiology, medicine, and public health.";
    const canonicalUrl = `${SITE_ORIGIN}/${getStaticBlogPath(post)}`;
    const ogImage = post.image
      ? getAbsoluteAssetUrl(post.image)
      : `${SITE_ORIGIN}/assets/cardiovascular-epidemiology-hero-og.jpg`;
    const tags = adminNormalizeList(post.tags)
      .map((tag) => (tag && (tag.label || tag.slug)) || "")
      .filter(Boolean);
    const series = post.series && (post.series.label || post.series.slug)
      ? post.series.label || post.series.slug
      : "";
    const taxonomyLabels = [series, ...tags].filter(Boolean);
    const tagsHtml = renderStaticArticleTaxonomy(tags, series);
    const heroImage = post.image
      ? `<figure class="article-cover-image"><img class="article-image" src="${escapeHtmlContent(getNestedAssetPath(post.image))}" alt="${escapeHtmlContent(post.imageAlt || title)}" loading="lazy" decoding="async"></figure>`
      : "";
    const body = adminNormalizeList(post.body).map(renderMarkdownBlockForStatic).join("");
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "description": excerpt,
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
      "keywords": taxonomyLabels.join(", ")
    };

    if (series) {
      jsonLdData.articleSection = series;
    }

    const jsonLd = JSON.stringify(jsonLdData);

    return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtmlContent(title)} | 陳思翰 Szu-Han Chen</title>
    <meta name="description" content="${escapeHtmlContent(excerpt)}">
    <link rel="canonical" href="${escapeHtmlContent(canonicalUrl)}">
    <meta property="og:title" content="${escapeHtmlContent(title)} | 陳思翰 Szu-Han Chen">
    <meta property="og:description" content="${escapeHtmlContent(excerpt)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtmlContent(canonicalUrl)}">
    <meta property="og:image" content="${escapeHtmlContent(ogImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&amp;family=Noto+Sans+TC:wght@400;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
    <link rel="stylesheet" href="../styles.css?v=20260612-nested-lists">
    <script type="application/ld+json">${jsonLd}</script>
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"a8f57387064d4f27b1ba086354d6ac5f"}'></script>
    <!-- End Cloudflare Web Analytics -->
    <script>(function(){var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.setAttribute("data-theme","dark")}})();</script>
    <script>(function(){var l=localStorage.getItem("lang");if(l!=="en"&&l!=="zh-Hant"){l=(navigator.language||navigator.userLanguage||"").toLowerCase().indexOf("zh")===0?"zh-Hant":"en";}document.documentElement.setAttribute("lang",l);})();</script>
  </head>
  <body data-page="blog" data-base-path="../">
    <a class="skip-link" href="#main">跳到主要內容</a>

    <header class="site-header" data-header></header>

    <main id="main">
      <article class="article">
        <header class="article-header">
          <a class="back-link" href="../blog.html">Back to Blog</a>
          <p class="post-category">${escapeHtmlContent(post.dateLabel || post.date || "")}</p>
          <h1>${escapeHtmlContent(title)}</h1>
          <p class="article-dek">${escapeHtmlContent(excerpt)}</p>
        </header>
        <div class="article-body">
          ${heroImage}
          ${body}
        </div>
        ${tagsHtml ? `<footer class="article-footer">${tagsHtml}</footer>` : ""}
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
`;
  };

  const buildActivityHtml = (activity) => {
    if (!activity || !activity.id) {
      return "";
    }

    const title = activity.title || "Activity";
    const summary = activity.summary || activity.meta || "Activity notes by Szu-Han Chen.";
    const canonicalUrl = `${SITE_ORIGIN}/${getStaticActivityPath(activity)}`;
    const ogImage = activity.image
      ? getAbsoluteAssetUrl(activity.image)
      : `${SITE_ORIGIN}/assets/cardiovascular-epidemiology-hero-og.jpg`;
    const dateLabel = getStaticActivityDateLabel(activity);
    const meta = activity.meta || dateLabel || "Activity";
    const compactMeta = dateLabel && activity.year && meta.startsWith(`${activity.year} · `)
      ? meta.slice(`${activity.year} · `.length)
      : meta;
    const body = getStaticActivityBody(activity)
      .map((paragraph) => /^[#>]/.test(String(paragraph).trim())
        ? renderMarkdownBlockForStatic(paragraph)
        : `<p>${escapeHtmlContent(paragraph).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>")}</p>`)
      .join("");
    const gallery = getStaticActivityImages(activity);
    const galleryHtml = gallery.length
      ? `
      <div class="article-gallery" aria-label="活動照片">
        ${gallery.map((image) => `
          <figure>
            <img src="${escapeHtmlContent(getNestedAssetPath(image.src))}" alt="${escapeHtmlContent(image.alt || title)}" loading="lazy" decoding="async">
            ${image.caption ? `<figcaption>${escapeHtmlContent(image.caption)}</figcaption>` : ""}
          </figure>
        `).join("")}
      </div>
    `
      : "";
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": summary,
      "datePublished": activity.date || activity.year || "",
      "image": ogImage,
      "url": canonicalUrl,
      "mainEntityOfPage": canonicalUrl,
      "author": {
        "@type": "Person",
        "name": "Szu-Han Chen",
        "url": `${SITE_ORIGIN}/`
      }
    });

    return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtmlContent(title)} | Activities | 陳思翰 Szu-Han Chen</title>
    <meta name="description" content="${escapeHtmlContent(summary)}">
    <link rel="canonical" href="${escapeHtmlContent(canonicalUrl)}">
    <meta property="og:title" content="${escapeHtmlContent(title)} | Activities | 陳思翰 Szu-Han Chen">
    <meta property="og:description" content="${escapeHtmlContent(summary)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtmlContent(canonicalUrl)}">
    <meta property="og:image" content="${escapeHtmlContent(ogImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&amp;family=Noto+Sans+TC:wght@400;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">${jsonLd}</script>
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"a8f57387064d4f27b1ba086354d6ac5f"}'></script>
    <!-- End Cloudflare Web Analytics -->
    <script>(function(){var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.setAttribute("data-theme","dark")}})();</script>
    <script>(function(){var l=localStorage.getItem("lang");if(l!=="en"&&l!=="zh-Hant"){l=(navigator.language||navigator.userLanguage||"").toLowerCase().indexOf("zh")===0?"zh-Hant":"en";}document.documentElement.setAttribute("lang",l);})();</script>
  </head>
  <body data-page="activities" data-base-path="../">
    <a class="skip-link" href="#main">跳到主要內容</a>

    <header class="site-header" data-header></header>

    <main id="main">
      <article class="article">
        <header class="article-header">
          <a class="back-link" href="../activities.html">Back to Activities</a>
          <p class="post-category">${escapeHtmlContent(dateLabel ? `${dateLabel} · ${compactMeta}` : compactMeta)}</p>
          <h1>${escapeHtmlContent(title)}</h1>
          <p class="article-dek">${escapeHtmlContent(summary)}</p>
        </header>
        <div class="article-body">
          ${body}
          ${galleryHtml}
        </div>
      </article>
    </main>

    <footer class="site-footer" data-footer></footer>

    <button class="back-to-top" data-back-to-top aria-label="回到頂部" title="回到頂部">↑</button>

    <script src="../site-config.js"></script>
    <script src="../script.js"></script>
  </body>
</html>
`;
  };

  const writeBlogPostFile = async (post) => {
    if (!state.rootHandle || !post || !post.id) {
      return;
    }

    const fileHandle = await getFileHandle(getStaticBlogPath(post), true);
    const writable = await fileHandle.createWritable();

    await writable.write(buildBlogPostHtml(post));
    await writable.close();
  };

  const writeAllBlogPostFiles = async () => {
    if (!state.rootHandle || !state.content) {
      return;
    }

    const posts = adminNormalizeList(state.content.blogPosts)
      .filter((post) => post && post.status !== "draft" && post.id);

    for (const post of posts) {
      await writeBlogPostFile(post);
    }
  };

  const writeActivityFile = async (activity) => {
    if (!state.rootHandle || !activity || !activity.id) {
      return;
    }

    const fileHandle = await getFileHandle(getStaticActivityPath(activity), true);
    const writable = await fileHandle.createWritable();

    await writable.write(buildActivityHtml(activity));
    await writable.close();
  };

  const writeAllActivityFiles = async () => {
    if (!state.rootHandle || !state.content) {
      return;
    }

    const activities = adminNormalizeList(state.content.activities)
      .filter((activity) => activity && activity.id);

    for (const activity of activities) {
      await writeActivityFile(activity);
    }
  };

  const getAssetFileName = (file) => {
    const extension = getFileExtension(file?.name, OPTIMIZED_IMAGE_EXTENSION);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    return `${timestamp}-${slugify(getFileBaseName(file?.name || "image"))}.${extension}`;
  };

  const getAssetPath = (file, folder) => {
    if (!file) {
      return "";
    }

    return `assets/${folder}/${getAssetFileName(file)}`;
  };

  const convertHeicToJpeg = async (file) => {
    if (typeof window.heic2any !== "function") {
      throw new Error("HEIC 轉檔工具尚未載入，請重新整理 admin 頁面後再試一次。");
    }

    const result = await window.heic2any({
      blob: file,
      toType: HEIC_OUTPUT_MIME,
      quality: HEIC_OUTPUT_QUALITY
    });
    const blob = Array.isArray(result) ? result[0] : result;

    if (!(blob instanceof Blob)) {
      throw new Error("HEIC 轉檔結果不是有效的圖片檔。");
    }

    return new File([blob], `${getFileBaseName(file.name)}.jpg`, {
      type: HEIC_OUTPUT_MIME,
      lastModified: file.lastModified
    });
  };

  const loadImageElementFromFile = (file) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(url);

      image.addEventListener("load", () => {
        cleanup();
        resolve(image);
      }, { once: true });
      image.addEventListener("error", () => {
        cleanup();
        reject(new Error("圖片讀取失敗。"));
      }, { once: true });
      image.src = url;
    });

  const loadCanvasSourceFromFile = async (file, options = {}) => {
    const imageOrientation = options.ignoreMetadataOrientation ? "none" : "from-image";

    if (typeof window.createImageBitmap === "function") {
      try {
        const bitmap = await window.createImageBitmap(file, { imageOrientation });

        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          ignoresMetadataOrientation: options.ignoreMetadataOrientation,
          close: () => bitmap.close()
        };
      } catch {
        // Fall back to HTMLImageElement below; older browsers may not support ImageBitmap options.
      }
    }

    const image = await loadImageElementFromFile(file);

    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      ignoresMetadataOrientation: false,
      close: () => {}
    };
  };

  const canvasToBlob = (canvas, type, quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("圖片壓縮失敗。"));
      }, type, quality);
    });

  const getOptimizedDimensions = (width, height) => {
    const maxDimension = Math.max(width, height);

    if (maxDimension <= OPTIMIZED_IMAGE_MAX_DIMENSION) {
      return { width, height };
    }

    const ratio = OPTIMIZED_IMAGE_MAX_DIMENSION / maxDimension;

    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio)
    };
  };

  const normalizeImageOrientation = (orientation) => {
    const value = Number(orientation);

    return Number.isInteger(value) && value >= 1 && value <= 8 ? value : NORMAL_IMAGE_ORIENTATION;
  };

  const getOrientedDimensions = (width, height, orientation) =>
    IMAGE_ORIENTATION_ROTATES_DIMENSIONS.has(orientation)
      ? { width: height, height: width }
      : { width, height };

  const getRawDrawDimensions = (width, height, orientation) =>
    IMAGE_ORIENTATION_ROTATES_DIMENSIONS.has(orientation)
      ? { width: height, height: width }
      : { width, height };

  const applyCanvasOrientation = (context, orientation, width, height) => {
    if (orientation === 2) {
      context.transform(-1, 0, 0, 1, width, 0);
      return;
    }

    if (orientation === 3) {
      context.transform(-1, 0, 0, -1, width, height);
      return;
    }

    if (orientation === 4) {
      context.transform(1, 0, 0, -1, 0, height);
      return;
    }

    if (orientation === 5) {
      context.transform(0, 1, 1, 0, 0, 0);
      return;
    }

    if (orientation === 6) {
      context.transform(0, 1, -1, 0, height, 0);
      return;
    }

    if (orientation === 7) {
      context.transform(0, -1, -1, 0, height, width);
      return;
    }

    if (orientation === 8) {
      context.transform(0, -1, 1, 0, 0, width);
    }
  };

  const getAsciiString = (bytes, start, length) => {
    let value = "";

    for (let index = 0; index < length; index += 1) {
      value += String.fromCharCode(bytes[start + index] || 0);
    }

    return value;
  };

  const parseJpegExifOrientation = (buffer) => {
    const view = new DataView(buffer);

    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
      return NORMAL_IMAGE_ORIENTATION;
    }

    let offset = 2;

    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      offset += 2;

      if (marker === 0xffda || marker === 0xffd9) {
        break;
      }

      const segmentLength = view.getUint16(offset);
      const segmentStart = offset + 2;
      const nextOffset = offset + segmentLength;

      if (marker === 0xffe1 && segmentStart + 14 <= view.byteLength) {
        const bytes = new Uint8Array(buffer);

        if (getAsciiString(bytes, segmentStart, 6) !== "Exif\0\0") {
          offset = nextOffset;
          continue;
        }

        const tiffStart = segmentStart + 6;
        const byteOrder = getAsciiString(bytes, tiffStart, 2);
        const littleEndian = byteOrder === "II";

        if (!littleEndian && byteOrder !== "MM") {
          return NORMAL_IMAGE_ORIENTATION;
        }

        const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
        const ifdStart = tiffStart + ifdOffset;

        if (ifdStart + 2 > view.byteLength) {
          return NORMAL_IMAGE_ORIENTATION;
        }

        const entryCount = view.getUint16(ifdStart, littleEndian);

        for (let index = 0; index < entryCount; index += 1) {
          const entryStart = ifdStart + 2 + index * 12;

          if (entryStart + 12 > view.byteLength) {
            break;
          }

          if (view.getUint16(entryStart, littleEndian) === 0x0112) {
            return normalizeImageOrientation(view.getUint16(entryStart + 8, littleEndian));
          }
        }
      }

      if (nextOffset <= offset) {
        break;
      }

      offset = nextOffset;
    }

    return NORMAL_IMAGE_ORIENTATION;
  };

  const heicRotationToOrientation = (rotation) => {
    if (rotation === 1) {
      return 8;
    }

    if (rotation === 2) {
      return 3;
    }

    if (rotation === 3) {
      return 6;
    }

    return NORMAL_IMAGE_ORIENTATION;
  };

  const parseHeicOrientation = (buffer) => {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    for (let index = 4; index + 5 < bytes.length; index += 1) {
      if (getAsciiString(bytes, index, 4) !== "irot") {
        continue;
      }

      const size = view.getUint32(index - 4);

      if (size >= 9 && size <= bytes.length - index + 4) {
        return heicRotationToOrientation(bytes[index + 4] & 0x03);
      }
    }

    return NORMAL_IMAGE_ORIENTATION;
  };

  const getImageOrientation = async (file) => {
    const type = String(file?.type || "").toLowerCase();

    if (type === "image/jpeg" || /\.jpe?g$/i.test(file?.name || "")) {
      return parseJpegExifOrientation(await file.slice(0, 256 * 1024).arrayBuffer());
    }

    if (isHeicFile(file)) {
      return parseHeicOrientation(await file.slice(0, 512 * 1024).arrayBuffer());
    }

    return NORMAL_IMAGE_ORIENTATION;
  };

  const optimizeImageFile = async (file, originalName = file.name, options = {}) => {
    const orientation = normalizeImageOrientation(options.orientation);
    const source = await loadCanvasSourceFromFile(file, {
      ignoreMetadataOrientation: orientation !== NORMAL_IMAGE_ORIENTATION
    });

    try {
      const sourceWidth = source.width;
      const sourceHeight = source.height;
      const shouldApplyManualOrientation =
        orientation !== NORMAL_IMAGE_ORIENTATION &&
        (options.forceManualOrientation || source.ignoresMetadataOrientation);

      if (!sourceWidth || !sourceHeight) {
        throw new Error("圖片尺寸無法讀取。");
      }

      const orientedDimensions = getOrientedDimensions(
        sourceWidth,
        sourceHeight,
        shouldApplyManualOrientation ? orientation : NORMAL_IMAGE_ORIENTATION
      );
      const dimensions = getOptimizedDimensions(orientedDimensions.width, orientedDimensions.height);
      const rawDrawDimensions = getRawDrawDimensions(
        dimensions.width,
        dimensions.height,
        shouldApplyManualOrientation ? orientation : NORMAL_IMAGE_ORIENTATION
      );
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("瀏覽器不支援圖片壓縮所需的 canvas。");
      }

      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      applyCanvasOrientation(
        context,
        shouldApplyManualOrientation ? orientation : NORMAL_IMAGE_ORIENTATION,
        rawDrawDimensions.width,
        rawDrawDimensions.height
      );
      context.drawImage(
        source.source,
        0,
        0,
        sourceWidth,
        sourceHeight,
        0,
        0,
        rawDrawDimensions.width,
        rawDrawDimensions.height
      );

      const blob = await canvasToBlob(canvas, OPTIMIZED_IMAGE_MIME, OPTIMIZED_IMAGE_QUALITY);

      return new File([blob], `${getFileBaseName(originalName)}.${OPTIMIZED_IMAGE_EXTENSION}`, {
        type: OPTIMIZED_IMAGE_MIME,
        lastModified: Date.now()
      });
    } finally {
      source.close();
    }
  };

  const prepareImageUpload = async (file) => {
    if (!file) {
      return null;
    }

    try {
      const wasConverted = isHeicFile(file);
      const orientation = await getImageOrientation(file);
      const workingFile = wasConverted ? await convertHeicToJpeg(file) : file;

      return {
        file: await optimizeImageFile(workingFile, file.name, {
          orientation,
          forceManualOrientation: wasConverted
        }),
        wasConverted,
        wasOptimized: true,
        originalName: file.name
      };
    } catch (error) {
      throw new Error(`圖片處理失敗：${file.name}。請重新選一次，或先在系統中轉成一般圖片格式後再上傳。${error?.message ? ` ${error.message}` : ""}`);
    }
  };

  const prepareImageUploads = async (files = []) => {
    const uploads = [];

    for (const file of adminNormalizeList(files)) {
      const upload = await prepareImageUpload(file);

      if (upload) {
        uploads.push(upload);
      }
    }

    return uploads;
  };

  const writePreparedImageToPath = async (upload, path) => {
    if (!upload?.file || !path) {
      return "";
    }

    const fileHandle = await getFileHandle(path, true);
    const writable = await fileHandle.createWritable();

    await writable.write(upload.file);
    await writable.close();

    return path;
  };

  const savePreparedImage = async (upload, folder) =>
    writePreparedImageToPath(upload, getAssetPath(upload?.file, folder));

  const saveImage = async (file, folder) => {
    const upload = await prepareImageUpload(file);

    return {
      upload,
      path: await savePreparedImage(upload, folder)
    };
  };

  const makeAssetPath = (file, folder) => {
    return getAssetPath(file, folder);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener("load", () => {
        resolve(String(reader.result).split(",")[1] || "");
      });
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsDataURL(file);
    });

  const registerPendingAssetUpload = (path, upload) => {
    if (path && upload?.file) {
      state.pendingAssetUploads.set(path, { path, upload });
    }
  };

  const contentReferencesAssetPath = (content, path) =>
    Boolean(path && JSON.stringify(content || {}).includes(path));

  const getPendingAssetUploadsForContent = (content) =>
    [...state.pendingAssetUploads.values()]
      .filter((entry) => contentReferencesAssetPath(content, entry.path));

  const clearPendingAssetUploads = (paths = []) => {
    paths.forEach((path) => {
      state.pendingAssetUploads.delete(path);
    });
  };

  const getPendingAssetExtraFiles = async (content) => {
    const entries = getPendingAssetUploadsForContent(content);
    const files = [];

    for (const entry of entries) {
      files.push({
        path: entry.path,
        content: await fileToBase64(entry.upload.file)
      });
    }

    return files;
  };

  const savePendingAssetUploads = async (content) => {
    const entries = getPendingAssetUploadsForContent(content);
    const savedPaths = [];

    for (const entry of entries) {
      const path = await writePreparedImageToPath(entry.upload, entry.path);

      if (path) {
        savedPaths.push(path);
      }
    }

    clearPendingAssetUploads(savedPaths);

    return savedPaths;
  };

  const GITHUB_REQUEST_TIMEOUT_MS = 30000;

  const githubRequest = async (path, options = {}) => {
    const owner = githubOwner.value.trim();
    const repo = githubRepo.value.trim();
    const token = githubToken.value.trim();

    if (!owner || !repo || !token) {
      throw new Error("請先填 GitHub owner、repository 和 token。");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(options.headers || {})
        }
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("GitHub API 連線逾時。請確認網路穩定後再試一次；若剛剛已按過發布，請先重新整理頁面確認狀態。");
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `GitHub request failed: ${response.status}`);
    }

    return response.json();
  };

  const getGitHubBranch = () => githubBranch.value.trim() || "main";

  const getRemoteSiteContent = async () => {
    const branch = getGitHubBranch();
    const file = await githubRequest(`/contents/data/site-content.json?ref=${encodeURIComponent(branch)}`);

    if (!file?.content) {
      throw new Error("GitHub 上找不到 data/site-content.json，無法確認最新版內容。");
    }

    return normalizeContent(JSON.parse(decodeBase64Content(file.content)));
  };

  const assertRemoteContentIsCurrent = async (nextContent) => {
    const remoteContent = await getRemoteSiteContent();
    const baseContent = state.baseContent ? getCanonicalContent(state.baseContent) : null;
    const remoteSnapshot = getCanonicalContent(remoteContent);

    if (
      baseContent &&
      remoteSnapshot !== baseContent &&
      remoteSnapshot !== getCanonicalContent(nextContent)
    ) {
      throw new Error("GitHub 上的內容已經有新版本。為了避免覆蓋別處的修改，請先執行 git pull 或重新載入 admin 後再發布。");
    }
  };

  const publishToGitHub = async (nextContent, extraFiles = [], message = "Update website content") => {
    const branch = getGitHubBranch();
    const ref = await githubRequest(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const baseCommitSha = ref.object.sha;
    const baseCommit = await githubRequest(`/git/commits/${baseCommitSha}`);
    const treeItems = [
      {
        path: "data/site-content.json",
        mode: "100644",
        type: "blob",
        content: `${JSON.stringify(nextContent, null, 2)}\n`
      }
    ];

    for (const file of extraFiles) {
      const blob = await githubRequest("/git/blobs", {
        method: "POST",
        body: JSON.stringify({
          content: file.content,
          encoding: "base64"
        })
      });

      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      });
    }

    const tree = await githubRequest("/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: treeItems
      })
    });
    const commit = await githubRequest("/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [baseCommitSha]
      })
    });

    await githubRequest(`/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({
        sha: commit.sha
      })
    });
  };

  const getPublicationTagOption = (slug) =>
    PUBLICATION_TAG_OPTIONS.find((tag) => tag.slug === slug) || null;

  const getPublicationTagGroup = (group) =>
    PUBLICATION_TAG_GROUP_OPTIONS.includes(group) ? group : "Topics";

  const normalizeTag = (tag) => {
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

  const normalizeBlogOption = (option) => {
    const source = typeof option === "string" ? { slug: option, label: option } : option || {};
    const value = source.slug || source.label || "";

    if (!String(value).trim()) {
      return null;
    }

    const slug = slugify(value);

    return slug
      ? {
          slug,
          label: source.label || source.slug || slug
        }
      : null;
  };

  const mergeBlogOptions = (...optionLists) => {
    const options = new Map();

    optionLists.flat().forEach((option) => {
      const normalized = normalizeBlogOption(option);

      if (normalized && !options.has(normalized.slug)) {
        options.set(normalized.slug, normalized);
      }
    });

    return [...options.values()];
  };

  const hasOwnContentKey = (content, key) =>
    Boolean(content && Object.prototype.hasOwnProperty.call(content, key));

  const getBlogContentOptionSource = (content, key, fallbackOptions) =>
    hasOwnContentKey(content, key) ? adminNormalizeList(content[key]) : fallbackOptions;

  const getBlogPostTagItems = (content) =>
    adminNormalizeList(content?.blogPosts).flatMap((post) => adminNormalizeList(post.tags));

  const getBlogPostSeriesItems = (content) =>
    adminNormalizeList(content?.blogPosts).map((post) => post.series).filter(Boolean);

  const normalizeBlogTaxonomyContent = (content) => {
    const tagOptions = mergeBlogOptions(
      getBlogContentOptionSource(content, "blogTagOptions", DEFAULT_BLOG_TAG_OPTIONS),
      getBlogPostTagItems(content)
    );
    const seriesOptions = mergeBlogOptions(
      getBlogContentOptionSource(content, "blogSeriesOptions", DEFAULT_BLOG_SERIES_OPTIONS),
      getBlogPostSeriesItems(content)
    );
    const tagMap = new Map(tagOptions.map((tag) => [tag.slug, tag]));
    const seriesMap = new Map(seriesOptions.map((series) => [series.slug, series]));

    content.blogTagOptions = tagOptions;
    content.blogSeriesOptions = seriesOptions;

    adminNormalizeList(content.blogPosts).forEach((post) => {
      post.tags = mergeBlogOptions(adminNormalizeList(post.tags))
        .map((tag) => tagMap.get(tag.slug) || tag);

      const series = normalizeBlogOption(post.series);

      if (series) {
        post.series = seriesMap.get(series.slug) || series;
      } else {
        delete post.series;
      }
    });
  };

  const normalizeBlogTaxonomyWithOptions = (item, options) => {
    const normalized = normalizeBlogOption(item);

    if (!normalized) {
      return null;
    }

    return options.find((option) => option.slug === normalized.slug || option.label === normalized.label)
      || normalized;
  };

  const getBlogOptionConfig = (kind) =>
    kind === "series"
      ? {
          optionsKey: "blogSeriesOptions",
          inputName: "blogSeries",
          label: "系列",
          emptyLabel: "不設定系列"
        }
      : {
          optionsKey: "blogTagOptions",
          inputName: "blogTags",
          label: "標籤",
          emptyLabel: ""
        };

  const getManagedBlogOptions = (kind) => {
    const config = getBlogOptionConfig(kind);
    const fallback = kind === "series" ? DEFAULT_BLOG_SERIES_OPTIONS : DEFAULT_BLOG_TAG_OPTIONS;

    if (!state.content) {
      return mergeBlogOptions(fallback);
    }

    state.content[config.optionsKey] ||= [];

    return mergeBlogOptions(state.content[config.optionsKey]);
  };

  const getBlogTagOptions = () => getManagedBlogOptions("tag");
  const getBlogSeriesOptions = () => getManagedBlogOptions("series");

  const normalizeBlogTag = (tag) =>
    normalizeBlogTaxonomyWithOptions(tag, getBlogTagOptions());

  const normalizeBlogSeries = (series) =>
    normalizeBlogTaxonomyWithOptions(series, getBlogSeriesOptions());

  const getBlogOptionBySlug = (kind, slug) =>
    getManagedBlogOptions(kind).find((option) => option.slug === slugify(slug)) || null;

  const getBlogOptionsFromSlugs = (kind, slugs = []) => {
    const seen = new Set();

    return slugs
      .map((slug) => slugify(slug))
      .filter((slug) => {
        if (!slug || seen.has(slug)) {
          return false;
        }

        seen.add(slug);
        return true;
      })
      .map((slug) => getBlogOptionBySlug(kind, slug) || { slug, label: slug });
  };

  const parseCustomTagLabels = (value = "") =>
    String(value || "")
      .split(/[,\n;]+/)
      .map((label) => label.trim())
      .filter(Boolean);

  const buildCustomTags = (labels = [], group = "Topics") =>
    labels
      .map((label) => normalizeTag({ slug: label, label, group }))
      .filter(Boolean);

  const getCustomTagsFromFormData = (formData) =>
    buildCustomTags(parseCustomTagLabels(formData.get("customTagLabels")), formData.get("customTagGroup"));

  const mergeTags = (...tagLists) => {
    const tags = new Map();

    tagLists.flat().forEach((tag) => {
      const normalized = normalizeTag(tag);

      if (normalized && !tags.has(normalized.slug)) {
        tags.set(normalized.slug, normalized);
      }
    });

    return [...tags.values()];
  };

  const getPublicationTagOptions = () => {
    const tags = new Map();

    PUBLICATION_TAG_OPTIONS.forEach((tag) => {
      const normalized = normalizeTag(tag);

      if (normalized) {
        tags.set(normalized.slug, normalized);
      }
    });

    adminNormalizeList(state.content?.publications).forEach((publication) => {
      adminNormalizeList(publication.tags).forEach((tag) => {
        const normalized = normalizeTag(tag);

        if (normalized && !tags.has(normalized.slug)) {
          tags.set(normalized.slug, normalized);
        }
      });
    });

    return [...tags.values()];
  };

  const getTagsFromSlugs = (slugs = []) => {
    const tagMap = new Map(getPublicationTagOptions().map((tag) => [tag.slug, tag]));
    const seen = new Set();

    return slugs
      .map((slug) => slugify(slug))
      .filter((slug) => {
        if (!slug || seen.has(slug)) {
          return false;
        }

        seen.add(slug);
        return true;
      })
      .map((slug) => tagMap.get(slug) || { slug, label: slug });
  };

  const getCheckedTags = (root) =>
    getTagsFromSlugs(
      [...root.querySelectorAll("input[name='tags']:checked")].map((input) => input.value)
    );

  const getCheckedBlogTagSlugs = (root) =>
    [...root.querySelectorAll("input[name='blogTags']:checked")]
      .map((input) => slugify(input.value))
      .filter(Boolean);

  const getCheckedBlogTags = (root) =>
    getBlogOptionsFromSlugs("tag", getCheckedBlogTagSlugs(root));

  const getSelectedBlogSeriesSlug = (root) => {
    const value = root.querySelector("input[name='blogSeries']:checked")?.value || "";

    return value.trim() ? slugify(value) : "";
  };

  const getSelectedBlogSeries = (root) => {
    const slug = getSelectedBlogSeriesSlug(root);

    return slug ? getBlogOptionBySlug("series", slug) || { slug, label: slug } : null;
  };

  const getBlogOptionList = (kind) => {
    if (!state.content) {
      return [];
    }

    const key = getBlogOptionConfig(kind).optionsKey;

    state.content[key] ||= [];

    return state.content[key];
  };

  const updateBlogPostTaxonomyReferences = (kind, oldSlug, nextOption = null) => {
    const normalizedOldSlug = slugify(oldSlug);

    adminNormalizeList(state.content?.blogPosts).forEach((post) => {
      if (kind === "series") {
        const series = normalizeBlogOption(post.series);

        if (!series || series.slug !== normalizedOldSlug) {
          return;
        }

        if (nextOption) {
          post.series = { ...nextOption };
        } else {
          delete post.series;
        }
        return;
      }

      post.tags = mergeBlogOptions(adminNormalizeList(post.tags)
        .map(normalizeBlogOption)
        .filter(Boolean)
        .map((tag) => tag.slug === normalizedOldSlug ? nextOption : tag)
        .filter(Boolean));
    });
  };

  const addBlogOption = (kind, label) => {
    const option = normalizeBlogOption({ label });
    const options = getBlogOptionList(kind);

    if (!option) {
      return { error: `請先輸入${getBlogOptionConfig(kind).label}名稱。` };
    }

    const existing = options.find((item) => item.slug === option.slug);

    if (existing) {
      return { option: existing, existing: true };
    }

    options.push(option);

    return { option, existing: false };
  };

  const updateBlogOption = (kind, oldSlug, nextValues) => {
    const options = getBlogOptionList(kind);
    const index = options.findIndex((option) => option.slug === slugify(oldSlug));
    const current = options[index];
    const option = normalizeBlogOption({
      slug: nextValues.slug || nextValues.label,
      label: nextValues.label || nextValues.slug
    });

    if (index < 0 || !current) {
      return { error: "找不到要更新的項目。" };
    }

    if (!option) {
      return { error: `${getBlogOptionConfig(kind).label}名稱或 slug 不能留白。` };
    }

    const duplicate = options.find((item) => item.slug === option.slug && item.slug !== current.slug);

    if (duplicate) {
      return { error: `已有相同 slug：${option.slug}` };
    }

    options[index] = option;
    updateBlogPostTaxonomyReferences(kind, current.slug, option);

    return { option, previous: current };
  };

  const removeBlogOption = (kind, slug) => {
    const options = getBlogOptionList(kind);
    const normalizedSlug = slugify(slug);
    const index = options.findIndex((option) => option.slug === normalizedSlug);

    if (index < 0) {
      return null;
    }

    const [removed] = options.splice(index, 1);

    updateBlogPostTaxonomyReferences(kind, normalizedSlug, null);

    return removed;
  };

  const getPublicationCategory = (value = "") => {
    const aliases = {
      "peer-reviewed-journal-publications": "journal-publications"
    };
    const slug = aliases[slugify(value)] || slugify(value);

    return PUBLICATION_CATEGORY_OPTIONS.find((category) => slug === category.slug)
      || PUBLICATION_CATEGORY_OPTIONS[0];
  };

  const getFirstLinkHref = (links) => adminNormalizeList(links)[0]?.href || "";

  const setSingleUrlLink = (item, url = "") => {
    const href = String(url || "").trim();

    item.links = href
      ? [{
          label: item.title || "Coverage",
          href
        }]
      : [];
  };

  const parseImages = (value) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [src, alt, caption] = line.split("|").map((part) => part.trim());

        return {
          src,
          alt: alt || "",
          caption: caption || ""
        };
      });

  const stringifyImages = (images) =>
    adminNormalizeList(images)
      .map((image) => {
        if (typeof image === "string") {
          return image;
        }

        return [image.src || "", image.alt || "", image.caption || ""].join("|");
      })
      .join("\n");

  const field = (name, label, value = "", type = "text") => `
    <label class="admin-field">
      <span>${label}</span>
      <input type="${type}" name="${name}" value="${escapeHTML(value)}">
    </label>
  `;

  const textarea = (name, label, value = "", rows = 4) => `
    <label class="admin-field">
      <span>${label}</span>
      <textarea name="${name}" rows="${rows}">${escapeHTML(value)}</textarea>
    </label>
  `;

  const markdownToolbarButton = (action, label, title) =>
    `<button type="button" data-markdown-action="${action}" title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}">${label}</button>`;

  const markdownEditorField = (name, label, value = "", rows = 8) => `
    <div class="admin-markdown-editor">
      <div class="admin-markdown-toolbar" aria-label="文章格式工具列">
        ${markdownToolbarButton("h2", "H2", "加入大標")}
        ${markdownToolbarButton("h3", "H3", "加入小標")}
        ${markdownToolbarButton("bold", "B", "粗體")}
        ${markdownToolbarButton("italic", "I", "斜體")}
        ${markdownToolbarButton("list", "•", "項目清單")}
        ${markdownToolbarButton("ordered-list", "1.", "編號清單")}
        ${markdownToolbarButton("quote", ">", "引用")}
        ${markdownToolbarButton("link", "Link", "加入連結")}
        ${markdownToolbarButton("image", "Img", "插入圖片與圖說")}
        ${markdownToolbarButton("inline-math", "Math", "插入行內公式")}
        ${markdownToolbarButton("math-block", "$$", "插入區塊公式")}
      </div>
      <label class="admin-field">
        <span>${label}</span>
        <textarea name="${name}" rows="${rows}" data-markdown-editor>${escapeHTML(value)}</textarea>
      </label>
      <p class="admin-help">段落請用空行分開；工具列會插入 Markdown 標記，圖片會自動壓縮成 WebP。圖片圖說可寫成 ![替代文字](圖片路徑 "圖說文字")，會顯示為圖片下方的小灰字。公式可用行內 \\( ... \\) 或區塊 $$ ... $$。</p>
    </div>
  `;

  const blogChoiceOption = (kind, option, checked = false) => {
    const config = getBlogOptionConfig(kind);
    const type = kind === "series" ? "radio" : "checkbox";

    return `
      <div class="admin-tag-option" data-blog-${kind}-option="${escapeHTML(option.slug)}">
        <label>
          <input type="${type}" name="${config.inputName}" value="${escapeHTML(option.slug)}" ${checked ? "checked" : ""}>
          <span>${escapeHTML(option.label)}</span>
        </label>
      </div>
    `;
  };

  const blogOptionManager = (kind, options = {}) => {
    const config = getBlogOptionConfig(kind);
    const items = getManagedBlogOptions(kind);

    return `
      <details class="admin-taxonomy-manager" data-blog-taxonomy-manager="${kind}" ${options.open ? "open" : ""}>
        <summary>管理${escapeHTML(config.label)}</summary>
        <div class="admin-taxonomy-list">
          ${items.length ? items.map((item) => `
            <div class="admin-taxonomy-row" data-blog-option-row data-blog-option-kind="${kind}" data-blog-option-slug="${escapeHTML(item.slug)}">
              <label class="admin-field">
                <span>名稱</span>
                <input type="text" value="${escapeHTML(item.label)}" data-blog-option-field="label">
              </label>
              <label class="admin-field">
                <span>Slug</span>
                <input type="text" value="${escapeHTML(item.slug)}" data-blog-option-field="slug">
              </label>
              <button class="button button-outline" type="button" data-remove-blog-option="${escapeHTML(item.slug)}" data-blog-option-kind="${kind}">刪除</button>
            </div>
          `).join("") : `<p class="admin-help">尚未建立${escapeHTML(config.label)}。</p>`}
        </div>
        <div class="admin-taxonomy-add">
          <label class="admin-field">
            <span>新增${escapeHTML(config.label)}</span>
            <input type="text" data-new-blog-option-label="${kind}">
          </label>
          <button class="button button-outline" type="button" data-add-blog-option="${kind}">新增${escapeHTML(config.label)}</button>
        </div>
      </details>
    `;
  };

  const blogTagField = (selectedTags = [], options = {}) => {
    const selectedSlugs = new Set(
      adminNormalizeList(selectedTags)
        .map((tag) => normalizeBlogTag(tag)?.slug)
        .filter(Boolean)
    );
    const tags = getBlogTagOptions();

    return `
      <fieldset class="admin-tag-field" data-blog-taxonomy-field="tag">
        <legend>文章標籤</legend>
        <div class="admin-tag-options">
          ${tags.map((tag) => blogChoiceOption("tag", tag, selectedSlugs.has(tag.slug))).join("")}
        </div>
        ${blogOptionManager("tag", { open: options.managerOpen })}
      </fieldset>
    `;
  };

  const blogSeriesField = (selectedSeries = null, options = {}) => {
    const selectedSlug = normalizeBlogSeries(selectedSeries)?.slug || "";
    const seriesOptions = getBlogSeriesOptions();

    return `
      <fieldset class="admin-tag-field" data-blog-taxonomy-field="series">
        <legend>文章系列</legend>
        <div class="admin-tag-options">
          <div class="admin-tag-option">
            <label>
              <input type="radio" name="blogSeries" value="" ${selectedSlug ? "" : "checked"}>
              <span>不設定系列</span>
            </label>
          </div>
          ${seriesOptions.map((series) => blogChoiceOption("series", series, selectedSlug === series.slug)).join("")}
        </div>
        ${blogOptionManager("series", { open: options.managerOpen })}
      </fieldset>
    `;
  };

  const refreshBlogTaxonomyControls = (root, selections = {}) => {
    const openManagers = new Set(
      [...root.querySelectorAll("[data-blog-taxonomy-manager][open]")]
        .map((manager) => manager.dataset.blogTaxonomyManager)
    );
    const selectedTags = "tags" in selections ? selections.tags : getCheckedBlogTags(root);
    const selectedSeries = "series" in selections ? selections.series : getSelectedBlogSeries(root);
    const tagField = root.querySelector("[data-blog-taxonomy-field='tag']");
    const seriesField = root.querySelector("[data-blog-taxonomy-field='series']");

    if (tagField) {
      tagField.outerHTML = blogTagField(selectedTags, { managerOpen: openManagers.has("tag") });
    }

    if (seriesField) {
      seriesField.outerHTML = blogSeriesField(selectedSeries, { managerOpen: openManagers.has("series") });
    }
  };

  const checkbox = (name, label, checked = false) => `
    <label class="admin-check">
      <input type="checkbox" name="${name}" ${checked ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `;

  const publicationTagGroupSelect = (selected = "Topics") =>
    PUBLICATION_TAG_GROUP_OPTIONS
      .map((group) => `<option value="${escapeHTML(group)}" ${getPublicationTagGroup(selected) === group ? "selected" : ""}>${escapeHTML(group)}</option>`)
      .join("");

  const publicationCustomTagField = (options = {}) => `
    <div class="admin-custom-tag">
      <div class="admin-grid two">
        <label class="admin-field">
          <span>新增關鍵字</span>
          <input type="text" name="customTagLabels" placeholder="例如 Hypertension, Cohort Study">
        </label>
        <label class="admin-field">
          <span>關鍵字分類</span>
          <select name="customTagGroup">
            ${publicationTagGroupSelect()}
          </select>
        </label>
      </div>
      ${options.showButton ? "<button class=\"button button-outline\" type=\"button\" data-add-publication-tag>加入關鍵字</button>" : ""}
      <p class="admin-help">${options.showButton ? "可用逗號一次加入多個；按下加入後會成為這篇著作的關鍵字。" : "可用逗號一次加入多個；儲存或發布時會一起加入這篇著作。"}</p>
    </div>
  `;

  const publicationTagField = (selectedTags = [], options = {}) => {
    const selectedSlugs = new Set(
      adminNormalizeList(selectedTags)
        .map((tag) => normalizeTag(tag)?.slug)
        .filter(Boolean)
    );
    const groupedOptions = PUBLICATION_TAG_GROUP_OPTIONS
      .map((group) => {
        const tags = getPublicationTagOptions().filter((tag) => getPublicationTagGroup(tag.group) === group);

        if (!tags.length) {
          return "";
        }

        return `
          <div class="admin-tag-group">
            <p>${escapeHTML(group)}</p>
            <div class="admin-tag-options">
              ${tags.map((tag) => `
                <label class="admin-tag-option">
                  <input type="checkbox" name="tags" value="${escapeHTML(tag.slug)}" ${selectedSlugs.has(tag.slug) ? "checked" : ""}>
                  <span>${escapeHTML(tag.label)}</span>
                </label>
              `).join("")}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <fieldset class="admin-tag-field">
        <legend>關鍵字</legend>
        <div class="admin-tag-groups">
          ${groupedOptions}
        </div>
        ${publicationCustomTagField(options)}
      </fieldset>
    `;
  };

  const imageField = (pathValue = "", folder = "blog", options = {}) => `
    <div class="admin-image-row">
      ${field("image", "圖片路徑", pathValue)}
      <label class="admin-field">
        <span>上傳圖片</span>
        <input type="file" name="imageFile" accept="image/*,.heic,.heif" data-admin-image-upload="${folder}" ${options.multiple ? "multiple" : ""}>
      </label>
    </div>
  `;

  const activityImagesField = (item) => `
    <div class="admin-image-row">
      ${field("image", "封面圖片路徑", item.image)}
      <label class="admin-field">
        <span>上傳封面照</span>
        <input type="file" name="coverImageFile" accept="image/*,.heic,.heif" data-admin-cover-upload="activities">
      </label>
    </div>
    <label class="admin-field">
      <span>上傳其他活動照片</span>
      <input type="file" name="galleryImageFiles" accept="image/*,.heic,.heif" data-admin-gallery-upload="activities" multiple>
    </label>
    <p class="admin-help">封面照會顯示在 Activities 卡片；其他活動照片會放進完整頁的圖片集。上傳圖片會先在本機壓縮成最長邊 1920px 的 WebP，並移除 EXIF/GPS metadata。已上傳的圖片集仍可用「路徑|替代文字|照片說明」每行編輯一張。</p>
    ${textarea("images", "其他照片圖片集", stringifyImages(item.images), 5)}
  `;

  const honorCategoryOptions = (selected = "awards") => `
    <option value="awards" ${selected === "awards" ? "selected" : ""}>Awards</option>
    <option value="talks" ${selected === "talks" ? "selected" : ""}>Invited Talks</option>
    <option value="presentations" ${selected === "presentations" ? "selected" : ""}>Conference Presentations</option>
    <option value="mediaCoverage" ${selected === "mediaCoverage" ? "selected" : ""}>Media Coverage</option>
  `;

  const honorAwardScopeField = (selected = "domestic") => {
    const current = selected === "international" ? "international" : "domestic";

    return `
      <label class="admin-field">
        <span>獎項範圍</span>
        <select name="scope">
          <option value="international" ${current === "international" ? "selected" : ""}>International Awards</option>
          <option value="domestic" ${current === "domestic" ? "selected" : ""}>Domestic Awards</option>
        </select>
      </label>
    `;
  };

  const quickHonorCategoryField = (selected = "awards") => `
    <label class="admin-field">
      <span>類型</span>
      <select name="honorCategory" data-quick-honor-category>
        ${honorCategoryOptions(selected)}
      </select>
    </label>
  `;

  const publicationCategoryField = (selected = PUBLICATION_CATEGORY_OPTIONS[0].label) => {
    const current = getPublicationCategory(selected);
    const options = PUBLICATION_CATEGORY_OPTIONS
      .map((category) => `<option value="${escapeHTML(category.label)}" ${current.slug === category.slug ? "selected" : ""}>${escapeHTML(category.label)}</option>`)
      .join("");

    return `
      <label class="admin-field">
        <span>分類</span>
        <select name="category">
          ${options}
        </select>
      </label>
    `;
  };

  const renderQuickHonorFields = (category = "awards") => {
    const currentYear = new Date().getFullYear().toString();

    if (category === "mediaCoverage") {
      quickFields.innerHTML = `
        <div class="admin-grid two">
          ${quickHonorCategoryField(category)}
        </div>
        ${field("title", "媒體或報導標題", "")}
        ${textarea("description", "報導說明", "", 5)}
        ${field("url", "URL", "")}
        <p class="admin-help">Media Coverage 會以「標題、說明、URL」顯示在 Honors 頁。</p>
      `;
      return;
    }

    const dateLabel = category === "talks" || category === "presentations"
      ? "日期（建議填）"
      : "日期（選填）";

    quickFields.innerHTML = `
      <div class="admin-grid two">
        ${quickHonorCategoryField(category)}
        ${category === "awards" ? honorAwardScopeField("domestic") : field("date", dateLabel, "", "date")}
      </div>
      <div class="admin-grid two">
        ${field("dateLabel", "顯示日期", "")}
        ${field("year", "年份", currentYear)}
      </div>
      ${field("title", "標題", "")}
      ${textarea("description", "說明", "", 5)}
      <p class="admin-help">Awards 可以只填年份；Invited Talks 和 Conference Presentations 建議填日期，前台會依日期由近到遠排序。</p>
    `;
  };

  const editorActionsMarkup = () => `
    <div class="admin-editor-actions">
      <p class="admin-help">改完這個項目後，可以先儲存到本機，或直接發布到 GitHub Pages。</p>
      <div class="admin-editor-buttons">
        <button class="button button-outline" type="button" data-editor-open-folder>選擇網站資料夾</button>
        <button class="button button-primary" type="button" data-editor-save disabled>儲存到本機</button>
        <button class="button button-primary" type="button" data-editor-publish-github disabled>發布到 GitHub</button>
      </div>
    </div>
  `;

  const defaultItem = () => {
    const today = new Date().toISOString().slice(0, 10);

    if (state.section === "blogPosts") {
      return {
        id: `post-${today}`,
        status: "draft",
        date: today,
        dateLabel: today.replaceAll("-", "."),
        title: "新文章",
        excerpt: "",
        image: "",
        imageAlt: "",
        tags: [],
        body: [""]
      };
    }

    if (state.section === "publications") {
      return {
        year: new Date().getFullYear().toString(),
        category: PUBLICATION_CATEGORY_OPTIONS[0].label,
        title: "New publication",
        authors: "Szu-Han Chen.",
        venue: "",
        summary: "",
        doi: "",
        tags: [],
        firstAuthor: true,
        correspondingAuthor: false,
        featured: false
      };
    }

    if (state.section === "homeHighlights") {
      return {
        meta: `${new Date().getFullYear()} · Research`,
        title: "新亮點",
        description: "",
        href: ""
      };
    }

    if (state.section === "activities") {
      return {
        id: `activity-${today}`,
        date: today,
        dateLabel: formatDateForDisplay(today),
        year: today.slice(0, 4),
        meta: `${today.slice(0, 4)} · Activity`,
        title: "New activity",
        summary: "",
        body: [""],
        visualLabel: "Activity",
        visualTheme: "poa",
        image: "",
        images: [],
        imageAlt: "",
        featured: false,
        log: true
      };
    }

    if (state.honorCategory === "mediaCoverage") {
      return {
        title: "New media coverage",
        description: "",
        links: []
      };
    }

    if (honorCategoryUsesDate(state.honorCategory)) {
      return {
        date: "",
        dateLabel: "",
        year: new Date().getFullYear().toString(),
        title: "New honor",
        description: ""
      };
    }

    return {
      year: new Date().getFullYear().toString(),
      title: "New honor",
      description: "",
      ...(state.honorCategory === "awards" ? { scope: "domestic" } : {})
    };
  };

  const renderQuickFields = () => {
    const type = quickType.value;

    state.quickImageFile = null;

    if (type === "blogPosts") {
      quickFields.innerHTML = `
        ${field("title", "標題", "")}
        ${blogSeriesField(null)}
        ${blogTagField([])}
        ${markdownEditorField("body", "你想發布的文字", "", 9)}
        <label class="admin-field">
          <span>附加圖片</span>
          <input type="file" name="imageFile" accept="image/*,.heic,.heif" data-quick-image>
        </label>
        <p class="admin-help">上傳圖片會先在本機壓縮成最長邊 1920px 的 WebP，並移除 EXIF/GPS metadata，再存進網站資料夾或直接發布到 GitHub。</p>
      `;
      return;
    }

    if (type === "activities") {
      const today = new Date().toISOString().slice(0, 10);

      quickFields.innerHTML = `
        <div class="admin-grid two">
          ${field("title", "活動名稱", "")}
          ${field("date", "活動日期", today, "date")}
          ${field("year", "年份", today.slice(0, 4))}
          ${field("dateLabel", "顯示日期", formatDateForDisplay(today))}
          ${field("meta", "活動資訊", `${today.slice(0, 4)} · Activity`)}
        </div>
        ${textarea("summary", "卡片摘要", "", 4)}
        ${textarea("body", "完整心得（每一段用空行分開）", "", 8)}
        <div class="admin-grid two">
          <label class="admin-field">
            <span>封面照</span>
            <input type="file" name="coverImageFile" accept="image/*,.heic,.heif" data-quick-cover-image>
          </label>
          <label class="admin-field">
            <span>其他活動照片</span>
            <input type="file" name="galleryImageFiles" accept="image/*,.heic,.heif" data-quick-gallery-images multiple>
          </label>
        </div>
        <p class="admin-help">封面照會顯示在 Activities 卡片；其他活動照片會放進完整頁的圖片集。上傳圖片會先在本機壓縮成最長邊 1920px 的 WebP，並移除 EXIF/GPS metadata。</p>
        <div class="admin-check-row">
          ${checkbox("log", "加入 Activity Log", true)}
          ${checkbox("featured", "放大活動卡", false)}
        </div>
      `;
      return;
    }

    if (type === "honors") {
      renderQuickHonorFields();
      return;
    }

    quickFields.innerHTML = `
      <div class="admin-grid two">
        ${field("year", "年份", new Date().getFullYear().toString())}
        ${publicationCategoryField()}
        ${field("doi", "DOI / 連結", "")}
      </div>
      ${field("title", "著作標題", "")}
      ${textarea("authors", "作者", "Szu-Han Chen.", 3)}
      ${textarea("venue", "期刊 citation", "", 3)}
      ${textarea("summary", "Take-home（一句話研究結論，可選填）", "", 3)}
      ${publicationTagField()}
      <div class="admin-check-row">
        ${checkbox("firstAuthor", "第一作者", true)}
        ${checkbox("correspondingAuthor", "通訊作者", false)}
        ${checkbox("featured", "設為 Research 頁代表作", false)}
      </div>
    `;
  };

  const splitParagraphs = (value) =>
    value
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  const stripMarkdownForExcerpt = (value = "") =>
    String(value || "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

  const getExcerptSource = (value = "") =>
    String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^#{1,6}\s+/.test(line) && !MARKDOWN_IMAGE_PATTERN.test(line)) || "";

  const getBlogExcerpt = (body = []) => {
    const blocks = adminNormalizeList(body);
    const firstParagraph = blocks.map(getExcerptSource).find(Boolean) || blocks[0] || "";

    return stripMarkdownForExcerpt(firstParagraph);
  };

  const focusTextareaWithoutScroll = (textarea) => {
    try {
      textarea.focus({ preventScroll: true });
    } catch (error) {
      textarea.focus();
    }
  };

  const restoreScrollPosition = (textarea, textareaScrollTop, pageScrollX, pageScrollY) => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;

    textarea.scrollTop = textareaScrollTop;
    root.style.scrollBehavior = "auto";
    window.scrollTo(pageScrollX, pageScrollY);
    root.style.scrollBehavior = previousScrollBehavior;
  };

  const replaceTextareaSelection = (textarea, replacement, selectionStartOffset = replacement.length, selectionEndOffset = selectionStartOffset) => {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const textareaScrollTop = textarea.scrollTop;
    const pageScrollX = window.scrollX;
    const pageScrollY = window.scrollY;
    const restoreView = () => restoreScrollPosition(textarea, textareaScrollTop, pageScrollX, pageScrollY);
    const scheduleRestore = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0);

    textarea.value = `${before}${replacement}${after}`;
    focusTextareaWithoutScroll(textarea);
    textarea.setSelectionRange(start + selectionStartOffset, start + selectionEndOffset);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    restoreView();
    scheduleRestore(restoreView);
  };

  const insertLinePrefix = (textarea, prefix, placeholder) => {
    const selected = textarea.value.slice(textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0);
    const content = selected || placeholder;
    const replacement = content
      .split("\n")
      .map((line) => `${prefix}${line.replace(/^\s*(#{2,3}\s+|>\s+|[-*]\s+|\d+\.\s+)/, "")}`)
      .join("\n");
    const firstPlaceholderStart = replacement.indexOf(placeholder);

    replaceTextareaSelection(
      textarea,
      replacement,
      selected ? replacement.length : firstPlaceholderStart,
      selected ? replacement.length : firstPlaceholderStart + placeholder.length
    );
  };

  const wrapSelection = (textarea, before, after, placeholder) => {
    const selected = textarea.value.slice(textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0);
    const content = selected || placeholder;

    replaceTextareaSelection(textarea, `${before}${content}${after}`, before.length, before.length + content.length);
  };

  const insertMarkdownBlock = (textarea, block) => {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before.trim()
      ? before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"
      : "";
    const suffix = after.trim()
      ? after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n"
      : "";
    const replacement = `${prefix}${block}${suffix}`;

    replaceTextareaSelection(textarea, replacement, prefix.length + block.length, prefix.length + block.length);
  };

  const insertMathBlock = (textarea) => {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const selected = textarea.value.slice(start, end);
    const content = selected || "OR_{\\mathrm{true}} = \\frac{100/100}{100/900} = 9";
    const prefix = before.trim()
      ? before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"
      : "";
    const suffix = after.trim()
      ? after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n"
      : "";
    const block = `$$\n${content}\n$$`;
    const replacement = `${prefix}${block}${suffix}`;
    const contentStart = prefix.length + "$$\n".length;

    replaceTextareaSelection(textarea, replacement, contentStart, contentStart + content.length);
  };

  const chooseMarkdownImageFile = () =>
    new Promise((resolve) => {
      const input = document.createElement("input");

      input.type = "file";
      input.accept = "image/*,.heic,.heif";
      input.hidden = true;
      input.addEventListener("change", () => {
        resolve(input.files?.[0] || null);
        input.remove();
      }, { once: true });
      document.body.append(input);
      input.click();
    });

  const getMarkdownImageAlt = (file) =>
    getFileBaseName(file?.name || "image")
      .replace(/[-_]+/g, " ")
      .replace(/[\[\]\n\r]+/g, " ")
      .trim() || "圖片說明";

  const cleanMarkdownImageText = (value = "") =>
    String(value || "")
      .replace(/[\[\]\n\r]+/g, " ")
      .replace(/"/g, "'")
      .trim();

  const insertMarkdownImage = async (textarea) => {
    if (!textarea) {
      return;
    }

    const file = await chooseMarkdownImageFile();

    if (!file) {
      return;
    }

    try {
      setStatus("正在壓縮圖片並準備插入正文...", "");

      const upload = await prepareImageUpload(file);
      const path = makeAssetPath(upload.file, "blog");
      const defaultAlt = getMarkdownImageAlt(file);
      const rawCaption = window.prompt("圖片圖說（可留空；會顯示為圖片下方小灰字）", "");
      const caption = cleanMarkdownImageText(rawCaption || "");
      const imageMarkdown = caption
        ? `![${defaultAlt}](${path} "${caption}")`
        : `![${defaultAlt}](${path})`;

      registerPendingAssetUpload(path, upload);
      insertMarkdownBlock(textarea, imageMarkdown);
      setStatus(
        `已插入正文圖片：${path}${caption ? "，並加入圖說" : ""}.${getUploadProcessingSummary([upload])}`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setStatus(error?.message || "圖片插入失敗，請重新選擇圖片。", "error");
    }
  };

  const applyMarkdownAction = (textarea, action) => {
    if (!textarea) {
      return;
    }

    if (action === "h2") {
      insertLinePrefix(textarea, "## ", "大標題");
      return;
    }

    if (action === "h3") {
      insertLinePrefix(textarea, "### ", "小標題");
      return;
    }

    if (action === "bold") {
      wrapSelection(textarea, "**", "**", "重點文字");
      return;
    }

    if (action === "italic") {
      wrapSelection(textarea, "*", "*", "補充文字");
      return;
    }

    if (action === "list") {
      insertLinePrefix(textarea, "- ", "清單項目");
      return;
    }

    if (action === "ordered-list") {
      insertLinePrefix(textarea, "1. ", "清單項目");
      return;
    }

    if (action === "quote") {
      insertLinePrefix(textarea, "> ", "引用文字");
      return;
    }

    if (action === "link") {
      wrapSelection(textarea, "[", "](https://)", "連結文字");
      return;
    }

    if (action === "inline-math") {
      wrapSelection(textarea, "\\(", "\\)", "OR_{\\mathrm{true}} = 9");
      return;
    }

    if (action === "math-block") {
      insertMathBlock(textarea);
    }
  };

  const buildQuickItem = (type, formData, imageInput = [], options = {}) => {
    const today = new Date().toISOString().slice(0, 10);
    const paths = Array.isArray(imageInput) ? imageInput.filter(Boolean) : [imageInput].filter(Boolean);

    if (type === "blogPosts") {
      const title = formData.get("title") || "新文章";
      const body = splitParagraphs(formData.get("body") || "");
      const tags = getCheckedBlogTags(quickFields);
      const series = getSelectedBlogSeries(quickFields);

      return {
        id: options.id || getSuggestedBlogPostId(title, today),
        status: "published",
        date: today,
        dateLabel: today.replaceAll("-", "."),
        title,
        excerpt: getBlogExcerpt(body),
        image: paths[0] || "",
        imageAlt: title,
        tags,
        ...(series ? { series } : {}),
        body
      };
    }

    if (type === "activities") {
      const title = formData.get("title") || "New activity";
      const date = formData.get("date") || today;
      const year = formData.get("year") || date.slice(0, 4);
      const body = splitParagraphs(formData.get("body") || "");
      const summary = formData.get("summary") || body[0] || "";
      const coverPath = Array.isArray(imageInput)
        ? paths[0] || ""
        : imageInput.coverPath || "";
      const galleryPaths = Array.isArray(imageInput)
        ? paths.slice(1)
        : adminNormalizeList(imageInput.galleryPaths).filter(Boolean);
      const images = galleryPaths.map((path) => ({
        src: path,
        alt: title,
        caption: ""
      }));

      return {
        id: `${date}-${slugify(title)}`,
        date,
        dateLabel: formData.get("dateLabel") || formatDateForDisplay(date),
        year,
        meta: formData.get("meta") || `${year} · Activity`,
        title,
        summary,
        body: body.length ? body : [summary].filter(Boolean),
        visualLabel: title,
        visualTheme: "poa",
        image: coverPath || galleryPaths[0] || "",
        images,
        imageAlt: title,
        featured: formData.get("featured") === "on",
        log: formData.get("log") === "on"
      };
    }

    if (type === "honors") {
      const honorCategory = formData.get("honorCategory") || "awards";

      if (honorCategory === "mediaCoverage") {
        const item = {
          title: formData.get("title") || "New media coverage",
          description: formData.get("description") || "",
          honorCategory
        };

        setSingleUrlLink(item, formData.get("url") || "");

        return item;
      }

      const date = String(formData.get("date") || "").trim();
      const dateLabel = String(formData.get("dateLabel") || "").trim();
      const year = String(formData.get("year") || today.slice(0, 4)).trim();
      const item = {
        year: date ? date.slice(0, 4) : year,
        title: formData.get("title") || "New honor",
        description: formData.get("description") || "",
        honorCategory
      };

      if (honorCategory === "awards") {
        item.scope = formData.get("scope") === "international" ? "international" : "domestic";
      }

      if (honorCategoryUsesDate(honorCategory) || date || dateLabel) {
        item.date = date;
        item.dateLabel = dateLabel || (date ? formatDateForDisplay(date) : "");
      }

      return item;
    }

    return {
      year: formData.get("year") || today.slice(0, 4),
      category: getPublicationCategory(formData.get("category")).label,
      title: formData.get("title") || "New publication",
      authors: formData.get("authors") || "Szu-Han Chen.",
      venue: formData.get("venue") || "",
      summary: formData.get("summary") || "",
      doi: formData.get("doi") || "",
      tags: mergeTags(getTagsFromSlugs(formData.getAll("tags")), getCustomTagsFromFormData(formData)),
      firstAuthor: formData.get("firstAuthor") === "on",
      correspondingAuthor: formData.get("correspondingAuthor") === "on",
      featured: formData.get("featured") === "on"
    };
  };

  const insertQuickItem = (content, type, item) => {
    if (type === "honors") {
      const category = item.honorCategory || "awards";
      const honorItem = { ...item };

      delete honorItem.honorCategory;
      content.honors ||= {};
      content.honors[category] ||= [];
      content.honors[category].unshift(honorItem);
      sortHonorItems(content.honors[category], category);
      return;
    }

    content[type] ||= [];

    if (type === "publications" && item.featured) {
      content.publications.forEach((publication) => {
        publication.featured = false;
      });
    }

    if (type === "activities" && item.featured) {
      content.activities.forEach((activity) => {
        activity.featured = false;
      });
    }

    content[type].unshift(item);

    if (type === "activities") {
      sortActivities(content.activities);
    }

    if (type === "blogPosts") {
      normalizeBlogTaxonomyContent(content);
    }
  };

  const renderList = () => {
    const collection = getCollection();

    newButton.disabled = !state.content;
    deleteButton.disabled = !state.content || !collection.length;

    list.innerHTML = collection
      .map((item, index) => {
        const label = item.title || item.category || "Untitled";
        const meta = item.dateLabel || item.date || item.year || item.status || item.meta || "";

        return `
          <button class="${index === state.selectedIndex ? "is-active" : ""}" type="button" data-admin-index="${index}">
            <span>${escapeHTML(label)}</span>
            <small>${escapeHTML(meta)}</small>
          </button>
        `;
      })
      .join("");

    list.querySelectorAll("[data-admin-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedIndex = Number(button.dataset.adminIndex);
        render();
      });
    });
  };

  const renderEditor = () => {
    const item = getCurrentItem();

    if (!item) {
      editor.innerHTML = `
        <div class="admin-empty-state">
          <h2>選擇或新增一個項目</h2>
          <p>內容載入後，這裡會出現可編輯欄位。</p>
        </div>
      `;
      return;
    }

    if (state.section === "blogPosts") {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Blog</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        <div class="admin-grid two">
          ${field("title", "標題", item.title)}
          ${field("id", "文章 ID", item.id)}
          ${field("date", "日期", item.date, "date")}
          ${field("dateLabel", "顯示日期", item.dateLabel)}
          <label class="admin-field">
            <span>狀態</span>
            <select name="status">
              <option value="published" ${item.status !== "draft" ? "selected" : ""}>Published</option>
              <option value="draft" ${item.status === "draft" ? "selected" : ""}>Draft</option>
            </select>
          </label>
        </div>
        ${textarea("excerpt", "摘要", item.excerpt, 3)}
        ${blogSeriesField(item.series)}
        ${blogTagField(item.tags)}
        ${imageField(item.image, "blog")}
        ${field("imageAlt", "圖片替代文字", item.imageAlt)}
        ${markdownEditorField("body", "正文", adminNormalizeList(item.body).join("\n\n"), 12)}
        ${editorActionsMarkup()}
      `;
      return;
    }

    if (state.section === "homeHighlights") {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Home Highlight</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        <p class="admin-help">首頁「近期學術亮點」三張卡片由這裡管理。建議放三項：一項研究成果（含 DOI 連結）、一項獎項、一項媒體報導，但你可以依當下重點隨時調整。順序就是顯示順序，新增項目會出現在最上方，可以拖到對的位置或刪除後重建。</p>
        ${field("meta", "上方小標（例：2026 · Research / Media）", item.meta)}
        ${field("title", "標題", item.title)}
        ${textarea("description", "說明文字", item.description, 4)}
        ${field("href", "連結 URL（可選；填了標題會變成連結）", item.href)}
        ${editorActionsMarkup()}
      `;
      return;
    }

    if (state.section === "publications") {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Publication</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        <div class="admin-grid two">
          ${field("year", "年份", item.year)}
          ${publicationCategoryField(item.category)}
          ${field("doi", "DOI / 連結", item.doi)}
        </div>
        ${field("title", "標題", item.title)}
        ${textarea("authors", "作者", item.authors, 3)}
        ${textarea("venue", "期刊 citation", item.venue, 3)}
        ${textarea("summary", "Take-home（一句話研究結論，可選填）", item.summary || "", 3)}
        ${publicationTagField(item.tags, { showButton: true })}
        <div class="admin-check-row">
          ${checkbox("firstAuthor", "第一作者", item.firstAuthor)}
          ${checkbox("correspondingAuthor", "通訊作者", item.correspondingAuthor)}
          ${checkbox("featured", "設為 Research 頁代表作", item.featured)}
        </div>
        ${editorActionsMarkup()}
      `;
      return;
    }

    if (state.section === "activities") {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Activity</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        <div class="admin-grid two">
          ${field("id", "活動 ID", item.id)}
          ${field("date", "活動日期", item.date, "date")}
          ${field("dateLabel", "顯示日期", item.dateLabel)}
          ${field("year", "年份", item.year)}
          ${field("meta", "Meta", item.meta)}
          ${field("visualLabel", "占位視覺文字", item.visualLabel)}
          <label class="admin-field">
            <span>占位色彩</span>
            <select name="visualTheme">
              ${["poa", "aha", "talk", "hypertension", "ebm", "nycu"].map((theme) => `<option value="${theme}" ${item.visualTheme === theme ? "selected" : ""}>${theme}</option>`).join("")}
            </select>
          </label>
        </div>
        ${field("title", "標題", item.title)}
        ${textarea("summary", "卡片摘要", item.summary, 4)}
        ${textarea("body", "完整心得（每一段用空行分開）", adminNormalizeList(item.body).join("\n\n"), 12)}
        ${activityImagesField(item)}
        ${field("imageAlt", "圖片替代文字", item.imageAlt)}
        <div class="admin-check-row">
          ${checkbox("featured", "放大活動卡", item.featured)}
          ${checkbox("log", "加入 Activity Log", item.log)}
        </div>
        ${editorActionsMarkup()}
      `;
      return;
    }

    if (state.honorCategory === "mediaCoverage") {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Media Coverage</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        ${field("title", "標題", item.title)}
        ${textarea("description", "說明", item.description, 5)}
        ${field("url", "URL", getFirstLinkHref(item.links))}
        ${editorActionsMarkup()}
      `;
      return;
    }

    if (honorCategoryUsesDate(state.honorCategory)) {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Honor</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        <div class="admin-grid two">
          ${field("date", "日期", item.date || "", "date")}
          ${field("dateLabel", "顯示日期", item.dateLabel || "")}
          ${field("year", "年份", item.year)}
          ${field("title", "標題", item.title)}
        </div>
        ${textarea("description", "說明", item.description, 5)}
        <p class="admin-help">這兩個分類會依日期由近到遠排序；若有日期但顯示日期留白，前台會用 YYYY.MM.DD。</p>
        ${editorActionsMarkup()}
      `;
      return;
    }

    editor.innerHTML = `
      <div class="admin-editor-heading">
        <p class="eyebrow">Honor</p>
        <h2>${escapeHTML(item.title || "Untitled")}</h2>
      </div>
      <div class="admin-grid two">
        ${field("year", "年份", item.year)}
        ${field("title", "標題", item.title)}
        ${state.honorCategory === "awards" ? honorAwardScopeField(item.scope) : ""}
      </div>
      ${textarea("description", "說明", item.description, 5)}
      ${editorActionsMarkup()}
    `;
  };

  const render = () => {
    const isHonors = state.section === "honors";

    tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.adminSection === state.section);
    });

    honorCategoryField.hidden = !isHonors;
    honorCategorySelect.value = state.honorCategory;
    renderList();
    renderEditor();
    syncContentActionButtons();
  };

  const updateCurrentItem = async (event) => {
    const item = getCurrentItem();

    if (!item || !event.target.name) {
      return;
    }

    if (["coverImageFile", "galleryImageFiles", "imageFile"].includes(event.target.name) && !state.rootHandle) {
      setStatus("這個編輯區的圖片上傳會直接寫入網站資料夾。請先按「選擇網站資料夾」；若只想直接發到 GitHub，請改用上方 Quick Publish。", "error");
      event.target.value = "";
      return;
    }

    if (event.target.name === "coverImageFile") {
      const result = await saveImage(event.target.files?.[0], event.target.dataset.adminCoverUpload || "activities");
      const path = result.path;

      if (path) {
        item.image = path;
        setStatus(
          `封面照已加入：${path}.${getUploadProcessingSummary([result.upload])}`,
          "success"
        );
      }

      setDirty(true);
      render();
      return;
    }

    if (event.target.name === "galleryImageFiles") {
      const folder = event.target.dataset.adminGalleryUpload || "activities";
      const files = [...(event.target.files || [])];
      const paths = [];
      const uploads = [];

      for (const file of files) {
        const result = await saveImage(file, folder);
        const path = result.path;

        if (result.upload) {
          uploads.push(result.upload);
        }

        if (path) {
          paths.push(path);
        }
      }

      if (paths.length) {
        item.images ||= [];
        paths.forEach((path) => {
          item.images.push({
            src: path,
            alt: item.title || "活動照片",
            caption: ""
          });
        });

        if (!item.image) {
          item.image = paths[0];
          setStatus(
            `已加入 ${paths.length} 張其他活動照片，並用第一張作為封面。${getUploadProcessingSummary(uploads)}`,
            "success"
          );
        } else {
          setStatus(
            `已加入 ${paths.length} 張其他活動照片。${getUploadProcessingSummary(uploads)}`,
            "success"
          );
        }
      }

      setDirty(true);
      render();
      return;
    }

    if (event.target.name === "imageFile") {
      const result = await saveImage(event.target.files?.[0], event.target.dataset.adminImageUpload || "blog");
      const path = result.path;

      if (path) {
        item.image = path;
        setStatus(
          `圖片已加入：${path}.${getUploadProcessingSummary([result.upload])}`,
          "success"
        );
      }

      setDirty(true);
      render();
      return;
    }

    const name = event.target.name;
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

    if (["customTagLabels", "customTagGroup"].includes(name)) {
      return;
    }

    if (name === "blogTags") {
      item.tags = getCheckedBlogTags(editor);
    } else if (name === "blogSeries") {
      const series = getSelectedBlogSeries(editor);

      if (series) {
        item.series = series;
      } else {
        delete item.series;
      }
    } else if (name === "tags") {
      item.tags = getCheckedTags(editor);
    } else if (name === "url") {
      setSingleUrlLink(item, value);
    } else if (name === "images") {
      item.images = parseImages(value);
    } else if (name === "body") {
      item.body = value
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
    } else {
      item[name] = value;
    }

    if (state.section === "publications" && name === "featured" && value) {
      state.content.publications.forEach((publication) => {
        if (publication !== item) {
          publication.featured = false;
        }
      });
    }

    if (state.section === "honors" && state.honorCategory === "mediaCoverage" && name === "title" && item.links?.[0]) {
      item.links[0].label = item.title || "Coverage";
    }

    if (state.section === "activities" && name === "featured" && value) {
      state.content.activities.forEach((activity) => {
        if (activity !== item) {
          activity.featured = false;
        }
      });
    }

    if (state.section === "activities" && ["date", "year", "title"].includes(name)) {
      sortActivities(state.content.activities);
      state.selectedIndex = state.content.activities.indexOf(item);
    }

    if (state.section === "honors" && honorCategoryUsesDate(state.honorCategory)) {
      if (name === "date" && value) {
        item.year = String(value).slice(0, 4);

        if (!item.dateLabel || item.dateLabel === item.year || /^\d{4}\.\d{2}\.\d{2}$/.test(item.dateLabel)) {
          item.dateLabel = formatDateForDisplay(String(value));
        }
      }

      if (["date", "year", "title"].includes(name)) {
        const honors = getCollection();
        sortHonorItems(honors, state.honorCategory);
        state.selectedIndex = honors.indexOf(item);
      }
    }

    setDirty(true);
    renderList();
  };

  const getQuickImageFiles = () => [...(quickForm.querySelector("[data-quick-image]")?.files || [])];
  const getQuickCoverImageFile = () => quickForm.querySelector("[data-quick-cover-image]")?.files?.[0] || null;
  const getQuickGalleryImageFiles = () => [...(quickForm.querySelector("[data-quick-gallery-images]")?.files || [])];

  const handleQuickPublish = async (mode) => {
    if (!state.content) {
      setStatus("內容尚未載入，請稍等或選擇網站資料夾。", "error");
      return;
    }

    if (state.publishing) {
      return;
    }

    const type = quickType.value;
    const coverFile = type === "activities" ? getQuickCoverImageFile() : null;
    const galleryFiles = type === "activities" ? getQuickGalleryImageFiles() : [];
    const rawImageFiles = type === "activities"
      ? [coverFile, ...galleryFiles].filter(Boolean)
      : getQuickImageFiles();
    const imageFolder = type === "activities" ? "activities" : "blog";

    setPublishing(true);

    try {
      if (mode === "local" && rawImageFiles.length && !state.rootHandle) {
        setStatus("要儲存圖片到本機，請先按「選擇網站資料夾」。", "error");
        return;
      }

      if (mode === "local" && !state.rootHandle) {
        setStatus("要寫入本機檔案，請先按「選擇網站資料夾」。", "error");
        return;
      }

      if (mode === "github") {
        setStatus(state.dirty ? "正在確認 GitHub 是否已有新版本..." : "正在讀取 GitHub 最新內容，避免覆蓋其他修改...", "");
      }

      const nextContent = mode === "github" && !state.dirty
        ? await getRemoteSiteContent()
        : cloneContent(state.content);

      if (mode === "github" && state.dirty) {
        await assertRemoteContentIsCurrent(nextContent);
      }

      const quickFormData = new FormData(quickForm);
      let requestedBlogPostId = "";

      if (type === "blogPosts") {
        requestedBlogPostId = requestQuickBlogPostId(quickFormData, nextContent);

        if (!requestedBlogPostId) {
          setStatus("已取消發布。", "");
          return;
        }
      }

      const imagePaths = [];
      let coverPath = "";
      const galleryPaths = [];
      let coverUpload = null;
      let galleryUploads = [];
      let imageUploads = [];

      if (rawImageFiles.length) {
        setStatus("正在壓縮圖片並移除 EXIF/GPS metadata...", "");
      }

      if (type === "activities") {
        coverUpload = await prepareImageUpload(coverFile);
        galleryUploads = await prepareImageUploads(galleryFiles);
      } else {
        imageUploads = await prepareImageUploads(rawImageFiles);
      }

      const allUploads = type === "activities"
        ? [coverUpload, ...galleryUploads].filter(Boolean)
        : imageUploads;
      const processingSummary = getUploadProcessingSummary(allUploads);

      if (type === "activities") {
        if (mode === "local") {
          coverPath = await savePreparedImage(coverUpload, imageFolder);

          for (const upload of galleryUploads) {
            galleryPaths.push(await savePreparedImage(upload, imageFolder));
          }
        } else {
          coverPath = makeAssetPath(coverUpload?.file, imageFolder);
          galleryPaths.push(...galleryUploads.map((upload) => makeAssetPath(upload.file, imageFolder)));
        }
      } else {
        if (mode === "local") {
          for (const upload of imageUploads) {
            imagePaths.push(await savePreparedImage(upload, imageFolder));
          }
        } else {
          imagePaths.push(...imageUploads.map((upload) => makeAssetPath(upload.file, imageFolder)));
        }
      }

      const item = buildQuickItem(
        type,
        quickFormData,
        type === "activities" ? { coverPath, galleryPaths } : imagePaths,
        type === "blogPosts" ? { id: requestedBlogPostId } : {}
      );
      const extraFiles = [];

      insertQuickItem(nextContent, type, item);

      if (mode === "github") {
        const pendingAssetFiles = await getPendingAssetExtraFiles(nextContent);

        extraFiles.push(...pendingAssetFiles);

        if (type === "activities") {
          if (coverUpload?.file && coverPath) {
            extraFiles.push({
              path: coverPath,
              content: await fileToBase64(coverUpload.file)
            });
          }

          for (const [index, upload] of galleryUploads.entries()) {
            extraFiles.push({
              path: galleryPaths[index],
              content: await fileToBase64(upload.file)
            });
          }
        } else {
          for (const [index, upload] of imageUploads.entries()) {
            extraFiles.push({
              path: imagePaths[index],
              content: await fileToBase64(upload.file)
            });
          }
        }

        extraFiles.push({
          path: "sitemap.xml",
          content: utf8ToBase64(buildSitemapXml(nextContent))
        });

        extraFiles.push({
          path: "blog.html",
          content: utf8ToBase64(await buildBlogIndexHtml(nextContent))
        });

        if (type === "blogPosts") {
          extraFiles.push({
            path: getStaticBlogPath(item),
            content: utf8ToBase64(buildBlogPostHtml(item))
          });
        }

        if (type === "activities") {
          extraFiles.push({
            path: getStaticActivityPath(item),
            content: utf8ToBase64(buildActivityHtml(item))
          });
        }

        setStatus("正在發布到 GitHub...", "");
        await publishToGitHub(nextContent, extraFiles, `Publish ${item.title || "website content"}`);
        state.content = nextContent;
        state.baseContent = cloneContent(nextContent);
        clearPendingAssetUploads(pendingAssetFiles.map((file) => file.path));
        setDirty(false);

        setStatus(
          `已發布到 GitHub。本機檔案不會自動改動；需要本機同步時請用 git pull。${processingSummary}`,
          "success"
        );
      } else {
        state.content = nextContent;
        await savePendingAssetUploads(nextContent);
        await writeContentFile();
        await writeSitemapFile();
        await writeBlogIndexFile();

        if (type === "blogPosts") {
          await writeBlogPostFile(item);
        }

        if (type === "activities") {
          await writeActivityFile(item);
        }

        setDirty(false);
        setStatus(
          `已儲存到本機 data/site-content.json。${processingSummary}`,
          "success"
        );
      }

      quickForm.reset();
      renderQuickFields();
      render();
    } catch (error) {
      console.error(error);
      setStatus(`發布失敗：${getFriendlyPublishError(error)}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  const publishCurrentContent = async () => {
    if (!state.content) {
      setStatus("內容尚未載入，請先載入後再發布。", "error");
      return;
    }

    if (state.publishing) {
      return;
    }

    setPublishing(true);

    try {
      const nextContent = cloneContent(state.content);

      if (!ensurePublishedBlogPostIds(nextContent)) {
        setStatus("已取消發布。", "");
        return;
      }

      setStatus("正在確認 GitHub 是否已有新版本...", "");
      await assertRemoteContentIsCurrent(nextContent);
      setStatus("正在發布到 GitHub...", "");

      const blogIndexHtml = await buildBlogIndexHtml(nextContent);
      const extraFiles = [
        {
          path: "sitemap.xml",
          content: utf8ToBase64(buildSitemapXml(nextContent))
        },
        {
          path: "blog.html",
          content: utf8ToBase64(blogIndexHtml)
        }
      ];
      const pendingAssetFiles = await getPendingAssetExtraFiles(nextContent);

      extraFiles.push(...pendingAssetFiles);

      adminNormalizeList(nextContent.blogPosts)
        .filter((post) => post && post.status !== "draft" && post.id)
        .forEach((post) => {
          extraFiles.push({
            path: getStaticBlogPath(post),
            content: utf8ToBase64(buildBlogPostHtml(post))
          });
        });

      adminNormalizeList(nextContent.activities)
        .filter((activity) => activity && activity.id)
        .forEach((activity) => {
          extraFiles.push({
            path: getStaticActivityPath(activity),
            content: utf8ToBase64(buildActivityHtml(activity))
          });
        });

      await publishToGitHub(nextContent, extraFiles, "Update website content");
      state.content = nextContent;
      state.baseContent = cloneContent(nextContent);
      clearPendingAssetUploads(pendingAssetFiles.map((file) => file.path));
      setDirty(false);
      render();
      setStatus("已發布到 GitHub。本機檔案不會自動改動；需要本機同步時請用 git pull。", "success");
    } catch (error) {
      console.error(error);
      setStatus(`發布失敗：${getFriendlyPublishError(error)}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  const saveCurrentContent = async () => {
    if (!state.content) {
      setStatus("內容尚未載入，請先載入後再儲存。", "error");
      return;
    }

    if (!state.rootHandle) {
      setStatus("要儲存到本機，請先按「選擇網站資料夾」取得寫入權限；若要直接上傳，請按「發布到 GitHub」。", "error");
      return;
    }

    try {
      if (!ensurePublishedBlogPostIds(state.content)) {
        setStatus("已取消儲存。", "");
        return;
      }

      await savePendingAssetUploads(state.content);
      await writeContentFile();
      await writeSitemapFile();
      await writeBlogIndexFile();
      await writeAllBlogPostFiles();
      await writeAllActivityFiles();
      setDirty(false);
      render();
      setStatus("已儲存 data/site-content.json、sitemap.xml、blog 列表、blog 靜態檔與 activity 靜態檔。", "success");
    } catch (error) {
      console.error(error);
      setStatus("儲存失敗，請確認瀏覽器仍有資料夾寫入權限。", "error");
    }
  };

  const loadInitialContent = async () => {
    try {
      const response = await fetch("data/site-content.json", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      state.content = normalizeContent(await response.json());
      state.baseContent = cloneContent(state.content);
      setDirty(false);
      setStatus("內容已載入。可以直接編輯並發布到 GitHub；若要儲存回本機，請先選擇網站資料夾。", "success");
      renderQuickFields();
      render();
    } catch (error) {
      console.warn(error);
      setStatus("尚未載入內容。請用本機伺服器開啟，或按「選擇網站資料夾」。", "error");
      render();
    }
  };

  const openWebsiteFolder = async () => {
    if (!window.showDirectoryPicker) {
      setStatus("這個瀏覽器不支援資料夾寫入。請使用 Chrome 或 Edge 開啟 admin.html。", "error");
      return;
    }

    try {
      const shouldKeepUnsavedContent = Boolean(state.content && state.dirty);

      state.rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });

      if (shouldKeepUnsavedContent) {
        await readContentFile();
        setDirty(true);
        setStatus("已選擇網站資料夾。你剛剛的未儲存變更仍保留，現在可以按「儲存到本機」寫入。", "success");
      } else {
        state.content = normalizeContent(await readContentFile());
        state.baseContent = cloneContent(state.content);
        state.selectedIndex = 0;
        setDirty(false);
        setStatus("內容已載入，可以開始編輯。", "success");
      }

      renderQuickFields();
      render();
    } catch (error) {
      console.error(error);
      setStatus("無法讀取 data/site-content.json，請確認選到網站根目錄。", "error");
    }
  };

  const getBlogTaxonomySelections = (root) => {
    const item = root === editor && state.section === "blogPosts" ? getCurrentItem() : null;

    return {
      tags: item ? adminNormalizeList(item.tags) : getCheckedBlogTags(root),
      series: item ? item.series || null : getSelectedBlogSeries(root)
    };
  };

  const selectBlogOptionForRoot = (root, kind, option) => {
    const item = root === editor && state.section === "blogPosts" ? getCurrentItem() : null;
    let tags = item ? adminNormalizeList(item.tags) : getCheckedBlogTags(root);
    let series = item ? item.series || null : getSelectedBlogSeries(root);

    if (kind === "series") {
      series = option;

      if (item) {
        item.series = { ...option };
      }
    } else {
      tags = mergeBlogOptions(tags, [option]);

      if (item) {
        item.tags = tags;
      }
    }

    refreshBlogTaxonomyControls(root, { tags, series });
  };

  const handleBlogTaxonomyClick = (root, event) => {
    const target = event.target instanceof Element ? event.target : null;
    const addButton = target?.closest("[data-add-blog-option]");
    const removeButton = target?.closest("[data-remove-blog-option]");

    if (!addButton && !removeButton) {
      return false;
    }

    event.preventDefault();

    if (!state.content) {
      setStatus("內容尚未載入，請稍等或選擇網站資料夾。", "error");
      return true;
    }

    if (addButton) {
      const kind = addButton.dataset.addBlogOption || "tag";
      const input = root.querySelector(`[data-new-blog-option-label="${kind}"]`);
      const result = addBlogOption(kind, input?.value || "");

      if (result.error) {
        setStatus(result.error, "error");
        return true;
      }

      selectBlogOptionForRoot(root, kind, result.option);
      if (!result.existing || root === editor) {
        setDirty(true);
      }
      setStatus(
        result.existing
          ? `已選取既有${getBlogOptionConfig(kind).label}：${result.option.label}`
          : `已新增${getBlogOptionConfig(kind).label}：${result.option.label}`,
        "success"
      );
      return true;
    }

    const kind = removeButton.dataset.blogOptionKind || "tag";
    const slug = removeButton.dataset.removeBlogOption || "";
    const option = getBlogOptionBySlug(kind, slug);
    const label = option?.label || slug;

    if (!window.confirm(`確定刪除「${label}」嗎？這會從所有 Blog 文章移除。`)) {
      return true;
    }

    const selectedBeforeRemoval = getBlogTaxonomySelections(root);
    const removed = removeBlogOption(kind, slug);

    if (!removed) {
      setStatus("找不到要刪除的項目。", "error");
      return true;
    }

    const fallbackSelections = {
      tags: adminNormalizeList(selectedBeforeRemoval.tags).filter((tag) => normalizeBlogOption(tag)?.slug !== removed.slug),
      series: normalizeBlogOption(selectedBeforeRemoval.series)?.slug === removed.slug ? null : selectedBeforeRemoval.series
    };

    refreshBlogTaxonomyControls(root, root === editor ? getBlogTaxonomySelections(root) : fallbackSelections);
    setDirty(true);
    setStatus(`已刪除${getBlogOptionConfig(kind).label}：${removed.label}`, "success");
    return true;
  };

  const handleBlogTaxonomyChange = (root, event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.matches("[data-blog-option-field]")) {
      return false;
    }

    const row = target.closest("[data-blog-option-row]");
    const kind = row?.dataset.blogOptionKind || "tag";
    const oldSlug = row?.dataset.blogOptionSlug || "";
    const result = updateBlogOption(kind, oldSlug, {
      label: row?.querySelector("[data-blog-option-field='label']")?.value || "",
      slug: row?.querySelector("[data-blog-option-field='slug']")?.value || ""
    });

    if (result.error) {
      setStatus(result.error, "error");
      refreshBlogTaxonomyControls(root);
      return true;
    }

    const selectedBeforeRefresh = getBlogTaxonomySelections(root);
    const updatedSelections = root === editor
      ? getBlogTaxonomySelections(root)
      : {
          tags: adminNormalizeList(selectedBeforeRefresh.tags)
            .map((tag) => normalizeBlogOption(tag)?.slug === result.previous.slug ? result.option : tag),
          series: normalizeBlogOption(selectedBeforeRefresh.series)?.slug === result.previous.slug
            ? result.option
            : selectedBeforeRefresh.series
        };

    refreshBlogTaxonomyControls(root, updatedSelections);
    setDirty(true);
    setStatus(`已更新${getBlogOptionConfig(kind).label}：${result.option.label}`, "success");
    return true;
  };

  openFolderButton.addEventListener("click", openWebsiteFolder);

  saveButton.addEventListener("click", saveCurrentContent);

  newButton.addEventListener("click", () => {
    const collection = getCollection();

    collection.unshift(defaultItem());
    state.selectedIndex = 0;
    setDirty(true);
    render();
  });

  deleteButton.addEventListener("click", () => {
    const collection = getCollection();

    if (!collection.length) {
      return;
    }

    if (!window.confirm("確定要刪除此項目嗎？此操作無法復原。")) {
      return;
    }

    collection.splice(state.selectedIndex, 1);
    state.selectedIndex = Math.max(0, state.selectedIndex - 1);
    setDirty(true);
    render();
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.section = tab.dataset.adminSection;
      state.selectedIndex = 0;
      render();
    });
  });

  honorCategorySelect.addEventListener("change", () => {
    state.honorCategory = honorCategorySelect.value;
    state.selectedIndex = 0;
    render();
  });

  const preventMarkdownToolbarFocusLoss = (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (target?.closest("[data-markdown-action]")) {
      event.preventDefault();
    }
  };

  editor.addEventListener("input", updateCurrentItem);
  editor.addEventListener("change", updateCurrentItem);
  editor.addEventListener("change", (event) => {
    handleBlogTaxonomyChange(editor, event);
  });
  editor.addEventListener("mousedown", preventMarkdownToolbarFocusLoss);
  editor.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const addTagButton = target?.closest("[data-add-publication-tag]");
    const markdownButton = target?.closest("[data-markdown-action]");
    const actionButton = target?.closest("[data-editor-open-folder], [data-editor-save], [data-editor-publish-github]");

    if (handleBlogTaxonomyClick(editor, event)) {
      return;
    }

    if (markdownButton) {
      const markdownEditor = markdownButton.closest(".admin-markdown-editor");
      const markdownTextarea = markdownEditor?.querySelector("[data-markdown-editor]");

      event.preventDefault();

      if (markdownButton.dataset.markdownAction === "image") {
        await insertMarkdownImage(markdownTextarea);
      } else {
        applyMarkdownAction(markdownTextarea, markdownButton.dataset.markdownAction);
      }

      return;
    }

    if (addTagButton) {
      const item = getCurrentItem();
      const customTags = getCustomTagsFromFormData(new FormData(editor));

      event.preventDefault();

      if (!item || state.section !== "publications") {
        return;
      }

      if (!customTags.length) {
        setStatus("請先輸入要新增的關鍵字。", "error");
        return;
      }

      item.tags = mergeTags(item.tags, customTags);
      setDirty(true);
      setStatus(`已加入關鍵字：${customTags.map((tag) => tag.label).join(", ")}`, "success");
      render();
      return;
    }

    if (!actionButton || actionButton.disabled) {
      return;
    }

    event.preventDefault();

    if (actionButton.matches("[data-editor-open-folder]")) {
      openWebsiteFolder();
      return;
    }

    if (actionButton.matches("[data-editor-save]")) {
      saveCurrentContent();
      return;
    }

    publishCurrentContent();
  });
  quickType.addEventListener("change", renderQuickFields);
  quickFields.addEventListener("mousedown", preventMarkdownToolbarFocusLoss);
  quickFields.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("[data-markdown-action]");

    if (handleBlogTaxonomyClick(quickFields, event)) {
      return;
    }

    if (!button) {
      return;
    }

    event.preventDefault();

    if (button.dataset.markdownAction === "image") {
      await insertMarkdownImage(quickFields.querySelector("[data-markdown-editor]"));
    } else {
      applyMarkdownAction(quickFields.querySelector("[data-markdown-editor]"), button.dataset.markdownAction);
    }
  });
  quickFields.addEventListener("change", (event) => {
    if (handleBlogTaxonomyChange(quickFields, event)) {
      return;
    }

    if (event.target.name === "honorCategory") {
      renderQuickHonorFields(event.target.value || "awards");
    }
  });
  quickSaveLocalButton.addEventListener("click", () => handleQuickPublish("local"));
  quickPublishGitHubButton.addEventListener("click", () => handleQuickPublish("github"));
  publishCurrentContentButton.addEventListener("click", publishCurrentContent);

  setStatus("尚未選擇網站資料夾。");
  renderQuickFields();
  render();
  loadInitialContent();
}
