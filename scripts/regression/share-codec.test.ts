/**
 * 分享码编解码回归测试
 * 运行：npx tsx scripts/regression/share-codec.test.ts
 */

import { encodeShareCode, decodeShareCode, birthKey } from '../../lib/ziwei/share-codec';
import type { BirthInfo } from '../../lib/ziwei/types';

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name}`, detail ?? '');
  }
}

const birth: BirthInfo = { year: 1990, month: 5, day: 9, hour: 2, gender: 'male' };
const analyses = [
  '**【命格定性】**\n紫微破军坐命，一生主破旧立新。',
  '**【主星解读】**\n紫微为帝星，破军为先锋，二者同宫既有格局又有执行力。',
];

console.log('[share-codec] 往返与格式');
const code = encodeShareCode({ birthInfo: birth, analyses });
assert('编码带版本前缀 1.', code.startsWith('1.'));
assert('编码只含 URL 安全字符', /^[0-9A-Za-z._-]+$/.test(code));
assert('编码长度合理（< 4KB，双条分析）', code.length < 4096, code.length);
assert('同输入同输出（确定性）', encodeShareCode({ birthInfo: birth, analyses }) === code);

const decoded = decodeShareCode(code);
assert('解码成功', !!decoded);
assert('生辰完全还原', !!decoded && JSON.stringify(decoded.birthInfo) === JSON.stringify({
  year: 1990, month: 5, day: 9, hour: 2, gender: 'male',
}), decoded?.birthInfo);
assert('分析内容完全还原', !!decoded && JSON.stringify(decoded.analyses) === JSON.stringify(analyses));
assert('中文与换行无损', !!decoded && decoded.analyses[0].includes('破旧立新'));

console.log('[share-codec] 容错解析');
assert('粘贴完整 URL 可解析', !!decodeShareCode(`https://example.com/chart?d=${code}`));
assert('带空白/换行可解析', !!decodeShareCode(`  ${code.slice(0, 10)}\n${code.slice(10)}  `));

console.log('[share-codec] 校验与拒绝');
assert('拒绝错误前缀', decodeShareCode('2.abc') === null);
assert('拒绝篡改内容', decodeShareCode('1.' + 'AAAA') === null);
assert('拒绝 2 月 30 日', decodeShareCode(
  encodeShareCode({ birthInfo: { year: 1990, month: 2, day: 30, hour: 0, gender: 'male' }, analyses: [] })
) === null);
assert('拒绝越界小时（12）', decodeShareCode(
  encodeShareCode({ birthInfo: { year: 1990, month: 5, day: 9, hour: 12, gender: 'male' }, analyses: [] })
) === null);
assert('拒绝空字符串', decodeShareCode('') === null);
assert('拒绝超长乱码', decodeShareCode('1.' + 'a'.repeat(30_000)) === null);

console.log('[share-codec] 上限与隐私');
const many = Array.from({ length: 10 }, (_, i) => `分析${i}`);
const capped = decodeShareCode(encodeShareCode({ birthInfo: birth, analyses: many }));
assert('分析条数截断到 6', !!capped && capped.analyses.length === 6);

const longText = '长'.repeat(5000);
const longDecoded = decodeShareCode(encodeShareCode({ birthInfo: birth, analyses: [longText] }));
assert('单条分析截断到 4000 字', !!longDecoded && longDecoded.analyses[0].length === 4000);

const withName: BirthInfo = { ...birth, name: '张三', province: '北京', city: '北京', longitude: 116.4 };
const namedDecoded = decodeShareCode(encodeShareCode({ birthInfo: withName, analyses: [] }));
assert('分享码不含姓名/地点（隐私）', !!namedDecoded && !('name' in namedDecoded.birthInfo) && !('city' in namedDecoded.birthInfo));

console.log('[share-codec] 生辰指纹');
assert('同盘同 key', birthKey(birth) === birthKey({ ...birth }));
assert('不同盘不同 key', birthKey(birth) !== birthKey({ ...birth, hour: 3 }));

console.log(`\n[share-codec] ${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
