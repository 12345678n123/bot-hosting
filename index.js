const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('7351883808:AAGJd-mvBxFyYUDkTCg2dnjYhPfmSmjyNJk');
const ADMIN_ID = 7787131118;
const USERS_FILE = 'users.json';

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

// User management functions
function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function addUser(user) {
  const users = loadUsers();
  const exists = users.find(u => u.id === user.id);
  if (!exists) {
    users.push({ 
      id: user.id, 
      name: user.first_name, 
      phone: null,
      fileSent: false,
      registered: false
    });
    saveUsers(users);
  }
}

function updateUser(userId, updateFn) {
  const users = loadUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    users[index] = updateFn(users[index]);
    saveUsers(users);
  }
}

function getUser(userId) {
  return loadUsers().find(u => u.id === userId);
}

// Main menu keyboard
const mainMenuKeyboard = Markup.keyboard([
  ["➕ Bot qo'shish"],
  ["🗑 Botni o‘chirish"],
  ["📚 Qo‘llanma", "👨‍💻 Admin bilan bog'lanish"]
]).resize();

// Phone request keyboard (without cancel option)
const phoneRequestKeyboard = Markup.keyboard([
  [Markup.button.contactRequest("📱 Telefon raqamni yuborish")]
]).resize().oneTime();

// 🟢 /start command
bot.start(async (ctx) => {
  const user = ctx.from;
  addUser(user);
  
  const userData = getUser(user.id);
  
  // If user is already registered (has phone), show main menu
  if (userData.registered) {
    await ctx.reply(
      `Salom ${user.first_name}! Asosiy menyu:`,
      mainMenuKeyboard
    );
    return;
  }
  
  // If not registered, ask for phone number (without cancel option)
  await ctx.reply(
    `Salom ${user.first_name}!\nBizning hostingimizni tanlaganingiz uchun rahmat. ` +
    `Iltimos, xizmatdan foydalanish uchun telefon raqamingizni yuboring. ` +
    `Quyidagi "📱 Telefon raqamni yuborish" tugmasini bosing.`,
    phoneRequestKeyboard
  );
});

// Handle phone number submission
bot.on('contact', async (ctx) => {
  const contact = ctx.message.contact;
  if (contact.user_id !== ctx.from.id) {
    return ctx.reply('❌ Iltimos, faqat o\'zingizning telefon raqamingizni yuboring.');
  }
  
  updateUser(ctx.from.id, (u) => ({
    ...u,
    phone: contact.phone_number,
    registered: true
  }));
  
  await ctx.reply(
    `✅ Rahmat! Telefon raqamingiz qabul qilindi: ${contact.phone_number}\n\n` +
    `Endi bizning xizmatlarimizdan foydalanishingiz mumkin.`,
    mainMenuKeyboard
  );
});

// ➕ Add bot
bot.hears("➕ Bot qo'shish", async (ctx) => {
  const userData = getUser(ctx.from.id);
  if (!userData.registered) {
    await ctx.reply(
      `❌ Avval telefon raqamingizni yuborishingiz kerak. ` +
      `Iltimos, /start ni bosing va telefon raqamingizni yuboring.`,
      phoneRequestKeyboard
    );
    return;
  }
  
  await ctx.reply("Bo‘lim tanlang:",
    Markup.inlineKeyboard([
      [Markup.button.callback('Pullik', 'pul')],
      [Markup.button.callback('Tekin', 'tek')]
    ])
  );
});

// Tekin bo‘lim tanlandi
bot.action('tek', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply("Tekin bo‘lim shartlari:\n1. Ertalab soat 8 dan 12 gacha ishlaydi\n2. 1 ta botdan ortiq qo‘shib bo‘lmaydi\n3. 10 kun ishlaydi va o‘chadi!",
    Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash', 'tekbot')]])
  );
});

// Tekin bot faylini yuborish
bot.action('tekbot', async (ctx) => {
  const user = ctx.from;
  const userData = getUser(user.id);
  if (userData?.fileSent) {
    return ctx.reply("❌ Siz allaqachon fayl yuborgansiz. O‘chirish orqali yangisini yuborishingiz mumkin.");
  }
  await ctx.reply("Iltimos, ZIP faylni yuboring.");
});

// ZIP faylni qabul qilish
bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  const user = ctx.from;

  if (!doc.file_name.endsWith('.zip')) {
    return ctx.reply('❌ Faqat .zip fayllar qabul qilinadi.');
  }

  const userData = getUser(user.id);
  if (!userData.registered) {
    return ctx.reply('❌ Avval telefon raqamingizni yuborishingiz kerak. Iltimos, /start ni bosing.');
  }

  if (userData?.fileSent) {
    return ctx.reply("❌ Siz ZIP faylni allaqachon yuborgansiz. Avval faylni o‘chirishingiz kerak.");
  }

  await ctx.telegram.sendDocument(ADMIN_ID, doc.file_id, {
    caption: `📦 ZIP fayl\n👤 ${user.first_name} (${user.id})\n📱 ${userData.phone}\n📁 ${doc.file_name}`
  });

  updateUser(user.id, (u) => ({ ...u, fileSent: true }));
  await ctx.reply('✅ ZIP faylingiz adminga yuborildi.');
});

// 🗑 Botni o‘chirish menyusi
bot.hears("🗑 Botni o‘chirish", async (ctx) => {
  const userData = getUser(ctx.from.id);
  if (!userData.registered) {
    await ctx.reply(
      `❌ Avval telefon raqamingizni yuborishingiz kerak. ` +
      `Iltimos, /start ni bosing va telefon raqamingizni yuboring.`,
      phoneRequestKeyboard
    );
    return;
  }
  
  await ctx.reply("Faylingizni o‘chirishni istaysizmi?\n\nO‘chirilsa, siz yana yangi ZIP fayl yuborishingiz mumkin.",
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Ha, o‘chirish", "delete_file")]
    ])
  );
});

// Faylni o‘chirish
bot.action("delete_file", async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);

  if (!user?.fileSent) {
    return ctx.reply("❌ Sizda hozirda yuborilgan fayl yo‘q.");
  }

  updateUser(userId, (u) => ({ ...u, fileSent: false }));
  await ctx.reply("🗑 Faylingiz o‘chirildi. Endi qaytadan ZIP fayl yuborishingiz mumkin.");
});

// 👨‍💻 Admin bilan bog‘lanish
bot.hears("👨‍💻 Admin bilan bog'lanish", async (ctx) => {
  const userData = getUser(ctx.from.id);
  if (!userData.registered) {
    await ctx.reply(
      `❌ Avval telefon raqamingizni yuborishingiz kerak. ` +
      `Iltimos, /start ni bosing va telefon raqamingizni yuboring.`,
      phoneRequestKeyboard
    );
    return;
  }
  
  await ctx.reply("✍️ Savolingiz bo'lsa, yozing (bekor qilish uchun '🚫 Bekor qilish' tugmasini bosing):",
    Markup.keyboard([['🚫 Bekor qilish']]).resize()
  );
});

bot.action('pul', async (ctx) =>{
  await ctx.deleteMessage();
  await ctx.reply('🧾 1 oylik tariflar quyidagicha:',
    Markup.inlineKeyboard([
      [Markup.button.callback('50 mb - 10.000 sum', 'pul50')],
      [Markup.button.callback('100 mb - 25.000 sum', 'pul100')],
      [Markup.button.callback('150 mb - 40.000 sum', 'pul150')],
      [Markup.button.callback('200 mb - 60.000 sum', 'pul200')],
      [Markup.button.callback('250 mb - 75.000 sum', 'pul250')],
      [Markup.button.callback('300 mb - 100.000 sum', 'pul300')]
    ])
  );
});

bot.action('pul50', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('Iltimos ZIP fayl\nYuboring!',
    Markup.keyboard([
      ['🚫 Bekor qilish']
    ]).resize().oneTime()
  );
});

bot.action('pul100', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('Iltimos ZIP fayl\nYuboring!',
    Markup.keyboard([
      ['🚫 Bekor qilish']
    ]).resize().oneTime()
  );
});

bot.action('pul150', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('Iltimos ZIP fayl\nYuboring!',
    Markup.keyboard([
      ['🚫 Bekor qilish']
    ]).resize().oneTime()
  );
});

bot.action('pul200', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('Iltimos ZIP fayl\nYuboring!',
    Markup.keyboard([
      ['🚫 Bekor qilish']
    ]).resize().oneTime()
  );
});

bot.action('pul250', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('Iltimos ZIP fayl\nYuboring!',
    Markup.keyboard([
      ['🚫 Bekor qilish']
    ]).resize().oneTime()
  );
});

bot.action('pul300', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply('Iltimos ZIP fayl\nYuboring!',
    Markup.keyboard([
      ['🚫 Bekor qilish']
    ]).resize().oneTime()
  );
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const isCommand = ["➕ Bot qo'shish", "📚 Qo‘llanma", "👨‍💻 Admin bilan bog'lanish", "🗑 Botni o‘chirish"];
  if (isCommand.includes(text)) return;

  if (text === "🚫 Bekor qilish") {
    await ctx.reply("🚫 Yuborish bekor qilindi.", mainMenuKeyboard);
    return;
  }

  const userData = getUser(ctx.from.id);
  
  await bot.telegram.sendMessage(
    ADMIN_ID,
    `📩 Yangi xabar:\n👤 ${ctx.from.first_name}\n🆔 ${ctx.from.id}\n📱 ${userData?.phone || "Noma'lum"}\n💬 ${text}`
  );

  await ctx.reply("✅ Xabaringiz adminga yuborildi.", mainMenuKeyboard);
});  

bot.launch();
console.log('🤖 Bot ishga tushdi...');

const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000);
