const Moment = require('moment');

const RateConst = {
    NO_LIMIT: 'NO_LIMIT',
    DEFAULT: 'DEFAULT',
    STATS_TOP: 'stat_top',
    STATS_SELF: 'stat_self',
    WHEN_USER: 'when_user',
    ACTION_LIKE: 'action_like',
    GAY_START: 'gay_start',
};

const RateLimitMap = new Map([
    [RateConst.NO_LIMIT, 100],
    [RateConst.DEFAULT, 5000],
    [RateConst.STATS_TOP, 10000],
    [RateConst.STATS_SELF, 10000],
    [RateConst.WHEN_USER, 5000],
    [RateConst.ACTION_LIKE, 60000],
    [RateConst.GAY_START, 60000],
]);

class RateLimit {
    constructor() {
        this.lastUsed = new Map();
    }

    tryStart(limitName = 'default') {
        const currentLimit = this.lastUsed.get(limitName);

        if (currentLimit && (Moment() - currentLimit < RateLimitMap.get(limitName))) {
            return false;
        }

        this.lastUsed.set(limitName, Moment());
        return true;
    }
}

module.exports = {
    RateLimit,
    RateConst,
};
