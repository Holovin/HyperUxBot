const Sequelize = require('sequelize');

module.exports = function (sequelize) {
    const User = sequelize.define('user', {
        user_id: {
            type: Sequelize.INTEGER,
            primaryKey: true
        },

        user_login: Sequelize.STRING,

        user_name: Sequelize.STRING,

        total: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        total_len: {
            type: Sequelize.INTEGER,
            defaultValue: 1,
        },

        audio: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        document: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        photo: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        sticker: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        voice: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        video: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },

        other: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },
    });

    const UserGay = sequelize.define('user_gay', {
        total: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },
    }, {
        underscored: true
    });

    return {
        User,
        UserGay,
    }
};
