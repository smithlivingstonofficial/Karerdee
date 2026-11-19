const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '../admin-web/.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k) env[k] = v.join('=').replace(/^"|"$/g, '');
});

async function ensureBucket() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(`${url}/storage/v1/bucket`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  const buckets = await res.json();
  console.log('Buckets list:', buckets);

  const exists = Array.isArray(buckets) && buckets.some(b => b.id === 'exam-violations' || b.name === 'exam-violations');
  if (!exists) {
    console.log('Creating exam-violations bucket...');
    const createRes = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 'exam-violations',
        name: 'exam-violations',
        public: true,
        file_size_limit: 5242880, // 5MB limit
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp']
      })
    });
    console.log('Create result:', await createRes.json());
  } else {
    console.log('exam-violations bucket already exists!');
  }
}

ensureBucket().catch(console.error);
