// 动森经典角色村民化身库
export const VILLAGERS = [
  { name: '西施惠 (Isabelle)', avatar: '🐶' },
  { name: '狸克 (Tom Nook)', avatar: '🦝' },
  { name: '小润 (Marshal)', avatar: '🐿️' },
  { name: '茶茶丸 (Dom)', avatar: '🐑' },
  { name: '杰克 (Raymond)', avatar: '🐱' },
  { name: '莫妮卡 (Audie)', avatar: '🦊' },
  { name: '仰韶 (Coco)', avatar: '🐰' },
  { name: '阿波罗 (Apollo)', avatar: '🦅' },
];

const adjectives = [
  '极客', '疯狂', '写意', '朋克', '像素',
  '抽象', '写实', '多彩', '极简', '爱摸鱼',
];

const nouns = [
  '毕加索', '达芬奇', '莫奈', '马良',
  '梵高', '草间弥生', '张大千', '齐白石',
];

export function getRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}_${num}`;
}
