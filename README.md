# Personal Website

這是一個可直接部署到 GitHub Pages 的靜態個人網站，主題聚焦在陳思翰 Szu-Han Chen 的醫師科學家身份、心血管流行病學、營養流行病學、心血管-腎臟-代謝健康、心臟衰竭與部落格寫作。

## 檔案結構

- `index.html`: 首頁
- `research.html`: 研究介紹與最新研究入口
- `publications.html`: 完整已發表論文清單
- `honors.html`: 學術獎項、受邀演講、會議報告、媒體報導與專業服務
- `blog.html`: 文章列表
- `contact.html`: 聯繫方式頁面
- `posts/welcome.html`: 範例文章
- `posts/_template.html`: Blog 文章模板，新增文章時可以複製
- `styles.css`: 全站樣式
- `script.js`: 手機選單與年份
- `assets/cardiovascular-epidemiology-hero.png`: 首頁主視覺

## 更新 Publications

目前完整論文清單放在 `publications.html`，依 ORCID public record 與 DOI metadata 校對後排序。之後有新論文時：

1. 打開 `publications.html`。
2. 搜尋 `PUBLICATIONS: EDIT BELOW`。
3. 複製一整段 `<article class="publication-item">...</article>`。
4. 貼到正確年份位置，更新年份、標題、作者、期刊 citation 與 DOI 連結。
5. 若要在 Research 頁露出最新代表作，也同步更新 `research.html` 底部的 Publications 區塊。

## 更新 Honors

學術獎項與活動整理在 `honors.html`。之後有新的 award、invited talk、conference presentation、media coverage 或 reviewer service：

1. 打開 `honors.html`。
2. 找到對應區塊，例如 `Honors & Awards`、`Invited Speeches & Lectures`、`Conference Oral Presentations` 或 `Media & Academic Service`。
3. 複製一段 `<article class="honor-item">...</article>` 或 `<article class="service-card">...</article>`。
4. 依年份排序後更新年份、標題、機構與說明。
5. 若是特別重要的近期成果，也可以同步更新 `index.html` 的 `highlight-section`。

## 寫 Blog

這個網站目前是靜態網站，所以 Blog 的管理方式是「新增一個 HTML 文章檔，再把它加入文章列表」。步驟如下：

1. 複製 `posts/_template.html`，改名成清楚的檔名，例如 `posts/2026-05-01-risk-prediction.html`。
2. 在新檔案裡更新 `<title>`、`meta description`、日期、分類、文章標題、導言與正文。
3. 打開 `blog.html`，在 `BLOG INDEX` 註解下面新增一段 `<article class="post-row">`，連到新的文章檔。
4. 如果這篇文章也想放到首頁「最新文章」，同步更新 `index.html` 的 `writing-section`。
5. 本機預覽確認連結後，commit 並 push 到 GitHub Pages。

如果之後想要像後台一樣直接在瀏覽器登入寫文章，可以再升級成 Decap CMS、CloudCannon 或改用 Astro/Next.js 這類支援 Markdown 內容集合的架構。目前這版先保留最輕量、最不容易壞的檔案式管理。

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

直接用瀏覽器打開 `index.html` 即可。若想用本機伺服器預覽：

```bash
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000`。

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
