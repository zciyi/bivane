import * as React from 'react';

/**
 * Bivane Search · 跨模式共享逻辑（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 两端的差异只在**建议/历史摆在哪儿**（H5 全屏页 vs PC 锚定浮层），
 * 而「当前搜索词是什么、防抖后拉什么建议、提交时怎么写历史」两端完全一致。
 * 这些判定抽成纯函数后可直接单测。
 *
 * 依赖方向：本文件不 import 任何组件，避免与 h5/search.tsx、pc/search.tsx 形成环。
 */

/** 历史记录默认条数上限 */
export const SEARCH_HISTORY_LIMIT = 10;

/* ------------------------------------------------------------------ *
 * 纯函数
 * ------------------------------------------------------------------ */

/** 归一化关键词：去首尾空白；空串表示「没有关键词」 */
export function normalizeKeyword(keyword: string): string {
  return keyword.trim();
}

/** 单条建议是否命中关键词（大小写不敏感的子串匹配） */
export function matchSuggestion(text: string, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return text.toLowerCase().includes(kw);
}

/**
 * 过滤静态建议。
 * 关键词为空时返回全部——空关键词下展示「热门词」是搜索框的常见默认态。
 */
export function filterSuggestions(suggestions: string[], keyword: string): string[] {
  const kw = keyword.trim();
  if (!kw) return suggestions;
  return suggestions.filter((item) => matchSuggestion(item, kw));
}

/**
 * 把关键词写进历史：去重前置 + 截断。
 * 空关键词不写；已存在则移到最前（最近一次搜索排在最上面）。
 */
export function pushHistory(
  history: string[],
  keyword: string,
  limit: number = SEARCH_HISTORY_LIMIT,
): string[] {
  const kw = keyword.trim();
  if (!kw) return history;
  const rest = history.filter((item) => item !== kw);
  return [kw, ...rest].slice(0, limit);
}

/** 从历史里移除某一条 */
export function removeHistoryItem(history: string[], keyword: string): string[] {
  return history.filter((item) => item !== keyword);
}

/**
 * 键盘巡航：下一个建议的下标，到边界回绕；无建议返回 -1。
 * from 传 -1 表示「尚无激活项」：step=+1（↓）落在第一条，step=-1（↑）落在最后一条。
 */
export function nextSuggestionIndex(count: number, from: number, step: 1 | -1): number {
  if (count <= 0) return -1;
  const start = from < 0 ? (step === 1 ? -1 : 0) : from;
  return (start + step + count) % count;
}

/* ------------------------------------------------------------------ *
 * 防抖
 * ------------------------------------------------------------------ */

/**
 * 防抖值：delay 毫秒后才返回最新 value；delay <= 0 退化为直通。
 * 用于「用户停止输入 → 才去拉远程建议」，避免每敲一个字打一次请求。
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

export interface UseSearchStateOptions {
  /** 受控搜索词 */
  value?: string;
  /** 非受控初始搜索词 */
  defaultValue?: string;
  /** 搜索词变化（每次输入） */
  onChange?: (value: string) => void;
  /** 提交（回车 / 点建议 / 点搜索按钮） */
  onSearch?: (keyword: string) => void;
  /** 点击清除键 */
  onClear?: () => void;
  /** 历史记录（受控）；不传则组件内内存维护 */
  history?: string[];
  onHistoryChange?: (history: string[]) => void;
  /** 静态建议词；与 onFetchSuggestions 二选一，同时提供时以异步为准 */
  suggestions?: string[];
  /** 异步建议源，返回数组或 Promise；空关键词不触发 */
  onFetchSuggestions?: (keyword: string) => string[] | Promise<string[]>;
  /** 建议防抖毫秒（仅对异步生效），默认 300 */
  debounce?: number;
  /** 历史条数上限，默认 10 */
  historyLimit?: number;
}

export interface UseSearchStateResult {
  value: string;
  setValue: (next: string) => void;
  /** 提交关键词（写入历史 + 触发 onSearch）；空关键词不提交 */
  submit: (keyword?: string) => void;
  /** 点建议：先把搜索词设为该建议，再提交 */
  pick: (text: string) => void;
  /** 清除输入（onChange('') + onClear） */
  clear: () => void;
  history: string[];
  clearHistory: () => void;
  removeHistory: (keyword: string) => void;
  /** 当前建议（静态过滤或异步结果） */
  suggestions: string[];
  /** 异步建议加载中 */
  suggestionsLoading: boolean;
}

export function useSearchState({
  value,
  defaultValue,
  onChange,
  onSearch,
  onClear,
  history: historyProp,
  onHistoryChange,
  suggestions: suggestionsProp,
  onFetchSuggestions,
  debounce = 300,
  historyLimit = SEARCH_HISTORY_LIMIT,
}: UseSearchStateOptions): UseSearchStateResult {
  /* ---- 搜索词（受控 / 非受控） ---- */
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState(defaultValue ?? '');
  const current = isControlled ? value : innerValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInnerValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  /* ---- 历史记录（受控 / 非受控） ---- */
  const isHistoryControlled = historyProp !== undefined;
  const [innerHistory, setInnerHistory] = React.useState<string[]>([]);
  const history = isHistoryControlled ? historyProp : innerHistory;

  const setHistory = React.useCallback(
    (next: string[]) => {
      if (!isHistoryControlled) setInnerHistory(next);
      onHistoryChange?.(next);
    },
    [isHistoryControlled, onHistoryChange],
  );

  /* ---- 异步建议（防抖后拉取） ---- */
  const debouncedKeyword = useDebouncedValue(current, debounce);
  const [asyncSuggestions, setAsyncSuggestions] = React.useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);

  // 用 ref 持取 onFetchSuggestions，避免消费者写内联箭头函数时
  // effect 因函数身份每渲染都变而反复触发
  const fetchRef = React.useRef(onFetchSuggestions);
  React.useEffect(() => {
    fetchRef.current = onFetchSuggestions;
  }, [onFetchSuggestions]);

  React.useEffect(() => {
    const fetchFn = fetchRef.current;
    if (!fetchFn) return;

    const kw = debouncedKeyword.trim();
    if (!kw) {
      setAsyncSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    const result = fetchFn(kw);
    if (result && typeof (result as Promise<string[]>).then === 'function') {
      (result as Promise<string[]>)
        .then((list) => {
          if (cancelled) return;
          setAsyncSuggestions(Array.isArray(list) ? list : []);
          setSuggestionsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setAsyncSuggestions([]);
          setSuggestionsLoading(false);
        });
    } else {
      setAsyncSuggestions(Array.isArray(result) ? (result as string[]) : []);
      setSuggestionsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword]);

  /* ---- 汇总建议（异步优先，其次静态过滤） ---- */
  const suggestions = React.useMemo(() => {
    if (onFetchSuggestions) return asyncSuggestions;
    return filterSuggestions(suggestionsProp ?? [], current);
  }, [onFetchSuggestions, asyncSuggestions, suggestionsProp, current]);

  /* ---- 动作 ---- */
  const submit = React.useCallback(
    (keyword?: string) => {
      const kw = normalizeKeyword(keyword ?? current);
      if (!kw) return;
      setHistory(pushHistory(history, kw, historyLimit));
      onSearch?.(kw);
    },
    [current, history, historyLimit, setHistory, onSearch],
  );

  const pick = React.useCallback(
    (text: string) => {
      const kw = normalizeKeyword(text);
      if (!kw) return;
      setValue(kw);
      submit(kw);
    },
    [setValue, submit],
  );

  const clear = React.useCallback(() => {
    setValue('');
    onClear?.();
  }, [setValue, onClear]);

  const clearHistory = React.useCallback(() => setHistory([]), [setHistory]);

  const removeHistory = React.useCallback(
    (keyword: string) => setHistory(removeHistoryItem(history, keyword)),
    [history, setHistory],
  );

  return {
    value: current,
    setValue,
    submit,
    pick,
    clear,
    history,
    clearHistory,
    removeHistory,
    suggestions,
    suggestionsLoading,
  };
}