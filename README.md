# tangshilianliankan

唐诗连连看 · 一笔成诗 —— 纯 HTML/CSS/JavaScript 国风网页小游戏。

## 玩法

- 题库 100 首知名唐诗，每局随机抽取 50 首，刷新不重样
- 在 3×3 九宫格中按住诗句首字，沿上下相邻的字一笔连成完整诗句
- 每题 2 分，共 50 题，满分 100 分
- 每题 2 次连线机会，两次都错则本题锁定、不得分
- 支持跳过（下一题）与返回补答（上一题），全部题目处理完后结算总分与用时

## 运行

直接用浏览器打开 `index.html` 即可，或在本目录启动静态服务器：

```powershell
powershell -ExecutionPolicy Bypass -File tools/server.ps1
```

然后访问 http://localhost:8765/

## 题库生成

`poems.js` 由 `tools/build-data.ps1` 基于 `data/` 下的两份开源数据集生成：

1. chinese-poetry/chinese-poetry《水墨唐诗》(MIT)
2. 《唐诗三百首》简体整理版
