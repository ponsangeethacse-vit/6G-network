import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const getNodes = () => axios.get(`${API_URL}/nodes`);
export const simulateNodes = () => axios.post(`${API_URL}/nodes/simulate`);
export const getBlockchain = () => axios.get(`${API_URL}/blockchain`);
export const simulateAttack = (type: string) => axios.post(`${API_URL}/attacks/simulate`, { type });
export const getTrustDetails = (nodeId: string) => axios.get(`${API_URL}/trust/${nodeId}`);
