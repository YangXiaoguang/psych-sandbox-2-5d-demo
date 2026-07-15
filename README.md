# 2.5D 数字心理沙盘 Demo

一个本地运行的心理沙盘产品原型验证 Demo，基于 Vite、React、TypeScript、React-Konva 与 Three.js。

## 运行

```bash
npm install
npm run dev
```

## 开发文档

- [项目开发手册与技术说明书](docs/project-development-manual.md)
- [详细开发文档与技术规格参考](docs/development-and-technical-spec.md)

## 能力

- 左侧内置沙具资产库，沙具由 Three.js 正交相机离屏渲染为玩具化 3D sprite
- 沙具资产通过 `ToyAssetSpec` 描述锚点、足迹、缩略图比例、语义标签与程序化模型配方
- 中央 2.5D 沙盘画布，支持拖拽、旋转、缩放、删除
- 方形木框沙盘保持沙色沙面、蓝色内衬、边框厚度与柔和落影
- 根据沙具 y 坐标自动做空间深度排序
- 沙具使用低复杂度 3D 几何体、统一方向光、环境光、软阴影与透明背景合成
- 九宫格、中心区域、边界区域辅助分析
- 右侧显示对象属性、结构化数据、风险标签分布与事件流
- 导出 JSON 快照与 PNG 作品截图
- 使用 localStorage 暂存当前作品
