This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AI 配置与变量模板

### 环境变量
在项目根目录创建 `.env` 文件，并参考 `.env.example` 配置以下 AI 相关的环境变量：
- `MS_API_KEY`: ModelScope 或 OpenAI 的 API Key
- `MS_BASE_URL`: API 基础路径（默认为 ModelScope）
- `MS_MODEL`: 使用的模型 ID

### 数据库初始化
运行以下脚本初始化数据库并填充默认的 AI 变量模板：
```bash
npx ts-node scripts/init-db.ts
```

### 变量模板 (Variable Templates)
系统支持通过 `variable_templates` 表管理不同的 AI 配置方案。默认包含以下模板：
1. **DeepSeek-R1 (ModelScope)**: 针对 ModelScope 优化的 R1 配置。
2. **OpenAI GPT-4o**: 标准 GPT-4o 配置。
3. **AI 素养评估专用模板**: MAPLE 系统内置的素养评估提示词优化配置。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
