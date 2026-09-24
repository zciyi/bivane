import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLoadingEntries,
  hideLoading,
  resetLoadingStore,
  showLoading,
  updateLoading,
} from '@/hooks/use-loading-store';
import {
  closeNotify,
  getNotifyEntries,
  resetNotifyStore,
  resolveNotifyDuration,
  showNotify,
  updateNotify,
} from '@/hooks/use-notify-store';
import {
  closeActionSheet,
  getActionSheetEntries,
  resetActionSheetStore,
  showActionSheet,
  updateActionSheet,
} from '@/hooks/use-action-sheet-store';

/**
 * 反馈类（P1′）三件套的 store 单测
 *
 * 断言来自「我期望什么」：叠加时呈现最新、按 id 精确关闭、不传 id 全关、
 * 局部更新只改传入字段 —— 这些都是命令式 API 的语义契约。
 */

describe('loading store', () => {
  beforeEach(() => {
    resetLoadingStore();
  });

  it('多条叠加时保留全部，呈现层取最后一条', () => {
    showLoading({ text: '第一条' });
    showLoading({ text: '第二条' });

    const items = getLoadingEntries();
    expect(items).toHaveLength(2);
    expect(items[items.length - 1]?.options.text).toBe('第二条');
  });

  it('hideLoading(id) 只关闭指定的那一条', () => {
    const first = showLoading({ text: '第一条' });
    showLoading({ text: '第二条' });

    hideLoading(first.id);

    const items = getLoadingEntries();
    expect(items).toHaveLength(1);
    expect(items[0]?.options.text).toBe('第二条');
  });

  it('hideLoading() 不传 id 时关闭全部', () => {
    showLoading({ text: 'a' });
    showLoading({ text: 'b' });

    hideLoading();

    expect(getLoadingEntries()).toHaveLength(0);
  });

  it('updateLoading 只改传入字段', () => {
    const handle = showLoading({ text: '加载中', mask: true });

    updateLoading(handle.id, { text: '努力加载…' });

    const item = getLoadingEntries()[0];
    expect(item?.options.text).toBe('努力加载…');
    expect(item?.options.mask).toBe(true);
  });

  it('handle.close 等价于按 id 关闭', () => {
    const handle = showLoading({ text: 'x' });
    showLoading({ text: 'y' });

    handle.close();

    expect(getLoadingEntries()).toHaveLength(1);
  });
});

describe('notify store', () => {
  beforeEach(() => {
    resetNotifyStore();
  });

  it('默认时长 3s，显式 0 表示不自动关闭', () => {
    expect(resolveNotifyDuration()).toBe(3000);
    expect(resolveNotifyDuration(0)).toBe(0);
    expect(resolveNotifyDuration(1500)).toBe(1500);
  });

  it('showNotify 入队并回传 id', () => {
    const handle = showNotify({ message: '提示', duration: 0 });

    expect(handle.id).toBeGreaterThan(0);
    expect(getNotifyEntries()).toHaveLength(1);
  });

  it('closeNotify(id) 触发该条的 onClose', () => {
    let closed = 0;
    const handle = showNotify({
      message: 'x',
      duration: 0,
      onClose: () => {
        closed += 1;
      },
    });

    closeNotify(handle.id);

    expect(closed).toBe(1);
    expect(getNotifyEntries()).toHaveLength(0);
  });

  it('closeNotify() 不传 id 时关闭全部并各自回调', () => {
    let closed = 0;
    const onClose = () => {
      closed += 1;
    };
    showNotify({ message: 'a', duration: 0, onClose });
    showNotify({ message: 'b', duration: 0, onClose });

    closeNotify();

    expect(closed).toBe(2);
    expect(getNotifyEntries()).toHaveLength(0);
  });

  it('updateNotify 只改传入字段', () => {
    const handle = showNotify({ message: '旧', type: 'success', duration: 0 });

    updateNotify(handle.id, { message: '新' });

    const item = getNotifyEntries()[0];
    expect(item?.options.message).toBe('新');
    expect(item?.options.type).toBe('success');
  });
});

describe('action-sheet store', () => {
  beforeEach(() => {
    resetActionSheetStore();
  });

  it('showActionSheet 入队', () => {
    const handle = showActionSheet({ actions: [{ name: '删除' }] });

    expect(handle.id).toBeGreaterThan(0);
    expect(getActionSheetEntries()).toHaveLength(1);
  });

  it('closeActionSheet 按 id 关闭', () => {
    const first = showActionSheet({ actions: [{ name: 'a' }] });
    showActionSheet({ actions: [{ name: 'b' }] });

    closeActionSheet(first.id);

    const items = getActionSheetEntries();
    expect(items).toHaveLength(1);
    expect(items[0]?.options.actions?.[0]?.name).toBe('b');
  });

  it('closeActionSheet() 不传 id 关闭全部', () => {
    showActionSheet({ actions: [{ name: 'a' }] });
    showActionSheet({ actions: [{ name: 'b' }] });

    closeActionSheet();

    expect(getActionSheetEntries()).toHaveLength(0);
  });

  it('updateActionSheet 只改传入字段', () => {
    const handle = showActionSheet({ title: '旧标题', cancelText: '取消' });

    updateActionSheet(handle.id, { title: '新标题' });

    const item = getActionSheetEntries()[0];
    expect(item?.options.title).toBe('新标题');
    expect(item?.options.cancelText).toBe('取消');
  });
});
