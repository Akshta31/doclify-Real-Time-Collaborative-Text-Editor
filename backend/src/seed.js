require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Document = require('./models/Document');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/doclify');
  console.log('Connected to MongoDB...');

  // Clean up
  await User.deleteMany({});
  await Document.deleteMany({});

  // Create users
  const alice = await User.create({
    name: 'Alice Johnson',
    email: 'alice@doclify.app',
    password: 'password123',
    color: '#7c6af7',
  });
  const bob = await User.create({
    name: 'Bob Smith',
    email: 'bob@doclify.app',
    password: 'password123',
    color: '#3dd68c',
  });
  const sara = await User.create({
    name: 'Sara Kim',
    email: 'sara@doclify.app',
    password: 'password123',
    color: '#f59e0b',
  });

  // Create documents
  await Document.create([
    {
      title: 'Welcome to Doclify ✦',
      emoji: '✦',
      owner: alice._id,
      content: `<h1>Welcome to Doclify ✦</h1><p>Doclify is a <strong>real-time collaborative document editor</strong> built for teams.</p><h2>Features</h2><ul><li>Real-time collaboration</li><li>Version history</li><li>Dark &amp; Light theme</li></ul>`,
      collaborators: [
        { user: bob._id, role: 'editor' },
        { user: sara._id, role: 'viewer' },
      ],
      wordCount: 28,
    },
    {
      title: 'Project Roadmap Q3',
      emoji: '📊',
      owner: alice._id,
      content: '<h1>Q3 Roadmap</h1><p>Key milestones for Q3 2026...</p>',
      collaborators: [{ user: bob._id, role: 'editor' }],
      wordCount: 10,
    },
    {
      title: 'Meeting Notes — April',
      emoji: '🗓',
      owner: bob._id,
      content: '<h1>April Meeting Notes</h1><p>Attendees: Alice, Bob, Sara...</p>',
      collaborators: [{ user: alice._id, role: 'editor' }],
      wordCount: 8,
    },
  ]);

  console.log('✅ Seed complete!');
  console.log('\nDemo accounts:');
  console.log('  alice@doclify.app / password123');
  console.log('  bob@doclify.app   / password123');
  console.log('  sara@doclify.app  / password123\n');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
