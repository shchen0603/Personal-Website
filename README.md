# Personal Website

這是一個可直接部署到 GitHub Pages 的靜態個人網站，主題聚焦在陳思翰 Szu-Han Chen 的國立陽明交通大學醫學系學生與心血管流行病學研究者身份、心血管、腎臟與代謝健康、營養暴露、高血壓、心臟衰竭與部落格寫作。

## 檔案結構

- `index.html`: 首頁
- `research.html`: 研究介紹與最新研究入口
- `publications.html`: 完整已發表著作清單
- `honors.html`: 學術獎項、受邀演講、會議報告、媒體報導與專業服務
- `activities.html`: 研討會、受邀演講、工作坊等活動照片與簡短心得
- `blog.html`: 文章列表
- `post.html`: 由 `data/site-content.json` 動態產生的 Blog 文章頁；單篇文章也會在 `posts/<slug>.html` 同步預生成靜態檔，sitemap.xml 指到該靜態檔
- `admin.html`: 本機內容管理頁，可新增與更新 Blog、Publications、Honors、Activities
- `data/site-content.json`: 全站可維護內容資料來源
- `contact.html`: 聯繫方式頁面
- `posts/welcome.html`: 舊版靜態文章備份
- `posts/_template.html`: Blog 文章模板，僅供本機維護參考
- `styles.css`: 全站樣式
- `script.js`: 手機選單、年份與內容渲染
- `admin.js`: 管理頁的本機讀寫、表單與圖片上傳邏輯
- `assets/cardiovascular-epidemiology-hero.webp`: 首頁主視覺
- `assets/cardiovascular-epidemiology-hero-og.jpg`: 社群分享預覽圖
- `assets/blog/`: Blog 圖片
- `assets/activities/`: Activities 圖片

## 管理員模式

目前網站已改成「資料檔 + 前台渲染」：Blog、Publications、Honors、Activities 的主要內容都集中在 `data/site-content.json`。平常更新內容時建議使用 `admin.html`：

1. 用本機伺服器開網站，不要直接雙擊 HTML 檔。
2. 前往 `http://localhost:8000/admin.html`。
3. 在 Quick Publish 選擇 Blog、Activity、Honor 或 Publication。
4. 填文字、附圖片，按「直接發布到 GitHub」即可 commit 到 repository，GitHub Pages 會稍後自動部署。
5. 若只想先改本機檔案，按「選擇網站資料夾」，選取 repository 根目錄，再按「儲存到本機」。
6. 下方的 Content Studio 是進階編輯區，可用來修改既有項目或做比較細的整理。

`admin.html` 現在會在瀏覽器端自動把上傳圖片壓縮成最長邊 1920px 的 `.webp`，並移除原始 EXIF/GPS metadata 後再寫入網站檔案；`.heic` / `.heif` 也會先自動轉檔，所以平常照原本習慣上傳 iPhone 照片即可。若有特別需要保存原檔，可另外自行備份。

直接發布到 GitHub 需要一個 fine-grained personal access token。建議建立只限 `shchen0603/Personal-Website` 的 token，權限只開 `Contents: Read and write`。Token 不會寫進 repository，也不會被放進網頁檔案；它只存在你當下開啟的瀏覽器欄位中。Safari/Firefox 對本機檔案寫入支援有限，建議使用 Chrome 或 Edge。

## Analytics

公開頁面已安裝 Cloudflare Web Analytics beacon，hostname 設定為 `shchen0603.github.io`。`admin.html` 與 Google 驗證檔不會載入 analytics snippet，避免把管理操作或驗證請求算進訪客資料。

## 更新 Publications

目前完整著作清單由 `data/site-content.json` 產生，建議用 `admin.html` 更新。若要手動編輯 JSON，新著作需放入 `publications` 陣列：

1. 更新 `year`、`title`、`authors`、`venue`、`doi`。
2. 在 `category` 中填入 `Peer-Reviewed Journal Publications`、`Published Conference Abstracts` 或 `Journal Cover Features`。
3. 在 `tags` 中加入 `{ "slug": "heart-failure", "label": "Heart Failure", "group": "Topics" }` 這種格式；`group` 目前使用 `Study Design` 或 `Topics`。
4. 若要在 Research 頁露出代表作，把該篇的 `featured` 設為 `true`，其他篇設為 `false`。

## 更新 Honors

學術獎項與活動整理在 `data/site-content.json` 的 `honors` 物件中，包含 `awards`、`talks`、`presentations`、`mediaCoverage`、`services`。建議用 `admin.html` 的 Honors 分頁更新。

## 更新 Activities

活動照片與簡短心得由 `data/site-content.json` 的 `activities` 陣列產生。用 `admin.html` 更新時，圖片會自動放到 `assets/activities/`，並先在本機壓縮成 metadata-free `.webp`。沒有照片時會使用 `visualLabel` 與 `visualTheme` 產生占位視覺。

## 寫 Blog

Blog 文章由 `data/site-content.json` 的 `blogPosts` 陣列產生，建議用 `admin.html` 更新。Blog 不再使用分類，Quick Publish 與 Content Studio 都以五個固定文章標籤整理內容：流行病學與健康媒體識讀、健康與預防、研究方法、研究筆記、學術隨筆；每篇文章會由 `post.html?id=文章ID` 顯示。

舊的 `posts/` HTML 檔先保留作為備份；新的文章不需要再手動複製 HTML。

## 更新 Contact

導覽列的 Contact 已改成 `contact.html`，不再直接打開個人 email。之後要更新聯繫方式時，直接編輯 `contact.html` 的 Email、Academic Profiles 或 Professional Links 區塊。

## 個人連結

- GitHub repository: <https://github.com/shchen0603/Personal-Website>
- ORCID: <https://orcid.org/0009-0006-4557-9097>
- Google Scholar: <https://scholar.google.com/citations?user=0CdlnrgAAAAJ&hl=zh-TW>
- ResearchGate: <https://www.researchgate.net/profile/Szu-Han-Chen-7>
- LinkedIn: <https://www.linkedin.com/in/szu-han-chen-med/?locale=en>
- Email: `szuhanchen930603@gmail.com`, `szuhanchen.md11@nycu.edu.tw`, `szu-han@hsph.harvard.edu`

## 本機預覽

因為前台會讀取 `data/site-content.json`，建議使用本機伺服器預覽：

```bash
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000`。管理頁在 `http://localhost:8000/admin.html`。

## 部署到 GitHub Pages

1. 使用 GitHub repository：`https://github.com/shchen0603/Personal-Website`。
2. 把這個資料夾推上 GitHub。
3. 到 repository 的 `Settings` -> `Pages`。
4. `Build and deployment` 選擇 `Deploy from a branch`。
5. Branch 選 `main`，folder 選 `/root`，儲存後等待 GitHub Pages 發布。

第一次推送可使用：

```bash
git add .
git commit -m "Create personal website"
git push -u origin main
```

這個 repository 的 GitHub Pages 網址通常會是 `https://shchen0603.github.io/Personal-Website/`。

如果 repository 名稱是 `你的帳號.github.io`，網站網址會是 `https://你的帳號.github.io/`。
