# Szu-Han Chen Personal Website

陳思翰 Szu-Han Chen 的個人學術網站。這是部署在 GitHub Pages 的靜態網站，主要內容集中在 `data/site-content.json`，日常更新建議使用 `admin.html`。

## 最重要的工作流

### 1. 先啟動本機網站

不要直接雙擊 HTML，因為網站需要讀取 `data/site-content.json`。

```bash
python3 -m http.server 8000
```

打開：

- 公開網站：`http://localhost:8000`
- 管理頁：`http://localhost:8000/admin.html`

建議用 Chrome 或 Edge 開 `admin.html`，因為儲存到本機資料夾需要瀏覽器支援 File System Access API。

### 2. 用 Admin 修改內容

進入 `admin.html` 後：

1. 按「選擇網站資料夾」，選這個 repository 的根目錄。
2. 用 Quick Publish 新增文章/活動，或用 Content Studio 編輯既有內容。
3. 按「儲存到本機」。

Admin 儲存時會更新這些檔案：

- `data/site-content.json`
- `sitemap.xml`
- `blog.html` 裡的靜態文章列表
- `posts/<id>.html`
- `activities/<id>.html`
- 新上傳的圖片檔案

所以改完內容後，看到這些檔案一起變動是正常的。

### 3. 跑網站檢查

每次用 admin 改完內容後，建議跑：

```bash
python3 scripts/check_site.py --fix
python3 scripts/check_site.py
```

看到 `Site check passed` 再 commit / push。

`--fix` 會重新產生 sitemap、Blog 與 Activity 靜態頁、首頁的「最新文章」與統計數字，以及 Publications、Honors、About、Speaking &amp; Media 的 crawler-visible 區塊與結構化資料，避免搜尋引擎或訪客看到舊內容。

### 4. 本機預覽

檢查完後，在本機看一次：

- 首頁：`http://localhost:8000`
- Blog 列表：`http://localhost:8000/blog.html`
- 單篇文章：`http://localhost:8000/posts/<id>.html`

確認沒問題後再 commit / push。

### 5. Commit / Push

```bash
git status
git add .
git commit -m "Update site content"
git push
```

這個 repository 已設定 push 前自動執行網站檢查。若產生頁面、sitemap 或內容資料不同步，push 會被中止並顯示修正指令，不會把不完整版本送去部署。

GitHub Pages 更新後，Google 才會看到新版 `sitemap.xml`。

## 部署機制

網站只使用 GitHub Pages 的 branch deployment（`main`）部署。GitHub Actions 的 `Validate static site` workflow 只做唯讀檢查，不會產生檔案或再次部署，避免兩套部署同時競爭 Pages environment。

新的 clone 若也要啟用 push 前檢查，請在 repository 內執行一次：

```bash
git config core.hooksPath .githooks
```

## 用 Admin 修改時要注意

### 不要手動改產生出來的頁面

日常內容請改 `data/site-content.json` 或用 `admin.html`。

通常不要手動改：

- `posts/<id>.html`
- `activities/<id>.html`
- `sitemap.xml`
- `blog.html` 的靜態 fallback 區塊
- `publications.html`、`honors.html`、`about.html`、`speaking-media.html` 中有產生器標記的區塊

Blog、Activity、sitemap 與 blog fallback 可由 admin 或 `scripts/check_site.py --fix` 重新產生；collection 頁面的產生器區塊則以 `scripts/check_site.py --fix` 為準。手動改了之後，下次重產可能會被覆蓋。

### Blog 的 `id` 不要隨便改

Blog 的 `id` 會變成網址：

```text
posts/<id>.html
```

文章發布後若改 `id`，舊網址會失效，Google 也可能看到重複或消失的頁面。真的要改網址時，記得保留舊頁的 noindex redirect。

### 文章頁會自動產生的東西

每篇文章頁（`posts/<id>.html`）除了內文，產生器還會自動加上：

- **文章結尾區塊**：分享按鈕（LINE、Facebook、Threads、LinkedIn、複製連結）、作者卡、三篇延伸閱讀、CC BY-NC 4.0 授權聲明。延伸閱讀優先挑同標籤的最新文章，同系列的文章已有上一篇／下一篇，不會重複出現。
- **分享預覽圖**：有設主要圖片就用主要圖片；沒設的話自動取內文第一張圖；都沒有才用首頁通用圖。想要漂亮的預覽，建議每篇放一張 1200×630 左右的橫式圖當主要圖片。
- **搜尋標題**：標題寫成「系列名 06 | 主題」時，瀏覽器分頁與搜尋結果的標題會自動變成「主題｜系列名 06」，讓關鍵字排在前面；文章頁上看到的標題不變。
- **數學式**：內文有用到 `$$`、`\(`、`\[` 才會載入 KaTeX。

這些邏輯同時寫在 `scripts/check_site.py` 與 `admin.js`，兩邊輸出必須逐字相同；改其中一邊時記得同步另一邊，並更新兩邊的 `POST_ASSET_VERSION`。

### 著作連到解讀文章

在 `data/site-content.json` 的著作條目加上 `"explainer": "posts/<id>.html"`（或在 admin 的著作編輯畫面填「中文解讀文章路徑」），Publications 頁就會在該篇論文下方顯示「中文白話解讀」連結。

### 演講的客群子頁

`speaking/` 底下的四個頁面（高中老師、醫學生與醫學院、學會醫院與研究單位、媒體）是手寫的 HTML，不由產生器管理，要改講題或邀請說明時直接編輯檔案即可。演講頁（`speaking-media.html`）的四張客群卡片連到這些頁面；新增頁面時，記得把路徑加進 `scripts/check_site.py` 的 `BASE_PAGES` 與 `admin.js` 的 sitemap 清單。

給高中老師的一頁簡介 `assets/speaking/high-school-talks.pdf` 是由 `speaking/high-school-onepage.html` 印出來的。改完那個 HTML 後，用 Chrome 開啟它，列印成 PDF（A4、邊界「無」、勾選背景圖形），覆蓋原本的 PDF 即可；也可以在終端機執行：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf="$PWD/assets/speaking/high-school-talks.pdf" "file://$PWD/speaking/high-school-onepage.html"
```

### 草稿與發布

- `draft`：不會出現在 Blog 列表，也不會進 sitemap。
- `published`：會出現在 Blog 列表、首頁最新文章、sitemap，並產生 `posts/<id>.html`。

發布前請確認：

- title 不是「新文章」
- excerpt 已填好
- date 是 `YYYY-MM-DD`
- 主要圖片路徑正確
- 文章內圖片都有 alt 或圖說

### 圖片建議用 Admin 上傳

Admin 會把圖片轉成 WebP、壓縮、移除 EXIF/GPS metadata。

Blog 圖片語法：

```markdown
![替代文字](assets/blog/example.webp "這裡是圖片圖說")
```

雙引號裡的文字會顯示成圖片下方的小灰字。

### 如果 VS Code 說檔案比較新

如果出現：

```text
The content of the file is newer.
```

代表磁碟上的檔案已被 admin、檢查腳本或 git 更新過。不要直接 overwrite。先 compare，通常應以磁碟上的新版為準，再把真的需要的編輯補回去。

### 如果用 GitHub Token 直接發布

Admin 可以直接發布到 GitHub，但發布成功後，本機檔案不會自動同步。

之後在本機繼續改之前，先跑：

```bash
git pull
```

避免本機舊檔覆蓋 GitHub 上的新內容。

## 常用指令

```bash
# 啟動本機網站
python3 -m http.server 8000

# 檢查網站
python3 scripts/check_site.py

# 重產 sitemap / 靜態頁 / fallback 後檢查
python3 scripts/check_site.py --fix

# 查看目前哪些檔案有改
git status
```

## Sitemap 和 Google Search Console

sitemap 位置：

```text
https://shchen0603.github.io/Personal-Website/sitemap.xml
```

`robots.txt` 也有指向這個 sitemap。

### 自動通知 Bing（IndexNow）

每次 push 到 `main` 後，GitHub Actions 的 `Notify search engines (IndexNow)` workflow 會等 GitHub Pages 發布完成，再把這次有變動、且列在 sitemap 裡的頁面網址送給 IndexNow（Bing 與其合作搜尋引擎）。Google 不支援 IndexNow，仍以 Search Console 為主。

- 根目錄的 `d17c9b5366fbfb39f9ff7494c6bb4f6f.txt` 是 IndexNow 的所有權金鑰檔，本來就是公開的，不要刪除或改名。
- 想重新送出全站網址：到 GitHub 的 Actions 頁面手動執行這個 workflow，或在本機跑 `python3 scripts/indexnow.py --all`。
- 只想看會送出哪些網址：`python3 scripts/indexnow.py --all --dry-run`。

如果 Google Search Console 顯示「無法擷取」，先確認：

1. 最新修改已經 commit / push。
2. GitHub Pages 已部署完成。
3. 瀏覽器能打開 sitemap。
4. 本機跑過 `python3 scripts/check_site.py`。

如果以上都正常，通常是 Search Console 暫時性問題，可以刪掉 failed sitemap 後重新提交，或等 24-48 小時再看。
