import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['websocket'],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    };

    const serverUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
    console.log('Connecting to server:', serverUrl); // Add this line for debugging

    const socket = io(serverUrl, options);


    return new Promise((resolve, reject) => {
        socket.on('connect', () => {
            console.log('Socket connected successfully');
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            reject(error);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });
    });
};