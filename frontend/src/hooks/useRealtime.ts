import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useRealtime = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [data, setData] = useState<any>(null);
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        const s = io('http://localhost:5000');
        setSocket(s);

        s.on('trust_update', (payload: any) => {
            setData(payload.nodes);
            if (payload.alerts.length > 0) {
                setAlerts(prev => [...payload.alerts, ...prev].slice(0, 50));
            }
        });

        return () => {
            s.disconnect();
        };
    }, []);

    return { data, alerts, socket };
};
