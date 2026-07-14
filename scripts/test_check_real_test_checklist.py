import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / "scripts" / "check_real_test_checklist.py"


def checklist(rows: str, state: str = "待实测") -> str:
    return textwrap.dedent(
        f"""
        # macOS 真机实测清单

        ## 当前状态

        `{state}`

        ## 实测步骤

        | # | 模块 | 适用性 | 前置条件 | 操作 | 期望结果 | 证据路径 | 失败回写 | 结果 |
        | -: | ---- | ------ | -------- | ---- | -------- | -------- | -------- | ---- |
        {rows}
        """
    ).strip()


class ChecklistCheckerTest(unittest.TestCase):
    def run_checker(self, content: str, require_complete: bool = False):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "checklist.md"
            path.write_text(content, encoding="utf-8")
            command = ["python3", str(CHECKER), str(path)]
            if require_complete:
                command.append("--require-complete")
            return subprocess.run(command, capture_output=True, text=True, check=False)

    def test_accepts_complete_continuous_checklist(self):
        result = self.run_checker(
            checklist(
                "\n".join(
                    [
                        "| 1 | 启动 | 适用 | 已打包 | 启动应用 | 窗口显示 | `evidence/01.md` | `04-开发追踪.md` | ✅ |",
                        "| 2 | 多显示器 | 当前无第二显示器，不适用 | 无 | 检查显示器 | 记录限制 | `evidence/02.md` | `09-真机实测.md` | 不适用 |",
                    ]
                ),
                state="真机测试通过",
            ),
            require_complete=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_non_continuous_numbers(self):
        result = self.run_checker(
            checklist(
                "\n".join(
                    [
                        "| 1 | 启动 | 适用 | 已打包 | 启动 | 显示 | `a.md` | `b.md` | 未执行 |",
                        "| 3 | 录入 | 适用 | 有账号 | 录入 | 保存 | `c.md` | `d.md` | 未执行 |",
                    ]
                )
            )
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("编号必须连续", result.stderr)

    def test_require_complete_rejects_unexecuted_and_placeholders(self):
        result = self.run_checker(
            checklist(
                "| 1 | 启动 | 适用 | 已打包 | 启动 | 显示 | 待生成 | `b.md` | 未执行 |",
                state="真机测试通过",
            ),
            require_complete=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("完成模式不允许", result.stderr)


if __name__ == "__main__":
    unittest.main()
