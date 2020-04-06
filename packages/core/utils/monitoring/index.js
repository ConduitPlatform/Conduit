const appmetrics = require('appmetrics-dash');

/**
 * Starts the monitoring agent
 * Currently it starts appmetrics, we should also support other APM providers (i guess)
 */
function monitoring() {
    appmetrics.attach();
}

module.exports = {
    monitoring
};
