import { PrismaClient } from '@prisma/client';
import { randomInt } from 'crypto';

const prisma = new PrismaClient();

async function generateFollows() {
    // First, let's get all user IDs from the database
    const users = await prisma.user.findMany({
        select: { id: true },
    });

    if (users.length < 2) {
        console.error('Need at least 2 users in the database to create follow relationships');
        return;
    }

    const userIds = users.map(user => user.id);
    const totalUsers = userIds.length;
    const followsToCreate = 10000;
    const existingFollows = new Set<string>();

    console.log(`Generating ${followsToCreate} follow relationships among ${totalUsers} users...`);

    let createdCount = 0;

    while (createdCount < followsToCreate) {
        // Randomly select two different users
        const followerIndex = randomInt(0, totalUsers);
        const followingIndex = randomInt(0, totalUsers - 1);

        // Ensure we don't have the same user following themselves
        if (followerIndex === followingIndex) continue;

        const followerId = userIds[followerIndex];
        const followingId = userIds[followingIndex];

        // Create a unique key for this follow relationship
        const followKey = `${followerId}-${followingId}`;

        // Skip if this relationship already exists (in our Set or in the database)
        if (existingFollows.has(followKey)) continue;

        try {
            await prisma.follow.create({
                data: {
                    followerId,
                    followingId,
                },
            });

            existingFollows.add(followKey);
            createdCount++;

            // Log progress every 1000 records
            if (createdCount % 1000 === 0) {
                console.log(`Created ${createdCount} follow relationships...`);
            }
        } catch (error) {
            // This will catch unique constraint violations if the relationship already exists in DB
            continue;
        }
    }

    console.log(`Successfully created ${createdCount} follow relationships!`);
}

generateFollows()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });