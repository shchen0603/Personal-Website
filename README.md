# Szu-Han Chen Personal Website

陳思翰 Szu-Han Chen 的個人學術網站。網站聚焦心血管流行病學、心血管-腎臟-代謝健康、心臟衰竭、高血壓、營養與代謝體學研究，也整理學術發表、榮譽紀錄、活動照片、部落格與聯繫方式。

這個專案是可直接部署到 GitHub Pages 的靜態網站，沒有 npm、bundler 或後端服務。公開頁面由 HTML/CSS/vanilla JavaScript 組成；可維護內容集中在 `data/site-content.json`，再由前台 `script.js` 動態渲染。

## 架構總覽

```text
Static HTML pages
  -> script.js loads data/site-content.json
  -> render dynamic sections, filters, detail pages, SEO metadata
  -> styles.css provides the site-wide design system

admin.html
  -> admin.js loads/edits data/site-content.json
  -> optionally writes local files through File System Access API
  -> optionally publishes directly to GitHub through GitHub API
  -> regenerates sitemap.xml, blog.html static fallback links, static blog pages under posts/, and static activity pages under activities/

scripts/check_site.py
  -> checks content data, image paths, generated pages, blog.html fallback links, noindex usage, and sitemap
  -> can regenerate sitemap, blog.html fallback links, and static pages with --fix
```

目前的內容資料流有兩層：

1. 公開網站：訪客打開各頁 HTML，`script.js` 讀取 `data/site-content.json`，渲染 publications、honors、activities、blog、home highlights 等內容。
2. 管理頁：作者打開 `admin.html`，用 Quick Publish 或 Content Studio 更新資料；可儲存到本機，也可用 GitHub token 直接 commit 到 GitHub Pages repository。

公開頁面都保留基本靜態 fallback 內容。若 JSON 載入失敗，頁面仍會顯示 HTML 內原本的內容，方便 GitHub Pages 或本機預覽發生暫時錯誤時維持可讀性。

## 主要檔案

| 路徑 | 角色 |
| --- | --- |
| `index.html` | 首頁。含 hero、個人簡介、統計數字、近期亮點、研究焦點、最新文章入口。 |
| `research.html` | 研究主題頁。呈現 research profile、三個研究焦點與代表著作。 |
| `publications.html` | 完整著作頁。由 JSON 產生列表，支援搜尋與主題/研究設計篩選。 |
| `honors.html` | 榮譽與學術活動頁。顯示 awards、talks、presentations、media coverage、services。 |
| `activities.html` | 活動總覽。顯示活動卡片與 activity log。 |
| `activity.html` | 舊版/預覽用的動態單一活動頁。透過 `activity.html?id=<activity-id>` 從 JSON 找資料渲染。 |
| `activities/<id>.html` | 預生成的 Activity 靜態頁。管理頁或檢查工具會自動產生，現在是活動頁主要分享網址。 |
| `blog.html` | Blog 列表。由 `blogPosts` 產生文章列表與標籤篩選。 |
| `post.html` | 動態 Blog 文章頁。透過 `post.html?id=<post-id>` 渲染。 |
| `posts/<id>.html` | 預生成的 Blog 靜態頁。由 `admin.js` 產生，供 canonical URL、SEO 與 sitemap 使用。 |
| `contact.html` | 聯繫方式、academic profiles、professional links。 |
| `admin.html` | 本機內容管理介面。包含 Quick Publish 與 Content Studio。 |
| `data/site-content.json` | 全站可維護內容的單一資料來源。 |
| `script.js` | 公開頁前台 runtime：導覽、footer、內容渲染、篩選、文章頁、活動頁、theme、scroll reveal、JSON-LD。 |
| `site-config.js` | 共用網站設定：導覽、footer、網站根網址、blog taxonomy fallback、publication 分類與標籤。 |
| `admin.js` | 管理頁 runtime：表單、資料排序、圖片處理、本機寫入、GitHub 發布、sitemap、Blog 靜態頁與 Activity 靜態頁產生。 |
| `styles.css` | 全站樣式與 responsive layout。 |
| `assets/` | CV、hero、portrait、blog 圖片、activity 圖片等公開資源。 |
| `vendor/heic2any.min.js` | 管理頁處理 `.heic` / `.heif` 圖片上傳時使用。 |
| `sitemap.xml` | 搜尋引擎 sitemap。由管理頁儲存或發布時更新。 |
| `schema/site-content.schema.json` | `data/site-content.json` 的資料形狀說明，可輔助理解與未來驗證。 |
| `scripts/check_site.py` | 網站健康檢查工具，可檢查資料、圖片、靜態頁與 sitemap。 |
| `robots.txt` | 搜尋引擎爬取設定。 |
| `.nojekyll` | 讓 GitHub Pages 以一般靜態檔案部署，不套 Jekyll 處理。 |

## 資料模型

`data/site-content.json` 目前有七個 top-level keys：

| Key | 用途 |
| --- | --- |
| `homeHighlights` | 首頁近期亮點。每筆含 `meta`、`title`、`description`、`href`。 |
| `blogTagOptions` | Blog 文章標籤選項；Admin 可新增、編輯與刪除。 |
| `blogSeriesOptions` | Blog 系列選項；每篇文章最多選一個系列。 |
| `publications` | 著作資料。用於 publications 頁、research 代表作、首頁統計。 |
| `honors` | 榮譽與學術紀錄。內含 `awards`、`talks`、`presentations`、`mediaCoverage`、`services`。 |
| `activities` | 活動紀錄、活動照片、單一 activity 頁面資料。 |
| `blogPosts` | Blog 文章資料。用於 blog 列表、首頁最新文章、動態/靜態文章頁。 |

常見欄位慣例：

- `id`: Blog 與 activity 的 URL key，請維持穩定；改掉會影響既有連結。
- `date`: 使用 `YYYY-MM-DD`，供排序與 sitemap 使用。
- `dateLabel`: 顯示用日期，通常使用 `YYYY.MM.DD`。
- `status`: Blog 使用；`draft` 不會出現在公開列表，也不會被寫進 sitemap。
- `tags`: Blog 與 publications 使用。Publication tags 建議含 `slug`、`label`、`group`。
- `series`: Blog 使用，格式同 tag object；每篇文章最多一個。
- `featured`: Publications 用於 research 代表作；activities 可用於活動排序/展示。
- `body`: Blog 與 activities 的正文陣列。Blog body 支援簡化 Markdown 區塊，包含標題、清單、引用、連結與獨立一行的圖片語法 `![圖片說明](assets/blog/example.webp)`。

## 前台渲染

`script.js` 會在頁面載入後做幾件事：

- 產生共用導覽列與 footer。
- 依照頁面上的 `data-render` target 注入內容。
- 從 `data/site-content.json` 讀取內容，並用 `{ cache: "no-store" }` 避免本機編輯時讀到舊資料。
- 更新首頁統計數字，例如 publications、awards、talks/presentations、activities。
- 產生 publications 的搜尋與標籤篩選。
- 產生 blog 標籤與系列篩選。
- 依 URL query 渲染 `post.html?id=...` 與 `activity.html?id=...`，作為預覽或 fallback。
- 更新單篇 blog/activity 的 canonical、Open Graph、Twitter card 與 JSON-LD。
- 處理 dark mode、手機選單、scroll reveal、back-to-top、stat counter。

前台依賴的是 HTML 裡的 data attributes，例如：

- `data-page`: 標示目前頁面，供導覽 active state 使用。
- `data-render`: 標示由 JSON 注入的區塊。
- `data-publication-search`: Publications 搜尋欄。
- `data-publication-filter` / `data-blog-tag-filter` / `data-blog-series-filter`: 篩選按鈕。
- `data-stat`: 首頁統計數字。

## 管理頁

`admin.html` 是目前建議的內容更新入口。它有兩種工作方式：

1. Quick Publish：快速新增 Blog、Activity、Honor 或 Publication。
2. Content Studio：逐筆編輯 `blogPosts`、`publications`、`honors`、`activities`、`homeHighlights`。

管理頁可做的事：

- 載入 `data/site-content.json`。
- 編輯 JSON 對應內容。
- 本機儲存 `data/site-content.json`。
- 本機重新產生 `sitemap.xml`。
- 本機重新產生 `blog.html` 裡的靜態文章列表，讓搜尋引擎不靠 JavaScript 也能看到公開文章連結。
- 本機重新產生已發布 Blog 的 `posts/<id>.html`。
- 本機重新產生 Activity 的 `activities/<id>.html`。
- 直接透過 GitHub API 發布到 repository，並同步提交 `sitemap.xml`、`blog.html` 靜態文章列表與預生成頁面。
- 發布前比對 GitHub 最新內容，降低覆蓋遠端修改的風險。
- 上傳圖片時自動壓縮、轉成 WebP、移除 EXIF/GPS metadata。
- 上傳 `.heic` / `.heif` 時先透過 `vendor/heic2any.min.js` 轉檔。

### 本機儲存

本機儲存依賴瀏覽器的 File System Access API，因此建議用 Chrome 或 Edge：

1. 啟動本機伺服器。
2. 打開 `http://localhost:8000/admin.html`。
3. 按「選擇網站資料夾」，選 repository 根目錄。
4. 編輯內容。
5. 按「儲存內容」或 Quick Publish 的「儲存到本機」。

Safari 和 Firefox 對資料夾寫入支援有限，管理頁會提示改用 Chrome 或 Edge。

### 直接發布到 GitHub

直接發布需要 fine-grained personal access token：

- Repository access: 只選 `shchen0603/Personal-Website`
- Repository permissions: `Contents: Read and write`
- Branch: 通常是 `main`

Token 不會寫入 repository，也不會被儲存在網站檔案中；它只存在當下瀏覽器欄位。直接發布成功後，本機檔案不會自動同步，之後需要用 `git pull` 把遠端更新拉回本機。

直接發布時，`admin.js` 會寫入：

- `data/site-content.json`
- `sitemap.xml`
- Blog 的 `posts/<id>.html`
- Activity 的 `activities/<id>.html`
- Quick Publish 上傳的圖片檔案

## 圖片與資源

建議透過管理頁上傳圖片，不要手動放原始大圖：

- Blog 圖片會放在 `assets/blog/`。
- Activity 圖片會放在 `assets/activities/`。
- 上傳圖片會轉為最長邊 1920px 的 `.webp`。
- 圖片會移除 EXIF/GPS metadata。
- `.heic` / `.heif` 可直接上傳，管理頁會先轉檔再壓縮。
- 原始照片不要直接放進公開資源。若需要暫存原檔，請放在被 `.gitignore` 忽略的 `assets/originals/`。

其他固定資源：

- `assets/cardiovascular-epidemiology-hero.webp`: 首頁 hero 圖。
- `assets/cardiovascular-epidemiology-hero-og.jpg`: 社群分享預覽圖。
- `assets/portrait.webp` / `assets/portrait-sm.webp`: 個人照片。
- `assets/cv.pdf`: CV 下載檔。
- `favicon.svg`: 網站 icon。

## 本機預覽

因為公開頁會使用 `fetch()` 讀取 `data/site-content.json`，請用本機伺服器預覽，不要直接雙擊 HTML：

```bash
python3 -m http.server 8000
```

然後打開：

- 公開網站：`http://localhost:8000`
- 管理頁：`http://localhost:8000/admin.html`
- 單篇 Blog 動態頁：`http://localhost:8000/post.html?id=2026-05-26-blog`
- 單一 Activity 動態頁：`http://localhost:8000/activity.html?id=<activity-id>`
- 單一 Activity 靜態頁：`http://localhost:8000/activities/<activity-id>.html`

## 網站健康檢查

你平常只需要記兩個指令。

### 只檢查網站有沒有問題

更新內容後，先執行：

```bash
python3 scripts/check_site.py
```

如果看到 `Site check passed`，代表目前沒有發現會讓網站壞掉的問題。

這個指令會檢查：

- `data/site-content.json` 是否能正確讀取。
- Blog 和 Activity 的 `id` 有沒有重複。
- 日期格式是否像 `YYYY-MM-DD`。
- 圖片路徑是否真的找得到檔案。
- 已發布 Blog 是否有 `posts/<id>.html`。
- Activity 是否有 `activities/<id>.html`。
- `blog.html` 的靜態文章列表是否和目前已發布 Blog 一致。
- `sitemap.xml` 是否包含目前應該公開的頁面。
- 是否有非預期的 `noindex`。

### 修正/重產生網站檔案後再檢查

如果你新增或修改了 Blog、Activity，建議執行：

```bash
python3 scripts/check_site.py --fix
```

這會重新產生：

- `sitemap.xml`
- Blog 靜態頁：`posts/<id>.html`
- Activity 靜態頁：`activities/<id>.html`

然後它也會順便檢查一次網站。

### 建議使用順序

每次用 `admin.html` 更新內容後，可以照這樣做：

```bash
python3 scripts/check_site.py --fix
python3 -m http.server 8000
```

接著打開 `http://localhost:8000` 看網站。確認沒問題後，再 commit / push。

如果只想快速確認資料有沒有錯，不需要重新產生檔案，就跑：

```bash
python3 scripts/check_site.py
```

## 內容更新流程

建議日常更新使用管理頁。

### 新增 Blog

1. 打開 `admin.html`。
2. Quick Publish 選 `Blog / 心得`。
3. 填入標題、摘要、日期、系列、標籤與正文。
4. 可選擇上傳圖片。
5. 本機儲存或直接發布到 GitHub。

發布後會更新 `blogPosts`，並為 published 文章產生 `posts/<id>.html`。公開網站主要 canonical URL 指向 `posts/<id>.html`，動態頁 `post.html?id=...` 仍可用於預覽與 fallback。

Blog 正文支援 Markdown 工具列與數學公式：

- 行內公式：`\( OR_{\mathrm{true}} = 9 \)`
- 區塊公式：

```text
$$
OR_{\mathrm{true}} = \frac{100/100}{100/900} = 9
$$
```

在 `admin.html` 可用 `Math` 按鈕插入行內公式，用 `$$` 按鈕插入區塊公式。若直接編輯 `data/site-content.json`，反斜線需要寫成 `\\mathrm`、`\\frac` 這種 JSON escape 形式。

### 新增 Activity

1. Quick Publish 選 `Activity / 活動照片`。
2. 填日期、標題、摘要、正文。
3. 可上傳封面與多張 gallery 圖片。
4. 儲存或發布後，活動會出現在 `activities.html`，主要單頁 URL 為 `activities/<activity-id>.html`。

### 更新 Publications

Publication 建議包含：

- `year`
- `title`
- `category`
- `authors`
- `venue`
- `doi`
- `firstAuthor`
- `correspondingAuthor`
- `summary`
- `tags`
- `featured`

`category` 目前常用：

- `Journal Publications`
- `Published Conference Abstracts`
- `Journal Cover Features`

`tags.group` 目前常用：

- `Study Design`
- `Topics`

若要在 `research.html` 顯示為代表作，將該筆 `featured` 設為 `true`。

### 更新 Honors

`honors` 內部分類：

- `awards`: 獎項。
- `talks`: 受邀演講。
- `presentations`: 會議口頭報告。
- `mediaCoverage`: 媒體報導。
- `services`: 學術服務，例如 reviewer 紀錄。

`awards` 可用 `scope` 分成 `international` 與 `domestic`。`services.items` 可使用純文字，或 `{ "label": "...", "highlight": true }` 讓 reviewer 項目以粗體顯示。`talks` 與 `presentations` 支援日期排序；建議同時維護 `date` 與 `dateLabel`。

### 更新首頁亮點

`homeHighlights` 只控制首頁「近期學術亮點」卡片。每筆通常包含：

- `meta`
- `title`
- `description`
- `href`

若 `href` 留空，前台會顯示純文字標題；有 `href` 時會顯示連結。

## SEO、Analytics 與搜尋引擎

專案目前包含：

- 每頁 canonical URL。
- Open Graph 與 Twitter card metadata。
- Person / BlogPosting / ScholarlyArticle / ItemList 等 JSON-LD。
- `sitemap.xml`。
- `robots.txt`。
- Google Search Console 驗證檔 `google29466b9e7fe5f620.html`。
- Cloudflare Web Analytics beacon。

Cloudflare Web Analytics 只放在公開頁面、預生成 Blog 頁與預生成 Activity 頁；`admin.html` 與 Google 驗證檔不載入 analytics，避免把管理操作或驗證請求算進訪客資料。

## 部署

這個 repository 可直接用 GitHub Pages 部署：

1. 到 repository 的 `Settings` -> `Pages`。
2. `Build and deployment` 選 `Deploy from a branch`。
3. Branch 選 `main`。
4. Folder 選 `/root`。
5. 儲存後等待 GitHub Pages 發布。

網站網址：

```text
https://shchen0603.github.io/Personal-Website/
```

若是透過本機修改後部署：

```bash
git add .
git commit -m "Update website content"
git push
```

若是透過管理頁直接發布到 GitHub，發布完成後請在本機同步：

```bash
git pull
```

## 維護檢查清單

內容變更後建議確認：

- 首頁統計數字是否正確。
- `publications.html` 搜尋與標籤篩選是否正常。
- `blog.html` 是否只顯示 published 文章。
- 新 Blog 是否有對應的 `posts/<id>.html`。
- 新 Activity 是否能用 `activities/<activity-id>.html` 開啟。
- `sitemap.xml` 是否包含新 Blog 或 Activity。
- 圖片是否已在 `assets/blog/` 或 `assets/activities/`，且不是原始大圖。
- 發布到 GitHub 後，本機是否已 `git pull`。

## 個人連結

- Website: <https://shchen0603.github.io/Personal-Website/>
- GitHub repository: <https://github.com/shchen0603/Personal-Website>
- ORCID: <https://orcid.org/0009-0006-4557-9097>
- Google Scholar: <https://scholar.google.com/citations?user=0CdlnrgAAAAJ&hl=zh-TW>
- ResearchGate: <https://www.researchgate.net/profile/Szu-Han-Chen-7>
- LinkedIn: <https://www.linkedin.com/in/szu-han-chen-med/?locale=en>
- Email: `szuhanchen930603@gmail.com`, `szuhanchen.md11@nycu.edu.tw`, `szu-han@hsph.harvard.edu`
