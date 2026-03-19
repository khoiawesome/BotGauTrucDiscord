require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
} = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Track when bot joined each guild's voice channel
const joinTimestamps = new Map();

// Track when each user joined voice (guildId -> Map<userId, timestamp>)
const userJoinTimes = new Map();

// Track which text channel to send reports to (guildId -> channelId)
const reportChannels = new Map();

client.once('clientReady', () => {
  console.log(`✅ GauTruc đã online! Logged in as ${client.user.tag}`);
  client.user.setActivity('Đang treo voice 🎙️', { type: ActivityType.Custom });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member } = interaction;
  console.log(`📩 Nhận command: /${commandName} từ ${member?.displayName || 'unknown'}`);

  // ========================
  // /join — Bot vào voice channel
  // ========================
  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ Bạn phải vào một kênh voice trước rồi mới gọi mình vào!',
        ephemeral: true,
      });
    }

    // Check if bot already in a voice channel in this guild
    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection) {
      return interaction.reply({
        content: `⚠️ Mình đang ở trong voice channel rồi! Dùng \`/leave\` để mình rời trước nhé.`,
        ephemeral: true,
      });
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,  // Tự deafen (không nghe)
        selfMute: true,  // Tự mute (không nói)
      });

      // Handle connection state changes
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          // Try to reconnect
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
          // Seems to be reconnecting to a new channel
        } catch (error) {
          // Seems to be a real disconnect, destroy connection
          connection.destroy();
          joinTimestamps.delete(guild.id);
          console.log(`🔌 Bị disconnect khỏi voice ở guild ${guild.name}`);
        }
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        joinTimestamps.delete(guild.id);
      });

      // Record join time
      joinTimestamps.set(guild.id, Date.now());

      // Set report channel to where the command was used
      reportChannels.set(guild.id, interaction.channelId);

      // Initialize user tracking for this guild
      if (!userJoinTimes.has(guild.id)) {
        userJoinTimes.set(guild.id, new Map());
      }

      // Track users already in the voice channel
      voiceChannel.members.forEach((m) => {
        if (!m.user.bot) {
          userJoinTimes.get(guild.id).set(m.id, Date.now());
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🎙️ GauTruc đã vào voice!')
        .setDescription(`Đã vào **${voiceChannel.name}**\nĐang treo câu giờ... 🕐\n📋 Báo cáo sẽ gửi tại <#${interaction.channelId}>`)
        .setFooter({ text: 'Dùng /leave để mình rời | /status để xem thời gian' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi join voice:', error);
      await interaction.reply({
        content: '❌ Không thể vào voice channel. Kiểm tra quyền bot nhé!',
        ephemeral: true,
      });
    }
  }

  // ========================
  // /leave — Bot rời voice channel
  // ========================
  if (commandName === 'leave') {
    const connection = getVoiceConnection(guild.id);

    if (!connection) {
      return interaction.reply({
        content: '❌ Mình không ở trong voice channel nào cả!',
        ephemeral: true,
      });
    }

    const joinTime = joinTimestamps.get(guild.id);
    const duration = joinTime ? formatDuration(Date.now() - joinTime) : 'N/A';

    connection.destroy();
    joinTimestamps.delete(guild.id);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('👋 GauTruc đã rời voice!')
      .setDescription(`Tổng thời gian treo: **${duration}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========================
  // /status — Xem trạng thái
  // ========================
  if (commandName === 'status') {
    const connection = getVoiceConnection(guild.id);

    if (!connection) {
      return interaction.reply({
        content: '💤 Mình không ở trong voice channel nào. Dùng `/join` để gọi mình!',
        ephemeral: true,
      });
    }

    const joinTime = joinTimestamps.get(guild.id);
    const duration = joinTime ? formatDuration(Date.now() - joinTime) : 'N/A';

    // Find which channel the bot is in
    const botVoiceState = guild.members.me?.voice;
    const channelName = botVoiceState?.channel?.name || 'Unknown';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📊 Trạng thái GauTruc')
      .addFields(
        { name: '🔊 Kênh voice', value: channelName, inline: true },
        { name: '⏱️ Thời gian treo', value: duration, inline: true },
        { name: '🔇 Trạng thái', value: 'Muted & Deafened', inline: true },
      )
      .setFooter({ text: 'Dùng /leave để mình rời voice' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========================
  // /setchannel — Đổi kênh báo cáo
  // ========================
  if (commandName === 'setchannel') {
    reportChannels.set(guild.id, interaction.channelId);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📋 Đã đổi kênh báo cáo!')
      .setDescription(`Báo cáo voice activity sẽ gửi tại <#${interaction.channelId}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// ========================
// Voice State Tracking
// ========================
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guild = newState.guild;
  const botVoiceChannel = guild.members.me?.voice?.channel;

  // Only track if bot is in a voice channel
  if (!botVoiceChannel) return;

  const member = newState.member;
  if (member.user.bot) return; // Ignore bots

  const reportChannelId = reportChannels.get(guild.id);
  if (!reportChannelId) return;

  const reportChannel = guild.channels.cache.get(reportChannelId);
  if (!reportChannel) return;

  // Initialize guild tracking
  if (!userJoinTimes.has(guild.id)) {
    userJoinTimes.set(guild.id, new Map());
  }
  const guildUserTimes = userJoinTimes.get(guild.id);

  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  // User joined bot's voice channel
  if (newChannel?.id === botVoiceChannel.id && oldChannel?.id !== botVoiceChannel.id) {
    guildUserTimes.set(member.id, Date.now());

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📥 Có người vào voice!')
      .setDescription(`**${member.displayName}** đã vào **${botVoiceChannel.name}**`)
      .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: '👥 Số người trong room', value: `${botVoiceChannel.members.filter(m => !m.user.bot).size}`, inline: true }
      )
      .setTimestamp();

    try {
      await reportChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Không gửi được báo cáo JOIN:', err.message);
    }
  }

  // User left bot's voice channel
  if (oldChannel?.id === botVoiceChannel.id && newChannel?.id !== botVoiceChannel.id) {
    const joinTime = guildUserTimes.get(member.id);
    const duration = joinTime ? formatDuration(Date.now() - joinTime) : 'Không rõ';
    guildUserTimes.delete(member.id);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('📤 Có người rời voice!')
      .setDescription(`**${member.displayName}** đã rời **${oldChannel.name}**`)
      .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: '⏱️ Thời gian trong room', value: duration, inline: true },
        { name: '👥 Còn lại trong room', value: `${botVoiceChannel.members.filter(m => !m.user.bot).size}`, inline: true }
      )
      .setTimestamp();

    try {
      await reportChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Không gửi được báo cáo LEAVE:', err.message);
    }
  }
});

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const s = seconds % 60;
  const m = minutes % 60;
  const h = hours;

  if (h > 0) {
    return `${h} giờ ${m} phút ${s} giây`;
  } else if (m > 0) {
    return `${m} phút ${s} giây`;
  } else {
    return `${s} giây`;
  }
}

// Debug: check if token is loaded
const token = process.env.DISCORD_TOKEN;
console.log(`🔍 Token loaded: ${token ? 'YES (' + token.substring(0, 10) + '...)' : 'NO - TOKEN IS MISSING!'}`);
console.log(`🔍 CLIENT_ID: ${process.env.CLIENT_ID || 'MISSING'}`);
console.log(`🔍 GUILD_ID: ${process.env.GUILD_ID || 'MISSING'}`);

// Login
client.login(token);
