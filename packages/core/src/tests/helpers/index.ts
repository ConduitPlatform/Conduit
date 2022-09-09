const { exec } = require('child_process');
const path = require('path');

async function setup() {
  process.env = {
    ...process.env,
    REDIS_HOST: '6379',
    REDIS_PORT: 'localhost',
    ADMIN_SOCKET_PORT: '3032',
    PORT: '3030',
  };
  const current_path = path.join(__dirname, '..', 'scripts', '/setup.sh');
  try {
    return exec('sh ' + current_path, { cwd: './' });
  } catch (e) {
    console.log(e);
  }
}

module.exports = { setup };
