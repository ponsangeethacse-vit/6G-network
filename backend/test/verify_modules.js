const http = require('http');

const BASE_URL = 'http://localhost:4000/api/admin';

function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}${path}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Status: ${res.statusCode}, Body: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('--- 🧪 Verifying Node Management & Transfer Modules ---');

    try {
        // 1. Create Nodes
        console.log('\n1. Creating Sender and Receiver Nodes...');
        const sender = await request('/nodes', 'POST', {
             nodeId: 'TEST_NODE_SENDER',
             type: 'IoT',
             senderAddress: '0x123',
             receiverAddress: '0x456',
             trustScore: 0.8,
             status: 'Normal'
        });
        console.log('✅ Created Sender:', sender.nodeId);

        const receiver = await request('/nodes', 'POST', {
             nodeId: 'TEST_NODE_RECEIVER',
             type: 'Edge',
             senderAddress: '0x456',
             receiverAddress: '0x789',
             trustScore: 0.9,
             status: 'Normal'
        });
        console.log('✅ Created Receiver:', receiver.nodeId);

        // 2. Update Node
        console.log('\n2. Updating Node Trust Score...');
        const updatedSender = await request(`/nodes/${sender.nodeId}`, 'PUT', {
             trustScore: 0.75
        });
        console.log('✅ Updated Sender Trust:', updatedSender.trustScore);

        // 3. Execute Transfer
        console.log('\n3. Executing Transfer...');
        const transfer = await request('/transfers', 'POST', {
             senderNodeId: 'TEST_NODE_SENDER',
             receiverNodeId: 'TEST_NODE_RECEIVER',
             data: 'Secure Communication Packet 1',
             behavior: 'Normal'
        });
        console.log('✅ Transfer Recorded. Status:', transfer.status);
        console.log('   New Trust Score:', transfer.updatedTrustScore);

        // 4. View Node Activity
        console.log('\n4. Viewing Node Activity...');
        const activity = await request(`/nodes/${sender.nodeId}/activity`);
        console.log(`✅ Activity items: ${activity.length}`);
        console.log('Latest Action:', activity[activity.length - 1].action);

        console.log('\n🎉 All Module Verifications Passed!');

    } catch (err) {
        console.error('\n❌ Verification failed:', err.message);
    }
}

runTests();
