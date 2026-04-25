# Personal Website

這是一個可直接部署到 GitHub Pages 的靜態個人網站，主題聚焦在陳思翰 Szu-Han Chen 的醫師科學家身份、心血管流行病學、營養流行病學、心血管-腎臟-代謝健康、心臟衰竭與部落格寫作。

## 檔案結構

- `index.html`: 首頁
- `research.html`: 研究介紹與代表著作
- `blog.html`: 文章列表
- `posts/welcome.html`: 範例文章
- `styles.css`: 全站樣式
- `script.js`: 手機選單與年份
- `assets/cardiovascular-epidemiology-hero.png`: 首頁主視覺

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
