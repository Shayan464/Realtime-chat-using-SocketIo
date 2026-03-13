import axios from 'axios';

export const axiosInstance = axios.create({
  baseURL:
    import.meta.env.MODE === 'production'
      ? 'https://realtime-chat-using-socketio.onrender.com'
      : '/api',
  withCredentials: true,
});
