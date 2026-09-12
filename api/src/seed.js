// api/src/seed.js
// 初始化食材库
// 用法： node src/seed.js   (或容器启动时自动跑)

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FOODS = [
  // 主食
  { name: '米饭', category: '主食', emoji: '🍚' },
  { name: '小米粥', category: '主食', emoji: '🥣' },
  { name: '面条', category: '主食', emoji: '🍜' },
  { name: '馒头', category: '主食', emoji: '🍞' },
  { name: '饺子', category: '主食', emoji: '🥟' },
  { name: '南瓜泥', category: '主食', emoji: '🎃' },
  { name: '红薯', category: '主食', emoji: '🍠' },
  { name: '土豆泥', category: '主食', emoji: '🥔' },
  // 蔬菜
  { name: '西兰花', category: '蔬菜', emoji: '🥦' },
  { name: '胡萝卜', category: '蔬菜', emoji: '🥕' },
  { name: '菠菜', category: '蔬菜', emoji: '🥬' },
  { name: '西红柿', category: '蔬菜', emoji: '🍅' },
  { name: '黄瓜', category: '蔬菜', emoji: '🥒' },
  { name: '南瓜', category: '蔬菜', emoji: '🎃' },
  { name: '白菜', category: '蔬菜', emoji: '🥬' },
  // 水果
  { name: '苹果', category: '水果', emoji: '🍎' },
  { name: '香蕉', category: '水果', emoji: '🍌' },
  { name: '梨', category: '水果', emoji: '🍐' },
  { name: '蓝莓', category: '水果', emoji: '🫐' },
  { name: '橙子', category: '水果', emoji: '🍊' },
  { name: '牛油果', category: '水果', emoji: '🥑' },
  { name: '猕猴桃', category: '水果', emoji: '🥝' },
  // 肉类
  { name: '鸡肉', category: '肉类', emoji: '🍗' },
  { name: '猪肉', category: '肉类', emoji: '🥩' },
  { name: '牛肉', category: '肉类', emoji: '🥩' },
  { name: '鱼肉', category: '肉类', emoji: '🐟' },
  { name: '虾', category: '肉类', emoji: '🦐' },
  // 蛋奶
  { name: '鸡蛋', category: '蛋奶', emoji: '🥚' },
  { name: '蛋黄', category: '蛋奶', emoji: '🥚' },
  { name: '牛奶', category: '蛋奶', emoji: '🥛' },
  { name: '酸奶', category: '蛋奶', emoji: '🥛' },
  { name: '奶酪', category: '蛋奶', emoji: '🧀' },
  // 其他
  { name: '豆腐', category: '其他', emoji: '🧊' },
  { name: '芝麻', category: '其他', emoji: '🌰' },
];

async function main() {
  // 食材
  for (const f of FOODS) {
    const existing = await prisma.food.findUnique({ where: { name: f.name } });
    if (!existing) {
      await prisma.food.create({ data: { ...f, isActive: true } });
      console.log(`[seed] food: ${f.name}`);
    }
  }

  console.log('[seed] done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });