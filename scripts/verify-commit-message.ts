import { readFileSync } from 'node:fs';

const messageFile = process.argv[2];

if (!messageFile) {
  throw new Error('缺少 commit message 文件路径。');
}

const rawMessage = readFileSync(messageFile, 'utf8');
const contentLines = rawMessage
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

const subject = contentLines[0] ?? '';
const fullContent = contentLines.join('\n');

// 提交信息是协作记录的一部分，所以这里用简单规则约束“中文且足够详细”。
const hasChinese = /\p{Script=Han}/u.test(fullContent);
const compactLength = fullContent.replace(/\s/g, '').length;

if (!hasChinese) {
  console.error('commit message 必须使用中文描述。');
  process.exit(1);
}

if (subject.length < 10 || compactLength < 20) {
  console.error('commit message 需要写得更详细：标题至少 10 个字符，总内容至少 20 个非空白字符。');
  process.exit(1);
}
