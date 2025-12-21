#!/bin/bash

# Epic 7 快速验收脚本
# 使用方法: ./quick-acceptance-script.sh <BASE_URL> [LOGIN_URL]

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 输入参数
BASE_URL=${1:-"https://todomvc.com/examples/react/"}
LOGIN_URL=${2:-""}

echo -e "${YELLOW}=== Epic 7 快速验收测试 ===${NC}"
echo "目标应用: $BASE_URL"
echo "测试开始时间: $(date)"
echo

# 创建测试结果目录
RESULT_DIR="./test-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULT_DIR"

# 辅助函数
check_step() {
    local step_name="$1"
    local command="$2"
    local expected_exit_code=${3:-0}

    echo -e "\n${YELLOW}测试步骤: $step_name${NC}"
    echo "执行命令: $command"

    if eval "$command" > "$RESULT_DIR/${step_name// /_}.log" 2>&1; then
        if [ $? -eq $expected_exit_code ]; then
            echo -e "${GREEN}✓ 通过${NC}"
            return 0
        else
            echo -e "${RED}✗ 失败 (退出码: $?)${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ 命令执行失败${NC}"
        return 1
    fi
}

# 1. 环境检查
echo -e "\n${YELLOW}=== 1. 环境检查 ===${NC}"
echo "Node 版本: $(node --version)"
echo "npm 版本: $(npm --version)"
echo "项目已构建: $([ -d "dist" ] && echo "是" || echo "否")"
echo "API 密钥配置: $([ -n "$ANTHROPIC_API_KEY" ] && echo "是" || echo "否")"

# 2. Story 7.1: 探索引擎测试
echo -e "\n${YELLOW}=== 2. Story 7.1: 探索引擎测试 ===${NC}"

# 清理旧结果
rm -rf .autoqa

# 运行探索 (使用 explore 子命令)
EXPLORE_CMD="autoqa plan explore -u $BASE_URL -d 2 --max-pages 5"
if [ -n "$LOGIN_URL" ]; then
    EXPLORE_CMD="$EXPLORE_CMD --login-url $LOGIN_URL --username-placeholder testuser --password-placeholder testpass"
fi

if check_step "7.1_探索引擎" "$EXPLORE_CMD"; then
    # 检查输出文件
    LATEST_RUN=$(ls -t .autoqa/runs/ | head -1)
    EXPLORE_DIR=".autoqa/runs/$LATEST_RUN/plan-explore"

    echo "检查探索产物..."
    if [ -f "$EXPLORE_DIR/explore-graph.json" ]; then
        echo -e "${GREEN}✓ explore-graph.json 存在${NC}"
        # 统计页面数
        PAGE_COUNT=$(jq '.pages | length' "$EXPLORE_DIR/explore-graph.json" 2>/dev/null || echo "解析失败")
        echo "  发现页面数: $PAGE_COUNT"
    else
        echo -e "${RED}✗ explore-graph.json 不存在${NC}"
    fi

    if [ -f "$EXPLORE_DIR/explore-elements.json" ]; then
        echo -e "${GREEN}✓ explore-elements.json 存在${NC}"
    else
        echo -e "${RED}✗ explore-elements.json 不存在${NC}"
    fi

    if [ -f "$EXPLORE_DIR/explore-transcript.jsonl" ]; then
        echo -e "${GREEN}✓ explore-transcript.jsonl 存在${NC}"
        # 统计行数
        LINE_COUNT=$(wc -l < "$EXPLORE_DIR/explore-transcript.jsonl")
        echo "  记录条数: $LINE_COUNT"
    else
        echo -e "${RED}✗ explore-transcript.jsonl 不存在${NC}"
    fi
fi

# 3. Story 7.3: 完整规划命令测试
echo -e "\n${YELLOW}=== 3. Story 7.3: 完整规划命令测试 ===${NC}"

# 清理旧结果
rm -rf .autoqa

PLAN_CMD="autoqa plan -u $BASE_URL -d 2 --max-pages 5"
if [ -n "$LOGIN_URL" ]; then
    PLAN_CMD="$PLAN_CMD --login-url $LOGIN_URL --username-placeholder testuser --password-placeholder testpass"
fi

# 测试完整的 plan 命令（现在相当于之前的 run 命令）
PLAN_CMD="autoqa plan -u $BASE_URL -d 2 --max-pages 5"
if [ -n "$LOGIN_URL" ]; then
    PLAN_CMD="$PLAN_CMD --login-url $LOGIN_URL --username-placeholder testuser --password-placeholder testpass"
fi

if check_step "7.3_完整规划" "$PLAN_CMD"; then
    # 检查输出
    LATEST_RUN=$(ls -t .autoqa/runs/ | head -1)
    PLAN_DIR=".autoqa/runs/$LATEST_RUN/plan"
    SPECS_DIR="$PLAN_DIR/specs"

    echo "检查规划产物..."
    if [ -f "$PLAN_DIR/test-plan.json" ]; then
        echo -e "${GREEN}✓ test-plan.json 存在${NC}"
        # 统计测试用例数
        CASE_COUNT=$(jq '.cases | length' "$PLAN_DIR/test-plan.json" 2>/dev/null || echo "解析失败")
        echo "  生成用例数: $CASE_COUNT"
    else
        echo -e "${RED}✗ test-plan.json 不存在${NC}"
    fi

    if [ -d "$SPECS_DIR" ]; then
        echo -e "${GREEN}✓ specs 目录存在${NC}"
        SPEC_COUNT=$(find "$SPECS_DIR" -name "*.md" | wc -l)
        echo "  生成 spec 文件数: $SPEC_COUNT"

        # 显示几个示例文件
        echo "  示例用例:"
        find "$SPECS_DIR" -name "*.md" | head -3 | while read spec; do
            echo "    - $(basename "$spec")"
        done
    else
        echo -e "${RED}✗ specs 目录不存在${NC}"
    fi

    if [ -f "$PLAN_DIR/plan-summary.json" ]; then
        echo -e "${GREEN}✓ plan-summary.json 存在${NC}"
        # 显示配置信息
        echo "  有效配置:"
        jq '.effectiveConfig' "$PLAN_DIR/plan-summary.json" 2>/dev/null || echo "    配置解析失败"
    else
        echo -e "${RED}✗ plan-summary.json 不存在${NC}"
    fi
fi

# 4. Story 7.5: 执行集成测试
echo -e "\n${YELLOW}=== 4. Story 7.5: 执行集成测试 ===${NC}"

# 获取最新的 specs
LATEST_RUN=$(ls -t .autoqa/runs/ | head -1)
SPECS_DIR=".autoqa/runs/$LATEST_RUN/plan/specs"

if [ -d "$SPECS_DIR" ] && [ "$(ls -A "$SPECS_DIR")" ]; then
    # 选择第一个 spec 进行测试
    FIRST_SPEC=$(find "$SPECS_DIR" -name "*.md" | head -1)
    echo "测试 spec: $(basename "$FIRST_SPEC")"

    if check_step "7.5_autoqa_run" "autoqa run '$FIRST_SPEC' --headless"; then
        echo -e "${GREEN}✓ autoqa run 执行成功${NC}"
    else
        echo -e "${RED}✗ autoqa run 执行失败${NC}"
        echo "查看日志: $RESULT_DIR/7.5_autoqa_run.log"
    fi

    # 测试导出
    if check_step "7.5_autoqa_export" "autoqa export '$SPECS_DIR'"; then
        echo -e "${GREEN}✓ autoqa export 执行成功${NC}"
    else
        echo -e "${RED}✗ autoqa export 执行失败${NC}"
        echo "查看日志: $RESULT_DIR/7.5_autoqa_export.log"
    fi
else
    echo -e "${RED}没有找到可测试的 specs${NC}"
fi

# 5. 配置测试（Story 7.4）
echo -e "\n${YELLOW}=== 5. Story 7.4: 配置测试 ===${NC}"

# 创建测试配置
TEST_CONFIG="test-plan-config.json"
cat > "$TEST_CONFIG" << EOF
{
  "plan": {
    "maxDepth": 2,
    "maxPages": 3,
    "testTypes": ["functional", "form"],
    "excludePatterns": ["/admin/*"]
  }
}
EOF

echo "创建测试配置文件: $TEST_CONFIG"

# 测试配置文件读取
CONFIG_CMD="autoqa plan -u $BASE_URL --config $TEST_CONFIG"
if check_step "7.4_配置文件" "$CONFIG_CMD"; then
    echo -e "${GREEN}✓ 配置文件读取成功${NC}"

    # 检查配置是否生效
    LATEST_RUN=$(ls -t .autoqa/runs/ | head -1)
    SUMMARY_FILE=".autoqa/runs/$LATEST_RUN/plan/plan-summary.json"

    if [ -f "$SUMMARY_FILE" ]; then
        CONFIG_DEPTH=$(jq '.exploration.configuredDepth' "$SUMMARY_FILE" 2>/dev/null)
        if [ "$CONFIG_DEPTH" = "2" ]; then
            echo -e "${GREEN}✓ 配置 maxDepth=2 生效${NC}"
        else
            echo -e "${RED}✗ 配置 maxDepth 未生效${NC}"
        fi
    fi
else
    echo -e "${RED}✗ 配置文件测试失败${NC}"
fi

# 清理测试配置
rm -f "$TEST_CONFIG"

# 6. 生成验收报告
echo -e "\n${YELLOW}=== 6. 生成验收报告 ===${NC}"

REPORT_FILE="$RESULT_DIR/acceptance-report.md"
cat > "$REPORT_FILE" << EOF
# Epic 7 验收报告

**测试时间:** $(date)
**目标应用:** $BASE_URL
**测试结果目录:** $RESULT_DIR

## 测试结果概览

| Story | 状态 | 备注 |
|-------|------|------|
| 7.1 探索引擎 | $(grep -q "7.1_探索引擎.*✓" "${RESULT_DIR}/7.1_探索引擎.log" 2>/dev/null && echo "✅ 通过" || echo "❌ 失败") | |
| 7.3 完整规划 | $(grep -q "7.3_完整规划.*✓" "${RESULT_DIR}/7.3_完整规划.log" 2>/dev/null && echo "✅ 通过" || echo "❌ 失败") | |
| 7.4 配置支持 | $(grep -q "7.4_配置文件.*✓" "${RESULT_DIR}/7.4_配置文件.log" 2>/dev/null && echo "✅ 通过" || echo "❌ 失败") | |
| 7.5 执行集成 | $(grep -q "7.5_autoqa_run.*✓" "${RESULT_DIR}/7.5_autoqa_run.log" 2>/dev/null && echo "✅ 通过" || echo "❌ 失败") | |

## 详细日志

请查看 $RESULT_DIR 目录下的各个日志文件

EOF

echo "验收报告已生成: $REPORT_FILE"

# 输出最终结果
echo -e "\n${YELLOW}=== 测试完成 ===${NC}"
echo "测试结果保存在: $RESULT_DIR"
echo "验收报告: $REPORT_FILE"

# 显示简明统计
PASSED=$(grep -c "✓ 通过" "$REPORT_FILE" 2>/dev/null || echo "0")
TOTAL=$(grep -c "|" "$REPORT_FILE" | tail -1)
echo -e "\n通过率: ${GREEN}$PASSED/$TOTAL${NC}"

if [ $PASSED -eq $TOTAL ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  存在失败的测试，请查看日志${NC}"
    exit 1
fi