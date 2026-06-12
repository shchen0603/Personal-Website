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

`--fix` 會重新產生 sitemap、Blog 靜態頁、Activity 靜態頁和 blog fallback，避免 Google 或訪客看到舊內容。

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

GitHub Pages 更新後，Google 才會看到新版 `sitemap.xml`。

## 用 Admin 修改時要注意

### 不要手動改產生出來的頁面

日常內容請改 `data/site-content.json` 或用 `admin.html`。

通常不要手動改：

- `posts/<id>.html`
- `activities/<id>.html`
- `sitemap.xml`
- `blog.html` 的靜態 fallback 區塊

這些檔案會由 admin 或 `scripts/check_site.py --fix` 重新產生。手動改了之後，下次重產可能會被覆蓋。

### Blog 的 `id` 不要隨便改

Blog 的 `id` 會變成網址：

```text
posts/<id>.html
```

文章發布後若改 `id`，舊網址會失效，Google 也可能看到重複或消失的頁面。真的要改網址時，記得保留舊頁的 noindex redirect。

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

如果 Google Search Console 顯示「無法擷取」，先確認：

1. 最新修改已經 commit / push。
2. GitHub Pages 已部署完成。
3. 瀏覽器能打開 sitemap。
4. 本機跑過 `python3 scripts/check_site.py`。

如果以上都正常，通常是 Search Console 暫時性問題，可以刪掉 failed sitemap 後重新提交，或等 24-48 小時再看。
