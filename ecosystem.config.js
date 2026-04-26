module.exports = {
  apps: [
    {
      name: 'expo-dev',
      script: 'node',
      args: '/opt/platforma_frontend/node_modules/.bin/expo start --host lan --port 8081',
      cwd: '/opt/platforma_frontend',
      env: {
        NODE_ENV: 'development',
        EXPO_NO_DOCTOR: '1',
        CI: '1',
      },
    },
  ],
};