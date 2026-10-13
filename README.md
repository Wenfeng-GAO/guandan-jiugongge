# 掼蛋九宫格记牌练习

纯静态中文网页应用，帮掼蛋初学者练习「九宫格记牌法」。无后端、无依赖、打开即用。

品味稿 v5：开局扫牌（8 秒闪手牌报外剩）× 出牌闭卷（翻牌记填剩余）双关并排。

## 怎么打开

直接用浏览器打开 `index.html` 即可（双击文件或拖进浏览器）。也可以在目录里起个本地服务：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 两关怎么玩

首页「选一关练」并排两个入口，级牌设置在首页、两关共用。

### 开局扫牌

1. 进关自动发 27 张手牌：按点数排好，级牌（含 ♥级 逢人配）描金框，**只亮 8 秒**，到点自动盖牌、不能回看。
2. 凭记忆填 **级 / 大王 / 小王** 的外剩（外面还剩几张），直接点数字，点「核对」。
3. 每格绿 ✓ / 红 ✕（显示正确值）。有错可「只重练错的格」（换新牌只考错格），全对进「下一盘」。不计分、不挂升档。

### 出牌闭卷

1. 点「新开一盘」洗牌；再「翻开下一张」逐张记牌（**不要边看边减**）。
2. 记够后点「闭卷填剩余」：已翻列表清空，点格子选中、用下方数字键直接选最终剩余，再点「核对」。
3. 核对后：正确格绿+✓，错误格红+✕并标「漏x·填y」；上方显示本盘剩余与对错。
4. **三行升档**：默认只练第 1 行（级 / 大王 / 小王）。连对 3 盘解锁第 2 行（A/K/Q），再连对 3 盘解锁第 3 行（J/10/9）。灰行预览不可点、不计分。「级」跟随当前级牌。

页面顶部「怎么玩」默认折叠。

## 测试

```bash
npm test   # node check.js && node test/scan.test.js
```

## 文件结构

- `index.html` — 页面结构（首页入口 + 两关视图）
- `styles.css` — v4/v5 深色 tokens（radius≤8、琥珀强调、白实心主按钮）
- `scan.js` — 开局扫牌：8 秒闪牌 → 盖牌 → 填外剩 → 只重练错格
- `app.js` — 出牌闭卷流程与三行地图交互（数字直选）
- `logic.js` — 纯逻辑（浏览器与 Node 共用）：`dealScanHand` / `outsideCounts` / `checkScan` / `numberOptions` / `trueRemaining` / `applyStreakAfterCheck` 等
- `check.js` — Node 自检：`node check.js`
- `test/scan.test.js` — 开局扫牌逻辑测试

## 如何部署

已启用 GitHub Pages（`main` 分支根目录）。

在线访问：https://wenfeng-gao.github.io/guandan-jiugongge/

仓库：https://github.com/Wenfeng-GAO/guandan-jiugongge
