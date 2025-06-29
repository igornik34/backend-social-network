import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
    // Очищаем базу данных (осторожно в продакшене!)
    await prisma.$transaction([
        prisma.notification.deleteMany(),
        prisma.message.deleteMany(),
        prisma.chat.deleteMany(),
        prisma.repost.deleteMany(),
        prisma.like.deleteMany(),
        prisma.comment.deleteMany(),
        prisma.post.deleteMany(),
        prisma.follow.deleteMany(),
        prisma.user.deleteMany(),
    ]);

    // 1. Создаем пользователей
    const users = [];
    for (let i = 0; i < 20; i++) {
        const user = await prisma.user.create({
            data: {
                email: faker.internet.email(),
                password: faker.internet.password(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                bio: faker.lorem.sentence(),
                avatar: faker.image.avatar(),
                online: faker.datatype.boolean(),
                lastseen: faker.date.recent(),
            },
        });
        users.push(user);
    }

    // 2. Создаем подписки между пользователями
    for (const user of users) {
        const followingCount = faker.number.int({ min: 1, max: 5 });
        const following = faker.helpers.arrayElements(users, followingCount).filter(u => u.id !== user.id);

        for (const followUser of following) {
            await prisma.follow.create({
                data: {
                    followerId: user.id,
                    followingId: followUser.id,
                },
            });
        }
    }

    // 3. Создаем посты
    const posts = [];
    for (const user of users) {
        const postCount = faker.number.int({ min: 1, max: 5 });
        for (let i = 0; i < postCount; i++) {
            const post = await prisma.post.create({
                data: {
                    content: faker.lorem.paragraph(),
                    images: Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, () => faker.image.url()),
                    authorId: user.id,
                },
            });
            posts.push(post);
        }
    }

    // 4. Создаем комментарии к постам
    for (const post of posts) {
        const commentCount = faker.number.int({ min: 0, max: 5 });
        for (let i = 0; i < commentCount; i++) {
            const comment = await prisma.comment.create({
                data: {
                    content: faker.lorem.sentence(),
                    authorId: faker.helpers.arrayElement(users).id,
                    postId: post.id,
                    editable: faker.datatype.boolean(),
                },
            });

            // 5. Создаем ответы на комментарии
            if (faker.datatype.boolean()) {
                await prisma.comment.create({
                    data: {
                        content: faker.lorem.sentence(),
                        authorId: faker.helpers.arrayElement(users).id,
                        postId: post.id,
                        parentId: comment.id,
                        editable: faker.datatype.boolean(),
                    },
                });
            }
        }
    }

    // 6. Создаем лайки
    for (const post of posts) {
        const likeCount = faker.number.int({ min: 0, max: 10 });
        const likers = faker.helpers.arrayElements(users, likeCount);

        for (const liker of likers) {
            await prisma.like.create({
                data: {
                    userId: liker.id,
                    postId: post.id,
                },
            });
        }
    }

    // 7. Создаем репосты
    for (const post of posts) {
        if (faker.datatype.boolean(0.3)) { // 30% chance to repost
            await prisma.repost.create({
                data: {
                    userId: faker.helpers.arrayElement(users).id,
                    postId: post.id,
                },
            });
        }
    }

    // 8. Создаем чаты и сообщения
    for (let i = 0; i < 10; i++) {
        const participants = faker.helpers.arrayElements(users, 2);
        const chat = await prisma.chat.create({
            data: {
                participants: {
                    connect: participants.map(p => ({ id: p.id })),
                },
            },
        });

        // Создаем сообщения в чате
        const messageCount = faker.number.int({ min: 1, max: 20 });
        for (let j = 0; j < messageCount; j++) {
            const sender = faker.helpers.arrayElement(participants);
            await prisma.message.create({
                data: {
                    content: faker.lorem.sentence(),
                    senderId: sender.id,
                    recipientId: participants.find(p => p.id !== sender.id)!.id,
                    chatId: chat.id,
                    read: faker.datatype.boolean(),
                    reactions: faker.datatype.boolean() ?
                        [faker.helpers.arrayElement(['👍', '❤️', '😂', '😮', '😢'])] : [],
                    attachments: faker.datatype.boolean() ?
                        [faker.image.url()] : [],
                },
            });
        }
    }

    // 9. Создаем уведомления
    for (const user of users) {
        const notificationCount = faker.number.int({ min: 0, max: 5 });
        for (let i = 0; i < notificationCount; i++) {
            await prisma.notification.create({
                data: {
                    userId: faker.helpers.arrayElement(users).id,
                    recipientId: user.id,
                    type: faker.helpers.arrayElement([
                        'NEW_FOLLOWER',
                        'POST_LIKE',
                        'COMMENT_LIKE',
                        'NEW_COMMENT',
                        'COMMENT_REPLY',
                        'NEW_MESSAGE',
                        'CHAT_INVITE',
                        'SYSTEM',
                    ]),
                    read: faker.datatype.boolean(),
                    metadata: {},
                },
            });
        }
    }

    console.log('Тестовые данные успешно созданы!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });