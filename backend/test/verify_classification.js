async function verifyClassification() {
  const baseURL = 'http://localhost:4000/api';
  
  try {
    console.log('Fetching nodes to verify classification...');
    const resp = await fetch(`${baseURL}/nodes`);
    const data = await resp.json();
    const nodes = data.nodes || [];

    console.log(`Verifying ${nodes.length} nodes...`);
    
    // We can't easily check the frontend logic from here, 
    // but we can check the backend /api/trust-scores which should follow the same pattern
    const tsResp = await fetch(`${baseURL}/trust-scores`);
    const tsData = await tsResp.json();

    console.log('--- Backend Trust Classification Check ---');
    tsData.forEach(n => {
       const score = n.trustScore; // 0-1.0
       const status = n.status;
       const expected = score >= 0.7 ? 'trusted' : score >= 0.4 ? 'suspicious' : 'malicious';
       
       if (status === expected) {
         console.log(`✅ ${n.nodeId}: Score ${score} -> Status ${status} (Correct)`);
       } else {
         console.error(`❌ ${n.nodeId}: Score ${score} -> Status ${status} (Expected ${expected})`);
       }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

verifyClassification();
