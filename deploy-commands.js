require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('GauTruc vào voice channel của bạn và treo câu giờ'),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('GauTruc rời voice channel'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Xem GauTruc đang ở channel nào và đã treo bao lâu'),
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Đổi kênh nhận báo cáo voice activity sang kênh hiện tại'),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Đang đăng ký slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('✅ Đã đăng ký slash commands thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi đăng ký commands:', error);
  }
})();
