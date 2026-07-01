# Design System: cloud-price-radar

## 1. Overview

这是一个密集但安静的价格筛选工具。首屏只服务三件事：切换 VPS/GPU、筛配置、看表格和官网入口。视觉参考用户提供的 ai-home 绿色工具页，但删掉资料页感、营销解释和右侧结果面板。

## 2. Tokens

- Page: `#f7f8f8`
- Panel: `#ffffff`
- Soft surface: `#f1f4f3`
- Hover surface: `#eaf0ee`
- Text: `#101818`
- Muted text: `#65706f`
- Border: `#dce5e2`
- Accent: `#138a4d`
- Accent soft: `#e8f5ee`
- Price green: `#058447`
- Warning amber: `#fff5df`
- Risk blue: `#eaf3ff`
- Risk red: `#ffecef`
- Radius: `8px`
- Table shadow: `0 18px 50px rgb(16 24 24 / 0.06)`

## 3. Typography

全站使用系统 sans 字体：`Inter, ui-sans-serif, PingFang SC, Microsoft YaHei, Arial, sans-serif`。标题用 40-44px，正文和表格用 13-15px。字距为 0。

## 4. Components

- Header: 白底细边框，左侧 logo，中间两个导航项，右侧最近更新时间。
- Tabs: 两个 8px radius 的大按钮，选中态绿色边框和浅绿底。
- Filters: 统一输入、选择框和按钮，高度 40px，紧凑网格。
- Table: 单个共享表格容器，行不做大卡片，价格绿色加粗，风险是短标签。
- Pagination: 居中小按钮，当前页绿色实心。

## 5. Constraints

- 不使用右侧统计面板。
- 不显示卡网订阅、官网订阅、官方 API、中转 API、数据源、更新记录导航。
- 不写营销页，不堆长说明。
- 所有官网入口按钮文案统一为“官网直达”。
