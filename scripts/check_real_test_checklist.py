#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path


REQUIRED_COLUMNS = [
    "#",
    "模块",
    "适用性",
    "前置条件",
    "操作",
    "期望结果",
    "证据路径",
    "失败回写",
    "结果",
]
ALLOWED_RESULTS = {"未执行", "✅", "受阻", "不适用"}
PLACEHOLDERS = ("待生成", "待填写", "TODO", "TBD", "占位")


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def find_table(lines: list[str]) -> tuple[list[str], list[list[str]]]:
    try:
        section = next(index for index, line in enumerate(lines) if line.strip() == "## 实测步骤")
    except StopIteration as error:
        raise ValueError("缺少 `## 实测步骤` 章节") from error

    header_index = next(
        (
            index
            for index in range(section + 1, len(lines))
            if lines[index].lstrip().startswith("|")
        ),
        None,
    )
    if header_index is None or header_index + 1 >= len(lines):
        raise ValueError("实测步骤缺少 Markdown 表格")

    headers = split_row(lines[header_index])
    separator = split_row(lines[header_index + 1])
    if len(separator) != len(headers) or not all(re.fullmatch(r":?-{1,}:?", cell) for cell in separator):
        raise ValueError("实测步骤表头分隔行无效")

    rows: list[list[str]] = []
    for line in lines[header_index + 2 :]:
        if not line.lstrip().startswith("|"):
            if rows:
                break
            continue
        rows.append(split_row(line))
    return headers, rows


def validate(path: Path, require_complete: bool) -> list[str]:
    if not path.is_file():
        return [f"清单文件不存在：{path}"]
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    errors: list[str] = []

    try:
        headers, rows = find_table(lines)
    except ValueError as error:
        return [str(error)]

    if headers != REQUIRED_COLUMNS:
        errors.append(f"表头必须严格为：{'、'.join(REQUIRED_COLUMNS)}")
    if not rows:
        errors.append("实测步骤不能为空")
        return errors

    numbers: list[int] = []
    for row_index, row in enumerate(rows, start=1):
        if len(row) != len(REQUIRED_COLUMNS):
            errors.append(f"第 {row_index} 行列数应为 {len(REQUIRED_COLUMNS)}，实际为 {len(row)}")
            continue
        if any(not cell for cell in row):
            errors.append(f"第 {row_index} 行存在空的必填列")
        try:
            numbers.append(int(row[0]))
        except ValueError:
            errors.append(f"第 {row_index} 行编号不是整数：{row[0]}")
        result = row[-1]
        if result not in ALLOWED_RESULTS:
            errors.append(f"第 {row_index} 行结果无效：{result}")
        if result == "不适用" and "不适用" not in row[2]:
            errors.append(f"第 {row_index} 行标记不适用时，适用性列必须写明原因")
        if require_complete:
            if result in {"未执行", "受阻"}:
                errors.append(f"完成模式不允许第 {row_index} 行结果为 {result}")
            if any(placeholder.lower() in row[6].lower() for placeholder in PLACEHOLDERS):
                errors.append(f"完成模式不允许第 {row_index} 行证据路径包含占位内容")

    expected = list(range(1, len(numbers) + 1))
    if numbers != expected:
        errors.append(f"编号必须连续且从 1 开始，实际为：{numbers}")

    state_match = re.search(r"## 当前状态\s+`([^`]+)`", text)
    if not state_match:
        errors.append("当前状态必须在 `## 当前状态` 下使用反引号明确填写")
    elif require_complete and state_match.group(1) not in {"真机测试通过", "已完成"}:
        errors.append("完成模式要求当前状态为 `真机测试通过` 或 `已完成`")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="校验 macOS 真机实测清单结构和完成状态")
    parser.add_argument("checklist", type=Path)
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    errors = validate(args.checklist, args.require_complete)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"清单校验通过：{args.checklist}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
