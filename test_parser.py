#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试解析器"""

from caddyfile_parser import parse_caddyfile
import json

with open('Caddyfile', 'r', encoding='utf-8') as f:
    content = f.read()

result = parse_caddyfile(content)
print(json.dumps(result, indent=2, ensure_ascii=False))

