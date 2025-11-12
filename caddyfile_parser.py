#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Caddyfile 解析器和生成器
将Caddyfile文本解析为结构化数据，并支持反向生成
支持嵌套块结构
"""

import re
from typing import List, Dict, Any, Optional, Tuple


class CaddyfileParser:
    """Caddyfile解析器"""
    
    def __init__(self):
        self.sites = []
    
    def parse(self, content: str, preserve_unparsed: bool = True) -> Dict[str, Any]:
        """
        解析Caddyfile内容为结构化数据
        
        返回格式:
        {
            "sites": [
                {
                    "address": "example.com",
                    "directives": [
                        {
                            "name": "reverse_proxy",
                            "args": ["localhost:8080"],
                            "directives": [
                                {"name": "header_up", "args": ["Host", "example.com"]}
                            ]
                        }
                    ]
                }
            ],
            "unparsed": ["# 注释", "未解析的内容"]
        }
        """
        if not content or not content.strip():
            return {"sites": [], "unparsed": []}
        
        sites = []
        unparsed = []
        lines = content.split('\n')
        unparsed_before_site = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            original_line = line
            line = line.rstrip()
            stripped = line.strip()
            
            # 保留注释和空行
            if not stripped or stripped.startswith('#'):
                if preserve_unparsed:
                    unparsed_before_site.append(original_line)
                i += 1
                continue
            
            # 检查是否是站点地址（不以空格或制表符开头）
            if not line.startswith(' ') and not line.startswith('\t'):
                # 处理单独的 }
                if stripped == '}':
                    # 这应该是块结束，但不在站点块内，可能是格式错误
                    i += 1
                    continue
                
                # 处理单独的 {
                if stripped == '{':
                    # 单独的 { 不应该出现在站点级别
                    i += 1
                    continue
                
                # 检查是否是命名块（以 ( 开头，包含 )，且 ) 在 { 之前或行尾）
                if stripped.startswith('('):
                    # 检查是否包含 )，且 ) 在 { 之前或行尾
                    if ')' in stripped:
                        brace_pos = stripped.find(')')
                        has_brace_after = '{' in stripped[brace_pos+1:]
                        # 如果 ) 后面没有 {，或者 ) 在 { 之前，则认为是命名块
                        if not has_brace_after or stripped.find('{') > brace_pos:
                            # 这是命名块，不是站点地址，跳过
                            # 查找对应的 } 来结束这个块
                            brace_count = 0
                            found_opening = False
                            j = i
                            while j < len(lines):
                                line_stripped = lines[j].strip()
                                if '{' in line_stripped:
                                    brace_count += line_stripped.count('{')
                                    found_opening = True
                                if '}' in line_stripped:
                                    brace_count -= line_stripped.count('}')
                                    if found_opening and brace_count == 0:
                                        i = j + 1
                                        break
                                j += 1
                            else:
                                i = j
                            continue
                
                # 解析站点地址
                address = stripped
                if '{' in address:
                    address = address.split('{')[0].strip()
                
                if address:
                    # 解析站点块（行号从1开始）
                    site, consumed_lines = self._parse_site_block(lines, i, preserve_unparsed)
                    if site:
                        # 记录站点在原始文件中的行号（从1开始）
                        site["line_number"] = i + 1
                        
                        # 检查站点前的注释，提取备注
                        if unparsed_before_site:
                            for comment_line in reversed(unparsed_before_site):
                                comment_stripped = comment_line.strip()
                                if comment_stripped.startswith('#'):
                                    if '备注：' in comment_stripped or '备注:' in comment_stripped:
                                        if '备注：' in comment_stripped:
                                            notes = comment_stripped.split('备注：', 1)[1].strip()
                                        else:
                                            notes = comment_stripped.split('备注:', 1)[1].strip()
                                        site["notes"] = notes
                                        break
                                    elif comment_stripped.upper().startswith('# NOTE:'):
                                        notes = comment_stripped.split(':', 1)[1].strip() if ':' in comment_stripped else ''
                                        if notes:
                                            site["notes"] = notes
                                        break
                            
                            # 将站点前的未解析内容添加到unparsed（过滤空行和备注注释）
                            if preserve_unparsed:
                                filtered_unparsed = []
                                for line in unparsed_before_site:
                                    stripped_line = line.strip()
                                    if not (stripped_line.startswith('#') and ('备注：' in stripped_line or '备注:' in stripped_line or stripped_line.upper().startswith('# NOTE:'))):
                                        if stripped_line:
                                            filtered_unparsed.append(line)
                                unparsed.extend(filtered_unparsed)
                            unparsed_before_site = []
                        
                        sites.append(site)
                        i += consumed_lines
                        continue
                
                # 无法解析，保留为未解析内容
                if preserve_unparsed:
                    unparsed_before_site.append(original_line)
                i += 1
                continue
            
            # 不在站点块内的内容，保留为未解析
            if preserve_unparsed:
                unparsed_before_site.append(original_line)
            i += 1
        
        # 添加剩余的未解析内容（过滤空行）
        if preserve_unparsed and unparsed_before_site:
            non_empty_unparsed = [line for line in unparsed_before_site if line.strip()]
            unparsed.extend(non_empty_unparsed)
        
        # 如果unparsed只有空行，清空它
        if unparsed and all(not line.strip() for line in unparsed):
            unparsed = []
        
        return {
            "sites": sites,
            "unparsed": unparsed
        }
    
    def _parse_site_block(self, lines: List[str], start_idx: int, preserve_unparsed: bool = True) -> Tuple[Optional[Dict[str, Any]], int]:
        """
        解析站点块
        
        返回: (site_dict, consumed_lines)
        """
        if start_idx >= len(lines):
            return None, 0
        
        # 解析站点地址
        line = lines[start_idx].rstrip()
        stripped = line.strip()
        
        # 处理地址行可能包含 { 的情况
        if '{' in stripped:
            address = stripped.split('{')[0].strip()
            has_opening_brace = True
        else:
            address = stripped
            has_opening_brace = False
        
        if not address:
            return None, 0
        
        site = {
            "address": address,
            "directives": [],
            "notes": ""
        }
        
        i = start_idx
        consumed = 0
        
        # 如果地址行包含 {，跳过这一行，否则查找下一行的 {
        if has_opening_brace:
            i += 1
            consumed += 1
        else:
            # 查找下一行的 {
            i += 1
            consumed += 1
            if i < len(lines):
                next_line = lines[i].strip()
                if next_line == '{':
                    i += 1
                    consumed += 1
                else:
                    # 没有找到 {，可能是格式错误
                    return site, consumed
        
        # 解析块内容
        block_indent = None
        directives, consumed_in_block = self._parse_directives_block(lines, i, block_indent, preserve_unparsed)
        site["directives"] = directives
        consumed += consumed_in_block
        
        return site, consumed
    
    def _parse_directives_block(self, lines: List[str], start_idx: int, parent_indent: Optional[int], preserve_unparsed: bool = True) -> Tuple[List[Dict[str, Any]], int]:
        """
        解析指令块（递归）
        
        使用大括号匹配来确定块边界，而不是依赖缩进
        
        返回: (directives_list, consumed_lines)
        """
        directives = []
        i = start_idx
        consumed = 0
        brace_count = 0  # 大括号计数，用于跟踪嵌套层级
        
        while i < len(lines):
            line = lines[i]
            original_line = line
            line = line.rstrip()
            stripped = line.strip()
            
            # 空行或注释
            if not stripped or stripped.startswith('#'):
                i += 1
                consumed += 1
                continue
            
            # 计算当前行的缩进
            current_indent = len(line) - len(line.lstrip())
            
            # 统计当前行的大括号
            open_braces = stripped.count('{')
            close_braces = stripped.count('}')
            
            # 如果遇到单独的 }，检查是否是当前块的结束
            if stripped == '}':
                if brace_count == 0:
                    # 这是当前块的结束
                    consumed += 1
                    break
                else:
                    # 这是嵌套块的结束，减少计数
                    brace_count -= 1
                    # 继续解析，因为还在当前块内
                    i += 1
                    consumed += 1
                    continue
            
            # 更新大括号计数（在检查块结束之后）
            brace_count += open_braces - close_braces
            
            # 如果父级缩进为 None（站点块的第一层），检查是否遇到了新的站点地址
            if parent_indent is None:
                # 如果行不以空格或制表符开头，说明遇到了新的站点地址，应该停止解析
                if not line.startswith(' ') and not line.startswith('\t'):
                    # 但排除单独的 { 和 }
                    if stripped != '{' and stripped != '}':
                        break
            else:
                # 如果指定了父级缩进，检查是否还在当前块内
                # 主要依赖大括号计数，但也要考虑缩进（用于处理格式错误的情况）
                if current_indent <= parent_indent and brace_count == 0:
                    # 缩进减少且没有未闭合的大括号，说明已经退出当前块
                    # 但需要检查是否是格式错误（下一行缩进更深）
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].rstrip()
                        next_stripped = next_line.strip()
                        if next_stripped and not next_stripped.startswith('#'):
                            next_indent = len(next_line) - len(next_line.lstrip())
                            # 如果下一行的缩进更深，可能是格式错误，继续解析
                            if next_indent > current_indent:
                                # 格式错误，但继续解析
                                pass
                            else:
                                # 缩进减少或相等，且没有未闭合的大括号，说明已经退出当前块
                                break
                    else:
                        # 没有下一行，退出当前块
                        break
            
            # 解析指令
            directive, consumed_lines = self._parse_directive_with_block(lines, i, current_indent, preserve_unparsed)
            if directive:
                directives.append(directive)
                i += consumed_lines
                consumed += consumed_lines
            else:
                # 无法解析，跳过
                i += 1
                consumed += 1
        
        return directives, consumed
    
    def _parse_directive_with_block(self, lines: List[str], start_idx: int, directive_indent: int, preserve_unparsed: bool = True) -> Tuple[Optional[Dict[str, Any]], int]:
        """
        解析指令（可能包含块）
        
        返回: (directive_dict, consumed_lines)
        """
        if start_idx >= len(lines):
            return None, 0
        
        line = lines[start_idx].rstrip()
        stripped = line.strip()
        
        # 移除行内注释
        if '#' in stripped:
            stripped = stripped[:stripped.index('#')].strip()
        
        if not stripped:
            return None, 1
        
        # 检查是否是块结束
        if stripped == '}':
            return None, 0
        
        # 解析指令名和参数
        parts = stripped.split(None, 1)
        if not parts or not parts[0]:
            return None, 1
        
        directive_name = parts[0].strip()
        if not directive_name:
            return None, 1
        
        args = []
        has_opening_brace = False
        if len(parts) > 1:
            args_str = parts[1].strip()
            # 检查参数中是否包含单独的 {（在同一行，作为块的开始）
            # 如果 { 前面有空格，且 { 后面是空白或换行，则认为是块的开始
            # 否则，{ 是参数的一部分（如 {upstream_hostport}）
            if '{' in args_str:
                # 检查是否是单独的 {（作为块的开始）
                # 如果 { 前面有空格，且 { 后面没有内容或只有空格，则认为是块的开始
                brace_pos = args_str.find('{')
                before_brace = args_str[:brace_pos].strip()
                after_brace = args_str[brace_pos+1:].strip()
                
                # 如果 { 前面有内容，且 { 后面没有内容或只有空格，则认为是块的开始
                if before_brace and (not after_brace or after_brace == ''):
                    # 这是块的开始，移除 { 并解析参数
                    args_str = before_brace
                    has_opening_brace = True
                # 如果 { 前面没有内容（即参数只是 {），则认为是块的开始
                elif not before_brace and (not after_brace or after_brace == ''):
                    # 这是块的开始，没有参数
                    args_str = ''
                    has_opening_brace = True
                # 否则，{ 是参数的一部分，保留它
            
            if args_str:
                args = self._parse_args(args_str)
        
        directive = {
            "name": directive_name,
            "args": args,
            "directives": []
        }
        
        consumed = 1
        
        # 检查是否有块
        if has_opening_brace:
            # { 在同一行，直接解析块
            block_start = start_idx + 1
        else:
            # 检查下一行是否是 {
            if start_idx + 1 < len(lines):
                next_line = lines[start_idx + 1].rstrip()
                next_stripped = next_line.strip()
                next_indent = len(next_line) - len(next_line.lstrip())
                
                if next_stripped == '{' and next_indent > directive_indent:
                    # 下一行是 {，且缩进正确
                    block_start = start_idx + 2
                    consumed += 1
                else:
                    # 没有块
                    return directive, consumed
            else:
                # 没有下一行，没有块
                return directive, consumed
        
        # 解析块内容
        block_indent = directive_indent + 1  # 块内容应该比指令缩进更深
        sub_directives, consumed_in_block = self._parse_directives_block(lines, block_start, block_indent, preserve_unparsed)
        directive["directives"] = sub_directives
        consumed += consumed_in_block
        
        # 查找块结束的 }
        if block_start + consumed_in_block < len(lines):
            end_line = lines[block_start + consumed_in_block].rstrip()
            if end_line.strip() == '}':
                consumed += 1
        
        return directive, consumed
    
    def _parse_directive(self, line: str) -> Optional[Dict[str, Any]]:
        """解析单个指令（不包含块）"""
        # 移除注释
        if '#' in line:
            line = line[:line.index('#')].strip()
        
        if not line:
            return None
        
        # 分割指令名和参数
        parts = line.split(None, 1)
        if not parts or not parts[0]:
            return None
        
        directive_name = parts[0].strip()
        if not directive_name:
            return None
        
        args = []
        
        if len(parts) > 1:
            # 解析参数（支持引号）
            args_str = parts[1].strip()
            if args_str:
                args = self._parse_args(args_str)
        
        return {
            "name": directive_name,
            "args": args,
            "directives": []
        }
    
    def _parse_args(self, args_str: str) -> List[str]:
        """解析参数列表"""
        args = []
        current = ""
        in_quotes = False
        quote_char = None
        
        i = 0
        while i < len(args_str):
            char = args_str[i]
            
            if char in ['"', "'"] and (i == 0 or args_str[i-1] != '\\'):
                if not in_quotes:
                    in_quotes = True
                    quote_char = char
                elif char == quote_char:
                    in_quotes = False
                    quote_char = None
                else:
                    current += char
            elif char == ' ' and not in_quotes:
                if current.strip():
                    args.append(current.strip())
                    current = ""
            else:
                current += char
            
            i += 1
        
        if current.strip():
            args.append(current.strip())
        
        return args


class CaddyfileGenerator:
    """Caddyfile生成器"""
    
    def generate(self, sites: List[Dict[str, Any]], unparsed: List[str] = None, indent: int = 4) -> str:
        """
        将结构化数据生成Caddyfile文本
        
        Args:
            sites: 站点列表
            unparsed: 未解析的内容列表（保留原始内容）
            indent: 缩进空格数（默认4）
        """
        lines = []
        indent_str = " " * indent
        
        # 过滤掉没有地址的站点（不保存空的站点配置）
        valid_sites = [site for site in sites if site.get("address", "").strip()]
        
        # 生成站点配置
        for site in valid_sites:
            # 站点备注（如果有）
            notes = site.get("notes", "").strip()
            if notes:
                # 使用中文格式： # 备注：xxx
                lines.append(f"# 备注：{notes}")
            
            # 站点地址
            lines.append(site.get("address", ""))
            
            # 开始块
            lines.append("{")
            
            # 生成指令（递归）
            directives = site.get("directives", [])
            self._generate_directives(lines, directives, indent, indent_str)
            
            # 结束块
            lines.append("}")
            lines.append("")  # 空行分隔
        
        # 添加未解析的内容（保留原始内容）
        if unparsed:
            if lines and lines[-1].strip():
                lines.append("")
            lines.extend(unparsed)
        
        # 移除最后的空行
        while lines and not lines[-1].strip():
            lines.pop()
        
        return "\n".join(lines)
    
    def _generate_directives(self, lines: List[str], directives: List[Dict[str, Any]], base_indent: int, indent_str: str):
        """递归生成指令"""
        for directive in directives:
            name = directive.get("name", "").strip()
            
            # 跳过空指令名
            if not name:
                continue
            
            # 格式化指令
            directive_line = indent_str + name
            args = directive.get("args", [])
            
            if args:
                # 过滤空参数
                valid_args = [arg for arg in args if arg and str(arg).strip()]
                if valid_args:
                    # 格式化参数
                    formatted_args = []
                    for arg in valid_args:
                        arg_str = str(arg).strip()
                        # 如果参数包含空格或特殊字符，加引号
                        if ' ' in arg_str or '\t' in arg_str or not arg_str:
                            formatted_args.append(f'"{arg_str}"')
                        else:
                            formatted_args.append(arg_str)
                    directive_line += " " + " ".join(formatted_args)
            
            # 检查是否有子指令
            sub_directives = directive.get("directives", [])
            if sub_directives:
                # 有子指令，在同一行添加 {
                directive_line += " {"
                lines.append(directive_line)
                # 递归生成子指令
                self._generate_directives(lines, sub_directives, base_indent + 1, indent_str)
                # 结束块
                lines.append(indent_str + "}")
            else:
                # 没有子指令，直接添加
                lines.append(directive_line)
    
    def generate_from_text(self, content: str) -> str:
        """
        从文本解析并重新生成（格式化）
        这样可以统一格式
        """
        parser = CaddyfileParser()
        result = parser.parse(content, preserve_unparsed=True)
        return self.generate(result["sites"], result["unparsed"])


def parse_caddyfile(content: str, preserve_unparsed: bool = True) -> Dict[str, Any]:
    """解析Caddyfile的便捷函数"""
    parser = CaddyfileParser()
    return parser.parse(content, preserve_unparsed)


def generate_caddyfile(sites: List[Dict[str, Any]], unparsed: List[str] = None, indent: int = 4) -> str:
    """生成Caddyfile的便捷函数"""
    generator = CaddyfileGenerator()
    return generator.generate(sites, unparsed, indent)


def format_caddyfile(content: str, indent: int = 4) -> str:
    """格式化Caddyfile（解析后重新生成）"""
    parser = CaddyfileParser()
    generator = CaddyfileGenerator()
    result = parser.parse(content, preserve_unparsed=True)
    return generator.generate(result["sites"], result["unparsed"], indent)
