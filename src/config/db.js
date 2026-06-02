import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  }
  if (uri.includes('<db_password>')) {
    throw new Error(
      'MONGODB_URI still contains the <db_password> placeholder. ' +
        'Edit backend/.env and replace <db_password> with your real Atlas password.'
    );
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
}
