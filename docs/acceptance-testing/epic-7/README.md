# Epic 7 验收测试指南

本目录包含 Epic 7 的完整验收测试材料，用于验证 Agent 驱动的智能测试规划器功能是否符合要求。

## 文件说明

1. **epic-7-acceptance-checklist.md** - 详细的手工验收清单
   - 包含所有 5 个故事的验收标准
   - 提供详细的测试步骤
   - 支持记录测试结果和问题

2. **quick-acceptance-script.sh** - 自动化快速验收脚本
   - 自动执行核心功能测试
   - 生成测试报告
   - 适用于 CI/CD 或快速验证

3. **README.md** - 本文件

## 使用方法

### 方法一：完整手工验收

1. 打开 `epic-7-acceptance-checklist.md`
2. 按照前置条件准备环境
3. 逐项执行每个 Story 的测试步骤
4. 记录测试结果
5. 填写验收结论

### 方法二：快速自动化验收

```bash
# 基础测试（不需要登录的应用）
./docs/acceptance-testing/epic-7/quick-acceptance-script.sh https://todomvc.com/examples/react/

# 带登录的应用测试
./docs/acceptance-testing/epic-7/quick-acceptance-script.sh https://example.com https://example.com/login
```

脚本会：
- 自动执行所有核心功能
- 保存详细的日志
- 生成 HTML 格式的测试报告
- 给出通过/失败结论

### 方法三：结合使用

建议先运行快速验收脚本进行初步验证，然后使用手工清单进行更细致的测试，特别是：
- 复杂的登录场景
- 特定的配置需求
- 性能和稳定性测试
- 边界条件测试

## 验收环境建议

### 推荐的测试应用

1. **TodoMVC** (React 版本)
   - URL: https://todomvc.com/examples/react/
   - 特点：无需登录，页面简洁，功能完整
   - 适合：基础功能测试

2. **Demo Web Shop**
   - URL: https://demoshop.webkul.com/
   - 特点：需要登录，包含表单、导航等
   - 适合：完整流程测试

3. **内部测试应用**
   - 使用实际待测试的应用
   - 更贴近真实使用场景

### 环境要求

- Node.js >= 20
- 足够的磁盘空间（约 1GB 用于测试产物）
- 稳定的网络连接
- Anthropic API 访问权限

## 验收标准

### 必须通过的项

1. **Story 7.1**: 探索引擎能生成 3 个核心产物
2. **Story 7.3**: `autoqa plan` 命令能完成完整流程
3. **Story 7.5**: 生成的 specs 能被 `autoqa run` 执行

### 可选通过的项

1. **Story 7.2**: 生成的用例覆盖所有测试类型
2. **Story 7.4**: 所有配置项都正常工作
3. 性能指标达标
4. 稳定性测试通过

## 问题追踪

如果发现任何问题，请记录：

1. 问题描述
2. 复现步骤
3. 期望行为
4. 实际行为
5. 错误日志（如有）
6. 环境信息

## 联系支持

如有疑问，请参考：
- 项目文档：`docs/` 目录
- Epic 7 技术规范：`docs/sprint-artifacts/`
- 问题反馈：创建 GitHub Issue