/**
 * 分享码编解码回归测试（v2：gzip + crc32，兼容 v1）
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

async function main() {
  console.log('[share-codec] v2 往返与格式');
  const code = await encodeShareCode({ birthInfo: birth, analyses });
  assert('编码带版本前缀 2.', code.startsWith('2.'));
  assert('编码含 crc32 校验段', /\.\w{8}$/.test(code));
  assert('编码只含 URL 安全字符', /^[0-9A-Za-z._-]+$/.test(code));
  assert('v2 压缩后明显小于 v1 量级（双条 < 2KB）', code.length < 2048, code.length);
  assert('同输入同输出（确定性）', await encodeShareCode({ birthInfo: birth, analyses }) === code);

  const decoded = await decodeShareCode(code);
  assert('解码成功', !!decoded);
  assert('生辰完全还原', !!decoded && JSON.stringify(decoded.birthInfo) === JSON.stringify({
    year: 1990, month: 5, day: 9, hour: 2, gender: 'male',
  }), decoded?.birthInfo);
  assert('分析内容完全还原', !!decoded && JSON.stringify(decoded.analyses) === JSON.stringify(analyses));
  assert('中文与换行无损', !!decoded && decoded.analyses[0].includes('破旧立新'));

  console.log('[share-codec] v1 旧码兼容');
  // 手工构造 v1 码（与历史版本格式一致：base64url(JSON)）
  const v1Json = JSON.stringify({ v: 1, b: { y: 1990, m: 5, d: 9, h: 2, g: 'm' }, a: ['旧版分析'] });
  const v1Code = '1.' + btoa(unescape(encodeURIComponent(v1Json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const v1Decoded = await decodeShareCode(v1Code);
  assert('v1 码可解码', !!v1Decoded);
  assert('v1 生辰还原', !!v1Decoded && v1Decoded.birthInfo.year === 1990);
  assert('v1 分析还原', !!v1Decoded && v1Decoded.analyses[0] === '旧版分析');

  console.log('[share-codec] 容错解析');
  assert('粘贴完整 URL 可解析', !!(await decodeShareCode(`https://example.com/chart?d=${code}`)));
  assert('带空白/换行可解析', !!(await decodeShareCode(`  ${code.slice(0, 10)}\n${code.slice(10)}  `)));

  console.log('[share-codec] 校验与拒绝');
  assert('拒绝错误前缀', (await decodeShareCode('3.abc')) === null);
  assert('拒绝缺少校验段的 v2', (await decodeShareCode('2.' + 'AAAA')) === null);
  // 篡改压缩字节：改一个字符后 crc32 应失败
  const tampered = code.slice(0, 12) + (code[12] === 'A' ? 'B' : 'A') + code.slice(13);
  assert('篡改压缩体被 crc32 拒绝', (await decodeShareCode(tampered)) === null);
  // 篡改校验位
  const badSum = code.slice(0, -1) + (code.endsWith('0') ? '1' : '0');
  assert('篡改校验位被拒绝', (await decodeShareCode(badSum)) === null);
  assert('拒绝空字符串', (await decodeShareCode('')) === null);
  assert('拒绝超长乱码', (await decodeShareCode('2.' + 'a'.repeat(30_000))) === null);
  // 非法生辰：用 v1 格式构造（encode 不校验，decode 必须拒绝）
  const badBirth = (b: Record<string, unknown>) =>
    '1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, b, a: [] })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert('拒绝 2 月 30 日', (await decodeShareCode(badBirth({ y: 1990, m: 2, d: 30, h: 0, g: 'm' }))) === null);
  assert('拒绝越界小时（12）', (await decodeShareCode(badBirth({ y: 1990, m: 5, d: 9, h: 12, g: 'm' }))) === null);
  assert('拒绝非法性别', (await decodeShareCode(badBirth({ y: 1990, m: 5, d: 9, h: 2, g: 'x' }))) === null);

  console.log('[share-codec] 上限与隐私');
  const many = Array.from({ length: 10 }, (_, i) => `分析${i}`);
  const capped = await decodeShareCode(await encodeShareCode({ birthInfo: birth, analyses: many }));
  assert('分析条数截断到 6', !!capped && capped.analyses.length === 6);

  const longText = '长'.repeat(5000);
  const longDecoded = await decodeShareCode(await encodeShareCode({ birthInfo: birth, analyses: [longText] }));
  assert('单条分析截断到 4000 字', !!longDecoded && longDecoded.analyses[0].length === 4000);

  const withName: BirthInfo = { ...birth, name: '张三', province: '北京', city: '北京', longitude: 116.4 };
  const namedDecoded = await decodeShareCode(await encodeShareCode({ birthInfo: withName, analyses: [] }));
  assert('分享码不含姓名/地点（隐私）', !!namedDecoded && !('name' in namedDecoded.birthInfo) && !('city' in namedDecoded.birthInfo));

  console.log('[share-codec] 生辰指纹');
  assert('同盘同 key', birthKey(birth) === birthKey({ ...birth }));
  assert('不同盘不同 key', birthKey(birth) !== birthKey({ ...birth, hour: 3 }));

  console.log(`\n[share-codec] ${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
