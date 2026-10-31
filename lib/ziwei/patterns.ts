/**
 * 紫微斗数格局识别 —— 服务端入口（server-only）
 *
 * 纯逻辑在 patterns-core.ts（client / server 共用，供 ChartSummary 等
 * 客户端组件引用）；本文件保留 server-only 守卫，服务端代码（lib/ai/*）
 * 请从这里 import。
 */

import 'server-only';
export * from './patterns-core';
