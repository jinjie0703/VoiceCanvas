---
name: verify_frontend_build
description: 运行前端项目的 TypeScript 类型检查与 Vite 生产环境构建，排查任何因语法或未使用变量导致的致命编译错误。
---

# Verify Frontend Build Skill

## 触发条件
当你在开发过程中，针对前端核心 `*.ts` 或 `*.tsx` 文件进行了下列操作时，请务必执行本技能以确保代码不会在 CI/CD 中崩溃：
- 添加或修改了 TypeScript 接口 (`interface` 或 `type`)
- 导入了新的库或模块
- 对组件进行过大幅度的裁剪（可能残留未使用的导入或局部变量）

## Instructions (执行指南)
1. 使用终端切换到 `frontend` 目录下。
2. 执行 `npm run build` 指令。
3. 如果输出包含 `✓ built in ...` 则说明验证完美通过，你可以继续当前任务。
4. **异常自纠察**：如果输出中抛出错误（如 `TS1484` 提示导入方式错误，或 `TS6133` 提示变量未使用）：
   - 立即读取控制台输出的文件名和对应行号。
   - 使用文件编辑工具修复这些问题。
   - 再次触发本技能验证，直至完全通过。

## Resources (执行脚本资源)
```bash
# Frontend 根目录下执行
cd frontend && npm run build
```
