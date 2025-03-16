const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const app = express();

// Maintenance mode configuration
let maintenanceConfig = {
  enabled: false,
  title: 'Under Maintenance',
  message: 'The Weather Bot is currently undergoing maintenance. Service will resume shortly.'
};

// Try to load maintenance config if it exists
try {
  if (fs.existsSync('./maintenance-config.json')) {
    const configData = fs.readFileSync('./maintenance-config.json', 'utf8');
    maintenanceConfig = JSON.parse(configData);
  }
} catch (err) {
  console.error('Error loading maintenance config:', err);
}

// Save maintenance config function
const saveMaintenanceConfig = () => {
  try {
    fs.writeFileSync('./maintenance-config.json', JSON.stringify(maintenanceConfig, null, 2));
  } catch (err) {
    console.error('Error saving maintenance config:', err);
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather for a city')
    .addStringOption(option =>
      option.setName('city')
        .setDescription('The city to get weather for')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('bot-info') // Changed from 'info' to 'bot-info'
    .setDescription('Get bot information'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get a list of available commands')
];

const rest = new REST().setToken("MTM0MzE1MzcwNDE3MzU3MjA5Ng.GzcDS3.sQrM5o1VmOtkBogNYgzkh2wPZYh249wZ7v6IXU");
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands("1343153704173572096"),
      { body: commands },
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

app.use(express.json());
app.use(express.static('public'));

// Middleware to check maintenance mode
app.use((req, res, next) => {
  // Skip maintenance check for admin page and API endpoints
  if (req.path === '/admin' || req.path.startsWith('/api/')) {
    return next();
  }
  
  // Check if maintenance mode is enabled
  if (maintenanceConfig.enabled) {
    return res.sendFile(__dirname + '/public/maintenance.html');
  }
  
  next();
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/weather', (req, res) => {
  res.sendFile(__dirname + '/public/weather.html');
});

app.get('/weather-map', (req, res) => {
  res.sendFile(__dirname + '/public/weather-map.html');
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

app.get('/maintenance', (req, res) => {
  res.sendFile(__dirname + '/public/maintenance.html');
});

// Maintenance mode API endpoints
app.get('/api/maintenance', (req, res) => {
  res.json({
    success: true,
    ...maintenanceConfig
  });
});

app.post('/api/maintenance', express.json(), (req, res) => {
  try {
    console.log('Received maintenance update:', req.body);
    
    if (req.body && typeof req.body.enabled !== 'undefined') {
      maintenanceConfig.enabled = req.body.enabled;
      
      if (req.body.title) {
        maintenanceConfig.title = req.body.title;
      }
      
      if (req.body.message) {
        maintenanceConfig.message = req.body.message;
      }
      
      saveMaintenanceConfig();
      console.log('Updated maintenance config:', maintenanceConfig);
      
      res.json({ 
        success: true,
        ...maintenanceConfig 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid request body' 
      });
    }
  } catch (error) {
    console.error('Error updating maintenance settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error updating maintenance settings' 
    });
  }
});

app.post('/api/restart-bot', (req, res) => {
  // In a production environment, you'd implement actual restart logic
  // For now, we'll just simulate a restart response
  res.json({ success: true });
});

app.get('/api/weather/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=07ea72e9a847f12102e9d30f3b9b1a61&units=metric`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  // Check maintenance mode first
  if (maintenanceConfig.enabled) {
    const maintenanceEmbed = new EmbedBuilder()
      .setTitle(maintenanceConfig.title)
      .setDescription(maintenanceConfig.message)
      .setColor('#e74c3c') // Red color for maintenance
      .setTimestamp();

    await interaction.reply({ embeds: [maintenanceEmbed], ephemeral: true });
    return;
  }

  if (interaction.commandName === 'weather') {
    const city = interaction.options.getString('city');
    try {
      const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=07ea72e9a847f12102e9d30f3b9b1a61&units=metric`);
      const weather = response.data;

      const embed = new EmbedBuilder()
        .setTitle(`Weather in ${city}`)
        .setDescription(`${weather.weather[0].description}`)
        .addFields(
          { name: '🌡 Temperature', value: `${weather.main.temp}°C`, inline: true },
          { name: '💧 Humidity', value: `${weather.main.humidity}%`, inline: true },
          { name: '🌬 Wind Speed', value: `${weather.wind.speed} m/s`, inline: true }
        )
        .setColor('#00A2E8')
        .setThumbnail(`http://openweathermap.org/img/wn/${weather.weather[0].icon}.png`);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply('Failed to fetch weather data');
    }
  } else if (interaction.commandName === 'bot-info') {
    const embed = new EmbedBuilder()
      .setTitle('Bot Information')
      .setDescription('This is a weather bot that provides real-time weather updates.')
      .addFields(
        { name: 'Developer', value: 'Robloxbot Inc, Software Developers', inline: true },
        { name: 'Version', value: '1.0.1', inline: true }
      )
      .setColor('#00A2E8');

    await interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('Help - Available Commands')
      .setDescription('List of commands you can use:')
      .addFields(
        { name: '/weather <city>', value: 'Get weather for a specific city' },
        { name: '/bot-info', value: 'Get bot information' },
        { name: '/help', value: 'Show this help message' }
      )
      .setColor('#00A2E8');

    await interaction.reply({ embeds: [embed] });
  }
});

const PORT = 9001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

client.login("MTM0MzE1MzcwNDE3MzU3MjA5Ng.GzcDS3.sQrM5o1VmOtkBogNYgzkh2wPZYh249wZ7v6IXU");
