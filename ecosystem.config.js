module.exports = {
  apps: [
    {
      name: 'expo-dev',
      script: 'node_modules/.bin/expo',
      args: 'start --host lan --port 8081 --non-interactive',
      cwd: '/home/user/platforma_frontend',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        EXPO_NO_DOCTOR: '1',
      },
    },
  ],
};
