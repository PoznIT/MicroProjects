"""External data tools (yfinance fetch/search/history, IBKR Flex).

These are normally spawned as standalone subprocesses via
``app.common.run_python_tool``. Marking the directory a package also lets the
in-process CSV importer (``app.ibkr_csv``) reuse ``ibkr``'s pure helpers so the
XML and CSV trade paths normalize symbols and dates identically.
"""
