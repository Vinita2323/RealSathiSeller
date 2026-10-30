import mongoose from 'mongoose';

let isConnected = false;
let reconnectTimeout = null;
let indexesSynced = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB connection string/environment variable (MONGODB_URI) is missing.');
    return;
  }

  try {
    mongoose.set('autoIndex', false);

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: 4,
      retryWrites: true,
      w: 'majority',
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host} [DB: ${conn.connection.name}] (Pool: 5-50)`);

    // Always sync indexes in production so a fresh deploy never silently runs
    // without them (createIndexes() is non-blocking/non-destructive and only
    // builds what's missing). In local dev this stays opt-in via the env flag
    // to avoid re-syncing on every nodemon reload.
    const shouldSyncIndexes = process.env.NODE_ENV === 'production' || process.env.SYNC_INDEXES_ON_STARTUP === 'true';
    if (!indexesSynced && shouldSyncIndexes) {
      indexesSynced = true;
      import('../scripts/syncIndexes.js')
        .then((m) => m.syncAllIndexes())
        .catch((e) => console.warn('[DB] Background index sync notice:', e.message));
    }

    return conn;
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}. Retrying in 3s...`);
    isConnected = false;
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connectDB();
      }, 3000);
    }
  }
};

// Global Connection Event Listeners
mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB Error]', err.message);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB Disconnected] Socket connection lost. Auto-reconnecting...');
  isConnected = false;
  if (!reconnectTimeout) {
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectDB();
    }, 2000);
  }
});

export default connectDB;
