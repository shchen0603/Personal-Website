const adminApp = document.querySelector("[data-admin-app]");

if (adminApp) {
  const state = {
    rootHandle: null,
    content: null,
    section: "blogPosts",
    honorCategory: "awards",
    selectedIndex: 0,
    dirty: false
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

  const setStatus = (message, tone = "") => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const setDirty = (dirty) => {
    state.dirty = dirty;
    saveButton.disabled = !state.content || !dirty;
  };

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

  const saveImage = async (file, folder) => {
    if (!file) {
      return "";
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
    const safeName = `${new Date().toISOString().slice(0, 10)}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
    const directory = await getDirectoryHandle(`assets/${folder}`, true);
    const fileHandle = await directory.getFileHandle(safeName, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(file);
    await writable.close();

    return `assets/${folder}/${safeName}`;
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

  setStatus("尚未選擇網站資料夾。");
  render();
}
