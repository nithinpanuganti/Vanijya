const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

async function start() {
  const dbPath = path.resolve(__dirname, '../.mongo-data');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  console.log('🍃 Starting local standalone MongoDB instance on port 27017...');
  try {
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'vanijya',
        dbPath: dbPath,
        storageEngine: 'wiredTiger',
      },
    });

    console.log('✅ Local MongoDB instance is running on port 27017.');
    console.log('🔗 Connection URI: mongodb://127.0.0.1:27017/vanijya');
    console.log(`📁 Persistence directory: ${dbPath}`);
    console.log('Press Ctrl+C to stop the MongoDB service.\n');

    process.on('SIGINT', async () => {
      console.log('\nStopping local MongoDB instance...');
      await mongod.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nStopping local MongoDB instance...');
      await mongod.stop();
      process.exit(0);
    });
  } catch (err) {
    if (err.message && err.message.includes('EADDRINUSE')) {
      console.log('ℹ️ MongoDB is already running on port 27017.');
    } else {
      console.error('❌ Failed to start local MongoDB:', err.message);
      process.exit(1);
    }
  }
}

start();
