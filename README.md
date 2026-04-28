# 2.5D 数字心理沙盘 Demo

一个本地运行的心理沙盘产品原型验证 Demo，基于 Vite、React、TypeScript 与 React-Konva。

## 运行

```bash
npm install
npm run dev
```

## 能力

- 左侧内置矢量沙具资产库，支持点击添加与拖拽放置
- 中央 2.5D 沙盘画布，支持拖拽、旋转、缩放、删除
- 根据沙具 y 坐标自动做空间深度排序
- 九宫格、中心区域、边界区域辅助分析
- 右侧显示对象属性、结构化数据、风险标签分布与事件流
- 导出 JSON 快照与 PNG 作品截图
- 使用 localStorage 暂存当前作品
