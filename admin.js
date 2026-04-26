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
    quickSaveLocalButton.disabled = !state.content;
    quickPublishGitHubButton.disabled = !state.content;
  };

  const cloneContent = (content) => JSON.parse(JSON.stringify(content || {}));

  const slugify = (value) =>
    String(value || "item")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "item";

  const adminNormalizeList = (value) => (Array.isArray(value) ? value : []);

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
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    return `${timestamp}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
  };

  const saveImage = async (file, folder) => {
    if (!file) {
      return "";
    }

    const safeName = getAssetFileName(file);
    const directory = await getDirectoryHandle(`assets/${folder}`, true);
    const fileHandle = await directory.getFileHandle(safeName, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(file);
    await writable.close();

    return `assets/${folder}/${safeName}`;
  };

  const makeAssetPath = (file, folder) => {
    if (!file) {
      return "";
    }

    return `assets/${folder}/${getAssetFileName(file)}`;
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

  const imageField = (pathValue = "", folder = "blog") => `
    <div class="admin-image-row">
      ${field("image", "圖片路徑", pathValue)}
      <label class="admin-field">
        <span>上傳圖片</span>
        <input type="file" name="imageFile" accept="image/*" data-admin-image-upload="${folder}">
      </label>
    </div>
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
        year: new Date().getFullYear().toString(),
        meta: `${new Date().getFullYear()} · Activity`,
        title: "New activity",
        summary: "",
        visualLabel: "Activity",
        visualTheme: "poa",
        image: "",
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
          <input type="file" name="imageFile" accept="image/*" data-quick-image>
        </label>
      `;
      return;
    }

    if (type === "activities") {
      quickFields.innerHTML = `
        <div class="admin-grid two">
          ${field("title", "活動名稱", "")}
          ${field("meta", "活動資訊", `${new Date().getFullYear()} · Activity`)}
        </div>
        ${textarea("summary", "簡短心得", "", 6)}
        <label class="admin-field">
          <span>附加圖片</span>
          <input type="file" name="imageFile" accept="image/*" data-quick-image>
        </label>
        <div class="admin-check-row">
          ${checkbox("log", "加入 Activity Log", true)}
          ${checkbox("featured", "放大為首張活動卡", false)}
        </div>
      `;
      return;
    }

    if (type === "honors") {
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
          ${field("year", "年份", new Date().getFullYear().toString())}
        </div>
        ${field("title", "標題", "")}
        ${textarea("description", "說明", "", 5)}
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

  const buildQuickItem = (type, formData, imagePath = "") => {
    const today = new Date().toISOString().slice(0, 10);

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
        image: imagePath,
        imageAlt: title,
        body
      };
    }

    if (type === "activities") {
      const title = formData.get("title") || "New activity";

      return {
        year: today.slice(0, 4),
        meta: formData.get("meta") || `${today.slice(0, 4)} · Activity`,
        title,
        summary: formData.get("summary") || "",
        visualLabel: title,
        visualTheme: "poa",
        image: imagePath,
        imageAlt: title,
        featured: formData.get("featured") === "on",
        log: formData.get("log") === "on"
      };
    }

    if (type === "honors") {
      return {
        year: formData.get("year") || today.slice(0, 4),
        title: formData.get("title") || "New honor",
        description: formData.get("description") || "",
        honorCategory: formData.get("honorCategory") || "awards"
      };
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
  };

  const renderList = () => {
    const collection = getCollection();

    newButton.disabled = !state.content;
    deleteButton.disabled = !state.content || !collection.length;

    list.innerHTML = collection
      .map((item, index) => {
        const label = item.title || item.category || "Untitled";
        const meta = item.year || item.dateLabel || item.date || item.status || "";

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
        ${textarea("summary", "心得 / 說明", item.summary, 5)}
        ${imageField(item.image, "activities")}
        ${field("imageAlt", "圖片替代文字", item.imageAlt)}
        <div class="admin-check-row">
          ${checkbox("featured", "放大為首張活動卡", item.featured)}
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

    if (event.target.name === "imageFile") {
      const folder = event.target.dataset.adminImageUpload || "blog";
      const path = await saveImage(event.target.files[0], folder);

      if (path) {
        item.image = path;
        setStatus(`圖片已加入：${path}`, "success");
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

    setDirty(true);
    renderList();
  };

  const getQuickImageFile = () => quickForm.querySelector("[data-quick-image]")?.files?.[0] || null;

  const handleQuickPublish = async (mode) => {
    if (!state.content) {
      setStatus("內容尚未載入，請稍等或選擇網站資料夾。", "error");
      return;
    }

    const type = quickType.value;
    const imageFile = getQuickImageFile();
    const imageFolder = type === "activities" ? "activities" : "blog";

    try {
      if (mode === "local" && imageFile && !state.rootHandle) {
        setStatus("要儲存圖片到本機，請先按「選擇網站資料夾」。", "error");
        return;
      }

      if (mode === "local" && !state.rootHandle) {
        setStatus("要寫入本機檔案，請先按「選擇網站資料夾」。", "error");
        return;
      }

      const nextContent = cloneContent(state.content);
      const imagePath = mode === "local"
        ? await saveImage(imageFile, imageFolder)
        : makeAssetPath(imageFile, imageFolder);
      const item = buildQuickItem(type, new FormData(quickForm), imagePath);
      const extraFiles = [];

      insertQuickItem(nextContent, type, item);

      if (mode === "github") {
        if (imageFile && imagePath) {
          extraFiles.push({
            path: imagePath,
            content: await fileToBase64(imageFile)
          });
        }

        setStatus("正在發布到 GitHub...", "");
        await publishToGitHub(nextContent, extraFiles, `Publish ${item.title || "website content"}`);
        state.content = nextContent;
        setDirty(false);
        setStatus("已發布到 GitHub。GitHub Pages 會在稍後自動部署。", "success");
      } else {
        state.content = nextContent;
        await writeContentFile();
        setDirty(false);
        setStatus("已儲存到本機 data/site-content.json。", "success");
      }

      quickForm.reset();
      renderQuickFields();
      render();
    } catch (error) {
      console.error(error);
      setStatus(`發布失敗：${error.message || "請檢查設定與權限。"}`, "error");
    }
  };

  const loadInitialContent = async () => {
    try {
      const response = await fetch("data/site-content.json", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      state.content = await response.json();
      setDirty(false);
      setStatus("內容已載入。可以直接快速發布；若要寫入本機檔案，請選擇網站資料夾。", "success");
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

  setStatus("尚未選擇網站資料夾。");
  renderQuickFields();
  render();
  loadInitialContent();
}
