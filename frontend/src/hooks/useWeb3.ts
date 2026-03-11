import { useState, useEffect } from 'react';
import Web3 from 'web3';

export const useWeb3 = () => {
    const [account, setAccount] = useState<string | null>(null);
    const [web3, setWeb3] = useState<Web3 | null>(null);

    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const w3 = new Web3(window.ethereum);
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setWeb3(w3);
                setAccount(accounts[0]);
            } catch (error) {
                console.error("User denied account access");
            }
        } else {
            console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
        }
    };

    useEffect(() => {
        if (window.ethereum) {
            const w3 = new Web3(window.ethereum);
            setWeb3(w3);
        }
    }, []);

    return { account, web3, connectWallet };
};

declare global {
    interface Window {
        ethereum: any;
    }
}
