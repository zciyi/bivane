"""在 bivane 项目内执行 npm 脚本并回显输出（Windows 受管 Node 环境）。

为什么要这个脚本：本机 bash 的 coreutils 缺失（`tail`/`cp`/`dirname` 全无）且 PATH 被破坏，
`npm.cmd` 直接跑会找不到 node。这里显式把受管 Node 目录塞进 PATH 再调 npm。

用法（用受管 Python 的绝对路径，别用裸 `python`）：
    & "C:\\Users\\Administrator\\.workbuddy\\binaries\\python\\versions\\3.13.12\\python.exe" `
        scripts/run-npm.py run typecheck

CWD 由本文件位置推导，不写死绝对路径（换机器/换盘符都能跑）。
"""
import os
import subprocess
import sys

CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE_DIR = r"C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3"
NPM = os.path.join(NODE_DIR, "npm.cmd")

if __name__ == "__main__":
    args = sys.argv[1:] or ["run", "check"]
    env = dict(os.environ)
    env["PATH"] = NODE_DIR + os.pathsep + env.get("PATH", "")
    env["CI"] = "1"
    env["NO_COLOR"] = "1"
    p = subprocess.run(
        [NPM] + args,
        cwd=CWD,
        env=env,
        capture_output=True,
        text=True,
        shell=True,
        timeout=1800,
    )
    print("EXIT", p.returncode)
    print(p.stdout[-12000:])
    print("STDERR", p.stderr[-4000:])
    sys.exit(p.returncode)
