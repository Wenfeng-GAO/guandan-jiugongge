# 掼蛋九宫格记牌练习

纯静态中文网页应用，帮掼蛋初学者练习「九宫格记牌法」。无后端、无依赖、打开即用。

品味稿 v4：闭卷填剩余 + 三行渐进解锁。

## 怎么打开

直接用浏览器打开 `index.html` 即可（双击文件或拖进浏览器）。也可以在目录里起个本地服务：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 怎么玩（闭卷循环）

1. 选好本局**级牌**，点「新开一盘」洗牌；再「翻开下一张」逐张记牌（**不要边看边减**）。
2. 记够后点「闭卷填剩余」：已翻列表清空，只能点已解锁格子用「点改」填最终剩余，再点「核对」。
3. 核对后：正确格绿+✓，错误格红+✕并标「漏x·填y」；上方显示本盘剩余与对错。
4. **三行升档**：默认只练第 1 行（级 / 大王 / 小王）。连对 3 盘解锁第 2 行（A/K/Q），再连对 3 盘解锁第 3 行（J/10/9）。灰行预览不可点、不计分。「级」跟随当前级牌。

页面顶部「怎么玩」默认折叠。

## 文件结构

- `index.html` — 页面结构
- `styles.css` — v4 深色 tokens（radius≤8、琥珀强调、白实心主按钮）
- `app.js` — 闭卷流程与三行地图交互
- `logic.js` — 纯逻辑（浏览器与 Node 共用）：`getRowKeys` / `getUnlockedKeys` / `cycleGuess` / `applyStreakAfterCheck` / `checkAnswer`
- `check.js` — Node 自检：`node check.js`

## 如何部署

已启用 GitHub Pages（`main` 分支根目录）。

在线访问：https://wenfeng-gao.github.io/guandan-jiugongge/

仓库：https://github.com/Wenfeng-GAO/guandan-jiugongge
