# cloud-price-radar

独立的 VPS 云服务器与 GPU 算力租赁价格筛选网站。

## 本地运行

1. 安装依赖：

```bash
npm install
```

成功标志：生成 `node_modules`，命令没有报错。

2. 验证数据和页面契约：

```bash
npm run test:cloud
```

成功标志：看到 `cloud price radar contract ok`。

3. 启动页面：

```bash
npm run dev
```

成功标志：浏览器打开 `http://127.0.0.1:3000` 后，只看到 VPS/GPU 云资源比价工具。

## 数据更新

```bash
npm run collect:cloud-offers
```

采集会更新 `data/cloud-offers-db.json` 和 `data/cloud-offer-update-records.json`。更新记录保留在本地数据文件里，不显示在页面顶部。

## 部署

Cloudflare Workers + OpenNext：

```bash
npm run deploy:cloudflare
```

部署前请先在 Cloudflare / Wrangler 配好账号和项目权限，不要把密钥提交到仓库。
