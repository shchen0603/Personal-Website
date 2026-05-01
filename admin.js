const adminApp = document.querySelector("[data-admin-app]");

if (adminApp) {
  const state = {
    rootHandle: null,
    content: null,
    section: "blogPosts",
    honorCategory: "awards",
    selectedIndex: 0,
    dirty: false,
    quickImageFile: null
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

  const setDirty = (dirty) => {
    state.dirty = dirty;
    saveButton.disabled = !state.content || !dirty;
    publishCurrentContentButton.disabled = !state.content || !dirty;
    quickSaveLocalButton.disabled = !state.content;
    quickPublishGitHubButton.disabled = !state.content;
  };

  const cloneContent = (content) => JSON.parse(JSON.stringify(content || {}));

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

    return rawMessage || "請檢查設定與權限。";
  };

  const slugify = (value) =>
    String(value || "item")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "item";

  const adminNormalizeList = (value) => (Array.isArray(value) ? value : []);

  const formatDateForDisplay = (date) => String(date || "").replaceAll("-", ".");
  const honorCategoryUsesDate = (category) =>
    category === "talks" || category === "presentations";
  const HEIC_MIME_TYPES = new Set([
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence"
  ]);
  const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;
  const HEIC_OUTPUT_MIME = "image/jpeg";
  const HEIC_OUTPUT_EXTENSION = "jpg";
  const HEIC_OUTPUT_QUALITY = 0.9;

  const getFileBaseName = (fileName = "") => fileName.replace(/\.[^.]+$/, "") || "image";

  const getFileExtension = (fileName = "", fallback = "jpg") => {
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

  const sortAllHonorCollections = (honors) => {
    if (!honors) {
      return;
    }

    sortHonorItems(honors.talks ||= [], "talks");
    sortHonorItems(honors.presentations ||= [], "presentations");
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

  const getAssetFileName = (file) => {
    const extension = getFileExtension(file?.name, "jpg");
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

    return new File([blob], `${getFileBaseName(file.name)}.${HEIC_OUTPUT_EXTENSION}`, {
      type: HEIC_OUTPUT_MIME,
      lastModified: file.lastModified
    });
  };

  const prepareImageUpload = async (file) => {
    if (!file) {
      return null;
    }

    try {
      if (!isHeicFile(file)) {
        return {
          file,
          wasConverted: false,
          originalName: file.name
        };
      }

      return {
        file: await convertHeicToJpeg(file),
        wasConverted: true,
        originalName: file.name
      };
    } catch (error) {
      throw new Error(`HEIC 轉檔失敗：${file.name}。請重新選一次，或先在系統中轉成 JPG/PNG 後再上傳。${error?.message ? ` ${error.message}` : ""}`);
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

  const savePreparedImage = async (upload, folder) => {
    if (!upload?.file) {
      return "";
    }

    const path = getAssetPath(upload.file, folder);
    const fileHandle = await getFileHandle(path, true);
    const writable = await fileHandle.createWritable();

    await writable.write(upload.file);
    await writable.close();

    return path;
  };

  const saveImage = async (file, folder) => {
    const upload = await prepareImageUpload(file);

    return {
      upload,
      path: await savePreparedImage(upload, folder)
    };
  };

  const saveFileAtPath = async (file, path) => {
    if (!file || !path) {
      return;
    }

    const fileHandle = await getFileHandle(path, true);
    const writable = await fileHandle.createWritable();

    await writable.write(file);
    await writable.close();
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

  const githubRequest = async (path, options = {}) => {
    const owner = githubOwner.value.trim();
    const repo = githubRepo.value.trim();
    const token = githubToken.value.trim();

    if (!owner || !repo || !token) {
      throw new Error("請先填 GitHub owner、repository 和 token。");
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `GitHub request failed: ${response.status}`);
    }

    return response.json();
  };

  const publishToGitHub = async (nextContent, extraFiles = [], message = "Update website content") => {
    const branch = githubBranch.value.trim() || "main";
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

  const parseTags = (value) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [slug, label] = line.split("|").map((part) => part.trim());

        return {
          slug: slugify(slug),
          label: label || slug
        };
      });

  const stringifyTags = (tags) =>
    adminNormalizeList(tags)
      .map((tag) => `${tag.slug || ""}|${tag.label || ""}`)
      .join("\n");

  const parseLinks = (value) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, href] = line.split("|").map((part) => part.trim());

        return {
          label: label || "Link",
          href: href || "#"
        };
      });

  const stringifyLinks = (links) =>
    adminNormalizeList(links)
      .map((link) => `${link.label || ""}|${link.href || ""}`)
      .join("\n");

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

  const checkbox = (name, label, checked = false) => `
    <label class="admin-check">
      <input type="checkbox" name="${name}" ${checked ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `;

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
    <p class="admin-help">封面照會顯示在 Activities 卡片；其他活動照片會放進完整頁的圖片集。若你上傳 HEIC/HEIF，系統會先在本機自動轉成 JPG 再寫入網站。已上傳的圖片集仍可用「路徑|替代文字|照片說明」每行編輯一張。</p>
    ${textarea("images", "其他照片圖片集", stringifyImages(item.images), 5)}
  `;

  const defaultItem = () => {
    const today = new Date().toISOString().slice(0, 10);

    if (state.section === "blogPosts") {
      return {
        id: `post-${today}`,
        status: "published",
        date: today,
        dateLabel: today.replaceAll("-", "."),
        category: "Research Notes",
        title: "新文章",
        excerpt: "",
        image: "",
        imageAlt: "",
        body: [""]
      };
    }

    if (state.section === "publications") {
      return {
        year: new Date().getFullYear().toString(),
        title: "New publication",
        authors: "Szu-Han Chen.",
        venue: "",
        doi: "",
        tags: [],
        featured: false
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

    if (state.honorCategory === "services") {
      return {
        title: "New service",
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
      description: ""
    };
  };

  const renderQuickFields = () => {
    const type = quickType.value;

    state.quickImageFile = null;

    if (type === "blogPosts") {
      quickFields.innerHTML = `
        <div class="admin-grid two">
          ${field("title", "標題", "")}
          ${field("category", "分類", "Research Notes")}
        </div>
        ${textarea("body", "你想發布的文字", "", 7)}
        <label class="admin-field">
          <span>附加圖片</span>
          <input type="file" name="imageFile" accept="image/*,.heic,.heif" data-quick-image>
        </label>
        <p class="admin-help">若上傳 HEIC/HEIF，系統會先在本機自動轉成 JPG，再存進網站資料夾或直接發布到 GitHub。</p>
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
        <p class="admin-help">封面照會顯示在 Activities 卡片；其他活動照片會放進完整頁的圖片集。若你上傳 HEIC/HEIF，系統會先在本機自動轉成 JPG。</p>
        <div class="admin-check-row">
          ${checkbox("log", "加入 Activity Log", true)}
          ${checkbox("featured", "放大活動卡", false)}
        </div>
      `;
      return;
    }

    if (type === "honors") {
      const currentYear = new Date().getFullYear().toString();

      quickFields.innerHTML = `
        <div class="admin-grid two">
          <label class="admin-field">
            <span>類型</span>
            <select name="honorCategory">
              <option value="awards">Awards</option>
              <option value="talks">Invited Talks</option>
              <option value="presentations">Conference Presentations</option>
              <option value="services">Media & Service</option>
            </select>
          </label>
          ${field("date", "日期（演講/口頭報告可填）", "", "date")}
        </div>
        <div class="admin-grid two">
          ${field("dateLabel", "顯示日期", "")}
          ${field("year", "年份", currentYear)}
        </div>
        ${field("title", "標題", "")}
        ${textarea("description", "說明", "", 5)}
        <p class="admin-help">`Awards` 可以只填年份；`Invited Talks` 和 `Conference Presentations` 建議填完整日期，前台會依日期由近到遠排序。</p>
      `;
      return;
    }

    quickFields.innerHTML = `
      <div class="admin-grid two">
        ${field("year", "年份", new Date().getFullYear().toString())}
        ${field("doi", "DOI / 連結", "")}
      </div>
      ${field("title", "論文標題", "")}
      ${textarea("authors", "作者", "Szu-Han Chen.", 3)}
      ${textarea("venue", "期刊 citation", "", 3)}
      ${textarea("tags", "Tags（slug|Label，每行一個）", "", 4)}
      ${checkbox("featured", "設為 Research 頁代表作", false)}
    `;
  };

  const splitParagraphs = (value) =>
    value
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  const buildQuickItem = (type, formData, imageInput = []) => {
    const today = new Date().toISOString().slice(0, 10);
    const paths = Array.isArray(imageInput) ? imageInput.filter(Boolean) : [imageInput].filter(Boolean);

    if (type === "blogPosts") {
      const title = formData.get("title") || "新文章";
      const body = splitParagraphs(formData.get("body") || "");

      return {
        id: `${today}-${slugify(title)}`,
        status: "published",
        date: today,
        dateLabel: today.replaceAll("-", "."),
        category: formData.get("category") || "Research Notes",
        title,
        excerpt: body[0] || "",
        image: paths[0] || "",
        imageAlt: title,
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
      const date = String(formData.get("date") || "").trim();
      const year = String(formData.get("year") || today.slice(0, 4)).trim();
      const dateLabel = String(formData.get("dateLabel") || "").trim();

      const item = {
        year: date ? date.slice(0, 4) : year,
        title: formData.get("title") || "New honor",
        description: formData.get("description") || "",
        honorCategory
      };

      if (honorCategoryUsesDate(honorCategory) || date || dateLabel) {
        item.date = date;
        item.dateLabel = dateLabel || (date ? formatDateForDisplay(date) : "");
      }

      return item;
    }

    return {
      year: formData.get("year") || today.slice(0, 4),
      title: formData.get("title") || "New publication",
      authors: formData.get("authors") || "Szu-Han Chen.",
      venue: formData.get("venue") || "",
      doi: formData.get("doi") || "",
      tags: parseTags(formData.get("tags") || ""),
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
  };

  const renderList = () => {
    const collection = getCollection();

    newButton.disabled = !state.content;
    deleteButton.disabled = !state.content || !collection.length;

    list.innerHTML = collection
      .map((item, index) => {
        const label = item.title || item.category || "Untitled";
        const meta = item.dateLabel || item.date || item.year || item.status || "";

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
          ${field("category", "分類", item.category)}
          <label class="admin-field">
            <span>狀態</span>
            <select name="status">
              <option value="published" ${item.status !== "draft" ? "selected" : ""}>Published</option>
              <option value="draft" ${item.status === "draft" ? "selected" : ""}>Draft</option>
            </select>
          </label>
        </div>
        ${textarea("excerpt", "摘要", item.excerpt, 3)}
        ${imageField(item.image, "blog")}
        ${field("imageAlt", "圖片替代文字", item.imageAlt)}
        ${textarea("body", "正文（每一段用空行分開）", adminNormalizeList(item.body).join("\n\n"), 12)}
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
          ${field("doi", "DOI / 連結", item.doi)}
        </div>
        ${field("title", "標題", item.title)}
        ${textarea("authors", "作者", item.authors, 3)}
        ${textarea("venue", "期刊 citation", item.venue, 3)}
        ${textarea("tags", "Tags（slug|Label，每行一個）", stringifyTags(item.tags), 6)}
        ${checkbox("featured", "設為 Research 頁代表作", item.featured)}
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
      `;
      return;
    }

    if (state.honorCategory === "services") {
      editor.innerHTML = `
        <div class="admin-editor-heading">
          <p class="eyebrow">Media & Service</p>
          <h2>${escapeHTML(item.title || "Untitled")}</h2>
        </div>
        ${field("title", "標題", item.title)}
        ${textarea("description", "說明", item.description, 5)}
        ${textarea("links", "連結（Label|URL，每行一個）", stringifyLinks(item.links), 5)}
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
        <p class="admin-help">這兩個分類會依日期由近到遠排序；若有 `date` 但沒填 `dateLabel`，前台會自動顯示為 `YYYY.MM.DD`。</p>
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
      </div>
      ${textarea("description", "說明", item.description, 5)}
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
          result.upload?.wasConverted
            ? `封面照已加入，並已把 ${result.upload.originalName} 自動轉成 JPG：${path}`
            : `封面照已加入：${path}`,
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
      let convertedCount = 0;

      for (const file of files) {
        const result = await saveImage(file, folder);
        const path = result.path;

        if (path) {
          paths.push(path);
        }

        if (result.upload?.wasConverted) {
          convertedCount += 1;
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
            `已加入 ${paths.length} 張其他活動照片，並用第一張作為封面。${convertedCount ? ` 其中 ${convertedCount} 張 HEIC/HEIF 已自動轉成 JPG。` : ""}`,
            "success"
          );
        } else {
          setStatus(
            `已加入 ${paths.length} 張其他活動照片。${convertedCount ? ` 其中 ${convertedCount} 張 HEIC/HEIF 已自動轉成 JPG。` : ""}`,
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
          result.upload?.wasConverted
            ? `圖片已加入，並已把 ${result.upload.originalName} 自動轉成 JPG：${path}`
            : `圖片已加入：${path}`,
          "success"
        );
      }

      setDirty(true);
      render();
      return;
    }

    const name = event.target.name;
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

    if (name === "tags") {
      item.tags = parseTags(value);
    } else if (name === "links") {
      item.links = parseLinks(value);
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

    const type = quickType.value;
    const coverFile = type === "activities" ? getQuickCoverImageFile() : null;
    const galleryFiles = type === "activities" ? getQuickGalleryImageFiles() : [];
    const rawImageFiles = type === "activities"
      ? [coverFile, ...galleryFiles].filter(Boolean)
      : getQuickImageFiles();
    const imageFolder = type === "activities" ? "activities" : "blog";

    try {
      if (mode === "local" && rawImageFiles.length && !state.rootHandle) {
        setStatus("要儲存圖片到本機，請先按「選擇網站資料夾」。", "error");
        return;
      }

      if (mode === "local" && !state.rootHandle) {
        setStatus("要寫入本機檔案，請先按「選擇網站資料夾」。", "error");
        return;
      }

      const nextContent = cloneContent(state.content);
      const imagePaths = [];
      let coverPath = "";
      const galleryPaths = [];
      let coverUpload = null;
      let galleryUploads = [];
      let imageUploads = [];

      if (rawImageFiles.some(isHeicFile)) {
        setStatus("偵測到 HEIC/HEIF，正在自動轉成 JPG...", "");
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
      const convertedCount = getConvertedUploadCount(allUploads);

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
        new FormData(quickForm),
        type === "activities" ? { coverPath, galleryPaths } : imagePaths
      );
      const extraFiles = [];

      insertQuickItem(nextContent, type, item);

      if (mode === "github") {
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

        setStatus("正在發布到 GitHub...", "");
        await publishToGitHub(nextContent, extraFiles, `Publish ${item.title || "website content"}`);
        state.content = nextContent;
        setDirty(false);

        if (state.rootHandle) {
          try {
            if (type === "activities") {
              await saveFileAtPath(coverUpload?.file, coverPath);

              for (const [index, upload] of galleryUploads.entries()) {
                await saveFileAtPath(upload.file, galleryPaths[index]);
              }
            } else {
              for (const [index, upload] of imageUploads.entries()) {
                await saveFileAtPath(upload.file, imagePaths[index]);
              }
            }

            await writeContentFile();
            setStatus(
              `已發布到 GitHub，並同步寫回本機資料夾。GitHub Pages 會在稍後自動部署。${convertedCount ? ` 其中 ${convertedCount} 張 HEIC/HEIF 已自動轉成 JPG。` : ""}`,
              "success"
            );
          } catch (localError) {
            console.error(localError);
            setStatus("已發布到 GitHub，但本機同步失敗。請確認網站資料夾權限仍有效，或之後用 git pull 同步本機。", "error");
          }
        } else {
          setStatus(
            `已發布到 GitHub。尚未選擇網站資料夾，所以本機未同步；需要本機同步時可再用 git pull。${convertedCount ? ` 其中 ${convertedCount} 張 HEIC/HEIF 已自動轉成 JPG。` : ""}`,
            "success"
          );
        }
      } else {
        state.content = nextContent;
        await writeContentFile();
        setDirty(false);
        setStatus(
          `已儲存到本機 data/site-content.json。${convertedCount ? ` 其中 ${convertedCount} 張 HEIC/HEIF 已自動轉成 JPG。` : ""}`,
          "success"
        );
      }

      quickForm.reset();
      renderQuickFields();
      render();
    } catch (error) {
      console.error(error);
      setStatus(`發布失敗：${getFriendlyPublishError(error)}`, "error");
    }
  };

  const publishCurrentContent = async () => {
    if (!state.content) {
      setStatus("內容尚未載入，請先載入後再發布。", "error");
      return;
    }

    try {
      const nextContent = cloneContent(state.content);
      setStatus("正在發布到 GitHub...", "");
      await publishToGitHub(nextContent, [], "Update website content");
      setDirty(false);

      if (state.rootHandle) {
        try {
          await writeContentFile();
          setStatus("已發布到 GitHub，並已同步寫回本機資料夾。GitHub Pages 會在稍後自動部署。", "success");
        } catch (localError) {
          console.error(localError);
          setStatus("已發布到 GitHub，但本機同步失敗。請確認網站資料夾權限仍有效。", "error");
        }
      } else {
        setStatus("已發布到 GitHub。尚未選擇網站資料夾，所以本機未同步；需要本機同步時可再選擇資料夾。", "success");
      }
    } catch (error) {
      console.error(error);
      setStatus(`發布失敗：${getFriendlyPublishError(error)}`, "error");
    }
  };

  const loadInitialContent = async () => {
    try {
      const response = await fetch("data/site-content.json", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      state.content = await response.json();
      sortAllHonorCollections(state.content.honors ||= {});
      sortActivities(state.content.activities ||= []);
      setDirty(false);
      setStatus("內容已載入。可以直接快速發布；若要 GitHub 發布後也同步本機，請先選擇網站資料夾。", "success");
      render();
    } catch (error) {
      console.warn(error);
      setStatus("尚未載入內容。請用本機伺服器開啟，或按「選擇網站資料夾」。", "error");
      render();
    }
  };

  openFolderButton.addEventListener("click", async () => {
    if (!window.showDirectoryPicker) {
      setStatus("這個瀏覽器不支援資料夾寫入。請使用 Chrome 或 Edge 開啟 admin.html。", "error");
      return;
    }

    try {
      state.rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      state.content = await readContentFile();
      sortAllHonorCollections(state.content.honors ||= {});
      sortActivities(state.content.activities ||= []);
      state.selectedIndex = 0;
      setDirty(false);
      setStatus("內容已載入，可以開始編輯。", "success");
      render();
    } catch (error) {
      console.error(error);
      setStatus("無法讀取 data/site-content.json，請確認選到網站根目錄。", "error");
    }
  });

  saveButton.addEventListener("click", async () => {
    try {
      await writeContentFile();
      setDirty(false);
      setStatus("已儲存 data/site-content.json。", "success");
    } catch (error) {
      console.error(error);
      setStatus("儲存失敗，請確認瀏覽器仍有資料夾寫入權限。", "error");
    }
  });

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

  editor.addEventListener("input", updateCurrentItem);
  editor.addEventListener("change", updateCurrentItem);
  quickType.addEventListener("change", renderQuickFields);
  quickSaveLocalButton.addEventListener("click", () => handleQuickPublish("local"));
  quickPublishGitHubButton.addEventListener("click", () => handleQuickPublish("github"));
  publishCurrentContentButton.addEventListener("click", publishCurrentContent);

  setStatus("尚未選擇網站資料夾。");
  renderQuickFields();
  render();
  loadInitialContent();
}
