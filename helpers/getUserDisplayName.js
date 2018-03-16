module.exports = function (request) {
    return (request.from.first_name ? request.from.first_name : '') +
        (request.from.last_name ? request.from.last_name : '');
};
