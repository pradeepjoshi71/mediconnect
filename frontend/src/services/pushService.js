import apiClient from './apiClient';

const pushService = {
  async registerToken(fcmToken, platform = 'web') {
    const response = await apiClient.post('/push/register', { fcmToken, platform });
    return response.data;
  },

  async deregisterToken(fcmToken) {
    const response = await apiClient.post('/push/deregister', { fcmToken });
    return response.data;
  },
};

export default pushService;
