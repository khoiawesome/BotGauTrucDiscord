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

// Track which milestone index has been reached (guildId -> milestoneIndex)
const reachedMilestones = new Map();

// Milestone intervals for milestone checker (guildId -> intervalId)
const milestoneIntervals = new Map();

// DM notify: when the caller joins voice, DM the target user
// guildId -> Map<callerUserId, Set<receiverUserId>>
const dmNotify = new Map();

// Quiet mode: tắt thông báo milestone + voice join/leave (guildId -> boolean)
const quietMode = new Map();
// Track user milestone progress (guildId -> Map<userId, milestoneIndex>)
const userReachedMilestones = new Map();

// User milestone checker intervals (guildId -> Map<userId, intervalId>)
const userMilestoneIntervals = new Map();

// User milestones config (in milliseconds)
const USER_MILESTONES = [
  { time: 1 * 60 * 60 * 1000, label: '1 giờ', emoji: '🎉', message: (name) => `🎉 **${name}** đã ngồi voice được **1 giờ** rồi! Mới bắt đầu thôi, cố lên nào~ 💪` },
  { time: 5 * 60 * 60 * 1000, label: '5 giờ', emoji: '🔥', message: (name) => `🔥 **${name}** đã **5 giờ** trong voice! Kiên trì phết ha! Respect! 🐻` },
  { time: 10 * 60 * 60 * 1000, label: '10 giờ', emoji: '💪', message: (name) => `💪 **${name}** đã ngồi **10 giờ** liên tục! Bạn sắp thành huyền thoại rồi đó! 🏆` },
  { time: 20 * 60 * 60 * 1000, label: '20 giờ', emoji: '🌙', message: (name) => `🌙 **${name}** ở voice **20 giờ** rồi?! Bạn không ngủ à?! Kinh nể! 🫡` },
  { time: 24 * 60 * 60 * 1000, label: '1 ngày', emoji: '☀️', message: (name) => `🎊 **${name}** đã ở voice TRỌN **1 NGÀY**! Xứng đáng nhận huy chương vàng! 🥇🐻` },
  { time: 48 * 60 * 60 * 1000, label: '2 ngày', emoji: '⚡', message: (name) => `⚡ **${name}** ở voice **2 NGÀY** rồi! Đã vượt qua giới hạn con người! 🦸` },
  { time: 50 * 60 * 60 * 1000, label: '50 giờ', emoji: '🏅', message: (name) => `🏅 **${name}** — **50 GIỜ** trong voice!! Nửa đường tới 100 giờ, không ai cản nổi bạn! 🔥🐻🔥` },
  { time: 72 * 60 * 60 * 1000, label: '3 ngày', emoji: '👑', message: (name) => `👑 **${name}** — **3 NGÀY** trong voice! Bạn giờ là VUA/NỮ HOÀNG của voice channel! 👑` },
  { time: 100 * 60 * 60 * 1000, label: '100 giờ', emoji: '💯', message: (name) => `💯🎆 **${name}** — **100 GIỜ** trong voice!!! CON SỐ HUYỀN THOẠI!! Bạn là sinh vật không cần ngủ!! 🐻👑🏆💯` },
  { time: 120 * 60 * 60 * 1000, label: '5 ngày', emoji: '🌟', message: (name) => `✨ **${name}** — **5 NGÀY** ở voice?! Đây là truyền thuyết chứ không phải thực tế nữa! 🌟🐻✨` },
  { time: 168 * 60 * 60 * 1000, label: '7 ngày', emoji: '🤯', message: (name) => `🤯🤯🤯 **${name}** — **7 NGÀY = 1 TUẦN** liên tục trong voice!! KHÔNG THỂ TIN ĐƯỢC!! Bạn đã đạt đến cảnh giới THẦN THÁNH!! 🐻👑🏆🎆` },
];

// Milestones config (in milliseconds)
const MILESTONES = [
  { time: 1 * 60 * 60 * 1000, label: '1 giờ', emoji: '🎉', message: 'GauTruc đã treo được **1 giờ**! Mới khởi động thôi, còn dài lắm~ 💪' },
  { time: 5 * 60 * 60 * 1000, label: '5 giờ', emoji: '🔥', message: 'Đã **5 giờ** rồi đó! GauTruc kiên trì phết ha! 🐻' },
  { time: 10 * 60 * 60 * 1000, label: '10 giờ', emoji: '💪', message: '**10 giờ** liên tục trong voice! GauTruc sắp thành huyền thoại rồi! 🏆' },
  { time: 20 * 60 * 60 * 1000, label: '20 giờ', emoji: '🌙', message: '**20 giờ**?! GauTruc không ngủ à?! Respect! 🫡' },
  { time: 24 * 60 * 60 * 1000, label: '1 ngày', emoji: '☀️', message: '🎊 TRỌN **1 NGÀY** trong voice! GauTruc xứng đáng nhận huy chương vàng! 🥇' },
  { time: 48 * 60 * 60 * 1000, label: '2 ngày', emoji: '⚡', message: '**2 NGÀY** rồi nha! GauTruc đã vượt qua giới hạn con người! 🦸' },
  { time: 50 * 60 * 60 * 1000, label: '50 giờ', emoji: '🏅', message: '🏅 **50 GIỜ** trong voice!! GauTruc nửa đường tới 100 giờ, không gì cản nổi! 🔥🐻🔥' },
  { time: 72 * 60 * 60 * 1000, label: '3 ngày', emoji: '👑', message: '**3 NGÀY**! GauTruc giờ là VUA của voice channel! 👑🐻' },
  { time: 100 * 60 * 60 * 1000, label: '100 giờ', emoji: '💯', message: '💯🎆 **100 GIỜ** trong voice!!! CON SỐ HUYỀN THOẠI!! GauTruc đã trở thành bất tử!! 🐻👑🏆💯' },
  { time: 120 * 60 * 60 * 1000, label: '5 ngày', emoji: '🌟', message: '**5 NGÀY** ở trong voice?! Đây là truyền thuyết chứ không còn là thực tế nữa! ✨🐻✨' },
  { time: 168 * 60 * 60 * 1000, label: '7 ngày', emoji: '🤯', message: '🤯🤯🤯 **7 NGÀY = 1 TUẦN** liên tục trong voice!! KHÔNG THỂ TIN ĐƯỢC!! GauTruc đã đạt đến cảnh giới THẦN THÁNH!! 🐻👑🏆🎆' },
];

/**
 * Start milestone checker for a guild
 */
function startMilestoneChecker(guild) {
  // Clear existing interval if any
  if (milestoneIntervals.has(guild.id)) {
    clearInterval(milestoneIntervals.get(guild.id));
  }
  reachedMilestones.set(guild.id, -1);

  const intervalId = setInterval(async () => {
    const joinTime = joinTimestamps.get(guild.id);
    if (!joinTime) return;

    const elapsed = Date.now() - joinTime;
    const currentMilestoneIdx = reachedMilestones.get(guild.id) ?? -1;

    // Check which milestone we've reached
    let nextIdx = currentMilestoneIdx + 1;

    // If past all milestones, cycle back to the last one every 7 days
    if (nextIdx >= MILESTONES.length) {
      const lastMilestone = MILESTONES[MILESTONES.length - 1];
      const cycleCount = Math.floor(elapsed / lastMilestone.time);
      const expectedIdx = MILESTONES.length - 1 + cycleCount;
      if (expectedIdx <= currentMilestoneIdx) return;
      nextIdx = currentMilestoneIdx + 1;
    }

    // Check if we've passed the next milestone
    let milestoneToAnnounce = null;
    if (nextIdx < MILESTONES.length && elapsed >= MILESTONES[nextIdx].time) {
      milestoneToAnnounce = MILESTONES[nextIdx];
      reachedMilestones.set(guild.id, nextIdx);
    } else if (nextIdx >= MILESTONES.length) {
      // Repeat last milestone every 7 days
      const lastMs = MILESTONES[MILESTONES.length - 1];
      const repeatCount = currentMilestoneIdx - MILESTONES.length + 2;
      const nextTime = lastMs.time * (repeatCount + 1);
      if (elapsed >= nextTime) {
        const weeks = repeatCount + 1;
        milestoneToAnnounce = {
          emoji: '🤯',
          message: `🤯🤯🤯 **${weeks} TUẦN** liên tục trong voice!! KHÔNG THỂ TIN ĐƯỢC!! GauTruc đã phá kỷ lục bản thân!! 🐻👑🏆🎆`,
        };
        reachedMilestones.set(guild.id, currentMilestoneIdx + 1);
      }
    }

    if (quietMode.get(guild.id)) return;
    if (!milestoneToAnnounce) return;

    const reportChannelId = reportChannels.get(guild.id);
    if (!reportChannelId) return;

    try {
      const reportChannel = await guild.channels.fetch(reportChannelId);
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`${milestoneToAnnounce.emoji} MILESTONE!`)
        .setDescription(milestoneToAnnounce.message)
        .addFields(
          { name: '⏱️ Tổng thời gian', value: formatDuration(elapsed), inline: true }
        )
        .setTimestamp();

      await reportChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Không gửi được milestone:', err.message);
    }
  }, 30 * 1000); // Check every 30 seconds

  milestoneIntervals.set(guild.id, intervalId);
}

/**
 * Stop milestone checker for a guild
 */
function stopMilestoneChecker(guildId) {
  const intervalId = milestoneIntervals.get(guildId);
  if (intervalId) {
    clearInterval(intervalId);
    milestoneIntervals.delete(guildId);
  }
  reachedMilestones.delete(guildId);
}

/**
 * Start milestone checker for a specific user in a guild
 */
function startUserMilestoneChecker(guild, userId) {
  if (!userMilestoneIntervals.has(guild.id)) {
    userMilestoneIntervals.set(guild.id, new Map());
  }
  if (!userReachedMilestones.has(guild.id)) {
    userReachedMilestones.set(guild.id, new Map());
  }

  // Clear existing interval for this user
  const guildIntervals = userMilestoneIntervals.get(guild.id);
  if (guildIntervals.has(userId)) {
    clearInterval(guildIntervals.get(userId));
  }
  userReachedMilestones.get(guild.id).set(userId, -1);

  const intervalId = setInterval(async () => {
    const guildUserTimes = userJoinTimes.get(guild.id);
    if (!guildUserTimes) return;
    const joinTime = guildUserTimes.get(userId);
    if (!joinTime) return;

    const elapsed = Date.now() - joinTime;
    const milestoneMap = userReachedMilestones.get(guild.id);
    if (!milestoneMap) return;
    const currentIdx = milestoneMap.get(userId) ?? -1;

    let nextIdx = currentIdx + 1;
    let milestoneToAnnounce = null;

    if (nextIdx < USER_MILESTONES.length) {
      if (elapsed >= USER_MILESTONES[nextIdx].time) {
        milestoneToAnnounce = USER_MILESTONES[nextIdx];
        milestoneMap.set(userId, nextIdx);
      }
    } else {
      // Past all milestones — repeat last milestone every 7 days
      const lastMs = USER_MILESTONES[USER_MILESTONES.length - 1];
      const repeatCount = currentIdx - USER_MILESTONES.length + 2;
      const nextTime = lastMs.time * (repeatCount + 1);
      if (elapsed >= nextTime) {
        const weeks = repeatCount + 1;
        milestoneToAnnounce = {
          emoji: '🤯',
          message: (name) => `🤯🤯🤯 **${name}** — **${weeks} TUẦN** liên tục trong voice!! KHÔNG THỂ TIN ĐƯỢC!! Bạn đã phá kỷ lục bản thân!! 🐻👑🏆🎆`,
        };
        milestoneMap.set(userId, currentIdx + 1);
      }
    }

    if (quietMode.get(guild.id)) return;
    if (!milestoneToAnnounce) return;

    const reportChannelId = reportChannels.get(guild.id);
    if (!reportChannelId) return;

    try {
      const reportChannel = await guild.channels.fetch(reportChannelId);
      const member = await guild.members.fetch(userId);
      const displayName = member.displayName;
      const msgText = typeof milestoneToAnnounce.message === 'function'
        ? milestoneToAnnounce.message(displayName)
        : milestoneToAnnounce.message;

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`${milestoneToAnnounce.emoji} USER MILESTONE!`)
        .setDescription(msgText)
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: '⏱️ Thời gian trong room', value: formatDuration(elapsed), inline: true }
        )
        .setTimestamp();

      await reportChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Không gửi được user milestone:', err.message);
    }
  }, 30 * 1000); // Check every 30 seconds

  guildIntervals.set(userId, intervalId);
}

/**
 * Stop milestone checker for a specific user
 */
function stopUserMilestoneChecker(guildId, userId) {
  const guildIntervals = userMilestoneIntervals.get(guildId);
  if (guildIntervals) {
    const intervalId = guildIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      guildIntervals.delete(userId);
    }
  }
  const milestoneMap = userReachedMilestones.get(guildId);
  if (milestoneMap) {
    milestoneMap.delete(userId);
  }
}

/**
 * Stop all user milestone checkers for a guild
 */
function stopAllUserMilestoneCheckers(guildId) {
  const guildIntervals = userMilestoneIntervals.get(guildId);
  if (guildIntervals) {
    for (const intervalId of guildIntervals.values()) {
      clearInterval(intervalId);
    }
    guildIntervals.clear();
  }
  const milestoneMap = userReachedMilestones.get(guildId);
  if (milestoneMap) {
    milestoneMap.clear();
  }
}

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
          stopMilestoneChecker(guild.id);
          stopAllUserMilestoneCheckers(guild.id);
          console.log(`🔌 Bị disconnect khỏi voice ở guild ${guild.name}`);
        }
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        joinTimestamps.delete(guild.id);
        stopMilestoneChecker(guild.id);
        stopAllUserMilestoneCheckers(guild.id);
      });

      // Record join time
      joinTimestamps.set(guild.id, Date.now());

      // Start milestone checker
      startMilestoneChecker(guild);

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
          startUserMilestoneChecker(guild, m.id);
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
    stopMilestoneChecker(guild.id);
    stopAllUserMilestoneCheckers(guild.id);

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

  // ========================
  // /notify — Khi bạn vào voice, người được chọn sẽ nhận DM
  // ========================
  if (commandName === 'notify') {
    const targetUser = interaction.options.getUser('user');

    if (targetUser.bot) {
      return interaction.reply({
        content: '❌ Không thể chọn bot làm người nhận thông báo!',
        ephemeral: true,
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Bạn không thể tự thông báo cho chính mình!',
        ephemeral: true,
      });
    }

    if (!dmNotify.has(guild.id)) {
      dmNotify.set(guild.id, new Map());
    }
    const guildNotify = dmNotify.get(guild.id);
    if (!guildNotify.has(interaction.user.id)) {
      guildNotify.set(interaction.user.id, new Set());
    }
    guildNotify.get(interaction.user.id).add(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔔 Đã bật thông báo!')
      .setDescription(`Khi bạn vào voice, **${targetUser.displayName}** sẽ nhận được DM.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ========================
  // /unnotify — Tắt thông báo DM
  // ========================
  if (commandName === 'unnotify') {
    const targetUser = interaction.options.getUser('user');
    const guildNotify = dmNotify.get(guild.id);
    const receivers = guildNotify?.get(interaction.user.id);

    if (!receivers || !receivers.has(targetUser.id)) {
      return interaction.reply({
        content: '❌ Bạn chưa đặt thông báo cho người này!',
        ephemeral: true,
      });
    }

    receivers.delete(targetUser.id);
    if (receivers.size === 0) {
      guildNotify.delete(interaction.user.id);
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔕 Đã tắt thông báo!')
      .setDescription(`**${targetUser.displayName}** sẽ không nhận DM khi bạn vào voice nữa.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ========================
  // /quiet — Tắt/bật thông báo tự động
  // ========================
  if (commandName === 'quiet') {
    const current = quietMode.get(guild.id) || false;
    quietMode.set(guild.id, !current);

    const embed = new EmbedBuilder()
      .setColor(!current ? 0xed4245 : 0x57f287)
      .setTitle(!current ? '🔇 Đã tắt thông báo' : '🔔 Đã bật thông báo')
      .setDescription(!current
        ? 'Bot sẽ không gửi thông báo milestone và ra/vào voice nữa.\nDùng `/quiet` lần nữa để bật lại.'
        : 'Bot sẽ gửi lại thông báo milestone và ra/vào voice bình thường.'
      )
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
  if (!botVoiceChannel) {
    console.log('🔇 voiceStateUpdate: bot không ở voice channel nào');
    return;
  }

  const member = newState.member;
  if (member.user.bot) return; // Ignore bots

  const reportChannelId = reportChannels.get(guild.id);
  if (!reportChannelId) {
    console.log('🔇 voiceStateUpdate: chưa set report channel (chưa dùng /join hoặc /setchannel)');
    return;
  }

  let reportChannel;
  try {
    reportChannel = await guild.channels.fetch(reportChannelId);
  } catch (err) {
    console.error('❌ Không tìm được report channel:', err.message);
    return;
  }

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
    startUserMilestoneChecker(guild, member.id);

    if (!quietMode.get(guild.id)) {
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

    // DM notify: khi người này vào voice, gửi DM cho những người họ đã đặt
    const guildNotify = dmNotify.get(guild.id);
    if (guildNotify) {
      const receivers = guildNotify.get(member.id);
      if (receivers && receivers.size > 0) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🔔 Thông báo voice!')
          .setDescription(`**${member.displayName}** vừa vào **${botVoiceChannel.name}** trong server **${guild.name}**!`)
          .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
          .setTimestamp();

        for (const receiverId of receivers) {
          try {
            const receiver = await client.users.fetch(receiverId);
            await receiver.send({ embeds: [dmEmbed] });
          } catch (err) {
            console.error(`❌ Không gửi được DM cho ${receiverId}:`, err.message);
          }
        }
      }
    }
  }

  // User left bot's voice channel
  if (oldChannel?.id === botVoiceChannel.id && newChannel?.id !== botVoiceChannel.id) {
    const joinTime = guildUserTimes.get(member.id);
    const duration = joinTime ? formatDuration(Date.now() - joinTime) : 'Không rõ';
    guildUserTimes.delete(member.id);
    stopUserMilestoneChecker(guild.id, member.id);

    if (!quietMode.get(guild.id)) {
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
