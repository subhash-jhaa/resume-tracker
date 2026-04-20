import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;

// Preserve connection across hot-reloads in development
declare global { var mongoosePromise: Promise<typeof mongoose> | null; }

export default async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error('⚠️ MONGODB_URI not found in environment variables');
  }

  // If already connected, reuse the connection
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If a connection is in progress, wait for it
  if (!global.mongoosePromise) {
    global.mongoosePromise = mongoose.connect(MONGODB_URI).then((m) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ MongoDB connected');
      }
      return m;
    });
  }

  return global.mongoosePromise;
}