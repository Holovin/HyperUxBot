// const-settings
const USERS_TOP = 5;

// req
const debug = require('debug')('hyperux:index');
const dotenv = require('dotenv').config();

const Sequelize = require('sequelize');

const Telegraf = require('telegraf');
const Session = require('telegraf/session');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

// helpers
const RateLimit = require('./helpers/rateLimit').RateLimit;
const RateConst = require('./helpers/rateLimit').RateConst;
const Moment = require('moment');
const getUserDisplayName = require('./helpers/getUserDisplayName');
const markdownEscape = require('./helpers/markdownEscape');

// db
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,

    dialect: 'mysql',
    logging: require('debug')('db'),

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    operatorsAliases: false
});

const models = require('./db/models')(sequelize);

models.UserGay.belongsTo(models.User);

sequelize.sync({force: false}).then(bot_ready);


function bot_ready() {
    // INIT BLOCK
    const settings = require('./settings');
    const bot = new Telegraf(process.env.BOT_TOKEN);

    bot.telegram.getMe().then((botInfo) => {
        bot.options.username = botInfo.username
    });

    // ru-ru
    Moment.locale('ru');

    // Session
    bot.use(Session());

    // Init
    bot.drop(async (request) => {
        debug(`[INCOMING] req.chat = ${request.chat.id}, req.from = ${JSON.stringify(request.from)}`);

        // Chat lock - if FALSE then message don't processed
        if (request.chat.id !== +process.env.BOT_CHAT_ID) {
            debug(`Wrong chat id ${request.chat.id} !== ${process.env.BOT_CHAT_ID}`);
            request.leaveChat();
            return true;
        }

        // Enable freq limiter
        if (!request.session.limit) {
            request.session.limit = new RateLimit();
        }

        if (!request.session.user) {
            const [user] = await models.User
                .findOrCreate({
                    where: {
                        user_id: request.from.id
                    },
                    defaults: {
                        user_id: request.from.id,
                        user_login: request.from.username,
                        user_name: getUserDisplayName(request),
                    }
                });

            request.session.user = user;
        }

        return false;
    });

    // HELPERS //
    async function getLikeKeyboard() {
        let setting = await models.User.findOne({ where: {user_id: -1} });

        if (!setting) {
            setting = {total: 0};
        }

        return Markup
            .resize(false)
            .inlineKeyboard([
                Markup.callbackButton(`❤️ ${setting.total}`, 'like'),
                Markup.urlButton('by UxBots', 'https://t.me/uxbots'),
            ]);
    }


    // COMMANDS //

    // Stat :: Top
    bot.command('stat_compot', async (request) => {
        if (!request.session.limit.tryStart(RateConst.STATS_TOP)) {
            return;
        }

        const users = await models.User.findAll({
            where: {
                user_id: { [Sequelize.Op.ne]: -1 },
            },

            order: [ ['total', 'DESC'] ],
        });

        // Count rating
        const newUsers = users.map(user => {
            user.rating = Math.round(user.total_len / user.total);

            return user;
        });

        // Prepare answer
        const lines = [`*hyperUxStats top* ${Moment().format('(DD/MM/YYYY hh:mm:ss)')}`];

        // Sort users
        newUsers
            .sort((one, two) => {
                return two.rating - one.rating;
            })
            .slice(0, USERS_TOP)
            .forEach((user, index) => {
                lines.push(`${index + 1}. ${user.user_name.slice(0, settings.MAX_NAME_LEN)}` +
                           ` = ${user.rating} (сбщ: ${user.total}, сткр: ${user.sticker}, вйсв: ${user.voice})`);
            });

        // Like counter
        const keyboard = await getLikeKeyboard();
        await request.reply(lines.join('\n'), Extra.markup(keyboard).markdown(true));
    });

    // Stat :: single user
    bot.command('stat_lichno', async (request) => {
        if (!request.session.limit.tryStart(RateConst.STATS_SELF)) {
            return;
        }

        const user = request.session.user;

        if (!user.rating) {
            user.rating = Math.round(user.total_len / user.total);
        }

        const answer = `Ваш рейтинг = ${user.rating} (сбщ: ${user.total}, сткр: ${user.sticker}, вйсв: ${user.voice})`;
        await request.reply(answer, Extra.inReplyTo(request.update.message.message_id));
    });

    // When :: user
    bot.command('when', async (request) => {
        if (!request.session.limit.tryStart(RateConst.WHEN_USER)) {
            return;
        }

        const [, findUsername] = request.message.text.split(' ');

        if (!findUsername) {
            const answer = '\u{1F46E} Пустой ник. Для использования команды пишите: \n`/when имя_пользователя`';
            await request.reply(answer, Extra.inReplyTo(request.update.message.message_id).markdown(true));

            return;
        }

        const resultUser = await models.User.findOne({
            where: { user_login: findUsername },
        });

        if (!resultUser) {
            const answer = `\u{1F46E} Нет записей по юзеру *${findUsername}*`;
            await request.reply(answer, Extra.inReplyTo(request.update.message.message_id));

            return;
        }

        const answer = `\u{1F46E} *${markdownEscape(findUsername)}* был последний раз: ${Moment(resultUser.updatedAt).fromNow()}`;
        await request.reply(answer, Extra
            .markdown(true)
            .inReplyTo(request.update.message.message_id));
    });

    // Gay :: reg
    bot.command(['gay', 'gay_start'], async (request) => {
        if (!request.session.limit.tryStart(RateConst.DEFAULT)) {
            return;
        }

        const [user, created] = await models.UserGay
            .findOrCreate({
                where: {user_user_id: request.from.id},
                defaults: {user_user_id: request.from.id},
            });

        let answer = '';

        if (user && created) {
            answer = `\u{1F44D} Заявка принята!`;

        } else {
            answer = `\u{1F44D} Вы уже в игре`;
        }

        await request.reply(answer, Extra.inReplyTo(request.update.message.message_id));
    });

    // Gay :: stop
    bot.command('gay_stop', async (request) => {
        if (!request.session.limit.tryStart(RateConst.DEFAULT)) {
            return;
        }

        const user = await models.UserGay.findOne({ where: {user_user_id: request.from.id} });

        let answer = '';

        if (!user) {
            answer = `\u{1F44E} Вы не играли в игру`;

        } else {
            answer = `\u{1F44E} Вы удалены из списка игры`;
            await user.destroy();
        }

        await request.reply(answer, Extra.inReplyTo(request.update.message.message_id));
    });

    // Greet'er
    bot.on('new_chat_members', async (request) => {
        const newUsers = request.update.message.new_chat_members;

        if (!newUsers) {
            return;
        }

        const usersStr = [];

        newUsers.forEach(user => {
            usersStr.push(user.username);
        });

        const answer = `\u{1F195} Welcome back *${markdownEscape(usersStr.join(', '))}*!`;
        await request.reply(answer, Extra.markdown(true));
    });

    // Bye'er
    bot.on('left_chat_member', async (request) => {
        const leftUser = request.update.message.left_chat_member;

        if (!leftUser) {
            return;
        }

        const user = await models.User.findOne({
            where: {user_id: leftUser.id},
        });

        const userGay = await models.UserGay.findOne({
            where: {user_user_id: leftUser.id},
        });

        if (user) {
            await user.destroy();
        }


        if (userGay) {
            await userGay.destroy();
        }

        const answer = `\u{1F480} Прощай, *${markdownEscape(leftUser.username)}* /rip`;
        await request.reply(answer, Extra.markdown(true));
    });

    // Update stats
    bot.on('message', async (request) => {
        const userNameDisplay = getUserDisplayName(request);
        const user = request.session.user;

        // Update msg size
        if (request.message.text) {
            user.total_len += request.message.text.length;

        } else {
            user.total_len++;
        }

        // Update stat counter
        request.updateSubTypes.forEach((subType) => {
            if (subType in user) {
                user[subType]++;

            } else {
                user.other++;
            }
        });

        // Warn if user change display name
        if (user.user_name !== userNameDisplay) {
            const answer = `\u{1F575} Пользователь *${markdownEscape(request.from.username)}* сменил имя` +
                `[${markdownEscape(user.user_name)}] >>> [${markdownEscape(userNameDisplay)}]\n#hyperux`;

            await request.reply(answer, Extra.markdown(true));
            user.user_name = userNameDisplay;
        }

        // Warn if user change login name
        if (user.user_login !== request.from.username) {
            const answer = `\u{1F575} Пользователь *${markdownEscape(user.user_login)} сменил имя на` +
                `${markdownEscape(request.from.username)}\n#hyperux`;

            await request.reply(answer, Extra.markdown(true));
            user.user_login = request.from.username;
        }

        user.total++;
        await user.save();
    });


    // ACTIONS //

    // Button :: Like
    bot.action('like', async (request) => {
        if (!request.session.limit.tryStart(RateConst.ACTION_LIKE)) {
            await request.answerCbQuery('No more bratishka for 60 seconds...', false);
            return;
        }

        // Answer to user
        await request.answerCbQuery('/bratishka', false);

        // Update data
        const [likeRecord] = await models.User.findOrCreate({
            where: {user_id: -1},
            defaults: {user_id: -1}
        });

        likeRecord.total++;
        await likeRecord.save();

        // update keyboard
        const keyboard = await getLikeKeyboard();
        await request.editMessageReplyMarkup(keyboard);
    });

    // Gay timer
    let lastTrigger = Moment();
    const checkFreq = 60000;

    async function checkTriggers() {
        debug('Run check...');

        const diff = Moment.duration(Moment().diff(lastTrigger)).asHours();

        // TODO
        if (diff > 1 && Moment().hours() === 13) {
            lastTrigger = Moment();

            const [user] = await models.UserGay.findAll({
                include: [{
                    model: models.User,
                    attributes: ['user_name', 'user_id'],
                }],

                order: [
                    [Sequelize.fn('RAND')],
                ],

                limit: 1,
            });

            if (!user) {
                return false;
            }

            const answer = `\u{1F60D} *Пидор дня:* [${markdownEscape(user.user.user_name)}](tg://user?id=${user.user.user_id})`;
            await bot.telegram.sendMessage(process.env.BOT_CHAT_ID, answer, Extra.markdown(true));
        }

        setTimeout(checkTriggers, checkFreq);
    }

    setTimeout(checkTriggers, checkFreq);

    // Webhook
    bot.telegram.setWebhook(process.env.WEBHOOK_URL);
    bot.startWebhook('/', null, 3002);

    // Error handling
    bot.catch((err) => {
        debug('[ERROR]', err);
    });

    debug('Loaded...');
}